import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface UserToMigrate {
  id: string;
  email: string;
  encrypted_password: string | null;
  email_confirmed_at: string;
  raw_app_meta_data: any;
  raw_user_meta_data: any;
  created_at: string;
  updated_at: string;
  last_sign_in_at: string | null;
  profile: {
    first_name: string;
    last_name: string;
    avatar_url: string | null;
    oab: string | null;
    phone: string | null;
    phone_country_code: string;
    city: string | null;
    state: string | null;
    is_admin: boolean;
    theme_preference: string;
    terms_accepted_at: string;
    email: string;
  };
}

interface MigrationProgress {
  user_email: string;
  auth_created: boolean;
  profile_created: boolean;
  error?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: adminUser }, error: adminError } = await supabase.auth.getUser(token);

    if (adminError || !adminUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: adminProfile } = await supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('id', adminUser.id)
      .maybeSingle();

    if (!adminProfile?.is_admin) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { users } = await req.json() as { users: UserToMigrate[] };

    if (!users || !Array.isArray(users) || users.length === 0) {
      return new Response(
        JSON.stringify({ error: 'users array is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const progress: MigrationProgress[] = [];

    for (const user of users) {
      const userProgress: MigrationProgress = {
        user_email: user.email,
        auth_created: false,
        profile_created: false,
      };

      try {
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
          email: user.email,
          password: user.encrypted_password ? undefined : Math.random().toString(36),
          email_confirm: true,
          user_metadata: user.raw_user_meta_data,
          app_metadata: user.raw_app_meta_data,
        });

        if (authError) {
          if (authError.message.includes('already registered')) {
            const { data: existingUser } = await supabase.auth.admin.getUserById(user.id);
            if (existingUser) {
              userProgress.auth_created = true;
            } else {
              throw authError;
            }
          } else {
            throw authError;
          }
        } else {
          userProgress.auth_created = true;

          if (user.encrypted_password) {
            await supabase.auth.admin.updateUserById(
              authUser.user.id,
              {
                password: user.encrypted_password,
              }
            );
          }
        }

        const { error: profileError } = await supabase
          .from('user_profiles')
          .upsert({
            id: authUser?.user.id || user.id,
            first_name: user.profile.first_name,
            last_name: user.profile.last_name,
            avatar_url: user.profile.avatar_url,
            oab: user.profile.oab,
            phone: user.profile.phone,
            phone_country_code: user.profile.phone_country_code,
            city: user.profile.city,
            state: user.profile.state,
            is_admin: user.profile.is_admin,
            theme_preference: user.profile.theme_preference,
            terms_accepted_at: user.profile.terms_accepted_at,
            email: user.profile.email,
            created_at: user.created_at,
            updated_at: user.updated_at,
          }, {
            onConflict: 'id'
          });

        if (profileError) {
          throw profileError;
        }

        userProgress.profile_created = true;
      } catch (error: any) {
        userProgress.error = error.message;
      }

      progress.push(userProgress);
    }

    const successCount = progress.filter(p => p.auth_created && p.profile_created).length;
    const failedCount = progress.filter(p => !p.auth_created || !p.profile_created).length;

    return new Response(
      JSON.stringify({
        success: true,
        message: `Migração concluída: ${successCount} usuários criados, ${failedCount} falhas`,
        progress,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error in admin-migrate-users function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});