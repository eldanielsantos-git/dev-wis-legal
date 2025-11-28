import React, { useEffect, useState } from 'react';
import { Crown, Calendar, CreditCard, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { stripeProducts } from '../../stripe-config';

interface SubscriptionData {
  subscription_status: string;
  price_id: string;
  current_period_end: number;
  payment_method_brand: string;
  payment_method_last4: string;
}

export function SubscriptionStatus() {
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    initializeSubscription();
  }, []);

  const initializeSubscription = async () => {
    await syncWithStripe();
    await fetchSubscription();
  };

  const syncWithStripe = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-stripe-subscription`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        console.log('Sync response:', await response.text());
      }
    } catch (error) {
      console.error('Error syncing with Stripe:', error);
    }
  };

  const fetchSubscription = async () => {
    try {
      const { data, error } = await supabase
        .from('stripe_user_subscriptions')
        .select('*')
        .maybeSingle();

      if (error) {
        console.error('Error fetching subscription:', error);
        return;
      }

      setSubscription(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setSyncing(true);
    await syncWithStripe();
    await fetchSubscription();
    setSyncing(false);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-8 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (!subscription || subscription.subscription_status === 'not_started') {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <div className="flex items-center">
          <Crown className="w-6 h-6 text-yellow-600 mr-3" />
          <div>
            <h3 className="text-lg font-semibold text-yellow-800">Nenhuma assinatura ativa</h3>
            <p className="text-yellow-700">Escolha um plano para começar a usar o Wis Legal.</p>
          </div>
        </div>
      </div>
    );
  }

  const currentProduct = stripeProducts.find(p => p.priceId === subscription.price_id);
  const isActive = subscription.subscription_status === 'active';

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('pt-BR');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'past_due':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'canceled':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return 'Ativa';
      case 'past_due':
        return 'Pagamento em atraso';
      case 'canceled':
        return 'Cancelada';
      case 'trialing':
        return 'Período de teste';
      default:
        return status;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <Crown className="w-5 h-5 mr-2 text-blue-600" />
          Assinatura Atual
        </h3>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={syncing}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            title="Sincronizar com Stripe"
          >
            <RefreshCw className={`w-4 h-4 text-gray-600 ${syncing ? 'animate-spin' : ''}`} />
          </button>
          <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(subscription.subscription_status)}`}>
            {getStatusText(subscription.subscription_status)}
          </span>
        </div>
      </div>

      {currentProduct && (
        <div className="space-y-4">
          <div>
            <h4 className="text-xl font-bold text-gray-900">{currentProduct.name}</h4>
            <p className="text-gray-600">{currentProduct.tokens}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {subscription.current_period_end && (
              <div className="flex items-center text-sm text-gray-600">
                <Calendar className="w-4 h-4 mr-2" />
                Renovação: {formatDate(subscription.current_period_end)}
              </div>
            )}

            {subscription.payment_method_brand && subscription.payment_method_last4 && (
              <div className="flex items-center text-sm text-gray-600">
                <CreditCard className="w-4 h-4 mr-2" />
                {subscription.payment_method_brand.toUpperCase()} •••• {subscription.payment_method_last4}
              </div>
            )}
          </div>

          {isActive && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-800 text-sm">
                ✅ Sua assinatura está ativa e você pode usar todos os recursos do seu plano.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}