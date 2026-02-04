import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../contexts/ThemeContext';
import { getThemeColors } from '../../utils/themeUtils';
import { useTokenPackages } from '../../hooks/useTokenPackages';
import { Loader2 } from 'lucide-react';

interface AddTokensSectionProps {
  title?: string;
  description?: string;
  onPurchaseStart?: () => void;
  onPurchaseComplete?: () => void;
  onPurchaseError?: (error: string) => void;
}

export function AddTokensSection({
  title = 'Adicione mais tokens em sua assinatura',
  description = 'Escolha uma das opções abaixo:',
  onPurchaseStart,
  onPurchaseComplete,
  onPurchaseError
}: AddTokensSectionProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const { packages, loading: packagesLoading } = useTokenPackages();
  const [loading, setLoading] = useState<string | null>(null);

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

  const handlePurchaseTokens = async (priceId: string, packageId: string) => {
    if (!priceId) {
      const errorMessage = 'Preço não configurado para este pacote';
      if (onPurchaseError) {
        onPurchaseError(errorMessage);
      }
      return;
    }

    setLoading(packageId);

    if (onPurchaseStart) {
      onPurchaseStart();
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Usuario nao autenticado');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          price_id: priceId,
          mode: 'payment',
          success_url: `${window.location.origin}/success`,
          cancel_url: `${window.location.origin}/tokens`,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao criar sessao de checkout');
      }

      if (data.url) {
        if (onPurchaseComplete) {
          onPurchaseComplete();
        }
        window.location.href = data.url;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao processar compra';

      if (onPurchaseError) {
        onPurchaseError(errorMessage);
      }
      setLoading(null);
    }
  };

  if (packagesLoading) {
    return (
      <div className="mb-8 flex items-center justify-center py-8">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: colors.textPrimary }} />
      </div>
    );
  }

  if (packages.length === 0) {
    return null;
  }

  return (
    <div className="mb-8">
      <h3 className="text-xl font-semibold mb-4" style={{ color: colors.textPrimary }}>
        {title}
      </h3>

      <p className="mb-6" style={{ color: colors.textSecondary }}>
        {description}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {packages.map((pkg) => {
          const isLoading = loading === pkg.id;
          return (
            <button
              key={pkg.id}
              onClick={() => handlePurchaseTokens(pkg.stripe_price_id, pkg.id)}
              disabled={isLoading || loading !== null || !pkg.stripe_price_id}
              className="p-6 rounded-xl text-left transition-all duration-200 hover:shadow-lg hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: colors.bgPrimary,
                border: `2px solid ${colors.border}`
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h4 className="text-lg font-bold mb-1" style={{ color: colors.textPrimary }}>
                    {pkg.name}
                  </h4>
                  <p className="text-sm mb-2" style={{ color: colors.textSecondary }}>
                    {formatTokens(pkg.tokens_amount)}
                  </p>
                </div>
              </div>
              <div className="flex items-baseline">
                <span className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
                  {formatPrice(pkg.price_brl)}
                </span>
                <span className="ml-2 text-sm" style={{ color: colors.textSecondary }}>
                  pagamento único
                </span>
              </div>
              {isLoading && (
                <div className="mt-4 text-center">
                  <span className="text-sm font-medium" style={{ color: '#22c55e' }}>
                    Processando...
                  </span>
                </div>
              )}
              {!pkg.stripe_price_id && (
                <div className="mt-4 text-center">
                  <span className="text-xs" style={{ color: '#EF4444' }}>
                    Preco nao configurado
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
