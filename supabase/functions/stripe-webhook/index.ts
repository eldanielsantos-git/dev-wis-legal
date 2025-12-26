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
  const { error } = await supabase
    .from('token_credits_audit')
    .insert(params);

  if (error) {
    console.error('Error logging token credit audit:', error);
  }
}

async function findUserIdForTokenPurchase(
  eventId: string,
  customerId: string | null,
  subscriptionId: string | null,
  customerEmail: string | null
): Promise<string | null> {
  console.info(`[${eventId}] Finding user with multiple strategies - customer_id: ${customerId}, subscription_id: ${subscriptionId}, email: ${customerEmail}`);

  if (customerId) {
    const { data: customerData } = await supabase
      .from('stripe_customers')
      .select('user_id')
      .eq('customer_id', customerId)
      .maybeSingle();

    if (customerData?.user_id) {
      console.info(`[${eventId}] Found user via customer_id: ${customerData.user_id}`);
      return customerData.user_id;
    }
  }

  if (subscriptionId) {
    const { data: subscriptionData } = await supabase
      .from('stripe_subscriptions')
      .select('customer_id')
      .eq('subscription_id', subscriptionId)
      .is('deleted_at', null)
      .maybeSingle();

    if (subscriptionData?.customer_id) {
      const { data: customerData } = await supabase
        .from('stripe_customers')
        .select('user_id')
        .eq('customer_id', subscriptionData.customer_id)
        .maybeSingle();

      if (customerData?.user_id) {
        console.info(`[${eventId}] Found user via subscription_id -> customer_id: ${customerData.user_id}`);
        return customerData.user_id;
      }
    }
  }

  if (customerEmail) {
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('email', customerEmail)
      .maybeSingle();

    if (userProfile?.id) {
      console.info(`[${eventId}] Found user via email: ${userProfile.id}`);

      if (customerId) {
        console.info(`[${eventId}] Creating customer mapping for ${customerEmail}`);
        const { error: insertError } = await supabase
          .from('stripe_customers')
          .insert({
            customer_id: customerId,
            user_id: userProfile.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (insertError) {
          console.error(`[${eventId}] Failed to create customer mapping:`, insertError);
        } else {
          console.info(`[${eventId}] Successfully created customer mapping`);
        }
      }

      return userProfile.id;
    }
  }

  console.error(`[${eventId}] Could not find user with any strategy`);
  return null;
}

async function sendSubscriptionConfirmationEmail(eventId: string, subscriptionId: string) {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const url = `${supabaseUrl}/functions/v1/send-subscription-confirmation-email`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({ subscription_id: subscriptionId }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[${eventId}] Failed to send subscription confirmation email: ${response.status} - ${errorText}`);
    } else {
      console.info(`[${eventId}] Subscription confirmation email sent successfully`);
    }
  } catch (error) {
    console.error(`[${eventId}] Error sending subscription confirmation email:`, error);
  }
}

async function sendSubscriptionUpgradeEmail(eventId: string, customerId: string, oldPriceId: string, newPriceId: string, tokensPreserved: number) {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const url = `${supabaseUrl}/functions/v1/send-subscription-upgrade-email`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        customer_id: customerId,
        old_price_id: oldPriceId,
        new_price_id: newPriceId,
        tokens_preserved: tokensPreserved
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[${eventId}] Failed to send subscription upgrade email: ${response.status} - ${errorText}`);
    } else {
      console.info(`[${eventId}] Subscription upgrade email sent successfully`);
    }
  } catch (error) {
    console.error(`[${eventId}] Error sending subscription upgrade email:`, error);
  }
}

async function sendSubscriptionDowngradeEmail(eventId: string, customerId: string, oldPriceId: string, newPriceId: string, tokensPreserved: number) {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const url = `${supabaseUrl}/functions/v1/send-subscription-downgrade-email`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        customer_id: customerId,
        old_price_id: oldPriceId,
        new_price_id: newPriceId,
        tokens_preserved: tokensPreserved
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[${eventId}] Failed to send subscription downgrade email: ${response.status} - ${errorText}`);
    } else {
      console.info(`[${eventId}] Subscription downgrade email sent successfully`);
    }
  } catch (error) {
    console.error(`[${eventId}] Error sending subscription downgrade email:`, error);
  }
}

async function sendSubscriptionCancellationEmail(eventId: string, subscriptionId: string) {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const url = `${supabaseUrl}/functions/v1/send-subscription-cancellation-email`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({ subscription_id: subscriptionId }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[${eventId}] Failed to send subscription cancellation email: ${response.status} - ${errorText}`);
    } else {
      console.info(`[${eventId}] Subscription cancellation email sent successfully`);
    }
  } catch (error) {
    console.error(`[${eventId}] Error sending subscription cancellation email:`, error);
  }
}

async function sendPaymentFailureEmail(eventId: string, userId: string, paymentIntentId: string, amount: number, currency: string, errorCode?: string, errorMessage?: string, cardBrand?: string, cardLast4?: string, paymentType?: string) {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const url = `${supabaseUrl}/functions/v1/send-payment-failure-email`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        user_id: userId,
        payment_intent_id: paymentIntentId,
        amount: amount,
        currency: currency,
        error_code: errorCode,
        error_message: errorMessage,
        card_brand: cardBrand,
        card_last4: cardLast4,
        payment_type: paymentType || 'renovacao_assinatura'
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[${eventId}] Failed to send payment failure email: ${response.status} - ${errorText}`);
    } else {
      console.info(`[${eventId}] Payment failure email sent successfully`);
    }
  } catch (error) {
    console.error(`[${eventId}] Error sending payment failure email:`, error);
  }
}

async function syncCustomerFromStripe(customerId: string, eventId: string) {
  const logPrefix = `[${eventId}]`;
  console.info(`${logPrefix} Syncing customer ${customerId}`);

  const customer = await stripe.customers.retrieve(customerId, {
    expand: ['subscriptions'],
  });

  if (customer.deleted) {
    console.warn(`${logPrefix} Customer deleted, skipping sync`);
    return;
  }

  let lastPlanChangeAt: string | null = null;

  const { data: existingSub, error: existingSubError } = await supabase
    .from('stripe_subscriptions')
    .select('*')
    .eq('customer_id', customerId)
    .is('deleted_at', null)
    .maybeSingle();

  if (existingSubError && existingSubError.code !== 'PGRST116') {
    console.error(`${logPrefix} Error fetching existing subscription:`, existingSubError);
    throw existingSubError;
  }

  const subscriptions = customer.subscriptions!;

  if (subscriptions.data.length === 0) {
    console.info(`${logPrefix} Customer has no active subscriptions`);

    if (existingSub) {
      const { error: deleteError } = await supabase
        .from('stripe_subscriptions')
        .update({ deleted_at: new Date().toISOString() })
        .eq('customer_id', customerId);

      if (deleteError) {
        console.error(`${logPrefix} Error marking subscription as deleted:`, deleteError);
        throw deleteError;
      }
    }

    const { error: noSubError } = await supabase
      .from('stripe_subscriptions')
      .upsert(
        {
          customer_id: customerId,
          subscription_id: null,
          status: 'none',
          price_id: null,
          current_period_start: null,
          current_period_end: null,
          plan_tokens: 0,
          extra_tokens: 0,
          tokens_carried_forward: 0,
          tokens_total: 0,
          tokens_used: 0,
          last_plan_change_at: null,
          created_at: new Date().toISOString(),
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

      const isUpgrade = finalPlanTokens > existingSub.plan_tokens;
      const isDowngrade = finalPlanTokens < existingSub.plan_tokens;

      if (isUpgrade) {
        console.info(`${logPrefix} Detected UPGRADE - sending upgrade email`);
        await sendSubscriptionUpgradeEmail(
          eventId,
          customerId,
          oldPriceId,
          priceId,
          remainingTokens
        );
      } else if (isDowngrade) {
        console.info(`${logPrefix} Detected DOWNGRADE - sending downgrade email`);
        await sendSubscriptionDowngradeEmail(
          eventId,
          customerId,
          oldPriceId,
          priceId,
          remainingTokens
        );
      }

      const { data: userData } = await supabase
        .from('stripe_customers')
        .select('user_id')
        .eq('customer_id', customerId)
        .maybeSingle();

      if (userData) {
        const isFirstSubscription = existingSub.plan_tokens === 0;

        if (!isFirstSubscription) {
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

              console.info(`${logPrefix} Sending ${isUpgrade ? 'upgrade' : 'downgrade'} Slack notification for ${profile.email}`);

              try {
                const notifyResult = await notifyAdminSafe({
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

                if (notifyResult.success) {
                  console.info(`${logPrefix} ${isUpgrade ? 'Upgrade' : 'Downgrade'} Slack notification sent successfully`);
                } else {
                  console.error(`${logPrefix} ${isUpgrade ? 'Upgrade' : 'Downgrade'} Slack notification failed:`, notifyResult.error);
                }
              } catch (notifyError) {
                console.error(`${logPrefix} Error sending ${isUpgrade ? 'upgrade' : 'downgrade'} Slack notification:`, notifyError);
              }
            } else {
              console.warn(`${logPrefix} Não foi possível enviar notificação: profile=${!!profile}, oldPlan=${!!oldPlan}, newPlan=${!!newPlan}`);
            }
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
    status: subscription.status,
    price_id: priceId,
    current_period_start: subscription.current_period_start,
    current_period_end: subscription.current_period_end,
    plan_tokens: finalPlanTokens,
    extra_tokens: finalExtraTokens,
    tokens_carried_forward: tokensCarriedForward,
    tokens_total: finalPlanTokens + finalExtraTokens,
    tokens_used: finalTokensUsed,
    updated_at: new Date().toISOString(),
  };

  if (!existingSub || shouldResetTokens) {
    subscriptionData.created_at = new Date().toISOString();
  }

  if (lastPlanChangeAt) {
    subscriptionData.last_plan_change_at = lastPlanChangeAt;
  }

  const { error: upsertError } = await supabase
    .from('stripe_subscriptions')
    .upsert(subscriptionData, {
      onConflict: 'customer_id',
    });

  if (upsertError) {
    console.error(`${logPrefix} Error upserting subscription:`, upsertError);
    throw upsertError;
  }

  console.info(`${logPrefix} Successfully synced subscription for customer ${customerId}`);
}

Deno.serve(async (req: Request) => {
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return new Response('No signature', { status: 400 });
  }

  const body = await req.text();
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured');
    return new Response('Webhook secret not configured', { status: 500 });
  }

  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    console.error(`Webhook signature verification failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    return new Response('Invalid signature', { status: 400 });
  }

  console.info(`[${event.id}] Processing webhook event: ${event.type}`);

  try {
    const stripeData = event.data.object;

    if (event.type === 'customer.created') {
      console.info(`[${event.id}] Customer created event received, no action needed`);
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

        if (event.type === 'customer.subscription.deleted') {
          const subscription = stripeData as Stripe.Subscription;
          console.info(`[${event.id}] Subscription deleted/cancelled, sending cancellation email`);

          try {
            await sendSubscriptionCancellationEmail(event.id, subscription.id);
            console.info(`[${event.id}] Cancellation email sent successfully`);
          } catch (emailError) {
            console.error(`[${event.id}] Failed to send cancellation email:`, emailError);
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

              try {
                const notifyResult = await notifyAdminSafe({
                  type: 'subscription_canceled',
                  title: 'Cancelamento de Assinatura',
                  message: `${userName} | ${profile.email}`,
                  severity: 'medium',
                  metadata: {
                    customer_id: customerId,
                    user_name: userName,
                    user_email: profile.email,
                    subscription_id: subscription.id,
                  },
                  userId: userData.user_id,
                });
                if (notifyResult.success) {
                  console.info(`[${event.id}] Admin notification for cancellation sent successfully`);
                } else {
                  console.error(`[${event.id}] Admin notification for cancellation failed:`, notifyResult.error);
                }
              } catch (notifyError) {
                console.error(`[${event.id}] Failed to send admin notification for cancellation:`, notifyError);
              }
            }
          }
        }

        const { data: existingSubBefore } = await supabase
          .from('stripe_subscriptions')
          .select('plan_tokens')
          .eq('customer_id', customerId)
          .is('deleted_at', null)
          .maybeSingle();

        const wasFirstSubscription = !existingSubBefore || existingSubBefore.plan_tokens === 0;

        await syncCustomerFromStripe(customerId, event.id);

        if (event.type === 'customer.subscription.created') {
          const subscription = stripeData as Stripe.Subscription;
          const subscriptionId = subscription.id;
          const priceId = subscription.items?.data[0]?.price?.id;

          if (wasFirstSubscription) {
            console.info(`[${event.id}] First subscription for customer, sending confirmation email and notification`);

            try {
              await sendSubscriptionConfirmationEmail(event.id, subscriptionId);
              console.info(`[${event.id}] Confirmation email sent successfully`);
            } catch (emailError) {
              console.error(`[${event.id}] Failed to send confirmation email:`, emailError);
            }

            const { data: planData } = await supabase
              .from('subscription_plans')
              .select('name, tokens_included, price_brl')
              .eq('stripe_price_id', priceId)
              .maybeSingle();

            const { data: userData } = await supabase
              .from('stripe_customers')
              .select('user_id')
              .eq('customer_id', customerId)
              .maybeSingle();

            console.info(`[${event.id}] Plan data:`, planData ? 'found' : 'not found');
            console.info(`[${event.id}] User data:`, userData ? 'found' : 'not found');

            if (userData && planData) {
              const { data: profile } = await supabase
                .from('user_profiles')
                .select('email, first_name, last_name')
                .eq('id', userData.user_id)
                .maybeSingle();

              console.info(`[${event.id}] Profile data:`, profile ? 'found' : 'not found');

              if (profile) {
                const userName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email;
                const amountFormatted = ((planData.price_brl || 0)).toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                });
                const tokensFormatted = Number(planData.tokens_included).toLocaleString('pt-BR');

                try {
                  const notifyResult = await notifyAdminSafe({
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
                  if (notifyResult.success) {
                    console.info(`[${event.id}] Admin notification sent successfully`);
                  } else {
                    console.error(`[${event.id}] Admin notification failed:`, notifyResult.error);
                  }
                } catch (notifyError) {
                  console.error(`[${event.id}] Failed to send admin notification:`, notifyError);
                }
              } else {
                console.error(`[${event.id}] Profile not found for user ${userData.user_id}`);
              }
            } else {
              console.error(`[${event.id}] Missing data - userData: ${!!userData}, planData: ${!!planData}`);
            }
          } else {
            console.info(`[${event.id}] Not first subscription (upgrade/downgrade), skipping confirmation email - upgrade/downgrade emails handled by syncCustomerFromStripe`);
          }
        }
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
        console.info(`[${event.id}] Subscription checkout completed - already processed by customer.subscription.created event`);
      } else if (session.mode === 'payment' && session.payment_status === 'paid') {
        console.info(`[${event.id}] Processing token payment`);

        const priceId = session.line_items?.data[0]?.price?.id;

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

        console.info(`[${event.id}] Adding ${tokenPackage.tokens_amount} extra tokens for customer ${customerId}`);

        const { data: subscription, error: subError } = await supabase
          .from('stripe_subscriptions')
          .select('*')
          .eq('customer_id', customerId)
          .is('deleted_at', null)
          .maybeSingle();

        let tokensAdded = false;

        if (subscription) {
          const newExtraTokens = (subscription.extra_tokens || 0) + tokenPackage.tokens_amount;
          const newTotalTokens = subscription.plan_tokens + newExtraTokens;

          const { error: updateError } = await supabase
            .from('stripe_subscriptions')
            .update({
              extra_tokens: newExtraTokens,
              tokens_total: newTotalTokens,
              updated_at: new Date().toISOString(),
            })
            .eq('customer_id', customerId);

          if (updateError) {
            console.error(`[${event.id}] Error updating extra tokens:`, updateError);
          } else {
            tokensAdded = true;
            console.info(`[${event.id}] Successfully added ${tokenPackage.tokens_amount} tokens to subscription`);

            await logTokenCreditAudit({
              event_id: event.id,
              event_type: 'token_purchase',
              customer_id: customerId,
              price_id: priceId,
              operation: 'token_purchase',
              status: 'success',
              subscription_found: true,
              before_extra_tokens: subscription.extra_tokens || 0,
              before_tokens_total: subscription.tokens_total,
              after_extra_tokens: newExtraTokens,
              after_tokens_total: newTotalTokens,
              tokens_amount: tokenPackage.tokens_amount,
              processing_time_ms: 0,
              metadata: {
                package_name: tokenPackage.name,
                tokens_added: tokenPackage.tokens_amount,
              },
            });
          }
        } else {
          console.warn(`[${event.id}] No active subscription found for customer ${customerId}, tokens will be added when subscription is created`);

          await logTokenCreditAudit({
            event_id: event.id,
            event_type: 'token_purchase',
            customer_id: customerId,
            price_id: priceId,
            operation: 'token_purchase_no_subscription',
            status: 'pending',
            subscription_found: false,
            tokens_amount: tokenPackage.tokens_amount,
            processing_time_ms: 0,
            metadata: {
              package_name: tokenPackage.name,
              tokens_added: tokenPackage.tokens_amount,
              note: 'Tokens purchased without active subscription, will be added on next subscription creation',
            },
          });
        }

        const customerEmail = session.customer_details?.email || session.customer_email || null;
        const subscriptionId = typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id || null;

        const userId = await findUserIdForTokenPurchase(
          event.id,
          customerId,
          subscriptionId,
          customerEmail
        );

        if (!userId) {
          console.error(`[${event.id}] Could not identify user for token purchase`);
          await notifyAdminSafe({
            type: 'token_purchase_error',
            title: 'Falha ao Identificar Usuário',
            message: `Compra de tokens não processada | Customer: ${customerId} | Email: ${customerEmail}`,
            severity: 'error',
            metadata: {
              customer_id: customerId,
              subscription_id: subscriptionId,
              customer_email: customerEmail,
              event_id: event.id,
            },
          });

          return new Response(JSON.stringify({ received: true, error: 'User not found' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (!tokensAdded) {
          console.info(`[${event.id}] Re-checking for subscription after user identification...`);
          const { data: retrySubscription } = await supabase
            .from('stripe_subscriptions')
            .select('*')
            .eq('customer_id', customerId)
            .is('deleted_at', null)
            .maybeSingle();

          if (retrySubscription) {
            const newExtraTokens = (retrySubscription.extra_tokens || 0) + tokenPackage.tokens_amount;
            const newTotalTokens = retrySubscription.plan_tokens + newExtraTokens;

            const { error: updateError } = await supabase
              .from('stripe_subscriptions')
              .update({
                extra_tokens: newExtraTokens,
                tokens_total: newTotalTokens,
                updated_at: new Date().toISOString(),
              })
              .eq('customer_id', customerId);

            if (!updateError) {
              tokensAdded = true;
              console.info(`[${event.id}] Successfully added ${tokenPackage.tokens_amount} tokens to subscription`);

              await logTokenCreditAudit({
                event_id: event.id,
                event_type: 'token_purchase',
                customer_id: customerId,
                price_id: priceId,
                operation: 'token_purchase_with_subscription',
                status: 'success',
                subscription_found: true,
                before_extra_tokens: retrySubscription.extra_tokens || 0,
                before_tokens_total: retrySubscription.tokens_total,
                after_extra_tokens: newExtraTokens,
                after_tokens_total: newTotalTokens,
                tokens_amount: tokenPackage.tokens_amount,
                processing_time_ms: 0,
                metadata: {
                  package_name: tokenPackage.name,
                  tokens_added: tokenPackage.tokens_amount,
                },
              });
            }
          }
        }

        const amountPaid = (session.amount_total || 0) / 100;
        const amountFormatted = `R$ ${amountPaid.toFixed(2).replace('.', ',')}`;

        console.info(`[${event.id}] Sending token purchase email for user ${userId}`);

        try {
          const emailResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-token-purchase-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({
              user_id: userId,
              package_name: tokenPackage.name,
              tokens_purchased: tokenPackage.tokens_amount,
              amount_paid: amountFormatted,
            }),
          });

          if (!emailResponse.ok) {
            const errorText = await emailResponse.text();
            console.error(`[${event.id}] Token purchase email failed: ${emailResponse.status} - ${errorText}`);
          } else {
            const result = await emailResponse.json();
            console.info(`[${event.id}] Token purchase email sent successfully:`, result);
          }
        } catch (emailError) {
          console.error(`[${event.id}] Error sending token purchase email:`, emailError);
        }

        const { data: profile } = await supabase
          .from('user_profiles')
          .select('email, first_name, last_name')
          .eq('id', userId)
          .maybeSingle();

        if (profile) {
          const userName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email;

          console.info(`[${event.id}] Sending token purchase Slack notification for ${profile.email}`);

          try {
            const notifyResult = await notifyAdminSafe({
              type: 'token_purchase',
              title: 'Compra de Tokens',
              message: `${amountFormatted} | ${userName} | ${profile.email} | ${tokenPackage.name}`,
              severity: 'success',
              metadata: {
                customer_id: customerId,
                user_name: userName,
                user_email: profile.email,
                package_name: tokenPackage.name,
                tokens_purchased: tokenPackage.tokens_amount,
                amount_paid: amountFormatted,
              },
              userId: userId,
            });

            if (notifyResult.success) {
              console.info(`[${event.id}] Token purchase Slack notification sent successfully`);
            } else {
              console.error(`[${event.id}] Token purchase Slack notification failed:`, notifyResult.error);
            }
          } catch (notifyError) {
            console.error(`[${event.id}] Error sending token purchase Slack notification:`, notifyError);
          }
        } else {
          console.error(`[${event.id}] Profile not found for user ${userId}`);
        }
      }

      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (event.type === 'invoice.payment_failed') {
      const invoice = stripeData as Stripe.Invoice;
      console.info(`[${event.id}] Invoice payment failed for customer ${invoice.customer}`);

      const customerId = typeof invoice.customer === 'string'
        ? invoice.customer
        : invoice.customer?.id;

      if (customerId) {
        const { data: userData } = await supabase
          .from('stripe_customers')
          .select('user_id')
          .eq('customer_id', customerId)
          .maybeSingle();

        if (userData) {
          const paymentIntent = invoice.payment_intent;
          const paymentIntentId = typeof paymentIntent === 'string' ? paymentIntent : paymentIntent?.id || `inv_${invoice.id}`;

          let errorCode: string | undefined;
          let errorMessage: string | undefined;
          let cardBrand: string | undefined;
          let cardLast4: string | undefined;

          if (invoice.charge) {
            const chargeId = typeof invoice.charge === 'string' ? invoice.charge : invoice.charge.id;
            try {
              const charge = await stripe.charges.retrieve(chargeId);
              errorCode = charge.failure_code || undefined;
              errorMessage = charge.failure_message || undefined;
              if (charge.payment_method_details?.card) {
                cardBrand = charge.payment_method_details.card.brand;
                cardLast4 = charge.payment_method_details.card.last4;
              }
            } catch (chargeError) {
              console.error(`[${event.id}] Error retrieving charge details:`, chargeError);
            }
          }

          const amount = invoice.amount_due || 0;
          const currency = invoice.currency || 'brl';

          console.info(`[${event.id}] Sending payment failure email to user ${userData.user_id}`);

          await sendPaymentFailureEmail(
            event.id,
            userData.user_id,
            paymentIntentId,
            amount,
            currency,
            errorCode,
            errorMessage,
            cardBrand,
            cardLast4,
            'renovacao_assinatura'
          );

          const { data: profile } = await supabase
            .from('user_profiles')
            .select('email, first_name, last_name')
            .eq('id', userData.user_id)
            .maybeSingle();

          if (profile) {
            const userName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email;
            const amountFormatted = (amount / 100).toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            });

            try {
              const notifyResult = await notifyAdminSafe({
                type: 'payment_failed',
                title: 'Falha no Pagamento',
                message: `${amountFormatted} | ${userName} | ${profile.email} | ${errorCode || 'Erro desconhecido'}`,
                severity: 'high',
                metadata: {
                  customer_id: customerId,
                  user_name: userName,
                  user_email: profile.email,
                  amount: amountFormatted,
                  error_code: errorCode,
                  error_message: errorMessage,
                  invoice_id: invoice.id,
                },
                userId: userData.user_id,
              });
              if (notifyResult.success) {
                console.info(`[${event.id}] Admin notification for payment failure sent successfully`);
              } else {
                console.error(`[${event.id}] Admin notification for payment failure failed:`, notifyResult.error);
              }
            } catch (notifyError) {
              console.error(`[${event.id}] Failed to send admin notification for payment failure:`, notifyError);
            }
          }
        }
      }

      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = stripeData as Stripe.PaymentIntent;
      console.info(`[${event.id}] Payment intent failed for customer ${paymentIntent.customer}`);

      const customerId = typeof paymentIntent.customer === 'string'
        ? paymentIntent.customer
        : paymentIntent.customer?.id;

      if (customerId) {
        const { data: userData } = await supabase
          .from('stripe_customers')
          .select('user_id')
          .eq('customer_id', customerId)
          .maybeSingle();

        if (userData) {
          const errorCode = paymentIntent.last_payment_error?.code;
          const errorMessage = paymentIntent.last_payment_error?.message;
          let cardBrand: string | undefined;
          let cardLast4: string | undefined;

          if (paymentIntent.charges?.data?.[0]?.payment_method_details?.card) {
            const card = paymentIntent.charges.data[0].payment_method_details.card;
            cardBrand = card.brand;
            cardLast4 = card.last4;
          }

          const amount = paymentIntent.amount || 0;
          const currency = paymentIntent.currency || 'brl';

          console.info(`[${event.id}] Sending payment failure email to user ${userData.user_id}`);

          await sendPaymentFailureEmail(
            event.id,
            userData.user_id,
            paymentIntent.id,
            amount,
            currency,
            errorCode,
            errorMessage,
            cardBrand,
            cardLast4,
            'compra_tokens'
          );

          const { data: profile } = await supabase
            .from('user_profiles')
            .select('email, first_name, last_name')
            .eq('id', userData.user_id)
            .maybeSingle();

          if (profile) {
            const userName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email;
            const amountFormatted = (amount / 100).toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            });

            try {
              const notifyResult = await notifyAdminSafe({
                type: 'payment_failed',
                title: 'Falha no Pagamento',
                message: `${amountFormatted} | ${userName} | ${profile.email} | ${errorCode || 'Erro desconhecido'}`,
                severity: 'high',
                metadata: {
                  customer_id: customerId,
                  user_name: userName,
                  user_email: profile.email,
                  amount: amountFormatted,
                  error_code: errorCode,
                  error_message: errorMessage,
                  payment_intent_id: paymentIntent.id,
                },
                userId: userData.user_id,
              });
              if (notifyResult.success) {
                console.info(`[${event.id}] Admin notification for payment failure sent successfully`);
              } else {
                console.error(`[${event.id}] Admin notification for payment failure failed:`, notifyResult.error);
              }
            } catch (notifyError) {
              console.error(`[${event.id}] Failed to send admin notification for payment failure:`, notifyError);
            }
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

  } catch (error) {
    console.error(`[${event.id}] Error processing webhook:`, error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
});
