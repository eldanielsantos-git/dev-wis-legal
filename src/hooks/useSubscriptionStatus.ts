import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface SubscriptionStatus {
  hasSubscription: boolean;
  planName: string | null;
  tokensRemaining: number;
  tokensLimit: number;
  pagesRemaining: number;
  pagesLimit: number;
  subscriptionStatus: string | null;
  loading: boolean;
  error: string | null;
}

const getPlanNameFromPriceId = (priceId: string): string | null => {
  const planNames: { [key: string]: string } = {
    'price_1SG3zEJrr43cGTt4oUj89h9u': 'Básico',
    'price_1SG40ZJrr43cGTt4SGCX0JUZ': 'Premium',
    'price_1SG41xJrr43cGTt4MQwqdEiv': 'Pro',
    'price_1SG43JJrr43cGTt4URQn0TxZ': 'Elite',
  };
  return planNames[priceId] || null;
};

export function useSubscriptionStatus(userId: string | undefined): SubscriptionStatus {
  const [status, setStatus] = useState<SubscriptionStatus>({
    hasSubscription: false,
    planName: null,
    tokensRemaining: 0,
    tokensLimit: 0,
    pagesRemaining: 0,
    pagesLimit: 0,
    subscriptionStatus: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!userId) {
      setStatus(prev => ({ ...prev, loading: false }));
      return;
    }

    let isMounted = true;

    const syncSubscription = async (customerId: string): Promise<boolean> => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return false;

        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-stripe-subscription`;
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ customer_id: customerId }),
        });

        if (response.ok) {
          console.log('[useSubscriptionStatus] Subscription synced successfully');
          return true;
        }
        return false;
      } catch (err) {
        console.error('[useSubscriptionStatus] Error syncing subscription:', err);
        return false;
      }
    };

    const loadSubscriptionStatus = async () => {
      try {
        console.log('[useSubscriptionStatus] Loading for userId:', userId);

        const { data: customerData } = await supabase
          .from('stripe_customers')
          .select('customer_id')
          .eq('user_id', userId)
          .is('deleted_at', null)
          .maybeSingle();

        console.log('[useSubscriptionStatus] Customer data:', customerData);

        if (!customerData?.customer_id) {
          console.log('[useSubscriptionStatus] No customer found, setting hasSubscription=false');
          if (isMounted) {
            setStatus({
              hasSubscription: false,
              planName: null,
              tokensRemaining: 0,
              tokensLimit: 0,
              pagesRemaining: 0,
              pagesLimit: 0,
              subscriptionStatus: null,
              loading: false,
              error: null,
            });
          }
          return;
        }

        const { data: subscriptionData, error: subError } = await supabase
          .from('stripe_subscriptions')
          .select('status, price_id, tokens_total, tokens_used, subscription_id, current_period_end')
          .eq('customer_id', customerData.customer_id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (subError) throw subError;

        console.log('[useSubscriptionStatus] Subscription data:', subscriptionData);

        if (!subscriptionData || !subscriptionData.subscription_id || subscriptionData.status === 'not_started') {
          console.log('[useSubscriptionStatus] Detected inconsistent subscription data, syncing...');
          const synced = await syncSubscription(customerData.customer_id);

          if (synced) {
            const { data: updatedData } = await supabase
              .from('stripe_subscriptions')
              .select('status, price_id, tokens_total, tokens_used, subscription_id, current_period_end')
              .eq('customer_id', customerData.customer_id)
              .is('deleted_at', null)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (updatedData) {
              const isActiveStatus = ['active', 'trialing'].includes(updatedData.status || '');
              const isCanceledButValid = updatedData.status === 'canceled' &&
                updatedData.current_period_end &&
                new Date(updatedData.current_period_end * 1000) > new Date();

              if (isActiveStatus || isCanceledButValid) {
                const tokensTotal = updatedData.tokens_total || 0;
                const tokensUsed = updatedData.tokens_used || 0;
                const tokensRemaining = Math.max(tokensTotal - tokensUsed, 0);
                const pagesRemaining = Math.round(tokensRemaining / 5500);
                const pagesLimit = Math.round(tokensTotal / 5500);
                const planName = getPlanNameFromPriceId(updatedData.price_id || '');

                if (isMounted) {
                  setStatus({
                    hasSubscription: true,
                    planName: planName,
                    tokensRemaining: tokensRemaining,
                    tokensLimit: tokensTotal,
                    pagesRemaining: pagesRemaining,
                    pagesLimit: pagesLimit,
                    subscriptionStatus: updatedData.status || null,
                    loading: false,
                    error: null,
                  });
                }
                return;
              }
            }
          }
        }

        const isActiveStatus = subscriptionData && ['active', 'trialing'].includes(subscriptionData.status || '');
        const isCanceledButValid = subscriptionData &&
          subscriptionData.status === 'canceled' &&
          subscriptionData.current_period_end &&
          new Date(subscriptionData.current_period_end * 1000) > new Date();

        if (subscriptionData && (isActiveStatus || isCanceledButValid)) {
          const tokensTotal = subscriptionData.tokens_total || 0;
          const tokensUsed = subscriptionData.tokens_used || 0;
          const tokensRemaining = Math.max(tokensTotal - tokensUsed, 0);
          const pagesRemaining = Math.round(tokensRemaining / 5500);
          const pagesLimit = Math.round(tokensTotal / 5500);
          const planName = getPlanNameFromPriceId(subscriptionData.price_id || '');

          console.log('[useSubscriptionStatus] Setting hasSubscription=true, tokens:', {
            total: tokensTotal,
            used: tokensUsed,
            remaining: tokensRemaining,
            planName: planName,
            status: subscriptionData.status,
          });

          if (isMounted) {
            setStatus({
              hasSubscription: true,
              planName: planName,
              tokensRemaining: tokensRemaining,
              tokensLimit: tokensTotal,
              pagesRemaining: pagesRemaining,
              pagesLimit: pagesLimit,
              subscriptionStatus: subscriptionData.status || null,
              loading: false,
              error: null,
            });
          }
        } else {
          console.log('[useSubscriptionStatus] Setting hasSubscription=false, status:', subscriptionData?.status);
          if (isMounted) {
            setStatus({
              hasSubscription: false,
              planName: null,
              tokensRemaining: 0,
              tokensLimit: 0,
              pagesRemaining: 0,
              pagesLimit: 0,
              subscriptionStatus: subscriptionData?.status || null,
              loading: false,
              error: null,
            });
          }
        }
      } catch (err) {
        console.error('[useSubscriptionStatus] Erro ao carregar status:', err);
        if (isMounted) {
          setStatus(prev => ({
            ...prev,
            loading: false,
            error: err instanceof Error ? err.message : 'Erro ao carregar status da assinatura',
          }));
        }
      }
    };

    loadSubscriptionStatus();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  return status;
}
