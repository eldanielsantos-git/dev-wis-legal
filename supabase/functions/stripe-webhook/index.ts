import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')!;
const stripeWebhookSecret1 = Deno.env.get('STRIPE_WEBHOOK_SECRET_1') || Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const stripeWebhookSecret2 = Deno.env.get('STRIPE_WEBHOOK_SECRET_2');
const stripeWebhookSecret3 = Deno.env.get('STRIPE_WEBHOOK_SECRET_3');
const stripe = new Stripe(stripeSecret, {
  appInfo: {
    name: 'Bolt Integration',
    version: '1.0.0',
  },
});

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`🔍 [${requestId}] Incoming request: ${req.method} ${req.url}`);

  try {
    if (req.method === 'OPTIONS') {
      console.log(`✅ [${requestId}] OPTIONS request - returning 204`);
      return new Response(null, { status: 204 });
    }

    if (req.method !== 'POST') {
      console.warn(`⚠️ [${requestId}] Method not allowed: ${req.method}`);
      return new Response('Method not allowed', { status: 405 });
    }

    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      return new Response('No signature found', { status: 400 });
    }

    const bodyBuffer = await req.arrayBuffer();
    const body = new TextDecoder('utf-8').decode(bodyBuffer);

    let event: Stripe.Event;

    const webhookSecrets = [stripeWebhookSecret1, stripeWebhookSecret2, stripeWebhookSecret3].filter(Boolean);
    let verificationSuccess = false;

    console.log(`🔑 Attempting webhook verification with ${webhookSecrets.length} secret(s)`);
    console.log(`📝 Signature length: ${signature.length}`);
    console.log(`📄 Body length: ${body.length}`);

    for (let i = 0; i < webhookSecrets.length; i++) {
      const secret = webhookSecrets[i];
      try {
        console.log(`🔍 Trying secret #${i + 1}: ${secret.substring(0, 15)}...`);
        event = await stripe.webhooks.constructEventAsync(body, signature, secret);
        verificationSuccess = true;
        console.log(`✅ Webhook verified with secret #${i + 1}`);
        break;
      } catch (error: any) {
        console.log(`❌ Failed with secret #${i + 1}: ${error.message}`);
        if (error.type) {
          console.log(`   Error type: ${error.type}`);
        }
      }
    }

    if (!verificationSuccess) {
      console.error('Webhook signature verification failed with all secrets');
      console.error('Attempted secrets count:', webhookSecrets.length);
      console.error('Signature received:', signature?.substring(0, 20) + '...');
      console.error('Event type from body:', JSON.parse(body).type);
      return new Response('Webhook signature verification failed', { status: 400 });
    }

    console.log(`✅ Webhook verified successfully. Event type: ${event!.type}`);

    try {
      await handleEvent(event!);
      console.log(`✅ Event ${event!.id} (${event!.type}) processed successfully`);
      return Response.json({ received: true });
    } catch (handlerError: any) {
      console.error(`❌ Error in handleEvent for ${event!.type}:`, handlerError);
      return Response.json({ error: 'Event processing failed', details: handlerError.message }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Error processing webhook:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function handleEvent(event: Stripe.Event) {
  const startTime = Date.now();
  console.log(`[${event.id}] Processing event: ${event.type}`);

  const stripeData = event?.data?.object ?? {};

  if (!stripeData) {
    console.warn(`[${event.id}] No data object in event`);
    return;
  }

  const informationalEvents = [
    'charge.succeeded',
    'charge.updated',
    'payment_intent.created',
    'payment_intent.processing',
    'customer.updated',
    'invoice.created',
    'invoice.finalized',
    'invoice.paid',
    'invoice.payment_succeeded',
    'invoice.upcoming',
    'customer.source.created',
    'customer.source.updated',
    'payment_method.attached',
    'payment_method.detached',
  ];

  if (informationalEvents.includes(event.type)) {
    console.info(`[${event.id}] Informational event received: ${event.type} - no action needed`);
    return;
  }

  const paymentFailureEvents = [
    'payment_intent.payment_failed',
    'invoice.payment_failed',
    'charge.failed',
  ];

  if (paymentFailureEvents.includes(event.type)) {
    console.info(`[${event.id}] Payment failure event received: ${event.type}`);
    await handlePaymentFailure(event);
    const elapsed = Date.now() - startTime;
    console.info(`[${event.id}] Payment failure event processed in ${elapsed}ms`);
    return;
  }

  const subscriptionEvents = [
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'customer.subscription.paused',
    'customer.subscription.resumed',
    'customer.subscription.trial_will_end',
  ];

  if (subscriptionEvents.includes(event.type) && 'customer' in stripeData) {
    const customerId = typeof stripeData.customer === 'string'
      ? stripeData.customer
      : stripeData.customer?.id;

    if (customerId) {
      console.info(`[${event.id}] Syncing subscription for customer ${customerId} due to ${event.type}`);
      await syncCustomerFromStripe(customerId, event.id);
      const elapsed = Date.now() - startTime;
      console.info(`[${event.id}] Event processed successfully in ${elapsed}ms`);
      return;
    }
  }

  if (!('customer' in stripeData)) {
    console.warn(`[${event.id}] No customer in event data`);
    return;
  }

  if (event.type === 'payment_intent.succeeded' && event.data.object.invoice === null) {
    console.info(`[${event.id}] Payment intent succeeded without invoice, skipping`);
    return;
  }

  const { customer: customerId } = stripeData;

  if (!customerId || typeof customerId !== 'string') {
    console.error(`[${event.id}] No customer received on event: ${JSON.stringify(event)}`);
    return;
  } else {
    let isSubscription = true;

    if (event.type === 'checkout.session.completed') {
      const { mode } = stripeData as Stripe.Checkout.Session;

      isSubscription = mode === 'subscription';

      console.info(`[${event.id}] Processing ${isSubscription ? 'subscription' : 'one-time payment'} checkout session`);
    }

    const { mode, payment_status } = stripeData as Stripe.Checkout.Session;

    if (isSubscription) {
      console.info(`[${event.id}] Starting subscription sync for customer: ${customerId}`);
      await syncCustomerFromStripe(customerId, event.id);

      if (event.type === 'checkout.session.completed') {
        const session = stripeData as Stripe.Checkout.Session;
        const subscriptionId = typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id;

        if (subscriptionId) {
          console.info(`[${event.id}] Sending subscription confirmation email for subscription: ${subscriptionId}`);
          await sendSubscriptionConfirmationEmail(event.id, subscriptionId);
        } else {
          console.warn(`[${event.id}] No subscription ID found in checkout session`);
        }
      }
    } else if (mode === 'payment' && payment_status === 'paid') {
      await processOneTimePayment(event.id, customerId, stripeData as Stripe.Checkout.Session);
    }

    const elapsed = Date.now() - startTime;
    console.info(`[${event.id}] Event processed successfully in ${elapsed}ms`);
  }
}

async function processOneTimePayment(eventId: string, customerId: string, session: Stripe.Checkout.Session) {
  const operationStartTime = Date.now();
  const logPrefix = `[${eventId}]`;

  try {
    const {
      id: checkout_session_id,
      payment_intent,
      amount_subtotal,
      amount_total,
      currency,
      payment_status,
      customer_details,
    } = session;

    const customerEmail = customer_details?.email;

    console.info(`${logPrefix} Processing one-time payment for session: ${checkout_session_id}`);
    console.info(`${logPrefix} Customer ID: ${customerId}, Email: ${customerEmail}`);

    if (payment_intent && typeof payment_intent === 'string') {
      const { error: orderError } = await supabase.from('stripe_orders').insert({
        checkout_session_id,
        payment_intent_id: payment_intent,
        customer_id: customerId,
        amount_subtotal,
        amount_total,
        currency,
        payment_status,
        status: 'completed',
      });

      if (orderError) {
        console.error(`${logPrefix} Error inserting order:`, orderError);
        await logTokenCreditAudit({
          event_id: eventId,
          event_type: 'checkout.session.completed',
          customer_id: customerId,
          checkout_session_id,
          operation: 'insert_order',
          status: 'failed',
          error_message: orderError.message,
          processing_time_ms: Date.now() - operationStartTime,
        });
        throw new Error(`Failed to insert order: ${orderError.message}`);
      }

      console.info(`${logPrefix} Successfully inserted order for session: ${checkout_session_id}`);
    } else {
      console.info(`${logPrefix} No payment_intent (possibly 100% discount), skipping order insert`);
    }

    const expandedSession = await stripe.checkout.sessions.retrieve(checkout_session_id, {
      expand: ['line_items'],
    });

    console.info(`${logPrefix} Retrieved session with line_items, count: ${expandedSession.line_items?.data.length || 0}`);

    if (!expandedSession.line_items || expandedSession.line_items.data.length === 0) {
      console.warn(`${logPrefix} No line items found in session ${checkout_session_id}`);
      await logTokenCreditAudit({
        event_id: eventId,
        event_type: 'checkout.session.completed',
        customer_id: customerId,
        checkout_session_id,
        operation: 'retrieve_line_items',
        status: 'skipped',
        error_message: 'No line items found in session',
        processing_time_ms: Date.now() - operationStartTime,
      });
      return;
    }

    const priceId = expandedSession.line_items.data[0].price?.id;

    if (!priceId) {
      console.warn(`${logPrefix} No price ID found in line items for session ${checkout_session_id}`);
      await logTokenCreditAudit({
        event_id: eventId,
        event_type: 'checkout.session.completed',
        customer_id: customerId,
        checkout_session_id,
        operation: 'extract_price_id',
        status: 'skipped',
        error_message: 'No price ID found in line items',
        processing_time_ms: Date.now() - operationStartTime,
      });
      return;
    }

    console.info(`${logPrefix} Extracted price ID: ${priceId}`);

    const tokensToAdd = await getTokenPackageAmount(priceId);

    if (tokensToAdd === 0) {
      console.info(`${logPrefix} Price ID ${priceId} is not a token package, skipping token credit`);
      await logTokenCreditAudit({
        event_id: eventId,
        event_type: 'checkout.session.completed',
        customer_id: customerId,
        checkout_session_id,
        price_id: priceId,
        tokens_amount: 0,
        operation: 'identify_token_package',
        status: 'skipped',
        error_message: 'Price ID does not correspond to a token package',
        processing_time_ms: Date.now() - operationStartTime,
      });
      return;
    }

    console.info(`${logPrefix} Identified token package: ${tokensToAdd} tokens for price ${priceId}`);

    await creditTokensToSubscription(eventId, customerId, customerEmail, checkout_session_id, priceId, tokensToAdd, operationStartTime);

  } catch (error: any) {
    console.error(`${logPrefix} Error processing one-time payment:`, error);
    await logTokenCreditAudit({
      event_id: eventId,
      event_type: 'checkout.session.completed',
      customer_id: customerId,
      operation: 'process_one_time_payment',
      status: 'failed',
      error_message: error.message || String(error),
      processing_time_ms: Date.now() - operationStartTime,
    });
    throw error;
  }
}

async function creditTokensToSubscription(
  eventId: string,
  customerId: string,
  customerEmail: string | null | undefined,
  checkoutSessionId: string,
  priceId: string,
  tokensToAdd: number,
  operationStartTime: number
) {
  const logPrefix = `[${eventId}]`;

  console.info(`${logPrefix} Attempting to credit ${tokensToAdd} tokens to customer ${customerId}`);

  let subscription = null;
  let targetCustomerId = customerId;

  const { data: directSub, error: fetchSubError } = await supabase
    .from('stripe_subscriptions')
    .select('customer_id, plan_tokens, extra_tokens, tokens_total, tokens_used, status')
    .eq('customer_id', customerId)
    .is('deleted_at', null)
    .maybeSingle();

  if (fetchSubError) {
    console.error(`${logPrefix} Error fetching subscription for token credit:`, fetchSubError);
    await logTokenCreditAudit({
      event_id: eventId,
      event_type: 'checkout.session.completed',
      customer_id: customerId,
      checkout_session_id: checkoutSessionId,
      price_id: priceId,
      tokens_amount: tokensToAdd,
      operation: 'fetch_subscription',
      status: 'failed',
      error_message: fetchSubError.message,
      subscription_found: false,
      processing_time_ms: Date.now() - operationStartTime,
    });
    throw new Error(`Failed to fetch subscription: ${fetchSubError.message}`);
  }

  if (directSub) {
    subscription = directSub;
    console.info(`${logPrefix} Found subscription directly by customer_id ${customerId}`);
  } else if (customerEmail) {
    console.info(`${logPrefix} No subscription found for customer ${customerId}, searching by email ${customerEmail}`);

    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('email', customerEmail)
      .maybeSingle();

    if (userProfile) {
      const { data: customerByUser } = await supabase
        .from('stripe_customers')
        .select('customer_id')
        .eq('user_id', userProfile.id)
        .maybeSingle();

      if (customerByUser) {
        const { data: subByEmail } = await supabase
          .from('stripe_subscriptions')
          .select('customer_id, plan_tokens, extra_tokens, tokens_total, tokens_used, status')
          .eq('customer_id', customerByUser.customer_id)
          .is('deleted_at', null)
          .maybeSingle();

        if (subByEmail) {
          subscription = subByEmail;
          targetCustomerId = customerByUser.customer_id;
          console.info(`${logPrefix} Found subscription by email! Customer: ${targetCustomerId}`);
        }
      }
    }
  }

  if (!subscription) {
    console.info(`${logPrefix} No active subscription found for customer ${customerId}, creating token-only subscription`);

    const { data: newSub, error: createError } = await supabase
      .from('stripe_subscriptions')
      .insert({
        customer_id: targetCustomerId,
        subscription_id: null,
        price_id: null,
        status: 'not_started',
        plan_tokens: 0,
        extra_tokens: 0,
        tokens_total: 0,
        tokens_used: 0,
      })
      .select('customer_id, plan_tokens, extra_tokens, tokens_total, tokens_used, status')
      .single();

    if (createError) {
      console.error(`${logPrefix} Error creating token-only subscription:`, createError);
      await logTokenCreditAudit({
        event_id: eventId,
        event_type: 'checkout.session.completed',
        customer_id: customerId,
        checkout_session_id: checkoutSessionId,
        price_id: priceId,
        tokens_amount: tokensToAdd,
        operation: 'create_token_only_subscription',
        status: 'failed',
        error_message: createError.message,
        subscription_found: false,
        processing_time_ms: Date.now() - operationStartTime,
      });
      throw new Error(`Failed to create token-only subscription: ${createError.message}`);
    }

    subscription = newSub;
    console.info(`${logPrefix} Successfully created token-only subscription for customer ${targetCustomerId}`);
  }

  const previousExtraTokens = subscription.extra_tokens || 0;
  const newExtraTokens = previousExtraTokens + tokensToAdd;

  console.info(`${logPrefix} Current subscription: plan_tokens=${subscription.plan_tokens}, extra_tokens=${previousExtraTokens}, tokens_used=${subscription.tokens_used}`);
  console.info(`${logPrefix} Adding ${tokensToAdd} tokens. New extra_tokens will be: ${newExtraTokens}`);

  const { error: updateError } = await supabase
    .from('stripe_subscriptions')
    .update({
      extra_tokens: newExtraTokens,
      updated_at: new Date().toISOString(),
    })
    .eq('customer_id', targetCustomerId)
    .is('deleted_at', null);

  if (updateError) {
    console.error(`${logPrefix} Error updating extra_tokens for customer ${targetCustomerId}:`, updateError);
    await logTokenCreditAudit({
      event_id: eventId,
      event_type: 'checkout.session.completed',
      customer_id: customerId,
      checkout_session_id: checkoutSessionId,
      price_id: priceId,
      tokens_amount: tokensToAdd,
      operation: 'update_extra_tokens',
      status: 'failed',
      error_message: updateError.message,
      subscription_found: true,
      before_extra_tokens: previousExtraTokens,
      after_extra_tokens: newExtraTokens,
      processing_time_ms: Date.now() - operationStartTime,
      metadata: {
        target_customer_id: targetCustomerId,
      },
    });
    throw new Error(`Failed to update extra_tokens: ${updateError.message}`);
  }

  console.info(`${logPrefix} Successfully credited ${tokensToAdd} tokens to customer ${targetCustomerId}`);
  console.info(`${logPrefix} Subscription extra_tokens updated from ${previousExtraTokens} to ${newExtraTokens}`);

  await logTokenCreditAudit({
    event_id: eventId,
    event_type: 'checkout.session.completed',
    customer_id: customerId,
    checkout_session_id: checkoutSessionId,
    price_id: priceId,
    tokens_amount: tokensToAdd,
    operation: 'credit_tokens',
    status: 'success',
    subscription_found: true,
    before_extra_tokens: previousExtraTokens,
    after_extra_tokens: newExtraTokens,
    processing_time_ms: Date.now() - operationStartTime,
    metadata: {
      target_customer_id: targetCustomerId,
      matched_by_email: targetCustomerId !== customerId,
    },
  });

  const { data: customer } = await supabase
    .from('stripe_customers')
    .select('user_id')
    .eq('customer_id', targetCustomerId)
    .maybeSingle();

  if (customer?.user_id) {
    console.info(`${logPrefix} Sending token purchase email to user: ${customer.user_id}`);
    await sendTokenPurchaseEmail(eventId, customer.user_id, priceId, tokensToAdd);
  } else {
    console.warn(`${logPrefix} Could not find user_id for customer ${targetCustomerId}, skipping email`);
  }
}

async function getTokenPackageAmount(priceId: string): Promise<number> {
  try {
    const { data: tokenPackage, error } = await supabase
      .from('token_packages')
      .select('tokens_amount')
      .eq('stripe_price_id', priceId)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error(`[getTokenPackageAmount] Error fetching token package for price_id ${priceId}:`, error);
      return 0;
    }

    if (!tokenPackage) {
      console.warn(`[getTokenPackageAmount] No token package found for price_id ${priceId}`);
      return 0;
    }

    return tokenPackage.tokens_amount || 0;
  } catch (error: any) {
    console.error(`[getTokenPackageAmount] Error:`, error);
    return 0;
  }
}

async function syncCustomerFromStripe(customerId: string, eventId: string) {
  const logPrefix = `[${eventId}]`;

  try {
    console.info(`${logPrefix} Syncing subscription for customer ${customerId}`);

    const { data: existingSub } = await supabase
      .from('stripe_subscriptions')
      .select('*')
      .eq('customer_id', customerId)
      .is('deleted_at', null)
      .maybeSingle();

    let lastPlanChangeAt = null;

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 100,
    });

    console.info(`${logPrefix} Found ${subscriptions.data.length} subscriptions for customer ${customerId}`);

    if (subscriptions.data.length === 0) {
      console.info(`${logPrefix} No subscriptions found for customer ${customerId}`);

      if (existingSub && existingSub.status !== 'canceled') {
        const currentPeriodEnd = existingSub.current_period_end;
        const periodEndDate = new Date(currentPeriodEnd * 1000);
        const now = new Date();

        if (periodEndDate > now) {
          console.info(`${logPrefix} Subscription period still valid until ${periodEndDate.toISOString()}, marking as canceled`);

          const { error: cancelError } = await supabase
            .from('stripe_subscriptions')
            .update({
              status: 'canceled',
              cancel_at_period_end: false,
              updated_at: new Date().toISOString(),
            })
            .eq('customer_id', customerId)
            .is('deleted_at', null);

          if (cancelError) {
            console.error(`${logPrefix} Error marking subscription as canceled:`, cancelError);
            throw cancelError;
          }

          await logTokenCreditAudit({
            event_id: eventId,
            event_type: 'customer.subscription.deleted',
            customer_id: customerId,
            operation: 'mark_subscription_canceled',
            status: 'success',
            subscription_found: true,
            tokens_amount: existingSub.tokens_total - existingSub.tokens_used,
            processing_time_ms: 0,
            metadata: {
              period_end: periodEndDate.toISOString(),
              tokens_preserved: existingSub.tokens_total - existingSub.tokens_used,
              plan_tokens: existingSub.plan_tokens,
              extra_tokens: existingSub.extra_tokens,
              tokens_used: existingSub.tokens_used,
            },
          });

          console.info(`${logPrefix} Sending cancellation email`);
          await sendSubscriptionCancellationEmail(eventId, customerId);

          return;
        } else {
          console.info(`${logPrefix} Subscription period expired (${periodEndDate.toISOString()}), zeroing tokens`);

          console.info(`${logPrefix} Sending cancellation email for expired subscription`);
          await sendSubscriptionCancellationEmail(eventId, customerId);
        }
      }

      const { error: noSubError } = await supabase.from('stripe_subscriptions').upsert(
        {
          customer_id: customerId,
          status: 'not_started',
          tokens_total: 0,
          tokens_used: 0,
          plan_tokens: 0,
          extra_tokens: 0,
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
    let finalTokensUsed = 0;
    let tokensCarriedForward = 0;

    if (existingSub) {
      const oldPriceId = existingSub.price_id;

      if (priceId !== oldPriceId) {
        console.info(`${logPrefix} Plan change detected: ${oldPriceId} -> ${priceId}`);
        lastPlanChangeAt = new Date().toISOString();

        const remainingTokens = existingSub.tokens_total - existingSub.tokens_used;

        if (remainingTokens > 0) {
          tokensCarriedForward = remainingTokens;
          finalExtraTokens += remainingTokens;
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

    const wasCanceledAtPeriodEnd = existingSub && !existingSub.cancel_at_period_end && subscription.cancel_at_period_end;
    const wasImmediatelyCanceled = existingSub &&
      existingSub.status === 'active' &&
      subscription.status === 'canceled' &&
      !subscription.cancel_at_period_end;

    console.info(`${logPrefix} Upserting subscription data for customer: ${customerId}`);

    const { error: upsertError } = await supabase.from('stripe_subscriptions').upsert(subscriptionData, {
      onConflict: 'customer_id',
    });

    if (upsertError) {
      console.error(`${logPrefix} Error upserting subscription:`, upsertError);
      throw upsertError;
    }

    if (wasCanceledAtPeriodEnd) {
      console.info(`${logPrefix} Subscription was canceled (cancel_at_period_end set to true), sending cancellation email`);
      await sendSubscriptionCancellationEmail(eventId, customerId);
    } else if (wasImmediatelyCanceled) {
      console.info(`${logPrefix} Subscription was immediately canceled (status: active → canceled), sending cancellation email`);
      await sendSubscriptionCancellationEmail(eventId, customerId);
    }

    console.info(`${logPrefix} Successfully synced subscription for customer: ${customerId}`);
  } catch (error: any) {
    console.error(`${logPrefix} Error syncing customer from Stripe:`, error);
    throw error;
  }
}

async function getPlanTokensFromPriceId(priceId: string): Promise<number> {
  try {
    const { data: plan, error } = await supabase
      .from('subscription_plans')
      .select('tokens_included')
      .eq('stripe_price_id', priceId)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error(`[getPlanTokensFromPriceId] Error fetching plan tokens for price_id ${priceId}:`, error);
      return 0;
    }

    if (!plan) {
      console.warn(`[getPlanTokensFromPriceId] No plan found for price_id ${priceId}`);
      return 0;
    }

    return plan.tokens_included || 0;
  } catch (error: any) {
    console.error(`[getPlanTokensFromPriceId] Error:`, error);
    return 0;
  }
}

async function logTokenCreditAudit(auditData: {
  event_id: string;
  event_type?: string;
  customer_id: string;
  checkout_session_id?: string;
  price_id?: string;
  tokens_amount?: number;
  operation: string;
  status: string;
  error_message?: string;
  subscription_found?: boolean;
  before_plan_tokens?: number;
  before_extra_tokens?: number;
  before_tokens_total?: number;
  after_plan_tokens?: number;
  after_extra_tokens?: number;
  after_tokens_total?: number;
  processing_time_ms: number;
  metadata?: any;
}) {
  try {
    const { error } = await supabase.from('token_credits_audit').insert(auditData);

    if (error) {
      console.error(`[${auditData.event_id}] Failed to log token credit audit:`, error);
    }
  } catch (error: any) {
    console.error(`[${auditData.event_id}] Error logging token credit audit:`, error);
  }
}

async function sendSubscriptionConfirmationEmail(
  eventId: string,
  subscriptionId: string
) {
  const logPrefix = `[${eventId}]`;

  try {
    console.info(`${logPrefix} Calling edge function to send subscription confirmation email`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/send-subscription-confirmation-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        subscription_id: subscriptionId
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`${logPrefix} Failed to send subscription confirmation email:`, response.status, errorText);
      throw new Error(`Email send failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.info(`${logPrefix} Subscription confirmation email sent successfully:`, result);

  } catch (error: any) {
    console.error(`${logPrefix} Error sending subscription confirmation email:`, error);
  }
}

async function sendSubscriptionCancellationEmail(
  eventId: string,
  customerId: string
) {
  const logPrefix = `[${eventId}]`;

  try {
    console.info(`${logPrefix} Calling edge function to send subscription cancellation email`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/send-subscription-cancellation-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        customer_id: customerId
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`${logPrefix} Failed to send subscription cancellation email:`, response.status, errorText);
      throw new Error(`Email send failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.info(`${logPrefix} Subscription cancellation email sent successfully:`, result);

  } catch (error: any) {
    console.error(`${logPrefix} Error sending subscription cancellation email:`, error);
  }
}

async function sendTokenPurchaseEmail(
  eventId: string,
  userId: string,
  priceId: string,
  tokensAmount: number
) {
  const logPrefix = `[${eventId}]`;

  try {
    console.info(`${logPrefix} Calling edge function to send token purchase email`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const { data: tokenPackage } = await supabase
      .from('token_packages')
      .select('name, price_brl')
      .eq('stripe_price_id', priceId)
      .maybeSingle();

    if (!tokenPackage) {
      console.warn(`${logPrefix} No token package found for price_id ${priceId}`);
      return;
    }

    const packageName = tokenPackage.name;
    const amountPaid = `R$ ${parseFloat(tokenPackage.price_brl).toFixed(2).replace('.', ',')}`;

    const response = await fetch(`${supabaseUrl}/functions/v1/send-token-purchase-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        user_id: userId,
        package_name: packageName,
        tokens_purchased: tokensAmount,
        amount_paid: amountPaid
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`${logPrefix} Failed to send token purchase email:`, response.status, errorText);
      throw new Error(`Email send failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.info(`${logPrefix} Token purchase email sent successfully:`, result);

  } catch (error: any) {
    console.error(`${logPrefix} Error sending token purchase email:`, error);
  }
}

async function handlePaymentFailure(event: Stripe.Event) {
  const logPrefix = `[${event.id}]`;

  try {
    console.info(`${logPrefix} Processing payment failure event: ${event.type}`);

    let paymentIntent: Stripe.PaymentIntent | null = null;
    let invoice: Stripe.Invoice | null = null;
    let charge: Stripe.Charge | null = null;

    if (event.type === 'payment_intent.payment_failed') {
      paymentIntent = event.data.object as Stripe.PaymentIntent;
    } else if (event.type === 'invoice.payment_failed') {
      invoice = event.data.object as Stripe.Invoice;
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

    if (invoice) {
      const subscriptionId = typeof invoice.subscription === 'string'
        ? invoice.subscription
        : invoice.subscription?.id;

      if (subscriptionId) {
        const { data: existingSub } = await supabase
          .from('stripe_subscriptions')
          .select('subscription_id')
          .eq('subscription_id', subscriptionId)
          .maybeSingle();

        paymentType = existingSub ? 'renovacao_assinatura' : 'assinatura_nova';

        if (invoice.lines?.data?.[0]?.price?.id) {
          priceId = invoice.lines.data[0].price.id;
          const { data: plan } = await supabase
            .from('subscription_plans')
            .select('name')
            .eq('stripe_price_id', priceId)
            .maybeSingle();

          if (plan) {
            productName = plan.name;
          }
        }
      }
    } else {
      const metadata = paymentIntent.metadata || {};
      if (metadata.price_id) {
        priceId = metadata.price_id;

        const { data: plan } = await supabase
          .from('subscription_plans')
          .select('name')
          .eq('stripe_price_id', priceId)
          .maybeSingle();

        if (plan) {
          productName = plan.name;
          paymentType = 'assinatura_nova';
        } else {
          const { data: tokenPackage } = await supabase
            .from('token_packages')
            .select('name')
            .eq('stripe_price_id', priceId)
            .maybeSingle();

          if (tokenPackage) {
            productName = tokenPackage.name;
            paymentType = 'compra_tokens';
          }
        }
      }
    }

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

    console.info(`${logPrefix} Sending payment failure email to user ${customer.user_id}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/send-payment-failure-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
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
        price_id: priceId
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`${logPrefix} Failed to send payment failure email:`, response.status, errorText);
      throw new Error(`Email send failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.info(`${logPrefix} Payment failure email sent successfully:`, result);

  } catch (error: any) {
    console.error(`${logPrefix} Error handling payment failure:`, error);
  }
}