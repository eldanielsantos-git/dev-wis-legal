import { useEffect, useState } from 'react';
import { Coins, Package, Sparkles, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../contexts/ThemeContext';
import { useTokenBalance } from '../../contexts/TokenBalanceContext';
import { getThemeColors } from '../../utils/themeUtils';

interface TokenBreakdown {
  plan_tokens: number;
  extra_tokens: number;
  tokens_total: number;
  tokens_used: number;
}

export function TokenBreakdownCard() {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const { balance, refreshBalance, isRefreshing } = useTokenBalance();
  const [breakdown, setBreakdown] = useState<TokenBreakdown | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTokenBreakdown();

    const channel = supabase
      .channel('token-breakdown-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'stripe_subscriptions',
        },
        () => {
          console.log('🔄 Subscription tokens updated, refreshing breakdown');
          fetchTokenBreakdown();
          refreshBalance();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshBalance]);

  const fetchTokenBreakdown = async () => {
    try {
      const { data, error } = await supabase
        .from('stripe_user_subscriptions')
        .select('plan_tokens, extra_tokens, tokens_total, tokens_used')
        .maybeSingle();

      if (error) {
        console.error('Error fetching token breakdown:', error);
        return;
      }

      setBreakdown(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTokens = (tokens: number): string => {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`;
    }
    return tokens.toLocaleString('pt-BR');
  };

  if (loading) {
    return (
      <div
        className="rounded-xl p-6 border animate-pulse"
        style={{ backgroundColor: colors.bgPrimary, borderColor: colors.border }}
      >
        <div className="h-6 rounded w-1/3 mb-4" style={{ backgroundColor: colors.border }}></div>
        <div className="space-y-3">
          <div className="h-4 rounded w-full" style={{ backgroundColor: colors.border }}></div>
          <div className="h-4 rounded w-full" style={{ backgroundColor: colors.border }}></div>
        </div>
      </div>
    );
  }

  if (!breakdown) {
    return null;
  }

  const tokensAvailable = breakdown.tokens_total - breakdown.tokens_used;

  return (
    <div
      className="rounded-xl p-6 border"
      style={{ backgroundColor: colors.bgPrimary, borderColor: colors.border }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Coins className="w-5 h-5" style={{ color: '#22c55e' }} />
          <h3 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
            Seus Tokens
          </h3>
        </div>
        <button
          onClick={() => {
            fetchTokenBreakdown();
            refreshBalance();
          }}
          disabled={isRefreshing}
          className="p-2 rounded-lg hover:opacity-80 transition-all disabled:opacity-50"
          style={{ backgroundColor: colors.bgSecondary }}
          title="Atualizar tokens"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} style={{ color: colors.textPrimary }} />
        </button>
      </div>

      <div className="space-y-4">
        <div
          className="p-4 rounded-lg border"
          style={{
            backgroundColor: theme === 'dark' ? '#1f2937' : '#f3f4f6',
            borderColor: colors.border
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4" style={{ color: '#3b82f6' }} />
              <span className="text-sm font-medium" style={{ color: colors.textSecondary }}>
                Tokens do Plano
              </span>
            </div>
            <span className="text-lg font-bold" style={{ color: colors.textPrimary }}>
              {formatTokens(breakdown.plan_tokens)}
            </span>
          </div>
        </div>

        {breakdown.extra_tokens > 0 && (
          <div
            className="p-4 rounded-lg border"
            style={{
              backgroundColor: theme === 'dark' ? '#1f2937' : '#ecfdf5',
              borderColor: '#22c55e'
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" style={{ color: '#22c55e' }} />
                <span className="text-sm font-medium" style={{ color: '#22c55e' }}>
                  Tokens Extras
                </span>
              </div>
              <span className="text-lg font-bold" style={{ color: '#22c55e' }}>
                +{formatTokens(breakdown.extra_tokens)}
              </span>
            </div>
            <p className="text-xs mt-1" style={{ color: colors.textSecondary }}>
              Pacotes adicionais comprados
            </p>
          </div>
        )}

        <div
          className="pt-4 border-t"
          style={{ borderColor: colors.border }}
        >
          <div className="flex items-center justify-between">
            <span className="font-medium" style={{ color: colors.textPrimary }}>
              Total Disponível
            </span>
            <span className="text-2xl font-bold" style={{ color: '#22c55e' }}>
              {formatTokens(tokensAvailable)}
            </span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-sm" style={{ color: colors.textSecondary }}>
              Total acumulado
            </span>
            <span className="text-sm" style={{ color: colors.textSecondary }}>
              {formatTokens(breakdown.tokens_total)} tokens
            </span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-sm" style={{ color: colors.textSecondary }}>
              Já utilizados
            </span>
            <span className="text-sm" style={{ color: colors.textSecondary }}>
              {formatTokens(breakdown.tokens_used)} tokens
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
