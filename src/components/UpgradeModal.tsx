import React from 'react';
import { X, AlertCircle, Coins } from 'lucide-react';
import { SubscriptionPlans } from './subscription/SubscriptionPlans';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';
import { TokenValidationService } from '../services/TokenValidationService';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  tokensRequired: number;
  tokensAvailable: number;
  pagesRequired: number;
  pagesAvailable: number;
  planName?: string;
  reason: 'insufficient_tokens' | 'no_subscription';
}

export function UpgradeModal({
  isOpen,
  onClose,
  tokensRequired,
  tokensAvailable,
  pagesRequired,
  pagesAvailable,
  planName,
  reason,
}: UpgradeModalProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);

  if (!isOpen) return null;

  const getMessage = () => {
    if (reason === 'no_subscription') {
      return {
        title: 'Assinatura Necessária',
        description: 'Você precisa de uma assinatura ativa para processar documentos. Escolha um plano abaixo para começar.',
      };
    }

    return {
      title: 'Tokens Insuficientes',
      description: `Você não possui tokens suficientes para processar este documento. Seu plano atual (${planName}) tem ${TokenValidationService.formatTokenCount(tokensAvailable)} tokens disponíveis (${pagesAvailable} páginas), mas este documento requer ${TokenValidationService.formatTokenCount(tokensRequired)} tokens (${pagesRequired} páginas).`,
    };
  };

  const message = getMessage();

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div
          className="fixed inset-0 transition-opacity backdrop-blur-sm"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.75)' }}
          onClick={onClose}
        />

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
          &#8203;
        </span>

        <div
          className="inline-block align-bottom rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-6xl sm:w-full"
          style={{ backgroundColor: colors.bgPrimary }}
        >
          <div className="px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-3">
                <div
                  className="flex items-center justify-center w-12 h-12 rounded-full"
                  style={{
                    backgroundColor:
                      reason === 'no_subscription'
                        ? 'rgba(59, 130, 246, 0.1)'
                        : 'rgba(245, 158, 11, 0.1)',
                  }}
                >
                  {reason === 'no_subscription' ? (
                    <AlertCircle className="w-6 h-6 text-blue-600" />
                  ) : (
                    <Coins className="w-6 h-6 text-yellow-600" />
                  )}
                </div>
                <div>
                  <h3
                    className="text-2xl font-title font-bold"
                    style={{ color: colors.textPrimary }}
                  >
                    {message.title}
                  </h3>
                  <p className="text-sm mt-1" style={{ color: colors.textSecondary }}>
                    {message.description}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                style={{ color: colors.textSecondary }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {reason === 'insufficient_tokens' && (
              <div
                className="mb-6 p-4 rounded-lg border"
                style={{
                  backgroundColor: theme === 'dark' ? colors.bgTertiary : '#FEF3C7',
                  borderColor: theme === 'dark' ? colors.border : '#FCD34D',
                }}
              >
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                      Detalhes do Consumo
                    </p>
                    <div className="mt-2 space-y-1 text-sm" style={{ color: colors.textSecondary }}>
                      <div className="flex justify-between">
                        <span>Tokens disponíveis:</span>
                        <span className="font-medium">
                          {TokenValidationService.formatTokenCount(tokensAvailable)} ({pagesAvailable}{' '}
                          páginas)
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tokens necessários:</span>
                        <span className="font-medium">
                          {TokenValidationService.formatTokenCount(tokensRequired)} ({pagesRequired}{' '}
                          páginas)
                        </span>
                      </div>
                      <div className="flex justify-between border-t pt-1 mt-2" style={{ borderColor: colors.border }}>
                        <span>Déficit:</span>
                        <span className="font-bold text-yellow-600">
                          {TokenValidationService.formatTokenCount(tokensRequired - tokensAvailable)} tokens
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="mb-4">
              <h4
                className="text-lg font-semibold mb-4 text-center"
                style={{ color: colors.textPrimary }}
              >
                {reason === 'no_subscription'
                  ? 'Escolha seu Plano'
                  : 'Faça Upgrade para Continuar'}
              </h4>
              <SubscriptionPlans onSuccess={onClose} />
            </div>
          </div>

          <div
            className="px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse border-t"
            style={{
              backgroundColor: colors.bgSecondary,
              borderColor: colors.border,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              className="w-full inline-flex justify-center rounded-md border px-4 py-2 text-base font-medium shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 sm:ml-3 sm:w-auto sm:text-sm transition-colors"
              style={{
                borderColor: colors.border,
                color: colors.textPrimary,
                backgroundColor: colors.bgPrimary,
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
