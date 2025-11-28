import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')!;
const stripe = new Stripe(stripeSecret, {
  appInfo: {
    name: 'Bolt Integration',
    version: '1.0.0',
  },
});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.is_admin) {
      return new Response(
        JSON.stringify({ error: 'Forbidden - Admin access required' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Fetching coupons from Stripe...');

    const coupons = await stripe.coupons.list({
      limit: 100,
    });

    console.log(`Found ${coupons.data.length} coupons in Stripe`);

    const validCoupons = coupons.data.filter(c => c.valid);
    console.log(`${validCoupons.length} valid coupons`);

    const upsertPromises = validCoupons.map(async (coupon) => {
      const couponData = {
        id: coupon.id,
        name: coupon.name || null,
        percent_off: coupon.percent_off || null,
        amount_off: coupon.amount_off || null,
        currency: coupon.currency || 'brl',
        duration: coupon.duration,
        duration_in_months: coupon.duration_in_months || null,
        times_redeemed: coupon.times_redeemed || 0,
        max_redemptions: coupon.max_redemptions || null,
        valid: coupon.valid,
        created_at: new Date(coupon.created * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('stripe_coupons')
        .upsert(couponData, {
          onConflict: 'id',
        });

      if (error) {
        console.error(`Error upserting coupon ${coupon.id}:`, error);
        throw error;
      }

      return couponData;
    });

    const syncedCoupons = await Promise.all(upsertPromises);

    console.log(`Successfully synced ${syncedCoupons.length} coupons`);

    return new Response(
      JSON.stringify({
        success: true,
        synced: syncedCoupons.length,
        coupons: syncedCoupons,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error syncing coupons:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});