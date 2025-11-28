import React, { useState, useEffect } from 'react';
import { Check, Crown, Star, Zap, Sparkles, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../contexts/ThemeContext';
import { getThemeColors } from '../../utils/themeUtils';
import { CancelSubscriptionModal } from '../CancelSubscriptionModal';
import { TokenBreakdownCard } from './TokenBreakdownCard';
import { AddTokensSection } from './AddTokensSection';
import { useSubscriptionPlans } from '../../hooks/useSubscriptionPlans';

interface SubscriptionPlansProps {
  onSuccess?: () => void;
}

interface SubscriptionData {
  subscription_status: string;
  price_id: string;
}

export function SubscriptionPlans({ onSuccess }: SubscriptionPlansProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const { plans, benefits, loading: plansLoading } = useSubscriptionPlans();
  const [loading, setLoading] = useState<string | null>(null);
  const [currentSubscription, setCurrentSubscription] = useState<SubscriptionData | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelingSubscription, setCancelingSubscription] = useState(false);
  const [syncingSubscription, setSyncingSubscription] = useState(true);
  const [forcingSync, setForcingSync] = useState(false);

  useEffect(() => {
    syncAndFetchSubscription();
  }, []);

  const syncAndFetchSubscription = async () => {
    setSyncingSubscription(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        console.log('Sincronizando assinatura com Stripe...');
        await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-stripe-subscription`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
          }
        );

        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      await fetchCurrentSubscription();
    } catch (error) {
      console.error('Error syncing subscription:', error);
      await fetchCurrentSubscription();
    } finally {
      setSyncingSubscription(false);
    }
  };

  const fetchCurrentSubscription = async () => {
    try {
      const { data, error } = await supabase
        .from('stripe_user_subscriptions')
        .select('subscription_status, price_id')
        .maybeSingle();

      if (!error && data) {
        setCurrentSubscription(data);
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
    }
  };

  const handleSubscribe = async (priceId: string) => {
    setLoading(priceId);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Usuário não autenticado');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          price_id: priceId,
          mode: 'subscription',
          success_url: `${window.location.origin}/success`,
          cancel_url: `${window.location.origin}/subscription`,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao criar sessão de checkout');
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Erro ao processar assinatura:', error);
      alert('Erro ao processar pagamento. Tente novamente.');
      setLoading(null);
    }
  };

  const getIcon = (planName: string) => {
    if (planName.includes('Elite')) return Crown;
    if (planName.includes('Pro')) return Star;
    if (planName.includes('Premium')) return Zap;
    return Sparkles;
  };

  const getPlanColor = (planName: string) => {
    if (planName.includes('Elite')) return '#255886';
    if (planName.includes('Pro')) return '#456684';
    if (planName.includes('Premium')) return '#313B44';
    return '#17191B';
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M tokens`;
    }
    return `${tokens.toLocaleString('pt-BR')} tokens`;
  };

  const handleCancelSubscription = async (): Promise<boolean> => {
    setCancelingSubscription(true);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        console.error('Erro de autenticação:', sessionError);
        return false;
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cancel-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        }
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Erro ao cancelar assinatura:', data);
        return false;
      }

      await fetchCurrentSubscription();
      return true;
    } catch (error: any) {
      console.error('Erro ao cancelar assinatura:', error);
      return false;
    } finally {
      setCancelingSubscription(false);
    }
  };

  const handleForceSync = async () => {
    setForcingSync(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        alert('Sessão expirada. Por favor, faça login novamente.');
        return;
      }

      console.log('Forçando sincronização completa...');
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/force-sync-customer`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao sincronizar');
      }

      console.log('Sincronização bem-sucedida:', data);
      alert('Assinatura sincronizada com sucesso! Recarregue a página.');

      await new Promise(resolve => setTimeout(resolve, 1000));
      window.location.reload();
    } catch (error: any) {
      console.error('Erro ao forçar sincronização:', error);
      alert(`Erro: ${error.message}`);
    } finally {
      setForcingSync(false);
    }
  };


  if (syncingSubscription || plansLoading) {
    return (
      <div className="min-h-screen py-12 px-4 flex items-center justify-center" style={{ backgroundColor: colors.bgPrimary }}>
        <div className="text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: theme === 'dark' ? '#1f2937' : '#e0f2fe' }}>
            <Loader2 className="w-10 h-10 animate-spin" style={{ color: '#3B82F6' }} />
          </div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: colors.textPrimary }}>
            {syncingSubscription ? 'Sincronizando com Stripe...' : 'Carregando planos...'}
          </h2>
          <p style={{ color: colors.textSecondary }}>
            {syncingSubscription ? 'Verificando seu plano atual' : 'Aguarde um momento'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-4" style={{ backgroundColor: colors.bgPrimary }}>
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-title font-bold mb-4" style={{ color: colors.textPrimary }}>
            Escolha seu Plano
          </h1>
          <p className="text-xl max-w-3xl mx-auto" style={{ color: colors.textSecondary }}>
            Escolha o plano ideal para suas necessidades.
          </p>

          {!currentSubscription && (
            <div className="mt-6">
              <button
                onClick={handleForceSync}
                disabled={forcingSync}
                className="px-6 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: theme === 'dark' ? '#3b82f6' : '#2563eb',
                  color: '#fff'
                }}
              >
                {forcingSync ? 'Sincronizando...' : '🔄 Problemas com sua assinatura? Clique aqui'}
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {plans.map((plan) => {
            const Icon = getIcon(plan.name);
            const colorClass = getPlanColor(plan.name);
            const isLoading = loading === plan.stripe_price_id;
            const isCurrentPlan = currentSubscription?.price_id === plan.stripe_price_id
              && (currentSubscription?.subscription_status === 'active' || currentSubscription?.subscription_status === 'trialing');

            const currentPlanIndex = plans.findIndex(p => p.stripe_price_id === currentSubscription?.price_id);
            const productIndex = plans.findIndex(p => p.stripe_price_id === plan.stripe_price_id);

            const hasActiveSubscription = currentSubscription?.subscription_status === 'active' || currentSubscription?.subscription_status === 'trialing';

            let buttonText = 'Assinar Agora';
            if (isCurrentPlan) {
              buttonText = 'Plano Ativo';
            } else if (isLoading) {
              buttonText = 'Processando...';
            } else if (hasActiveSubscription && currentPlanIndex >= 0) {
              if (productIndex > currentPlanIndex) {
                buttonText = 'Upgrade';
              } else if (productIndex < currentPlanIndex) {
                buttonText = 'Downgrade';
              }
            }

            return (
              <div
                key={plan.id}
                className={`rounded-2xl shadow-xl overflow-hidden transform hover:scale-105 transition-all duration-300 ${
                  isCurrentPlan ? 'ring-2 ring-gray-400' : ''
                }`}
                style={{ backgroundColor: colors.bgSecondary }}
              >
                <div className="p-4 text-white" style={{ backgroundColor: colorClass }}>
                  <Icon className="w-8 h-8 mb-2" />
                  <h3 className="text-lg font-bold mb-1">{plan.name}</h3>
                  <div className="text-2xl font-bold">
                    {formatPrice(plan.price_brl)}
                    <span className="text-sm font-normal opacity-80">/mês</span>
                  </div>
                </div>

                <div className="p-4">
                  <div className="mb-4">
                    <div className="rounded-lg p-2 mb-3" style={{ backgroundColor: theme === 'dark' ? colors.bgTertiary : '#f3f4f6' }}>
                      <p className="text-sm font-semibold text-center" style={{ color: colors.textPrimary }}>
                        {formatTokens(plan.tokens_included)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    {(benefits[plan.id] || []).map((benefit) => (
                      <div key={benefit.id} className="flex items-start">
                        <Check className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                        <span className="text-xs leading-tight" style={{ color: colors.textSecondary }}>{benefit.benefit_text}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => !isCurrentPlan && handleSubscribe(plan.stripe_price_id)}
                    disabled={isLoading || isCurrentPlan}
                    className="w-full text-white py-2 px-4 rounded-lg font-semibold hover:opacity-90 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                    style={{ backgroundColor: isCurrentPlan ? '#6b7280' : colorClass }}
                  >
                    {buttonText}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {currentSubscription && (currentSubscription.subscription_status === 'active' || currentSubscription.subscription_status === 'trialing') && (
          <div className="mt-16">
            <div className="rounded-2xl shadow-xl p-8" style={{ backgroundColor: colors.bgSecondary, borderTop: `4px solid ${colors.border}` }}>
              <h2 className="text-2xl font-title font-bold mb-6" style={{ color: colors.textPrimary }}>
                Detalhes do Plano
              </h2>

              <div className="mb-8">
                <TokenBreakdownCard />
              </div>

              <AddTokensSection />

              <div className="pt-6 flex justify-center" style={{ borderTop: `1px solid ${colors.border}` }}>
                <button
                  onClick={() => setShowCancelModal(true)}
                  disabled={cancelingSubscription}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: theme === 'dark' ? '#4b5563' : '#9ca3af',
                    color: '#fff'
                  }}
                >
                  Cancelar Assinatura
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      <CancelSubscriptionModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={handleCancelSubscription}
        isLoading={cancelingSubscription}
        planName={plans.find(p => p.stripe_price_id === currentSubscription?.price_id)?.name || 'Seu plano'}
        onNavigateToHome={() => {
          window.history.pushState({}, '', '/');
          window.dispatchEvent(new PopStateEvent('popstate'));
        }}
      />
    </div>
  );
}