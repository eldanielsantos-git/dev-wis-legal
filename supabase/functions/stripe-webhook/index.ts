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
      console.error(\`Error fetching plan tokens for price_id \${priceId}:\`, error);
      return 0;
    }

    if (!plan) {
      console.warn(\`No active plan found for price_id \${priceId}, returning 0 tokens\`);
      return 0;
    }

    return Number(plan.tokens_included) || 0;
  } catch (err) {
    console.error(\`Exception fetching plan tokens for price_id \${priceId}:\`, err);
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

async function sendSubscriptionConfirmationEmail(eventId: string, subscriptionId: string) {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const url = \`\${supabaseUrl}/functions/v1/send-subscription-confirmation-email\`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}\`,
      },
      body: JSON.stringify({ subscription_id: subscriptionId }),
    });

    if (!response.ok) {
      console.error(\`[\${eventId}] Failed to send subscription confirmation email: \${response.status}\`);
    } else {
      console.info(\`[\${eventId}] Subscription confirmation email sent successfully\`);
    }
  } catch (error) {
    console.error(\`[\${eventId}] Error sending subscription confirmation email:\`, error);
  }
}

async function syncCustomerFromStripe(customerId: string, eventId: string) {
  const logPrefix = \`[\${eventId}]\`;
  console.info(\`\${logPrefix} Syncing customer \${customerId}\`);

  const customer = await stripe.customers.retrieve(customerId, {
    expand: ['subscriptions'],
  });

  if (customer.deleted) {
    console.warn(\`\${logPrefix} Customer deleted, skipping sync\`);
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
    console.error(\`\${logPrefix} Error fetching existing subscription:\`, existingSubError);
    throw existingSubError;
  }

  const subscriptions = customer.subscriptions!;

  if (subscriptions.data.length === 0) {
    console.info(\`\${logPrefix} Customer has no active subscriptions\`);

    if (existingSub) {
      const { error: deleteError } = await supabase
        .from('stripe_subscriptions')
        .update({ deleted_at: new Date().toISOString() })
        .eq('customer_id', customerId);

      if (deleteError) {
        console.error(\`\${logPrefix} Error marking subscription as deleted:\`, deleteError);
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
      console.error(\`\${logPrefix} Error upserting no subscription record:\`, noSubError);
      throw noSubError;
    }

    return;
  }

  const subscription = subscriptions.data[0];
  console.info(\`\${logPrefix} Found subscription: \${subscription.id} with status: \${subscription.status}\`);

  const priceId = subscription.items?.data[0]?.price?.id;
  const planTokens = await getPlanTokensFromPriceId(priceId || '');

  console.info(\`\${logPrefix} Plan tokens for price \${priceId}: \${planTokens}\`);

  let finalPlanTokens = planTokens;
  let finalExtraTokens = existingSub?.extra_tokens || 0;
  let finalTokensUsed = existingSub?.tokens_used || 0;
  let tokensCarriedForward = existingSub?.tokens_carried_forward || 0;
  let shouldResetTokens = false;

  if (existingSub) {
    const oldPriceId = existingSub.price_id;

    if (priceId !== oldPriceId) {
      console.info(\`\${logPrefix} Plan change detected: \${oldPriceId} -> \${priceId}\`);
      lastPlanChangeAt = new Date().toISOString();
      shouldResetTokens = true;

      const remainingTokens = existingSub.tokens_total - existingSub.tokens_used;

      if (remainingTokens > 0) {
        tokensCarriedForward = (existingSub.tokens_carried_forward || 0) + remainingTokens;
        finalExtraTokens = (existingSub.extra_tokens || 0) + remainingTokens;
        console.info(\`\${logPrefix} Carrying forward \${remainingTokens} unused tokens as extra_tokens\`);
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
        const isFirstSubscription = existingSub.plan_tokens === 0;

        if (isFirstSubscription) {
          console.info(\`\${logPrefix} First subscription detected (before_plan_tokens = 0), treating as new subscription\`);

          const { data: profile } = await supabase
            .from('user_profiles')
            .select('email, first_name, last_name')
            .eq('id', userData.user_id)
            .maybeSingle();

          const { data: planData } = await supabase
            .from('subscription_plans')
            .select('name, tokens_included, price_brl')
            .eq('stripe_price_id', priceId)
            .maybeSingle();

          if (profile && planData) {
            const userName = \`\${profile.first_name || ''} \${profile.last_name || ''}\`.trim() || profile.email;
            const amountFormatted = ((planData.price_brl || 0)).toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            });
            const tokensFormatted = Number(planData.tokens_included).toLocaleString('pt-BR');

            console.info(\`\${logPrefix} Sending confirmation email for first subscription\`);
            await sendSubscriptionConfirmationEmail(eventId, subscription.id);

            console.info(\`\${logPrefix} Sending admin notification for first subscription\`);
            await notifyAdminSafe({
              type: 'subscription_created',
              title: 'Compra de Assinatura',
              message: \`\${amountFormatted} | \${userName} | \${profile.email} | \${planData.name}\`,
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
        } else {
          const tenSecondsAgo = new Date(Date.now() - 10000).toISOString();

          const { data: recentNotifications } = await supabase
            .from('admin_notifications')
            .select(\`
              id,
              metadata,
              notification_type_id,
              admin_notification_types!inner(slug)
            \`)
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
            console.info(\`\${logPrefix} Notificação de upgrade/downgrade já enviada recentemente, pulando duplicata\`);
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

            console.info(\`\${logPrefix} Old plan:\`, oldPlan, 'New plan:', newPlan);

            if (profile && oldPlan && newPlan) {
              const isUpgrade = finalPlanTokens > existingSub.plan_tokens;
              const notificationType = isUpgrade ? 'subscription_upgraded' : 'subscription_downgraded';

              const { data: fullProfile } = await supabase
                .from('user_profiles')
                .select('first_name, last_name')
                .eq('id', userData.user_id)
                .maybeSingle();

              const userName = fullProfile ? \`\${fullProfile.first_name || ''} \${fullProfile.last_name || ''}\`.trim() || profile.email : profile.email;

              await notifyAdminSafe({
                type: notificationType,
                title: isUpgrade ? 'Upgrade de Assinatura' : 'Downgrade de Assinatura',
                message: \`\${userName} | \${profile.email} | \${oldPlan.name} → \${newPlan.name}\`,
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
              console.warn(\`\${logPrefix} Não foi possível enviar notificação: profile=\${!!profile}, oldPlan=\${!!oldPlan}, newPlan=\${!!newPlan}\`);
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
    console.error(\`\${logPrefix} Error upserting subscription:\`, upsertError);
    throw upsertError;
  }

  console.info(\`\${logPrefix} Successfully synced subscription for customer \${customerId}\`);
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
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error(\`Webhook signature verification failed: \${err instanceof Error ? err.message : 'Unknown error'}\`);
    return new Response('Invalid signature', { status: 400 });
  }

  console.info(\`[\${event.id}] Processing webhook event: \${event.type}\`);

  try {
    const stripeData = event.data.object;

    if (event.type === 'customer.created') {
      console.info(\`[\${event.id}] Customer created event received, no action needed\`);
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
        console.info(\`[\${event.id}] Syncing subscription for \${customerId}\`);
        await syncCustomerFromStripe(customerId, event.id);

        if (event.type === 'customer.subscription.created') {
          const subscription = stripeData as Stripe.Subscription;
          const subscriptionId = subscription.id;
          const priceId = subscription.items?.data[0]?.price?.id;

          console.info(\`[\${event.id}] New subscription created, sending email and notification immediately\`);

          await sendSubscriptionConfirmationEmail(event.id, subscriptionId);

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

          if (userData && planData) {
            const { data: profile } = await supabase
              .from('user_profiles')
              .select('email, first_name, last_name')
              .eq('id', userData.user_id)
              .maybeSingle();

            if (profile) {
              const userName = \`\${profile.first_name || ''} \${profile.last_name || ''}\`.trim() || profile.email;
              const amountFormatted = ((planData.price_brl || 0)).toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              });
              const tokensFormatted = Number(planData.tokens_included).toLocaleString('pt-BR');

              await notifyAdminSafe({
                type: 'subscription_created',
                title: 'Compra de Assinatura',
                message: \`\${amountFormatted} | \${userName} | \${profile.email} | \${planData.name}\`,
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
        console.warn(\`[\${event.id}] No customer in checkout session\`);
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (session.mode === 'payment') {
        console.info(\`[\${event.id}] Expanding line_items for payment session\`);
        session = await stripe.checkout.sessions.retrieve(session.id, {
          expand: ['line_items', 'line_items.data.price'],
        });
      }

      if (session.mode === 'subscription') {
        console.info(\`[\${event.id}] Subscription checkout completed - already processed by customer.subscription.created event\`);
      } else if (session.mode === 'payment' && session.payment_status === 'paid') {
        console.info(\`[\${event.id}] Processing token payment\`);

        const priceId = session.line_items?.data[0]?.price?.id;

        if (!priceId) {
          console.error(\`[\${event.id}] No price ID in session\`);
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
          console.error(\`[\${event.id}] Token package not found\`);
          return new Response(JSON.stringify({ received: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        console.info(\`[\${event.id}] Adding \${tokenPackage.tokens_amount} extra tokens for customer \${customerId}\`);

        const { data: subscription, error: subError } = await supabase
          .from('stripe_subscriptions')
          .select('*')
          .eq('customer_id', customerId)
          .is('deleted_at', null)
          .maybeSingle();

        if (subError || !subscription) {
          console.error(\`[\${event.id}] Subscription not found for customer \${customerId}:\`, subError);
          return new Response(JSON.stringify({ received: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

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
          console.error(\`[\${event.id}] Error updating extra tokens:\`, updateError);
          throw updateError;
        }

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

        console.info(\`[\${event.id}] Successfully added \${tokenPackage.tokens_amount} tokens\`);
      }

      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.info(\`[\${event.id}] Unhandled event type: \${event.type}\`);
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error(\`[\${event.id}] Error processing webhook:\`, error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});
