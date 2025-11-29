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
  console.log('🚀 stripe-checkout function called');
  console.log('🚀 Method:', req.method);

  if (req.method === 'OPTIONS') {
    console.log('✅ Handling OPTIONS request');
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log('🔐 Verifying user authentication...');
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error('❌ User authentication failed:', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('✅ User authenticated:', user.id, user.email);

    const requestBody = await req.json();
    console.log('📥 Request body received:', requestBody);

    const { price_id, priceId, mode = 'subscription', success_url, successUrl, cancel_url, cancelUrl } = requestBody;

    const finalPriceId = price_id || priceId;
    const finalSuccessUrl = success_url || successUrl;
    const finalCancelUrl = cancel_url || cancelUrl;

    console.log('💳 Processing checkout with:', {
      priceId: finalPriceId,
      mode,
      successUrl: finalSuccessUrl,
      cancelUrl: finalCancelUrl
    });

    if (!finalPriceId) {
      console.error('❌ Price ID is missing');
      return new Response(JSON.stringify({ error: 'Price ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('🔍 Looking for existing Stripe customer...');
    const { data: customerData, error: customerError } = await supabase
      .from('stripe_customers')
      .select('customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    let customerId: string | undefined = customerData?.customer_id;

    if (!customerId) {
      console.log('📝 Creating new Stripe customer...');
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('email, first_name, last_name')
        .eq('id', user.id)
        .single();

      const customer = await stripe.customers.create({
        email: profile?.email || user.email!,
        name: profile ? `${profile.first_name} ${profile.last_name}` : undefined,
        metadata: {
          supabase_user_id: user.id,
        },
      });

      customerId = customer.id;
      console.log('✅ Stripe customer created:', customerId);

      const { error: insertCustomerError } = await supabase.from('stripe_customers').insert({
        user_id: user.id,
        customer_id: customerId,
      });

      if (insertCustomerError) {
        console.error('❌ Error saving customer to database:', insertCustomerError);
        // Rollback: delete Stripe customer
        await stripe.customers.del(customerId);
        throw new Error('Failed to save customer to database');
      }

      console.log('✅ Customer saved to database');

      // Create initial subscription record for subscription mode
      if (mode === 'subscription') {
        console.log('📝 Creating initial subscription record...');
        const { error: insertSubError } = await supabase.from('stripe_subscriptions').insert({
          customer_id: customerId,
          status: 'not_started',
          plan_tokens: 0,
          extra_tokens: 0,
          tokens_used: 0,
          tokens_total: 0,
        });

        if (insertSubError) {
          console.error('❌ Error creating subscription record:', insertSubError);
          // Rollback: delete customer records and Stripe customer
          await supabase.from('stripe_customers').delete().eq('customer_id', customerId);
          await stripe.customers.del(customerId);
          throw new Error('Failed to create subscription record');
        }

        console.log('✅ Initial subscription record created');
      }
    } else {
      console.log('✅ Found existing Stripe customer:', customerId);

      // Check if subscription record exists for existing customers
      if (mode === 'subscription') {
        const { data: existingSub } = await supabase
          .from('stripe_subscriptions')
          .select('id')
          .eq('customer_id', customerId)
          .maybeSingle();

        if (!existingSub) {
          console.log('📝 Creating subscription record for existing customer...');
          const { error: insertSubError } = await supabase.from('stripe_subscriptions').insert({
            customer_id: customerId,
            status: 'not_started',
            plan_tokens: 0,
            extra_tokens: 0,
            tokens_used: 0,
            tokens_total: 0,
          });

          if (insertSubError) {
            console.error('❌ Error creating subscription record:', insertSubError);
          } else {
            console.log('✅ Subscription record created for existing customer');
          }
        }
      }
    }

    console.log('🛒️ Creating checkout session...');
    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      line_items: [
        {
          price: finalPriceId,
          quantity: 1,
        },
      ],
      mode: mode as 'subscription' | 'payment',
      success_url: finalSuccessUrl || `${Deno.env.get('SUPABASE_URL')}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: finalCancelUrl || `${Deno.env.get('SUPABASE_URL')}/`,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
    };

    if (mode === 'subscription') {
      sessionConfig.subscription_data = {
        metadata: {
          supabase_user_id: user.id,
        },
      };
    } else {
      sessionConfig.payment_intent_data = {
        metadata: {
          supabase_user_id: user.id,
        },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);
    console.log('✅ Checkout session created:', session.id);
    console.log('🔗 Checkout URL:', session.url);

    return new Response(
      JSON.stringify({
        sessionId: session.id,
        url: session.url,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('💥 Error creating checkout session:', error);
    console.error('💥 Error stack:', error.stack);
    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
