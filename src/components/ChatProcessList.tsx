import React from 'react';
import { FileText, Loader } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';

interface Processo {
  id: string;
  file_name: string;
  created_at: string;
  status: string;
}

interface ChatProcessListProps {
  processos: Processo[];
  selectedProcessoId: string | null;
  onSelectProcesso: (processoId: string) => void;
  isLoading: boolean;
}

export function ChatProcessList({ processos, selectedProcessoId, onSelectProcesso, isLoading }: ChatProcessListProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Loader className="w-6 h-6 animate-spin" style={{ color: colors.textSecondary }} />
      </div>
    );
  }

  if (processos.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
        <FileText className="w-12 h-12 mb-3" style={{ color: colors.textSecondary }} />
        <p className="text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
          Nenhum processo
        </p>
        <p className="text-xs" style={{ color: colors.textSecondary }}>
          Envie um processo para começar a conversar
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-y-auto">
      <div className="p-4">
        <h2 className="text-sm font-semibold mb-3 px-2" style={{ color: colors.textPrimary }}>
          Seus Processos
        </h2>
        <div className="space-y-1">
          {processos.map((processo) => (
            <button
              key={processo.id}
              onClick={() => onSelectProcesso(processo.id)}
              className="w-full flex items-start space-x-3 px-3 py-3 rounded-lg transition-all duration-200 hover:scale-[1.02]"
              style={{
                backgroundColor: selectedProcessoId === processo.id ? colors.bgTertiary : 'transparent',
                borderLeft: selectedProcessoId === processo.id ? `3px solid #3B82F6` : '3px solid transparent',
              }}
            >
              <FileText className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#3B82F6' }} />
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: colors.textPrimary }}>
                  {processo.file_name}
                </p>
                <p className="text-xs mt-0.5" style={{ color: colors.textSecondary }}>
                  {new Date(processo.created_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
