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

  if (event.type === 'setup_intent.created') {
    console.info(`[${event.id}] Setup intent created: ${stripeData.id}`);
    return;
  }

  if (event.type === 'v1.billing.meter.error_report_triggered') {
    console.warn(`[${event.id}] Billing meter error triggered: ${JSON.stringify(stripeData)}`);
    return;
  }

  const informationalEvents = [
    'invoice.upcoming',
    'invoice.created',
    'invoice.finalized',
    'invoice.payment_action_required',
    'customer.created',
    'customer.updated',
    'payment_method.attached',
    'payment_method.detached',
  ];

  if (informationalEvents.includes(event.type)) {
    console.info(`[${event.id}] Informational event received: ${event.type} - no action needed`);
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

    const tokensToAdd = getTokenPackageAmount(priceId);

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
    console.warn(`${logPrefix} No active subscription found for customer ${customerId} to credit tokens`);
    console.warn(`${logPrefix} Customer may need to create a subscription first before purchasing token packages`);
    await logTokenCreditAudit({
      event_id: eventId,
      event_type: 'checkout.session.completed',
      customer_id: customerId,
      checkout_session_id: checkoutSessionId,
      price_id: priceId,
      tokens_amount: tokensToAdd,
      operation: 'credit_tokens',
      status: 'failed',
      error_message: 'No active subscription found for customer',
      subscription_found: false,
      processing_time_ms: Date.now() - operationStartTime,
      metadata: {
        suggestion: 'User needs to subscribe to a plan before purchasing token packages',
        searched_email: customerEmail,
      },
    });
    return;
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
      previous_extra_tokens: previousExtraTokens,
      new_extra_tokens: newExtraTokens,
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
    previous_extra_tokens: previousExtraTokens,
    new_extra_tokens: newExtraTokens,
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

function getTokenPackageAmount(priceId: string): number {
  const tokenPackages: { [key: string]: number } = {
    'price_1SGGa8Jrr43cGTt40LYw4F9X': 1200000,
    'price_1SGGb1Jrr43cGTt4oSjKhLHo': 2000000,
    'price_1SGAQHJrr43cGTt4dKkvB9lD': 2000000,
    'price_1SGAPJJrr43cGTt4r7k4qYZe': 1200000,
  };

  return tokenPackages[priceId] || 0;
}

async function logTokenCreditAudit(auditData: any) {
  try {
    const { error } = await supabase.from('token_credits_audit').insert(auditData);
    if (error) {
      console.error('[Audit Log] Failed to insert audit record:', error);
    }
  } catch (error: any) {
    console.error('[Audit Log] Exception while inserting audit record:', error);
  }
}

async function syncCustomerFromStripe(customerId: string, eventId: string) {
  const logPrefix = `[${eventId}]`;
  try {
    console.info(`${logPrefix} Fetching subscriptions for customer: ${customerId}`);

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 1,
      status: 'all',
      expand: ['data.default_payment_method'],
    });

    if (subscriptions.data.length === 0) {
      console.info(`${logPrefix} No subscriptions found for customer: ${customerId}`);

      const { data: existingSub } = await supabase
        .from('stripe_subscriptions')
        .select('plan_tokens, extra_tokens, tokens_used, tokens_total, current_period_end, status')
        .eq('customer_id', customerId)
        .maybeSingle();

      if (existingSub && existingSub.current_period_end) {
        const periodEndDate = new Date(existingSub.current_period_end * 1000);
        const now = new Date();
        const isWithinValidPeriod = periodEndDate > now;

        if (isWithinValidPeriod) {
          console.info(`${logPrefix} Canceled subscription still within valid period (until ${periodEndDate.toISOString()})`);
          console.info(`${logPrefix} Preserving tokens: ${existingSub.tokens_total} total, ${existingSub.tokens_used} used`);

          const { error: updateError } = await supabase
            .from('stripe_subscriptions')
            .update({
              status: 'canceled',
              updated_at: new Date().toISOString(),
            })
            .eq('customer_id', customerId);

          if (updateError) {
            console.error(`${logPrefix} Error updating canceled subscription:`, updateError);
            throw updateError;
          }

          await logTokenCreditAudit({
            event_id: eventId,
            event_type: 'subscription_canceled_preserve_tokens',
            customer_id: customerId,
            operation: 'preserve_tokens_within_period',
            status: 'success',
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

    console.info(`${logPrefix} Price ID: ${priceId}, Plan tokens: ${planTokens}`);

    const { data: existingSub } = await supabase
      .from('stripe_subscriptions')
      .select('extra_tokens, plan_tokens, tokens_used, price_id, current_period_start, tokens_carried_forward, cancel_at_period_end')
      .eq('customer_id', customerId)
      .maybeSingle();

    let finalExtraTokens = existingSub?.extra_tokens || 0;
    let finalTokensUsed = existingSub?.tokens_used || 0;
    let tokensCarriedForward = existingSub?.tokens_carried_forward || 0;
    let lastPlanChangeAt = null;

    const isNewBillingPeriod = existingSub && existingSub.current_period_start !== subscription.current_period_start;
    const isPlanChange = existingSub && existingSub.price_id && existingSub.price_id !== priceId;

    console.info(`${logPrefix} Existing subscription analysis:`);
    console.info(`${logPrefix} - isNewBillingPeriod: ${isNewBillingPeriod}`);
    console.info(`${logPrefix} - isPlanChange: ${isPlanChange}`);
    console.info(`${logPrefix} - Current plan_tokens: ${existingSub?.plan_tokens || 0}`);
    console.info(`${logPrefix} - Current extra_tokens: ${existingSub?.extra_tokens || 0}`);
    console.info(`${logPrefix} - Current tokens_used: ${existingSub?.tokens_used || 0}`);

    if (isPlanChange) {
      const oldPlanTokens = existingSub?.plan_tokens || 0;
      const tokensUsed = existingSub?.tokens_used || 0;
      const remainingPlanTokens = Math.max(0, oldPlanTokens - tokensUsed);

      const isUpgrade = planTokens > oldPlanTokens;
      const isDowngrade = planTokens < oldPlanTokens;

      console.info(`${logPrefix} Plan change detected (${isUpgrade ? 'UPGRADE' : isDowngrade ? 'DOWNGRADE' : 'LATERAL'}):`);
      console.info(`${logPrefix} - Old plan: ${existingSub?.price_id} -> New plan: ${priceId}`);
      console.info(`${logPrefix} - Old plan tokens: ${oldPlanTokens}`);
      console.info(`${logPrefix} - New plan tokens: ${planTokens}`);
      console.info(`${logPrefix} - Tokens used from old plan: ${tokensUsed}`);
      console.info(`${logPrefix} - Remaining plan tokens to preserve: ${remainingPlanTokens}`);

      finalExtraTokens = (existingSub?.extra_tokens || 0) + remainingPlanTokens;
      finalTokensUsed = 0;
      tokensCarriedForward = (existingSub?.tokens_carried_forward || 0) + remainingPlanTokens;
      lastPlanChangeAt = new Date().toISOString();

      console.info(`${logPrefix} - New extra_tokens (with carried forward): ${finalExtraTokens}`);
      console.info(`${logPrefix} - Tokens_used reset to 0 (new plan starts fresh)`);
      console.info(`${logPrefix} - Total tokens_carried_forward: ${tokensCarriedForward}`);
      console.info(`${logPrefix} - Total available: ${planTokens + finalExtraTokens}`);

      await logTokenCreditAudit({
        event_id: eventId,
        event_type: 'plan_change',
        customer_id: customerId,
        operation: 'preserve_remaining_tokens',
        status: 'success',
        tokens_amount: remainingPlanTokens,
        previous_extra_tokens: existingSub?.extra_tokens || 0,
        new_extra_tokens: finalExtraTokens,
        processing_time_ms: 0,
        metadata: {
          old_price_id: existingSub?.price_id,
          new_price_id: priceId,
          old_plan_tokens: oldPlanTokens,
          new_plan_tokens: planTokens,
          tokens_used: tokensUsed,
          remaining_preserved: remainingPlanTokens,
          change_type: isUpgrade ? 'upgrade' : isDowngrade ? 'downgrade' : 'lateral',
        },
      });

      if (isUpgrade) {
        console.info(`${logPrefix} Sending upgrade email for plan change`);
        await sendSubscriptionUpgradeEmail(
          eventId,
          subscription.id,
          existingSub?.price_id || '',
          priceId,
          remainingPlanTokens
        );
      } else if (isDowngrade) {
        console.info(`${logPrefix} Sending downgrade email for plan change`);
        await sendSubscriptionDowngradeEmail(
          eventId,
          subscription.id,
          existingSub?.price_id || '',
          priceId,
          remainingPlanTokens
        );
      }
    } else if (isNewBillingPeriod) {
      console.info(`${logPrefix} New billing period detected - resetting tokens_used to 0`);
      finalTokensUsed = 0;

      await logTokenCreditAudit({
        event_id: eventId,
        event_type: 'billing_period_renewed',
        customer_id: customerId,
        operation: 'reset_tokens_used',
        status: 'success',
        tokens_amount: planTokens,
        processing_time_ms: 0,
        metadata: {
          previous_tokens_used: existingSub?.tokens_used || 0,
          plan_tokens: planTokens,
          extra_tokens: finalExtraTokens,
        },
      });
    } else {
      console.info(`${logPrefix} No plan change or billing period change - preserving existing state`);
    }

    const subscriptionData: any = {
      customer_id: customerId,
      subscription_id: subscription.id,
      price_id: priceId,
      status: subscription.status,
      current_period_start: subscription.current_period_start,
      current_period_end: subscription.current_period_end,
      cancel_at_period_end: subscription.cancel_at_period_end,
      plan_tokens: planTokens,
      extra_tokens: finalExtraTokens,
      tokens_used: finalTokensUsed,
      tokens_carried_forward: tokensCarriedForward,
      updated_at: new Date().toISOString(),
    };

    if (lastPlanChangeAt) {
      subscriptionData.last_plan_change_at = lastPlanChangeAt;
    }

    const wasCanceled = existingSub && !existingSub.cancel_at_period_end && subscription.cancel_at_period_end;

    console.info(`${logPrefix} Upserting subscription data for customer: ${customerId}`);

    const { error: upsertError } = await supabase.from('stripe_subscriptions').upsert(subscriptionData, {
      onConflict: 'customer_id',
    });

    if (upsertError) {
      console.error(`${logPrefix} Error upserting subscription:`, upsertError);
      throw upsertError;
    }

    if (wasCanceled) {
      console.info(`${logPrefix} Subscription was canceled (cancel_at_period_end set to true), sending cancellation email`);
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
      console.warn(`[getPlanTokensFromPriceId] No active plan found for price_id ${priceId}, returning 0 tokens`);
      return 0;
    }

    console.log(`[getPlanTokensFromPriceId] Found plan with ${plan.tokens_included} tokens for price_id ${priceId}`);
    return Number(plan.tokens_included) || 0;
  } catch (err) {
    console.error(`[getPlanTokensFromPriceId] Exception fetching plan tokens for price_id ${priceId}:`, err);
    return 0;
  }
}

async function sendSubscriptionConfirmationEmail(eventId: string, subscriptionId: string) {
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

async function sendSubscriptionUpgradeEmail(
  eventId: string,
  subscriptionId: string,
  oldPriceId: string,
  newPriceId: string,
  tokensPreserved: number
) {
  const logPrefix = `[${eventId}]`;

  try {
    console.info(`${logPrefix} Calling edge function to send subscription upgrade email`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/send-subscription-upgrade-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        subscription_id: subscriptionId,
        old_price_id: oldPriceId,
        new_price_id: newPriceId,
        tokens_preserved: tokensPreserved
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`${logPrefix} Failed to send subscription upgrade email:`, response.status, errorText);
      throw new Error(`Email send failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.info(`${logPrefix} Subscription upgrade email sent successfully:`, result);

  } catch (error: any) {
    console.error(`${logPrefix} Error sending subscription upgrade email:`, error);
  }
}

async function sendSubscriptionDowngradeEmail(
  eventId: string,
  subscriptionId: string,
  oldPriceId: string,
  newPriceId: string,
  tokensPreserved: number
) {
  const logPrefix = `[${eventId}]`;

  try {
    console.info(`${logPrefix} Calling edge function to send subscription downgrade email`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/send-subscription-downgrade-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        subscription_id: subscriptionId,
        old_price_id: oldPriceId,
        new_price_id: newPriceId,
        tokens_preserved: tokensPreserved
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`${logPrefix} Failed to send subscription downgrade email:`, response.status, errorText);
      throw new Error(`Email send failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.info(`${logPrefix} Subscription downgrade email sent successfully:`, result);

  } catch (error: any) {
    console.error(`${logPrefix} Error sending subscription downgrade email:`, error);
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

    const { data: subscriptionData } = await supabase
      .from('stripe_subscriptions')
      .select('subscription_id')
      .eq('customer_id', customerId)
      .maybeSingle();

    if (!subscriptionData?.subscription_id) {
      console.warn(`${logPrefix} No subscription_id found for customer ${customerId}`);
      return;
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/send-subscription-cancellation-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        subscription_id: subscriptionData.subscription_id
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