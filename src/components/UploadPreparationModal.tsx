import React, { useEffect } from 'react';
import { Loader } from 'lucide-react';

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)' }}
      />

      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-md">
        <div className="mb-8">
          <div className="relative">
            <div className="w-20 h-20 rounded-full border-4 border-white/20 border-t-white animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader className="w-8 h-8 text-white animate-pulse" />
            </div>
          </div>
        </div>

        <h2 className="text-2xl font-semibold text-white mb-3">
          Sua análise está sendo preparada
        </h2>

        <p className="text-white/70 text-base mb-6">
          Não feche esta página para não interromper o processo inicial.
        </p>

        {fileName && (
          <div className="px-4 py-2 rounded-lg bg-white/10 mb-4">
            <p className="text-white/90 text-sm font-medium truncate max-w-xs">
              {fileName}
            </p>
          </div>
        )}

        {currentStep && (
          <p className="text-white/50 text-sm">
            {currentStep}
          </p>
        )}

        <div className="mt-8 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-white/60 animate-pulse" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 rounded-full bg-white/60 animate-pulse" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 rounded-full bg-white/60 animate-pulse" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}
