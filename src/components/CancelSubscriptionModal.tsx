import React, { useState } from 'react';
import { X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';

interface CancelSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<boolean>;
  isLoading: boolean;
  planName: string;
  onNavigateToHome?: () => void;
}

export function CancelSubscriptionModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
  planName,
  onNavigateToHome
}: CancelSubscriptionModalProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleConfirm = async () => {
    const success = await onConfirm();
    if (success) {
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        onClose();
        if (onNavigateToHome) {
          onNavigateToHome();
        }
      }, 2000);
    }
  };

  if (!isOpen) return null;

  if (showSuccess) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
        <div
          className="relative w-full max-w-md rounded-2xl shadow-2xl p-8"
          style={{ backgroundColor: colors.bgPrimary }}
        >
          <div className="flex flex-col items-center text-center">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
              style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)' }}
            >
              <CheckCircle2 className="w-12 h-12 text-green-500" />
            </div>

            <h2
              className="text-2xl font-bold mb-2"
              style={{ color: colors.textPrimary }}
            >
              Assinatura Cancelada
            </h2>

            <p
              className="text-base"
              style={{ color: colors.textSecondary }}
            >
              Sua assinatura foi cancelada com sucesso. Você ainda terá acesso aos seus tokens disponíveis.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div
        className="relative w-full max-w-md rounded-2xl shadow-2xl p-6"
        style={{ backgroundColor: colors.bgPrimary }}
      >
        <button
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-4 right-4 p-2 rounded-lg transition-colors hover:bg-opacity-10 hover:bg-gray-500 disabled:opacity-50"
          style={{ color: colors.textSecondary }}
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
            style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
          >
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>

          <h2
            className="text-2xl font-bold mb-2"
            style={{ color: colors.textPrimary }}
          >
            Cancelar Assinatura
          </h2>

          <p
            className="text-base mb-6"
            style={{ color: colors.textSecondary }}
          >
            Tem certeza que deseja cancelar sua assinatura do plano <strong>{planName}</strong>?
          </p>

          <div
            className="w-full p-4 rounded-lg mb-6 text-left text-sm"
            style={{
              backgroundColor: theme === 'dark' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)',
              color: colors.textSecondary
            }}
          >
            <p className="mb-2"><strong>O que acontecerá:</strong></p>
            <ul className="list-disc list-inside space-y-1">
              <li>Sua assinatura será cancelada imediatamente</li>
              <li>Você perderá acesso aos benefícios do plano</li>
              <li>Seu saldo de tokens atual será mantido</li>
              <li>Você poderá reativar sua assinatura a qualquer momento</li>
            </ul>
          </div>

          <div className="flex gap-3 w-full">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-6 py-3 rounded-lg font-medium transition-all duration-200 hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: theme === 'dark' ? '#374151' : '#e5e7eb',
                color: colors.textPrimary
              }}
            >
              Voltar
            </button>

            <button
              onClick={handleConfirm}
              disabled={isLoading}
              className="flex-1 px-6 py-3 rounded-lg font-medium transition-all duration-200 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: '#ef4444',
                color: '#ffffff'
              }}
            >
              {isLoading ? 'Cancelando...' : 'Sim, Cancelar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
