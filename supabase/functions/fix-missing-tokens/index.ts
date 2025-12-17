import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  appInfo: {
    name: 'Wis Legal',
    version: '1.0.0',
  },
});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { checkout_session_id } = await req.json();

    console.log(`[fix-missing-tokens] Investigating session: ${checkout_session_id}`);

    // 1. Buscar detalhes da sessão com line_items expandidos
    const session = await stripe.checkout.sessions.retrieve(checkout_session_id, {
      expand: ['line_items', 'line_items.data.price'],
    });

    console.log(`[fix-missing-tokens] Session details:`, {
      id: session.id,
      customer: session.customer,
      payment_status: session.payment_status,
      mode: session.mode,
      line_items_count: session.line_items?.data?.length || 0,
    });

    if (session.mode !== 'payment' || session.payment_status !== 'paid') {
      return new Response(
        JSON.stringify({
          error: 'Session is not a paid payment session',
          session_mode: session.mode,
          payment_status: session.payment_status,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const priceId = session.line_items?.data?.[0]?.price?.id;

    if (!priceId) {
      return new Response(
        JSON.stringify({ error: 'No price ID found in session line items' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[fix-missing-tokens] Found price_id: ${priceId}`);

    // 2. Buscar o pacote de tokens
    const { data: tokenPackage, error: packageError } = await supabase
      .from('token_packages')
      .select('tokens_amount, name')
      .eq('stripe_price_id', priceId)
      .maybeSingle();

    if (packageError || !tokenPackage) {
      return new Response(
        JSON.stringify({
          error: 'Token package not found for price_id',
          price_id: priceId,
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[fix-missing-tokens] Token package:`, tokenPackage);

    // 3. Buscar o customer_id do Stripe
    const stripeCustomerId = typeof session.customer === 'string'
      ? session.customer
      : session.customer?.id;

    if (!stripeCustomerId) {
      return new Response(
        JSON.stringify({ error: 'No customer ID in session' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[fix-missing-tokens] Stripe customer_id: ${stripeCustomerId}`);

    // 4. Buscar o email do customer no Stripe
    const stripeCustomer = await stripe.customers.retrieve(stripeCustomerId);
    const customerEmail = 'email' in stripeCustomer ? stripeCustomer.email : null;

    console.log(`[fix-missing-tokens] Customer email: ${customerEmail}`);

    // 5. Buscar o usuário no banco pelo email
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, email')
      .eq('email', customerEmail)
      .maybeSingle();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({
          error: 'User not found by email',
          email: customerEmail,
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[fix-missing-tokens] Found user: ${profile.id}`);

    // 6. Buscar o customer_id correto no banco
    const { data: customerData, error: customerError } = await supabase
      .from('stripe_customers')
      .select('customer_id')
      .eq('user_id', profile.id)
      .maybeSingle();

    if (customerError || !customerData) {
      return new Response(
        JSON.stringify({
          error: 'Stripe customer not found in database',
          user_id: profile.id,
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const dbCustomerId = customerData.customer_id;
    console.log(`[fix-missing-tokens] Database customer_id: ${dbCustomerId}`);

    // 7. Buscar a subscription atual
    const { data: subscription, error: subError } = await supabase
      .from('stripe_subscriptions')
      .select('extra_tokens')
      .eq('customer_id', dbCustomerId)
      .maybeSingle();

    if (subError) {
      return new Response(
        JSON.stringify({
          error: 'Error fetching subscription',
          details: subError,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const currentExtraTokens = subscription?.extra_tokens || 0;
    const newExtraTokens = currentExtraTokens + tokenPackage.tokens_amount;

    console.log(`[fix-missing-tokens] Current extra tokens: ${currentExtraTokens}`);
    console.log(`[fix-missing-tokens] Adding: ${tokenPackage.tokens_amount}`);
    console.log(`[fix-missing-tokens] New total: ${newExtraTokens}`);

    // 8. Atualizar os tokens
    const { error: updateError } = await supabase
      .from('stripe_subscriptions')
      .update({
        extra_tokens: newExtraTokens,
        updated_at: new Date().toISOString(),
      })
      .eq('customer_id', dbCustomerId);

    if (updateError) {
      return new Response(
        JSON.stringify({
          error: 'Error updating tokens',
          details: updateError,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 9. Registrar no audit log
    const { error: auditError } = await supabase
      .from('token_credits_audit')
      .insert({
        event_id: `manual_fix_${checkout_session_id}`,
        event_type: 'token_purchase',
        customer_id: dbCustomerId,
        price_id: priceId,
        operation: 'add_extra_tokens',
        status: 'success',
        subscription_found: !!subscription,
        before_extra_tokens: currentExtraTokens,
        after_extra_tokens: newExtraTokens,
        tokens_amount: tokenPackage.tokens_amount,
        processing_time_ms: 0,
        metadata: {
          manually_fixed: true,
          checkout_session_id: checkout_session_id,
          stripe_customer_from_session: stripeCustomerId,
          database_customer_id: dbCustomerId,
          reason: 'Missing token credit from successful checkout',
        },
      });

    if (auditError) {
      console.error('[fix-missing-tokens] Error logging audit:', auditError);
    }

    console.log(`[fix-missing-tokens] Successfully credited ${tokenPackage.tokens_amount} tokens`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Tokens creditados com sucesso',
        details: {
          user_email: profile.email,
          package_name: tokenPackage.name,
          tokens_added: tokenPackage.tokens_amount,
          previous_extra_tokens: currentExtraTokens,
          new_extra_tokens: newExtraTokens,
          stripe_customer_from_session: stripeCustomerId,
          database_customer_id: dbCustomerId,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[fix-missing-tokens] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message, stack: error.stack }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});