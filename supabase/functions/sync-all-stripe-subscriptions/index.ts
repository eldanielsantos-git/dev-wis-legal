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
    const { data: plan } = await supabase
      .from('subscription_plans')
      .select('tokens_included')
      .eq('stripe_price_id', priceId)
      .eq('is_active', true)
      .maybeSingle();

    return Number(plan?.tokens_included) || 0;
  } catch {
    return 0;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle();

    if (!userProfile?.is_admin) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: customers } = await supabase
      .from('stripe_customers')
      .select('customer_id');

    if (!customers || customers.length === 0) {
      return new Response(
        JSON.stringify({
          message: 'No customers found',
          summary: { total: 0, synced: 0, skipped: 0, errors: 0 },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let synced = 0;
    let skipped = 0;
    let errors = 0;

    for (const customer of customers) {
      try {
        const subscriptions = await stripe.subscriptions.list({
          customer: customer.customer_id,
          limit: 1,
          status: 'active',
          expand: ['data.default_payment_method'],
        });

        if (subscriptions.data.length === 0) {
          skipped++;
          continue;
        }

        const subscription = subscriptions.data[0];
        const priceId = subscription.items.data[0].price.id;
        const newTokensTotal = await getPlanTokensFromPriceId(priceId);

        const { data: existingSub } = await supabase
          .from('stripe_subscriptions')
          .select('plan_tokens, extra_tokens, tokens_used, price_id')
          .eq('customer_id', customer.customer_id)
          .is('deleted_at', null)
          .maybeSingle();

        let finalPlanTokens = newTokensTotal;
        let finalExtraTokens = 0;
        let finalTokensUsed = 0;

        if (existingSub) {
          finalExtraTokens = existingSub.extra_tokens || 0;
          finalTokensUsed = existingSub.tokens_used || 0;
        }

        const subscriptionData: any = {
          customer_id: customer.customer_id,
          subscription_id: subscription.id,
          price_id: priceId,
          current_period_start: subscription.current_period_start,
          current_period_end: subscription.current_period_end,
          cancel_at_period_end: subscription.cancel_at_period_end,
          status: subscription.status,
          plan_tokens: finalPlanTokens,
          extra_tokens: finalExtraTokens,
          tokens_used: finalTokensUsed,
          updated_at: new Date().toISOString(),
        };

        if (subscription.default_payment_method && typeof subscription.default_payment_method !== 'string') {
          subscriptionData.payment_method_brand = subscription.default_payment_method.card?.brand ?? null;
          subscriptionData.payment_method_last4 = subscription.default_payment_method.card?.last4 ?? null;
        }

        const { error } = await supabase
          .from('stripe_subscriptions')
          .upsert(subscriptionData, { onConflict: 'customer_id' });

        if (error) {
          console.error(`Error syncing customer ${customer.customer_id}:`, error);
          errors++;
        } else {
          synced++;
        }
      } catch (err) {
        console.error(`Error processing customer ${customer.customer_id}:`, err);
        errors++;
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Sync completed',
        summary: {
          total: customers.length,
          synced,
          skipped,
          errors,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error in sync-all-stripe-subscriptions:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});