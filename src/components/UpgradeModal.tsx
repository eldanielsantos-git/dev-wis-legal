import React from 'react';
import { X, Coins } from 'lucide-react';
import { SubscriptionPlans } from './subscription/SubscriptionPlans';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  tokensRequired: number;
  tokensAvailable: number;
  pagesRequired: number;
  pagesAvailable: number;
  planName?: string;
  reason: 'insufficient_tokens' | 'no_subscription';
  onNavigateToTokens?: () => void;
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
  onNavigateToTokens,
}: UpgradeModalProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);

  if (!isOpen) return null;

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
              <div className="flex-1 text-center">
                <h3
                  className="text-xl font-title font-semibold mb-2"
                  style={{ color: colors.textPrimary }}
                >
                  Para fazer a análise deste processo você não tem tokens suficientes.
                </h3>
                <p className="text-sm" style={{ color: colors.textSecondary }}>
                  Escolha o plano ideal para sua necessidade.
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
                style={{ color: colors.textSecondary }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-6">
              <SubscriptionPlans onSuccess={onClose} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
