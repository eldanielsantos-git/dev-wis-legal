import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
  console.log('\ud83d\udd0d diagnose-stripe-customer called');

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('email')
      .eq('id', user.id)
      .single();

    const userEmail = profile?.email || user.email;
    console.log('\ud83d\udd0d Searching Stripe for email:', userEmail);

    const customers = await stripe.customers.list({
      email: userEmail,
      limit: 10,
    });

    console.log(`\u2705 Found ${customers.data.length} customer(s) in Stripe`);

    const results = [];

    for (const customer of customers.data) {
      console.log(`\ud83d\udc64 Customer ${customer.id}: ${customer.email}`);

      const subscriptions = await stripe.subscriptions.list({
        customer: customer.id,
        limit: 10,
      });

      console.log(`  \ud83d\udccb Found ${subscriptions.data.length} subscription(s)`);

      for (const sub of subscriptions.data) {
        console.log(`    \ud83c\udfab Subscription ${sub.id}: ${sub.status}`);
        const priceId = sub.items.data[0]?.price?.id;
        console.log(`    \ud83d\udcb0 Price ID: ${priceId}`);
      }

      results.push({
        customer_id: customer.id,
        email: customer.email,
        created: new Date(customer.created * 1000).toISOString(),
        subscriptions: subscriptions.data.map((sub) => ({
          subscription_id: sub.id,
          status: sub.status,
          price_id: sub.items.data[0]?.price?.id,
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        })),
      });
    }

    const { data: dbCustomer } = await supabase
      .from('stripe_customers')
      .select('customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    const { data: dbSubscription } = await supabase
      .from('stripe_subscriptions')
      .select('*')
      .eq('customer_id', dbCustomer?.customer_id || 'none')
      .is('deleted_at', null)
      .maybeSingle();

    return new Response(
      JSON.stringify({
        user_id: user.id,
        email: userEmail,
        stripe_customers: results,
        database_customer: dbCustomer,
        database_subscription: dbSubscription,
        needs_sync: results.length > 0 && !dbCustomer,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('\ud83d\udca5 Error:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        stack: error.stack,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});