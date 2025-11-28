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

async function getPlanTokensFromPriceId(priceId: string): Promise<number> {
  try {
    const { data: plan, error } = await supabase
      .from('subscription_plans')
      .select('tokens_included')
      .eq('stripe_price_id', priceId)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error(`Error fetching plan tokens for price_id ${priceId}:`, error);
      return 0;
    }

    if (!plan) {
      console.warn(`No active plan found for price_id ${priceId}, returning 0 tokens`);
      return 0;
    }

    return Number(plan.tokens_included) || 0;
  } catch (err) {
    console.error(`Exception fetching plan tokens for price_id ${priceId}:`, err);
    return 0;
  }
}

Deno.serve(async (req) => {
  console.log('\ud83d\udd27 force-sync-customer called');

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

    console.log('\u2705 User authenticated:', user.id);

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

    if (customers.data.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No customer found in Stripe' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let selectedCustomer = null;
    let activeSubscription = null;

    for (const customer of customers.data) {
      const subscriptions = await stripe.subscriptions.list({
        customer: customer.id,
        status: 'active',
        limit: 1,
      });

      if (subscriptions.data.length > 0) {
        selectedCustomer = customer;
        activeSubscription = subscriptions.data[0];
        break;
      }
    }

    if (!selectedCustomer) {
      selectedCustomer = customers.data[0];
      const subscriptions = await stripe.subscriptions.list({
        customer: selectedCustomer.id,
        limit: 1,
      });
      if (subscriptions.data.length > 0) {
        activeSubscription = subscriptions.data[0];
      }
    }

    if (!activeSubscription) {
      return new Response(
        JSON.stringify({ error: 'No subscription found for customer' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('\u2705 Selected customer:', selectedCustomer.id);
    console.log('\u2705 Selected subscription:', activeSubscription.id);

    const { error: customerError } = await supabase
      .from('stripe_customers')
      .upsert({
        user_id: user.id,
        customer_id: selectedCustomer.id,
        email: userEmail,
      }, {
        onConflict: 'user_id',
      });

    if (customerError) {
      console.error('\u274c Error creating customer:', customerError);
      return new Response(
        JSON.stringify({ error: 'Failed to create customer', details: customerError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('\u2705 Customer created/updated in database');

    const priceId = activeSubscription.items.data[0].price.id;
    const planTokens = await getPlanTokensFromPriceId(priceId);

    console.log('\ud83d\udcb0 Plan tokens:', planTokens);

    const subscriptionData: any = {
      customer_id: selectedCustomer.id,
      subscription_id: activeSubscription.id,
      price_id: priceId,
      current_period_start: activeSubscription.current_period_start,
      current_period_end: activeSubscription.current_period_end,
      cancel_at_period_end: activeSubscription.cancel_at_period_end,
      status: activeSubscription.status,
      plan_tokens: planTokens,
      extra_tokens: 0,
      tokens_used: 0,
      tokens_carried_forward: 0,
      last_token_reset_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (activeSubscription.default_payment_method && typeof activeSubscription.default_payment_method !== 'string') {
      subscriptionData.payment_method_brand = activeSubscription.default_payment_method.card?.brand ?? null;
      subscriptionData.payment_method_last4 = activeSubscription.default_payment_method.card?.last4 ?? null;
    }

    const { error: subError } = await supabase
      .from('stripe_subscriptions')
      .upsert(subscriptionData, {
        onConflict: 'customer_id',
      });

    if (subError) {
      console.error('\u274c Error creating subscription:', subError);
      return new Response(
        JSON.stringify({ error: 'Failed to create subscription', details: subError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('\u2705 Subscription created/updated in database');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Customer and subscription synced successfully',
        customer_id: selectedCustomer.id,
        subscription_id: activeSubscription.id,
        status: activeSubscription.status,
        price_id: priceId,
        plan_tokens: planTokens,
        tokens_total: planTokens,
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