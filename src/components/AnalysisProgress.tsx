import React from 'react';
import { Clock, CheckCircle, Loader, FileText, Cpu, RefreshCw } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';

interface AnalysisProgressProps {
  currentPrompt: number;
  totalPrompts: number;
  status: 'created' | 'analyzing' | 'completed' | 'error';
  className?: string;
  llmModelName?: string | null;
  isModelSwitching?: boolean;
  switchReason?: string | null;
}

export function AnalysisProgress({ currentPrompt, totalPrompts, status, className = '', llmModelName, isModelSwitching, switchReason }: AnalysisProgressProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);

  const percentage = totalPrompts > 0 ? Math.round((currentPrompt / totalPrompts) * 100) : 0;
  const isCompleted = status === 'completed' || (currentPrompt >= totalPrompts && status === 'analyzing');

  const getStatusInfo = () => {
    const iconColor = theme === 'dark' ? '#FFFFFF' : '#141312';

    switch (status) {
      case 'created':
        return {
          icon: Clock,
          color: iconColor,
          text: 'Aguardando início',
          bgColor: colors.bgSecondary
        };
      case 'analyzing':
        return {
          icon: Loader,
          color: iconColor,
          text: `Analisando Processo Etapa ${currentPrompt} de ${totalPrompts}`,
          bgColor: colors.bgSecondary,
          animate: true
        };
      case 'completed':
        return {
          icon: CheckCircle,
          color: '#10B981',
          text: 'Análise concluída',
          bgColor: colors.bgSecondary
        };
      case 'error':
        return {
          icon: FileText,
          color: '#EF4444',
          text: 'Erro na análise',
          bgColor: colors.bgSecondary
        };
      default:
        return {
          icon: Clock,
          color: iconColor,
          text: 'Processando',
          bgColor: colors.bgSecondary
        };
    }
  };

  const statusInfo = getStatusInfo();
  const Icon = statusInfo.icon;

  const displayStatus = isCompleted ? 'completed' : status;
  const finalStatusInfo = displayStatus === 'completed' && isCompleted ? {
    icon: CheckCircle,
    color: '#10B981',
    text: 'Análise concluída',
    bgColor: colors.bgSecondary
  } : statusInfo;
  const FinalIcon = finalStatusInfo.icon;

  return (
    <div
      className={`rounded-lg p-5 space-y-4 ${className}`}
      style={{
        backgroundColor: theme === 'dark' ? '#141312' : '#F9FAFB',
        border: `1px solid ${theme === 'dark' ? '#374151' : '#E5E7EB'}`
      }}
    >
      {/* Header com Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div
            className="p-2 rounded-lg"
            style={{
              backgroundColor: theme === 'dark' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.1)',
            }}
          >
            <FinalIcon
              className={`w-6 h-6 ${finalStatusInfo.animate && !isCompleted ? 'animate-spin' : ''}`}
              style={{ color: finalStatusInfo.color }}
            />
          </div>
          <div>
            <h4
              className="text-base font-semibold"
              style={{ color: theme === 'dark' ? '#E5E7EB' : '#111827' }}
            >
              {finalStatusInfo.text}
            </h4>
            {status === 'analyzing' && !isCompleted && (
              <p className="text-sm mt-0.5" style={{ color: theme === 'dark' ? '#9CA3AF' : '#6B7280' }}>
                Etapa {currentPrompt} de {totalPrompts}
              </p>
            )}
          </div>
        </div>

        {/* Badge de status ativo */}
        {(status === 'analyzing' || status === 'created') && !isCompleted && (
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span
              className="text-xs font-medium"
              style={{ color: theme === 'dark' ? '#3B82F6' : '#2563EB' }}
            >
              Processando
            </span>
          </div>
        )}

        {/* Badge de concluído */}
        {isCompleted && (
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-4 h-4" style={{ color: '#10B981' }} />
            <span
              className="text-xs font-medium"
              style={{ color: '#10B981' }}
            >
              Concluído
            </span>
          </div>
        )}
      </div>

      {/* Badges informativos */}
      <div className="space-y-2">
        {isModelSwitching && (
          <div
            className="flex items-center space-x-2 px-3 py-2 rounded-lg animate-pulse"
            style={{
              backgroundColor: 'rgba(251, 146, 60, 0.1)',
              border: '1px solid rgba(251, 146, 60, 0.3)'
            }}
          >
            <RefreshCw className="w-4 h-4 animate-spin" style={{ color: '#FB923C' }} />
            <div className="flex-1">
              <p className="text-xs font-semibold" style={{ color: '#FB923C' }}>
                Alternando modelo LLM...
              </p>
              {switchReason && (
                <p className="text-xs mt-0.5" style={{ color: theme === 'dark' ? '#9CA3AF' : '#6B7280' }}>
                  {switchReason}
                </p>
              )}
            </div>
          </div>
        )}

        {llmModelName && !isModelSwitching && !isCompleted && (
          <div
            className="flex items-center space-x-2 px-3 py-2 rounded-lg"
            style={{
              backgroundColor: theme === 'dark' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.05)',
              border: `1px solid ${theme === 'dark' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.15)'}`
            }}
          >
            <Cpu className="w-4 h-4" style={{ color: '#10B981' }} />
            <span className="text-xs font-medium" style={{ color: theme === 'dark' ? '#10B981' : '#059669' }}>
              Modelo: {llmModelName}
            </span>
          </div>
        )}
      </div>

      {/* Barra de progresso com informações */}
      {displayStatus !== 'created' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span style={{ color: theme === 'dark' ? '#9CA3AF' : '#6B7280' }}>
              Progresso da Análise
            </span>
            <span
              className="font-semibold tabular-nums"
              style={{ color: theme === 'dark' ? '#E5E7EB' : '#111827' }}
            >
              {percentage}%
            </span>
          </div>
          <div
            className="w-full h-3 rounded-full overflow-hidden"
            style={{ backgroundColor: theme === 'dark' ? '#374151' : '#E5E7EB' }}
          >
            <div
              className="h-full transition-all duration-500 ease-out rounded-full relative overflow-hidden"
              style={{
                width: `${percentage}%`,
                backgroundColor: finalStatusInfo.color,
              }}
            >
              {status === 'analyzing' && !isCompleted && (
                <div
                  className="absolute inset-0 animate-pulse"
                  style={{
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
