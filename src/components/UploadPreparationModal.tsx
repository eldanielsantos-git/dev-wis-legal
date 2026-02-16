import React, { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';

interface UploadPreparationModalProps {
  isOpen: boolean;
  fileName?: string;
  currentStep?: string;
}

export function UploadPreparationModal({
  isOpen,
  fileName,
  currentStep
}: UploadPreparationModalProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);

  useEffect(() => {
    if (!isOpen) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'O upload ainda está em andamento. Tem certeza que deseja sair?';
      return e.returnValue;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div
        className="rounded-lg shadow-xl max-w-sm w-full p-6"
        style={{ backgroundColor: colors.bgSecondary }}
      >
        <div className="flex flex-col items-center text-center">
          <div className="flex items-center gap-3 mb-4">
            <Loader2
              className="w-5 h-5 animate-spin"
              style={{ color: colors.textSecondary }}
            />
            <h2
              className="text-base font-title font-semibold"
              style={{ color: colors.textPrimary }}
            >
              Preparando análise
            </h2>
          </div>

          <p
            className="text-sm mb-4"
            style={{ color: colors.textSecondary }}
          >
            Não feche esta página.
          </p>

          {fileName && (
            <div
              className="px-3 py-2 rounded-lg w-full mb-3"
              style={{ backgroundColor: colors.bgTertiary }}
            >
              <p
                className="text-sm font-medium truncate"
                style={{ color: colors.textPrimary }}
              >
                {fileName}
              </p>
            </div>
          )}

          {currentStep && (
            <p
              className="text-xs"
              style={{ color: colors.textTertiary }}
            >
              {currentStep}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
