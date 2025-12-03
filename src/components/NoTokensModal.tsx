import React from 'react';
import { X, AlertCircle, Zap, CreditCard } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';

interface NoTokensModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToSubscription: () => void;
  onNavigateToTokens: () => void;
}

export function NoTokensModal({ isOpen, onClose, onNavigateToSubscription, onNavigateToTokens }: NoTokensModalProps) {
  const { theme } = useTheme();

  if (!isOpen) return null;

  // Cores invertidas: dark mode = fundo branco, light mode = fundo preto
  const modalBg = theme === 'dark' ? '#FFFFFF' : '#141312';
  const textPrimary = theme === 'dark' ? '#141312' : '#FFFFFF';
  const textSecondary = theme === 'dark' ? 'rgba(20, 19, 18, 0.7)' : 'rgba(255, 255, 255, 0.7)';
  const iconBg = theme === 'dark' ? 'rgba(255, 107, 107, 0.1)' : 'rgba(255, 107, 107, 0.2)';
  const closeHoverBg = theme === 'dark' ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.1)';

  // Botão Ver Planos
  const btnPrimaryBg = theme === 'dark' ? '#29323A' : '#FAFAFA';
  const btnPrimaryText = theme === 'dark' ? '#FFFFFF' : '#141312';

  // Botão Comprar Tokens
  const btnSecondaryBorder = theme === 'dark' ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.2)';
  const btnSecondaryHoverBg = theme === 'dark' ? 'rgba(0, 0, 0, 0.02)' : 'rgba(255, 255, 255, 0.05)';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div
        className="rounded-lg shadow-xl max-w-md w-full p-6 relative"
        style={{ backgroundColor: modalBg }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg transition-colors"
          style={{ color: textSecondary }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = closeHoverBg;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div
            className="p-3 rounded-full"
            style={{ backgroundColor: iconBg }}
          >
            <AlertCircle className="w-6 h-6" style={{ color: '#FF6B6B' }} />
          </div>
          <h2 className="text-xl font-bold" style={{ color: textPrimary }}>
            Tokens Insuficientes
          </h2>
        </div>

        <div className="mb-6 space-y-3">
          <p className="text-base" style={{ color: textPrimary }}>
            Você não possui assinatura ativa ou tokens disponíveis para utilizar o chat.
          </p>
          <p className="text-sm" style={{ color: textSecondary }}>
            Para continuar conversando sobre seus processos, você precisa:
          </p>
          <ul className="space-y-2 text-sm" style={{ color: textSecondary }}>
            <li className="flex items-start gap-2">
              <span className="mt-1">•</span>
              <span>Assinar um plano mensal com tokens inclusos</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1">•</span>
              <span>Comprar pacotes avulsos de tokens</span>
            </li>
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => {
              onClose();
              onNavigateToSubscription();
            }}
            className="flex-1 px-4 py-3 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2"
            style={{
              backgroundColor: btnPrimaryBg,
              color: btnPrimaryText,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <CreditCard className="w-4 h-4" />
            <span>Ver Planos</span>
          </button>

          <button
            onClick={() => {
              onClose();
              onNavigateToTokens();
            }}
            className="flex-1 px-4 py-3 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2 border-2"
            style={{
              backgroundColor: 'transparent',
              color: textPrimary,
              borderColor: btnSecondaryBorder,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.backgroundColor = btnSecondaryHoverBg;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <Zap className="w-4 h-4" />
            <span>Comprar Tokens</span>
          </button>
        </div>
      </div>
    </div>
  );
}
