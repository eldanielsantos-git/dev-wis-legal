import React, { useEffect, useState } from 'react';
import { CheckCircle, ArrowRight, Home, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { stripeProducts } from '../../stripe-config';
import { useTheme } from '../../contexts/ThemeContext';
import { getThemeColors } from '../../utils/themeUtils';

interface SubscriptionData {
  subscription_status: string;
  price_id: string;
}

export function SuccessPage() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [countdown, setCountdown] = useState(8);
  const [syncing, setSyncing] = useState(true);
  const [syncComplete, setSyncComplete] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    syncSubscription();
  }, []);

  useEffect(() => {
    if (!syncing && syncComplete) {
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            const urlParams = new URLSearchParams(window.location.search);
            const sessionId = urlParams.get('session_id');
            navigate(`/app?from_stripe=success&session_id=${sessionId || 'unknown'}`);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [syncing, syncComplete, navigate]);

  const syncSubscription = async () => {
    setSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Usuário não autenticado');
        setSyncing(false);
        return;
      }

      console.log('Sincronizando assinatura com Stripe...');
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
        throw new Error('Erro ao sincronizar assinatura');
      }

      await new Promise(resolve => setTimeout(resolve, 2000));

      const { data: customerData, error: custError } = await supabase
        .from('stripe_customers')
        .select('customer_id')
        .eq('user_id', session.user.id)
        .is('deleted_at', null)
        .maybeSingle();

      if (custError || !customerData) {
        throw new Error('Cliente Stripe não encontrado');
      }

      const { data: subData, error: subError } = await supabase
        .from('stripe_subscriptions')
        .select('status, price_id')
        .eq('customer_id', customerData.customer_id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subError) {
        throw subError;
      }

      if (subData) {
        setSubscription({
          subscription_status: subData.status,
          price_id: subData.price_id
        });
      }
      setSyncComplete(true);
    } catch (error: any) {
      console.error('Erro ao sincronizar:', error);
      setError(error.message || 'Erro ao sincronizar assinatura');
    } finally {
      setSyncing(false);
    }
  };

  const getPlanInfo = () => {
    if (!subscription) return null;
    return stripeProducts.find(p => p.priceId === subscription.price_id);
  };

  const planInfo = getPlanInfo();

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: colors.bgPrimary }}>
      <div className="max-w-md w-full">
        <div className="rounded-2xl shadow-xl p-8 text-center" style={{ backgroundColor: colors.bgSecondary }}>
          {syncing ? (
            <>
              <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: theme === 'dark' ? '#1f2937' : '#e0f2fe' }}>
                <Loader2 className="w-12 h-12 animate-spin" style={{ color: '#3B82F6' }} />
              </div>

              <h1 className="text-3xl font-bold mb-4" style={{ color: colors.textPrimary }}>
                Sincronizando com Stripe...
              </h1>

              <p className="mb-8" style={{ color: colors.textSecondary }}>
                Aguarde enquanto confirmamos sua assinatura e ativamos seu plano.
              </p>
            </>
          ) : error ? (
            <>
              <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: theme === 'dark' ? '#FAFAFA' : '#fee2e2' }}>
                <CheckCircle className="w-12 h-12" style={{ color: theme === 'dark' ? '#0F0E0D' : '#dc2626' }} />
              </div>

              <h1 className="text-3xl font-bold mb-4" style={{ color: colors.textPrimary }}>
                Erro na Sincronização
              </h1>

              <p className="mb-8" style={{ color: colors.textSecondary }}>
                {error}
              </p>

              <button
                onClick={() => navigate('/')}
                className="w-full py-3 px-6 rounded-lg font-semibold transition-colors flex items-center justify-center"
                style={{ backgroundColor: '#3B82F6', color: '#FFFFFF' }}
              >
                <Home className="w-5 h-5 mr-2" />
                Ir para Dashboard
              </button>
            </>
          ) : (
            <>
              <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: theme === 'dark' ? '#065f46' : '#d1fae5' }}>
                <CheckCircle className="w-12 h-12 text-green-600" />
              </div>

              <h1 className="text-3xl font-bold mb-4" style={{ color: colors.textPrimary }}>
                Pagamento Confirmado!
              </h1>

              {planInfo && (
                <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: theme === 'dark' ? colors.bgTertiary : '#f3f4f6' }}>
                  <p className="text-sm mb-2" style={{ color: colors.textSecondary }}>
                    Plano Ativo:
                  </p>
                  <h2 className="text-2xl font-bold mb-1" style={{ color: colors.textPrimary }}>
                    {planInfo.name}
                  </h2>
                  <p className="text-lg font-semibold" style={{ color: '#10B981' }}>
                    {planInfo.tokens}
                  </p>
                </div>
              )}

              <p className="mb-8" style={{ color: colors.textSecondary }}>
                Sua assinatura foi ativada com sucesso. Agora você pode aproveitar todos os recursos do seu plano.
              </p>

              <div className="space-y-4">
                <button
                  onClick={() => {
                    const urlParams = new URLSearchParams(window.location.search);
                    const sessionId = urlParams.get('session_id');
                    navigate(`/app?from_stripe=success&session_id=${sessionId || 'unknown'}`);
                  }}
                  className="w-full py-3 px-6 rounded-lg font-semibold hover:opacity-90 focus:ring-2 focus:ring-offset-2 transition-colors flex items-center justify-center"
                  style={{ backgroundColor: '#10B981', color: '#FFFFFF' }}
                >
                  <Home className="w-5 h-5 mr-2" />
                  Ir para Dashboard
                </button>

                <div className="text-sm" style={{ color: colors.textSecondary }}>
                  Redirecionando automaticamente em {countdown} segundos...
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}