import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')!;
const stripe = new Stripe(stripeSecret, {
  appInfo: {
    name: 'Bolt Integration',
    version: '1.0.0',
  },
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

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

    console.log(`Found plan with ${plan.tokens_included} tokens for price_id ${priceId}`);
    return Number(plan.tokens_included) || 0;
  } catch (err) {
    console.error(`Exception fetching plan tokens for price_id ${priceId}:`, err);
    return 0;
  }
}

Deno.serve(async (req: Request) => {
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
      error: getUserError,
    } = await supabase.auth.getUser(token);

    if (getUserError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const requestedCustomerId = body.customer_id;

    let customerId: string;
    let userIdForCustomer: string | null = null;
    let customerEmail: string | null = null;

    if (requestedCustomerId) {
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

      customerId = requestedCustomerId;

      const { data: customerData } = await supabase
        .from('stripe_customers')
        .select('user_id')
        .eq('customer_id', customerId)
        .maybeSingle();

      if (customerData) {
        userIdForCustomer = customerData.user_id;

        const { data: profileData } = await supabase
          .from('user_profiles')
          .select('email')
          .eq('id', customerData.user_id)
          .maybeSingle();

        if (profileData) {
          customerEmail = profileData.email;
        }
      }
    } else {
      const { data: customerData } = await supabase
        .from('stripe_customers')
        .select('customer_id, user_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!customerData) {
        return new Response(JSON.stringify({ message: 'No customer found', hasSubscription: false }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      customerId = customerData.customer_id;
      userIdForCustomer = customerData.user_id;

      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('email')
        .eq('id', user.id)
        .maybeSingle();

      if (profileData) {
        customerEmail = profileData.email;
      }
    }

    let subscriptions;
    try {
      subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        limit: 1,
        status: 'all',
        expand: ['data.default_payment_method'],
      });
    } catch (error: any) {
      if (error.code === 'resource_missing' || error.message?.includes('No such customer')) {
        console.log(`Customer ${customerId} not found in Stripe. Attempting to find by email: ${customerEmail}`);

        if (!customerEmail) {
          console.error(`No email available for customer ${customerId}. Cannot search in Stripe.`);
          return new Response(JSON.stringify({
            error: 'Customer not found in Stripe and no email available to search',
            shouldDelete: true
          }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        console.log(`Searching Stripe for customers with email: ${customerEmail}`);
        const customers = await stripe.customers.list({
          email: customerEmail,
          limit: 10,
        });

        if (customers.data.length === 0) {
          console.warn(`No customer found in Stripe with email: ${customerEmail}`);
          return new Response(JSON.stringify({
            error: 'No customer found in Stripe with this email',
            shouldDelete: true
          }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        let foundCustomer = null;
        let foundSubscription = null;

        for (const customer of customers.data) {
          const customerSubs = await stripe.subscriptions.list({
            customer: customer.id,
            limit: 1,
            status: 'all',
            expand: ['data.default_payment_method'],
          });

          if (customerSubs.data.length > 0) {
            foundCustomer = customer;
            subscriptions = customerSubs;
            foundSubscription = customerSubs.data[0];
            console.log(`Found customer ${customer.id} with active subscription`);
            break;
          }
        }

        if (!foundCustomer || !foundSubscription) {
          foundCustomer = customers.data[0];
          const customerSubs = await stripe.subscriptions.list({
            customer: foundCustomer.id,
            limit: 1,
            status: 'all',
            expand: ['data.default_payment_method'],
          });
          subscriptions = customerSubs;
          console.log(`Using first customer found: ${foundCustomer.id}`);
        }

        console.log(`Found customer ${foundCustomer.id} in Stripe. Updating database...`);
        customerId = foundCustomer.id;

        if (userIdForCustomer) {
          const { error: upsertError } = await supabase
            .from('stripe_customers')
            .upsert({
              user_id: userIdForCustomer,
              customer_id: foundCustomer.id,
            }, {
              onConflict: 'user_id',
            });

          if (upsertError) {
            console.error('Error updating customer_id in database:', upsertError);
          } else {
            console.log(`Successfully updated customer_id to ${foundCustomer.id}`);
          }
        }
      } else {
        throw error;
      }
    }

    if (!subscriptions || subscriptions.data.length === 0) {
      return new Response(JSON.stringify({ message: 'No subscription found in Stripe', hasSubscription: false }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const subscription = subscriptions.data[0];
    const priceId = subscription.items.data[0].price.id;
    const newTokensTotal = await getPlanTokensFromPriceId(priceId);

    const { data: existingSub, error: fetchError } = await supabase
      .from('stripe_subscriptions')
      .select('plan_tokens, extra_tokens, tokens_used, price_id, current_period_start, tokens_carried_forward')
      .eq('customer_id', customerId)
      .is('deleted_at', null)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching existing subscription:', fetchError);
    }

    let finalPlanTokens = newTokensTotal;
    let finalExtraTokens = existingSub?.extra_tokens || 0;
    let finalTokensUsed = existingSub?.tokens_used || 0;
    let tokensCarriedForward = existingSub?.tokens_carried_forward || 0;
    let lastPlanChangeAt = null;
    let shouldResetTokens = false;

    if (existingSub) {
      const isNewBillingPeriod = existingSub.current_period_start !== subscription.current_period_start;
      const isPlanChange = existingSub.price_id !== priceId;

      console.info(`Subscription sync analysis for customer ${customerId}:`);
      console.info(`- isNewBillingPeriod: ${isNewBillingPeriod}`);
      console.info(`- isPlanChange: ${isPlanChange}`);
      console.info(`- Current plan_tokens: ${existingSub.plan_tokens || 0}`);
      console.info(`- Current extra_tokens: ${existingSub.extra_tokens || 0}`);
      console.info(`- Current tokens_used: ${existingSub.tokens_used || 0}`);

      if (isPlanChange) {
        const oldPlanTokens = existingSub.plan_tokens || 0;
        const tokensUsed = existingSub.tokens_used || 0;
        const remainingPlanTokens = Math.max(0, oldPlanTokens - tokensUsed);

        console.info(`Plan change detected for customer ${customerId}: ${existingSub.price_id} -> ${priceId}`);
        console.info(`- Old plan tokens: ${oldPlanTokens}`);
        console.info(`- Tokens used from old plan: ${tokensUsed}`);
        console.info(`- Remaining plan tokens to preserve: ${remainingPlanTokens}`);

        finalPlanTokens = newTokensTotal;
        finalExtraTokens = (existingSub.extra_tokens || 0) + remainingPlanTokens;
        finalTokensUsed = 0;
        tokensCarriedForward = (existingSub.tokens_carried_forward || 0) + remainingPlanTokens;
        lastPlanChangeAt = new Date().toISOString();
        shouldResetTokens = true;

        console.info(`- New plan_tokens: ${finalPlanTokens}`);
        console.info(`- New extra_tokens (with carried forward): ${finalExtraTokens}`);
        console.info(`- Tokens_used reset to 0 (new plan starts fresh)`);
        console.info(`- Total tokens_carried_forward: ${tokensCarriedForward}`);
        console.info(`- Total available: ${finalPlanTokens + finalExtraTokens}`);
      } else if (isNewBillingPeriod) {
        console.info(`New billing period detected for customer ${customerId}, resetting tokens_used to 0`);
        finalPlanTokens = newTokensTotal;
        finalExtraTokens = existingSub.extra_tokens || 0;
        finalTokensUsed = 0;
        tokensCarriedForward = existingSub.tokens_carried_forward || 0;
        shouldResetTokens = true;
      } else {
        console.info(`No changes detected - preserving existing state`);
        finalPlanTokens = existingSub.plan_tokens || newTokensTotal;
        finalExtraTokens = existingSub.extra_tokens || 0;
        finalTokensUsed = existingSub.tokens_used || 0;
        tokensCarriedForward = existingSub.tokens_carried_forward || 0;
      }
    }

    const subscriptionData: any = {
      customer_id: customerId,
      subscription_id: subscription.id,
      price_id: priceId,
      current_period_start: subscription.current_period_start,
      current_period_end: subscription.current_period_end,
      cancel_at_period_end: subscription.cancel_at_period_end,
      status: subscription.status,
      plan_tokens: finalPlanTokens,
      extra_tokens: finalExtraTokens,
      tokens_used: finalTokensUsed,
      tokens_carried_forward: tokensCarriedForward,
      updated_at: new Date().toISOString(),
    };

    if (shouldResetTokens) {
      subscriptionData.last_token_reset_at = new Date().toISOString();
      console.info(`Setting last_token_reset_at for customer ${customerId}`);
    }

    if (lastPlanChangeAt) {
      subscriptionData.last_plan_change_at = lastPlanChangeAt;
    }

    if (subscription.default_payment_method && typeof subscription.default_payment_method !== 'string') {
      subscriptionData.payment_method_brand = subscription.default_payment_method.card?.brand ?? null;
      subscriptionData.payment_method_last4 = subscription.default_payment_method.card?.last4 ?? null;
    }

    const { error: subError } = await supabase.from('stripe_subscriptions').upsert(
      subscriptionData,
      {
        onConflict: 'customer_id',
      },
    );

    if (subError) {
      console.error('Error syncing subscription:', subError);
      return new Response(JSON.stringify({ error: 'Failed to sync subscription' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        message: 'Subscription synced successfully',
        subscription: {
          id: subscription.id,
          status: subscription.status,
          price_id: priceId,
          plan_tokens: finalPlanTokens,
          extra_tokens: finalExtraTokens,
          tokens_used: finalTokensUsed,
          tokens_total: finalPlanTokens + finalExtraTokens,
          tokens_carried_forward: tokensCarriedForward,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});