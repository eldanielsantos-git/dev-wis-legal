import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { notifyAdminSafe } from './notify-admin-safe.ts';

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

async function logTokenCreditAudit(params: any) {
  const { error } = await supabase.from('token_credits_audit').insert(params);
  if (error) {
    console.error('Error logging token credit audit:', error);
  }
}

async function syncCustomerFromStripe(customerId: string, eventId: string) {
  const logPrefix = `[${eventId}][syncCustomer ${customerId}]`;
  console.info(`${logPrefix} Starting sync`);

  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    limit: 1,
    status: 'all',
    expand: ['data.default_payment_method'],
  });

  const { data: existingSub } = await supabase
    .from('stripe_subscriptions')
    .select('*')
    .eq('customer_id', customerId)
    .is('deleted_at', null)
    .maybeSingle();

  let lastPlanChangeAt: string | null = null;

  if (subscriptions.data.length === 0) {
    console.info(`${logPrefix} No subscription found in Stripe`);

    if (existingSub) {
      console.info(`${logPrefix} Marking existing subscription as deleted`);
      const { error: deleteError } = await supabase
        .from('stripe_subscriptions')
        .update({
          deleted_at: new Date().toISOString(),
          status: 'canceled',
          updated_at: new Date().toISOString(),
        })
        .eq('customer_id', customerId);

      if (deleteError) {
        console.error(`${logPrefix} Error marking subscription as deleted:`, deleteError);
        throw deleteError;
      }

      const { data: userData } = await supabase
        .from('stripe_customers')
        .select('user_id')
        .eq('customer_id', customerId)
        .maybeSingle();

      if (userData) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('email, first_name, last_name')
          .eq('id', userData.user_id)
          .maybeSingle();

        if (profile) {
          const userName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email;

          const { data: planData } = await supabase
            .from('subscription_plans')
            .select('name')
            .eq('stripe_price_id', existingSub.price_id)
            .maybeSingle();

          const planName = planData?.name || 'unknown';

          await notifyAdminSafe({
            type: 'subscription_cancelled',
            title: 'Assinatura Cancelada',
            message: `${userName} | ${profile.email} | ${planName}`,
            severity: 'medium',
            metadata: {
              customer_id: customerId,
              user_name: userName,
              user_email: profile.email,
              plan_name: planName,
              cancellation_reason: 'Cancelled in Stripe',
            },
            userId: userData.user_id,
          });
        }
      }
    }

    const { error: noSubError } = await supabase.from('stripe_subscriptions').upsert(
      {
        customer_id: customerId,
        status: 'not_started',
        plan_tokens: 0,
        extra_tokens: 0,
        tokens_used: 0,
        tokens_total: 0,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'customer_id',
      },
    );

    if (noSubError) {
      console.error(`${logPrefix} Error upserting no subscription record:`, noSubError);
      throw noSubError;
    }

    return;
  }

  const subscription = subscriptions.data[0];
  console.info(`${logPrefix} Found subscription: ${subscription.id} with status: ${subscription.status}`);

  const priceId = subscription.items?.data[0]?.price?.id;
  const planTokens = await getPlanTokensFromPriceId(priceId || '');

  console.info(`${logPrefix} Plan tokens for price ${priceId}: ${planTokens}`);

  let finalPlanTokens = planTokens;
  let finalExtraTokens = existingSub?.extra_tokens || 0;
  let finalTokensUsed = existingSub?.tokens_used || 0;
  let tokensCarriedForward = existingSub?.tokens_carried_forward || 0;
  let shouldResetTokens = false;

  if (existingSub) {
    const oldPriceId = existingSub.price_id;

    if (priceId !== oldPriceId) {
      console.info(`${logPrefix} Plan change detected: ${oldPriceId} -> ${priceId}`);
      lastPlanChangeAt = new Date().toISOString();
      shouldResetTokens = true;

      const remainingTokens = existingSub.tokens_total - existingSub.tokens_used;

      if (remainingTokens > 0) {
        tokensCarriedForward = (existingSub.tokens_carried_forward || 0) + remainingTokens;
        finalExtraTokens = (existingSub.extra_tokens || 0) + remainingTokens;
        console.info(`${logPrefix} Carrying forward ${remainingTokens} unused tokens as extra_tokens`);
      }

      finalTokensUsed = 0;

      await logTokenCreditAudit({
        event_id: eventId,
        event_type: 'plan_change',
        customer_id: customerId,
        price_id: priceId,
        operation: 'plan_change_carry_forward',
        status: 'success',
        subscription_found: true,
        before_plan_tokens: existingSub.plan_tokens,
        before_extra_tokens: existingSub.extra_tokens,
        before_tokens_total: existingSub.tokens_total,
        after_plan_tokens: finalPlanTokens,
        after_extra_tokens: finalExtraTokens,
        after_tokens_total: finalPlanTokens + finalExtraTokens,
        tokens_amount: tokensCarriedForward,
        processing_time_ms: 0,
        metadata: {
          old_price_id: oldPriceId,
          new_price_id: priceId,
          tokens_carried_forward: tokensCarriedForward,
        },
      });

      const { data: userData } = await supabase
        .from('stripe_customers')
        .select('user_id')
        .eq('customer_id', customerId)
        .maybeSingle();

      if (userData) {
        const tenSecondsAgo = new Date(Date.now() - 10000).toISOString();

        const { data: recentNotifications } = await supabase
          .from('admin_notifications')
          .select(`
            id,
            metadata,
            notification_type_id,
            admin_notification_types!inner(slug)
          `)
          .eq('user_id', userData.user_id)
          .gte('created_at', tenSecondsAgo);

        const isDuplicate = recentNotifications?.some((notif: any) => {
          const typeSlug = notif.admin_notification_types?.slug;
          if (typeSlug !== 'subscription_upgraded' && typeSlug !== 'subscription_downgraded') {
            return false;
          }
          const meta = notif.metadata as any;
          return meta?.customer_id === customerId &&
                 meta?.old_tokens === existingSub.plan_tokens.toLocaleString('pt-BR') &&
                 meta?.new_tokens === finalPlanTokens.toLocaleString('pt-BR');
        });

        if (isDuplicate) {
          console.info(`${logPrefix} Notificação de upgrade/downgrade já enviada recentemente, pulando duplicata`);
        } else {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('email')
            .eq('id', userData.user_id)
            .maybeSingle();

          const { data: oldPlan } = await supabase
            .from('subscription_plans')
            .select('name')
            .eq('stripe_price_id', oldPriceId)
            .maybeSingle();

          const { data: newPlan } = await supabase
            .from('subscription_plans')
            .select('name')
            .eq('stripe_price_id', priceId)
            .maybeSingle();

          console.info(`${logPrefix} Old plan:`, oldPlan, 'New plan:', newPlan);

          if (profile && oldPlan && newPlan) {
            const isUpgrade = finalPlanTokens > existingSub.plan_tokens;
            const notificationType = isUpgrade ? 'subscription_upgraded' : 'subscription_downgraded';

            const { data: fullProfile } = await supabase
              .from('user_profiles')
              .select('first_name, last_name')
              .eq('id', userData.user_id)
              .maybeSingle();

            const userName = fullProfile ? `${fullProfile.first_name || ''} ${fullProfile.last_name || ''}`.trim() || profile.email : profile.email;

            await notifyAdminSafe({
              type: notificationType,
              title: isUpgrade ? 'Upgrade de Assinatura' : 'Downgrade de Assinatura',
              message: `${userName} | ${profile.email} | ${oldPlan.name} → ${newPlan.name}`,
              severity: isUpgrade ? 'success' : 'low',
              metadata: {
                customer_id: customerId,
                user_name: userName,
                user_email: profile.email,
                old_plan: oldPlan.name,
                new_plan: newPlan.name,
                old_tokens: existingSub.plan_tokens.toLocaleString('pt-BR'),
                new_tokens: finalPlanTokens.toLocaleString('pt-BR'),
              },
              userId: userData.user_id,
            });
          } else {
            console.warn(`${logPrefix} Não foi possível enviar notificação: profile=${!!profile}, oldPlan=${!!oldPlan}, newPlan=${!!newPlan}`);
          }
        }
      }
    } else {
      finalTokensUsed = existingSub.tokens_used || 0;
    }
  }

  const subscriptionData: any = {
    customer_id: customerId,
    subscription_id: subscription.id,
    price_id: priceId,
    status: subscription.status,
    current_period_start: subscription.current_period_start,
    current_period_end: subscription.current_period_end,
    cancel_at_period_end: subscription.cancel_at_period_end || false,
    payment_method_brand: subscription.default_payment_method
      ? ((await stripe.paymentMethods.retrieve(subscription.default_payment_method as string)).card?.brand || null)
      : null,
    payment_method_last4: subscription.default_payment_method
      ? ((await stripe.paymentMethods.retrieve(subscription.default_payment_method as string)).card?.last4 || null)
      : null,
    plan_tokens: finalPlanTokens,
    extra_tokens: finalExtraTokens,
    tokens_used: finalTokensUsed,
    tokens_carried_forward: tokensCarriedForward,
    updated_at: new Date().toISOString(),
  };

  if (lastPlanChangeAt) {
    subscriptionData.last_plan_change_at = lastPlanChangeAt;
  }

  if (shouldResetTokens) {
    subscriptionData.last_token_reset_at = new Date().toISOString();
    console.info(`${logPrefix} Setting last_token_reset_at due to plan change`);
  }

  console.info(`${logPrefix} Upserting subscription with data:`, subscriptionData);

  const { error: upsertError } = await supabase
    .from('stripe_subscriptions')
    .upsert(subscriptionData, {
      onConflict: 'customer_id',
    });

  if (upsertError) {
    console.error(`${logPrefix} Error upserting subscription:`, upsertError);
    throw upsertError;
  }

  console.info(`${logPrefix} Subscription synced successfully`);
}

async function sendSubscriptionConfirmationEmail(eventId: string, subscriptionId: string) {
  const logPrefix = `[${eventId}][confirmEmail]`;

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const priceId = subscription.items.data[0]?.price?.id;

    if (!priceId) {
      console.warn(`${logPrefix} No price ID found in subscription`);
      return;
    }

    const { data: plan } = await supabase
      .from('subscription_plans')
      .select('name')
      .eq('stripe_price_id', priceId)
      .maybeSingle();

    const planName = plan?.name || 'Plano';

    const customerId = typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id;

    if (!customerId) {
      console.warn(`${logPrefix} No customer ID found`);
      return;
    }

    const { data: customerData } = await supabase
      .from('stripe_customers')
      .select('user_id')
      .eq('customer_id', customerId)
      .maybeSingle();

    if (!customerData?.user_id) {
      console.warn(`${logPrefix} No user found for customer ${customerId}`);
      return;
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    await fetch(`${supabaseUrl}/functions/v1/send-subscription-confirmation-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        user_id: customerData.user_id,
        subscription_id: subscriptionId,
        plan_name: planName,
      }),
    });

    console.info(`${logPrefix} Confirmation email triggered`);
  } catch (error) {
    console.error(`${logPrefix} Error sending confirmation email:`, error);
  }
}

async function handlePaymentFailure(event: Stripe.Event) {
  const logPrefix = `[${event.id}][paymentFailure]`;
  console.info(`${logPrefix} Processing payment failure event: ${event.type}`);

  try {
    let paymentIntent: Stripe.PaymentIntent | null = null;
    let invoice: Stripe.Invoice | null = null;
    let charge: Stripe.Charge | null = null;

    if (event.type === 'payment_intent.payment_failed') {
      paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.info(`${logPrefix} Payment intent direct:`, paymentIntent.id);
    } else if (event.type === 'invoice.payment_failed' || event.type === 'invoice.payment_action_required') {
      invoice = event.data.object as Stripe.Invoice;
      console.info(`${logPrefix} Invoice:`, invoice.id, 'Payment intent:', invoice.payment_intent);
      if (invoice.payment_intent && typeof invoice.payment_intent === 'string') {
        paymentIntent = await stripe.paymentIntents.retrieve(invoice.payment_intent);
      }
    } else if (event.type === 'charge.failed') {
      charge = event.data.object as Stripe.Charge;
      if (charge.payment_intent && typeof charge.payment_intent === 'string') {
        paymentIntent = await stripe.paymentIntents.retrieve(charge.payment_intent);
      }
    }

    if (!paymentIntent) {
      console.warn(`${logPrefix} Could not retrieve payment intent for failed payment`);
      return;
    }

    console.info(`${logPrefix} Processing payment intent:`, paymentIntent.id);

    const customerId = typeof paymentIntent.customer === 'string'
      ? paymentIntent.customer
      : paymentIntent.customer?.id;

    if (!customerId) {
      console.warn(`${logPrefix} No customer ID found in payment intent`);
      return;
    }

    const { data: customer } = await supabase
      .from('stripe_customers')
      .select('user_id')
      .eq('customer_id', customerId)
      .maybeSingle();

    if (!customer?.user_id) {
      console.warn(`${logPrefix} No user found for customer ${customerId}`);
      return;
    }

    let paymentType: 'assinatura_nova' | 'renovacao_assinatura' | 'compra_tokens' = 'compra_tokens';
    let productName = 'Produto';
    let priceId: string | null = null;

    console.info(`${logPrefix} Has invoice: ${!!invoice}`);

    if (invoice) {
      console.info(`${logPrefix} Processing invoice-based failure`);

      const subscriptionId = typeof invoice.subscription === 'string'
        ? invoice.subscription
        : invoice.subscription?.id;

      console.info(`${logPrefix} Subscription ID:`, subscriptionId);

      if (subscriptionId) {
        const { data: existingSub } = await supabase
          .from('stripe_subscriptions')
          .select('subscription_id, created_at')
          .eq('subscription_id', subscriptionId)
          .maybeSingle();

        console.info(`${logPrefix} Found existing sub:`, !!existingSub);

        if (existingSub) {
          const subscriptionAge = new Date().getTime() - new Date(existingSub.created_at).getTime();
          const isNewSubscription = subscriptionAge < 3600000;
          paymentType = isNewSubscription ? 'assinatura_nova' : 'renovacao_assinatura';
          console.info(`${logPrefix} Sub type:`, paymentType);
        } else {
          paymentType = 'assinatura_nova';
        }

        if (invoice.lines?.data?.[0]?.price?.id) {
          priceId = invoice.lines.data[0].price.id;
          console.info(`${logPrefix} Price ID from invoice:`, priceId);

          const { data: plan } = await supabase
            .from('subscription_plans')
            .select('name')
            .eq('stripe_price_id', priceId)
            .maybeSingle();

          if (plan) {
            productName = plan.name;
            console.info(`${logPrefix} Plan name:`, productName);
          }
        }
      } else {
        if (invoice.lines?.data?.[0]?.price?.id) {
          priceId = invoice.lines.data[0].price.id;

          const { data: tokenPackage } = await supabase
            .from('token_packages')
            .select('name')
            .eq('stripe_price_id', priceId)
            .maybeSingle();

          if (tokenPackage) {
            productName = tokenPackage.name;
            paymentType = 'compra_tokens';
            console.info(`${logPrefix} Token package:`, productName);
          }
        }
      }
    } else {
      console.info(`${logPrefix} Processing non-invoice failure`);

      const metadata = paymentIntent.metadata || {};
      priceId = metadata.price_id || null;

      const { data: allPlans } = await supabase
        .from('subscription_plans')
        .select('name, stripe_price_id')
        .eq('is_active', true);

      let matchedPlan = null;
      if (priceId && allPlans) {
        matchedPlan = allPlans.find(p => p.stripe_price_id === priceId);
      }

      if (matchedPlan) {
        productName = matchedPlan.name;
        paymentType = 'assinatura_nova';
      } else {
        const { data: tokenPackage } = await supabase
          .from('token_packages')
          .select('name')
          .eq('stripe_price_id', priceId || '')
          .maybeSingle();

        if (tokenPackage) {
          productName = tokenPackage.name;
          paymentType = 'compra_tokens';
        }
      }
    }

    console.info(`${logPrefix} Final - Type:`, paymentType, 'Product:', productName);

    const lastPaymentError = paymentIntent.last_payment_error;
    const errorCode = lastPaymentError?.code;
    const errorMessage = lastPaymentError?.message;

    const latestCharge = paymentIntent.latest_charge;
    let cardBrand: string | undefined;
    let cardLast4: string | undefined;

    if (latestCharge && typeof latestCharge === 'string') {
      const chargeDetails = await stripe.charges.retrieve(latestCharge);
      cardBrand = chargeDetails.payment_method_details?.card?.brand;
      cardLast4 = chargeDetails.payment_method_details?.card?.last4;
    } else if (paymentIntent.payment_method && typeof paymentIntent.payment_method === 'string') {
      const paymentMethod = await stripe.paymentMethods.retrieve(paymentIntent.payment_method);
      cardBrand = paymentMethod.card?.brand;
      cardLast4 = paymentMethod.card?.last4;
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error(`${logPrefix} Missing Supabase env vars`);
      return;
    }

    const emailPayload = {
      user_id: customer.user_id,
      payment_intent_id: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      error_code: errorCode,
      error_message: errorMessage,
      card_brand: cardBrand,
      card_last4: cardLast4,
      payment_type: paymentType,
      product_name: productName,
      price_id: priceId,
    };

    console.info(`${logPrefix} Sending email with payload:`, JSON.stringify(emailPayload));

    const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-payment-failure-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify(emailPayload),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error(`${logPrefix} Failed to send email:`, emailResponse.status, errorText);
    } else {
      console.info(`${logPrefix} Email sent successfully`);
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('email, first_name, last_name')
      .eq('id', customer.user_id)
      .maybeSingle();

    if (profile) {
      const userName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email;
      const amountFormatted = (paymentIntent.amount / 100).toLocaleString('pt-BR', {
        style: 'currency',
        currency: paymentIntent.currency.toUpperCase(),
      });

      const notificationType = paymentType === 'compra_tokens' ? 'stripe_token_payment_failed' : 'stripe_payment_failed';
      const titleText = paymentType === 'compra_tokens' ? 'Pagamento de Tokens Falhou' : 'Pagamento de Assinatura Falhou';

      await notifyAdminSafe({
        type: notificationType,
        title: titleText,
        message: `${amountFormatted} | ${userName} | ${profile.email} | ${productName}`,
        severity: 'high',
        metadata: {
          payment_intent_id: paymentIntent.id,
          user_name: userName,
          user_email: profile.email,
          amount: amountFormatted,
          product_name: productName,
          payment_type: paymentType,
          error_code: errorCode || 'N/A',
          error_message: errorMessage || 'N/A',
          card_brand: cardBrand || 'N/A',
          card_last4: cardLast4 || 'N/A',
        },
        userId: customer.user_id,
      });
    }

  } catch (error: any) {
    console.error(`${logPrefix} Error:`, error);
  }
}

Deno.serve(async (req: Request) => {
  const startTime = Date.now();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    console.error('[webhook] No stripe signature');
    return new Response(JSON.stringify({ error: 'No stripe signature' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await req.text();
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    console.info(`[${event.id}] Webhook received: ${event.type}`);
  } catch (err: any) {
    console.error('[webhook] Signature verification failed:', err.message);
    return new Response(JSON.stringify({ error: 'Webhook signature verification failed' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const stripeData: any = event.data.object;

    if (!stripeData) {
      console.error(`[${event.id}] No data in event`);
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const paymentFailureEvents = [
      'payment_intent.payment_failed',
      'invoice.payment_failed',
      'invoice.payment_action_required',
      'charge.failed',
    ];

    if (paymentFailureEvents.includes(event.type)) {
      console.info(`[${event.id}] Payment failure event`);
      await handlePaymentFailure(event);
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const subscriptionEvents = [
      'customer.subscription.created',
      'customer.subscription.updated',
      'customer.subscription.deleted',
    ];

    if (subscriptionEvents.includes(event.type) && 'customer' in stripeData) {
      const customerId = typeof stripeData.customer === 'string'
        ? stripeData.customer
        : stripeData.customer?.id;

      if (customerId) {
        console.info(`[${event.id}] Syncing subscription for ${customerId}`);
        await syncCustomerFromStripe(customerId, event.id);
      }

      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (event.type === 'checkout.session.completed') {
      let session = stripeData as Stripe.Checkout.Session;
      const customerId = typeof session.customer === 'string'
        ? session.customer
        : session.customer?.id;

      if (!customerId) {
        console.warn(`[${event.id}] No customer in checkout session`);
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (session.mode === 'payment') {
        console.info(`[${event.id}] Expanding line_items for payment session`);
        session = await stripe.checkout.sessions.retrieve(session.id, {
          expand: ['line_items', 'line_items.data.price'],
        });
      }

      if (session.mode === 'subscription') {
        console.info(`[${event.id}] Processing subscription checkout`);
        await syncCustomerFromStripe(customerId, event.id);

        const subscriptionId = typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id;

        if (subscriptionId) {
          await sendSubscriptionConfirmationEmail(event.id, subscriptionId);

          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const priceId = subscription.items.data[0]?.price?.id;

          const { data: planData } = await supabase
            .from('subscription_plans')
            .select('name, tokens_included')
            .eq('stripe_price_id', priceId)
            .maybeSingle();

          const { data: userData } = await supabase
            .from('stripe_customers')
            .select('user_id')
            .eq('customer_id', customerId)
            .maybeSingle();

          if (userData) {
            const { data: profile } = await supabase
              .from('user_profiles')
              .select('email, first_name, last_name')
              .eq('id', userData.user_id)
              .maybeSingle();

            if (profile && planData) {
              const userName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email;
              const amountFormatted = ((session.amount_total || 0) / 100).toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              });
              const tokensFormatted = Number(planData.tokens_included).toLocaleString('pt-BR');

              await notifyAdminSafe({
                type: 'subscription_created',
                title: 'Compra de Assinatura',
                message: `${amountFormatted} | ${userName} | ${profile.email} | ${planData.name}`,
                severity: 'success',
                metadata: {
                  customer_id: customerId,
                  user_name: userName,
                  user_email: profile.email,
                  plan_name: planData.name,
                  plan_tokens: tokensFormatted,
                  amount: amountFormatted,
                  status: 'active',
                },
                userId: userData.user_id,
              });
            }
          }
        }
      } else if (session.mode === 'payment' && session.payment_status === 'paid') {
        console.info(`[${event.id}] Processing token payment`);

        const priceId = session.line_items?.data?.[0]?.price?.id;

        if (!priceId) {
          console.error(`[${event.id}] No price ID in session`);
          return new Response(JSON.stringify({ received: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        const { data: tokenPackage } = await supabase
          .from('token_packages')
          .select('tokens_amount, name')
          .eq('stripe_price_id', priceId)
          .maybeSingle();

        if (!tokenPackage) {
          console.error(`[${event.id}] Token package not found`);
          return new Response(JSON.stringify({ received: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        let customerData = (await supabase
          .from('stripe_customers')
          .select('user_id, customer_id')
          .eq('customer_id', customerId)
          .maybeSingle()).data;

        let actualCustomerId = customerId;

        if (!customerData) {
          console.warn(`[${event.id}] Customer not found by customer_id, trying email fallback`);

          const stripeCustomer = await stripe.customers.retrieve(customerId);
          const customerEmail = 'email' in stripeCustomer ? stripeCustomer.email : null;

          if (customerEmail) {
            console.info(`[${event.id}] Found email: ${customerEmail}, searching by email`);

            const { data: profile } = await supabase
              .from('user_profiles')
              .select('id')
              .eq('email', customerEmail)
              .maybeSingle();

            if (profile) {
              const { data: fallbackCustomer } = await supabase
                .from('stripe_customers')
                .select('user_id, customer_id')
                .eq('user_id', profile.id)
                .maybeSingle();

              if (fallbackCustomer) {
                customerData = fallbackCustomer;
                actualCustomerId = fallbackCustomer.customer_id;
                console.info(`[${event.id}] Found user by email, using customer_id: ${actualCustomerId}`);
              }
            }
          }
        }

        if (!customerData) {
          console.error(`[${event.id}] User not found by customer_id or email`);
          return new Response(JSON.stringify({ received: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        const { data: subscription } = await supabase
          .from('stripe_subscriptions')
          .select('extra_tokens')
          .eq('customer_id', actualCustomerId)
          .maybeSingle();

        const currentExtraTokens = subscription?.extra_tokens || 0;
        const newExtraTokens = currentExtraTokens + tokenPackage.tokens_amount;

        const { error: updateError } = await supabase
          .from('stripe_subscriptions')
          .update({
            extra_tokens: newExtraTokens,
            updated_at: new Date().toISOString(),
          })
          .eq('customer_id', actualCustomerId);

        if (updateError) {
          console.error(`[${event.id}] Error updating tokens:`, updateError);
        } else {
          console.info(`[${event.id}] Added ${tokenPackage.tokens_amount} tokens`);

          await logTokenCreditAudit({
            event_id: event.id,
            event_type: 'token_purchase',
            customer_id: actualCustomerId,
            price_id: priceId,
            operation: 'add_extra_tokens',
            status: 'success',
            subscription_found: !!subscription,
            before_extra_tokens: currentExtraTokens,
            after_extra_tokens: newExtraTokens,
            tokens_amount: tokenPackage.tokens_amount,
            processing_time_ms: Date.now() - startTime,
            metadata: customerId !== actualCustomerId ? {
              original_customer_id: customerId,
              resolved_via_email: true,
            } : undefined,
          });

          const { data: profile } = await supabase
            .from('user_profiles')
            .select('email, first_name, last_name')
            .eq('id', customerData.user_id)
            .maybeSingle();

          if (profile) {
            const userName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email;
            const amountFormatted = ((session.amount_total || 0) / 100).toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            });
            const tokensFormatted = tokenPackage.tokens_amount.toLocaleString('pt-BR');

            await notifyAdminSafe({
              type: 'token_purchase',
              title: 'Compra de Tokens',
              message: `${amountFormatted} | ${userName} | ${profile.email} | ${tokenPackage.name}`,
              severity: 'success',
              metadata: {
                customer_id: actualCustomerId,
                original_customer_id: customerId !== actualCustomerId ? customerId : undefined,
                user_name: userName,
                user_email: profile.email,
                tokens_purchased: tokensFormatted,
                amount: amountFormatted,
                package_name: tokenPackage.name,
                before_tokens: currentExtraTokens.toLocaleString('pt-BR'),
                after_tokens: newExtraTokens.toLocaleString('pt-BR'),
              },
              userId: customerData.user_id,
            });
          }

          const supabaseUrl = Deno.env.get('SUPABASE_URL');
          const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

          if (supabaseUrl && supabaseAnonKey) {
            await fetch(`${supabaseUrl}/functions/v1/send-token-purchase-email`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseAnonKey}`,
              },
              body: JSON.stringify({
                user_id: customerData.user_id,
                package_name: tokenPackage.name,
                tokens_amount: tokenPackage.tokens_amount,
              }),
            });
          }
        }
      }

      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.info(`[${event.id}] Unhandled event type: ${event.type}`);
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error(`[${event.id}] Error:`, error.message, error.stack);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
