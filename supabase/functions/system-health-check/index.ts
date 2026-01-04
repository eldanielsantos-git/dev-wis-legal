import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase credentials not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const result = {
      database: 'unhealthy' as 'healthy' | 'unhealthy',
      auth: 'unhealthy' as 'healthy' | 'unhealthy',
      storage: 'unhealthy' as 'healthy' | 'unhealthy',
      realtime: 'healthy' as 'healthy' | 'unhealthy',
      edgeFunctions: 'healthy' as 'healthy' | 'unhealthy',
      checkedAt: new Date().toISOString(),
    };

    try {
      const { error: dbError } = await supabase
        .from('user_profiles')
        .select('id')
        .limit(1);

      if (!dbError) {
        result.database = 'healthy';
      }
    } catch (err) {
      console.error('Database check failed:', err);
    }

    try {
      const { data, error: authError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
      if (!authError && data) {
        result.auth = 'healthy';
      }
    } catch (err) {
      console.error('Auth check failed:', err);
    }

    try {
      const { error: storageError } = await supabase.storage.listBuckets();
      if (!storageError) {
        result.storage = 'healthy';
      }
    } catch (err) {
      console.error('Storage check failed:', err);
    }

    return new Response(JSON.stringify(result), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Health check error:', error);
    return new Response(
      JSON.stringify({
        database: 'unhealthy',
        auth: 'unhealthy',
        storage: 'unhealthy',
        realtime: 'unhealthy',
        edgeFunctions: 'unhealthy',
        checkedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});