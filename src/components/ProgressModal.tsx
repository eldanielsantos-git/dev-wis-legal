/**
 * ProgressModal - Componente genérico reutilizável para mostrar o progresso de operações
 *
 * Exemplo de uso:
 *
 * ```tsx
 * import { ProgressModal, ProgressStep } from './ProgressModal';
 *
 * function MyComponent() {
 *   const [isOpen, setIsOpen] = useState(false);
 *   const [progress, setProgress] = useState<ProgressStep[]>([]);
 *   const [isProcessing, setIsProcessing] = useState(false);
 *   const [error, setError] = useState<string | null>(null);
 *
 *   return (
 *     <ProgressModal
 *       isOpen={isOpen}
 *       title="Meu Processo"
 *       progress={progress}
 *       isProcessing={isProcessing}
 *       error={error}
 *       onClose={() => setIsOpen(false)}
 *       errorTitle="Erro no Processo"
 *       progressTitle="Progresso"
 *       processingText="Processando..."
 *       initialText="Iniciando..."
 *       closeButtonText="Fechar"
 *     />
 *   );
 * }
 * ```
 */

import React from 'react';
import { X, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';

export interface ProgressStep {
  step: string;
  completed: boolean;
  error?: string;
  count?: number;
}

interface ProgressModalProps {
  isOpen: boolean;
  title: string;
  progress: ProgressStep[];
  isProcessing: boolean;
  error: string | null;
  onClose: () => void;
  errorTitle?: string;
  progressTitle?: string;
  processingText?: string;
  initialText?: string;
  closeButtonText?: string;
}

export function ProgressModal({
  isOpen,
  title,
  progress,
  isProcessing,
  error,
  onClose,
  errorTitle = 'Erro',
  progressTitle = 'Progresso',
  processingText = 'Processando...',
  initialText = 'Iniciando processo...',
  closeButtonText = 'Fechar'
}: ProgressModalProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);

  if (!isOpen) return null;

  const canClose = !isProcessing;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
      <div
        className="rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: colors.bgSecondary }}
      >
        <div
          className="sticky top-0 flex items-center justify-between p-3 sm:p-4 border-b z-10"
          style={{
            backgroundColor: colors.bgSecondary,
            borderColor: colors.border
          }}
        >
          <h2 className="text-base sm:text-lg font-title font-bold" style={{ color: colors.textPrimary }}>
            {title}
          </h2>
          {canClose && (
            <button
              onClick={onClose}
              className="p-2 hover:opacity-70 transition-opacity"
              style={{ color: colors.textSecondary }}
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          )}
        </div>

        <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
          {error && (
            <div
              className="p-3 rounded-lg border border-red-500 bg-red-500/10"
            >
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-500 mb-0.5">{errorTitle}</p>
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              </div>
            </div>
          )}

          {progress.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm sm:text-base font-semibold" style={{ color: colors.textPrimary }}>
                  {progressTitle}
                </h3>
                {isProcessing && (
                  <div className="flex items-center gap-1.5">
                    <Loader className="w-3 h-3 animate-spin" style={{ color: colors.textSecondary }} />
                    <span className="text-xs" style={{ color: colors.textSecondary }}>
                      {processingText}
                    </span>
                  </div>
                )}
              </div>

              {progress.map((item, index) => (
                <div
                  key={index}
                  className="flex items-start gap-2 p-2 sm:p-2.5 rounded-lg border"
                  style={{
                    backgroundColor: item.error
                      ? 'rgba(239, 68, 68, 0.1)'
                      : item.completed
                      ? 'rgba(16, 185, 129, 0.1)'
                      : colors.bgTertiary,
                    borderColor: item.error
                      ? '#EF4444'
                      : item.completed
                      ? '#10B981'
                      : colors.border
                  }}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {item.error ? (
                      <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                    ) : item.completed ? (
                      <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                    ) : (
                      <Loader className="w-3.5 h-3.5 animate-spin" style={{ color: colors.textSecondary }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-xs sm:text-sm font-medium"
                      style={{
                        color: item.error
                          ? '#EF4444'
                          : item.completed
                          ? '#10B981'
                          : colors.textPrimary
                      }}
                    >
                      {item.step}
                      {item.count !== undefined && ` (${item.count})`}
                    </p>
                    {item.error && (
                      <p className="text-xs mt-0.5 text-red-400">
                        {item.error}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isProcessing && progress.length === 0 && !error && (
            <div className="text-center py-6">
              <p className="text-sm" style={{ color: colors.textSecondary }}>
                {initialText}
              </p>
            </div>
          )}

          {!isProcessing && canClose && (
            <div className="flex justify-end pt-3 border-t" style={{ borderColor: colors.border }}>
              <button
                onClick={onClose}
                className="px-5 py-2 rounded-lg font-medium text-sm transition-all duration-200 hover:opacity-80"
                style={{
                  backgroundColor: theme === 'dark' ? '#C8C8C8' : '#0F0E0D',
                  color: theme === 'dark' ? '#0F0E0D' : '#FFFFFF'
                }}
              >
                {closeButtonText}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
