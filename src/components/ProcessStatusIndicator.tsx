import React from 'react';
import { Loader2, CheckCircle2, XCircle, Upload, FileText, Brain, Sparkles } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface ProcessStatusIndicatorProps {
  status: string;
  currentPromptNumber?: number;
  totalPrompts?: number;
  currentModelName?: string;
  errorMessage?: string;
  size?: 'sm' | 'md' | 'lg';
  isAdmin?: boolean;
}

interface StatusConfig {
  label: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  progressColor: string;
  showProgress: boolean;
  animated: boolean;
}

const getStepDescription = (currentStep: number, totalSteps: number): string => {
  const actualStep = currentStep === 0 ? 1 : currentStep;
  const totalWithUpload = totalSteps + 2;

  if (actualStep === 1) {
    return `Upload do arquivo, etapa ${actualStep} de ${totalWithUpload}`;
  }
  if (actualStep === 2) {
    return `Iniciando o processamento, etapa ${actualStep} de ${totalWithUpload}`;
  }

  const analysisStep = actualStep - 2;
  const descriptions = [
    'Identificação das Partes',
    'Qualificação Completa',
    'Dados Processuais',
    'Histórico Processual',
    'Fundamentação Jurídica',
    'Pedidos e Causas de Pedir',
    'Provas e Documentos',
    'Decisões Judiciais',
    'Validação Final',
  ];

  const description = descriptions[analysisStep - 1] || `Análise em andamento (${analysisStep}/${totalSteps})`;
  return `${description}, etapa ${actualStep} de ${totalWithUpload}`;
};

const getStatusConfig = (
  status: string,
  currentPromptNumber?: number,
  totalPrompts?: number,
  currentModelName?: string
): StatusConfig => {
  const configs: Record<string, StatusConfig> = {
    uploading: {
      label: 'Fazendo upload do arquivo...',
      icon: <Upload className="w-4 h-4" />,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      progressColor: 'bg-blue-500',
      showProgress: false,
      animated: true,
    },
    created: {
      label: 'Preparando para análise...',
      icon: <FileText className="w-4 h-4" />,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      progressColor: 'bg-blue-500',
      showProgress: false,
      animated: true,
    },
    analyzing: {
      label: currentModelName
        ? `Analisando com ${currentModelName}`
        : 'Analisando documento',
      icon: <Brain className="w-4 h-4" />,
      color: 'text-[#255886]',
      bgColor: 'bg-sky-50',
      borderColor: 'border-sky-200',
      progressColor: 'bg-[#255886]',
      showProgress: true,
      animated: true,
    },
    processing_forensic: {
      label: currentModelName
        ? `Análise forense com ${currentModelName}`
        : 'Processando análise forense',
      icon: <Sparkles className="w-4 h-4" />,
      color: 'text-[#255886]',
      bgColor: 'bg-sky-50',
      borderColor: 'border-sky-200',
      progressColor: 'bg-[#255886]',
      showProgress: true,
      animated: true,
    },
    completed: {
      label: 'Análise concluída',
      icon: <CheckCircle2 className="w-4 h-4" />,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      progressColor: 'bg-green-500',
      showProgress: false,
      animated: false,
    },
    error: {
      label: 'Falha na análise',
      icon: <XCircle className="w-4 h-4" />,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      progressColor: 'bg-red-500',
      showProgress: false,
      animated: false,
    },
  };

  return configs[status] || configs.created;
};

export const ProcessStatusIndicator: React.FC<ProcessStatusIndicatorProps> = ({
  status,
  currentPromptNumber = 0,
  totalPrompts = 0,
  currentModelName,
  errorMessage,
  size = 'md',
  isAdmin = false,
}) => {
  const { theme } = useTheme();
  const config = getStatusConfig(status, currentPromptNumber, totalPrompts, currentModelName);

  const getEffectiveCurrentStep = (): number => {
    if (status === 'uploading') {
      return 1;
    }

    if (status === 'created') {
      return 2;
    }

    if (status === 'analyzing' || status === 'processing_forensic') {
      if (currentPromptNumber > 0) {
        return currentPromptNumber + 2;
      }
      return 3;
    }

    if (status === 'completed') {
      return totalPrompts + 2;
    }

    return currentPromptNumber === 0 ? 1 : currentPromptNumber + 2;
  };

  const effectiveCurrentStep = getEffectiveCurrentStep();
  const effectiveTotalSteps = totalPrompts + 2;
  const progressPercentage = effectiveTotalSteps > 0
    ? Math.round((effectiveCurrentStep / effectiveTotalSteps) * 100)
    : 0;

  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  const iconSizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const stepDescription = config.showProgress && totalPrompts > 0
    ? getStepDescription(effectiveCurrentStep, totalPrompts)
    : null;

  return (
    <div className="space-y-2">
      <div className={`flex items-center gap-2 ${sizeClasses[size]}`}>
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${theme === 'dark' ? '' : config.bgColor} ${theme === 'dark' ? '' : config.borderColor}`}
          style={theme === 'dark' ? {
            backgroundColor: '#FAFAFA',
            borderColor: '#E5E7EB'
          } : undefined}
        >
          <div className={`${config.color} ${config.animated ? 'animate-pulse' : ''}`}>
            {config.animated ? (
              <Loader2 className={`${iconSizeClasses[size]} animate-spin`} />
            ) : (
              React.cloneElement(config.icon as React.ReactElement, {
                className: iconSizeClasses[size],
              })
            )}
          </div>
          <span className={`font-medium ${config.color}`}>
            {config.label}
          </span>
        </div>
      </div>

      {config.showProgress && totalPrompts > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span className="font-medium">
              {stepDescription}
            </span>
            <span className="font-bold ml-2">{progressPercentage}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full ${config.progressColor} transition-all duration-500 ease-out`}
              style={{ width: `${progressPercentage}%` }}
            >
              <div className="w-full h-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
            </div>
          </div>
          {currentModelName && isAdmin && (
            <div
              className="flex items-center gap-1.5 mt-2 px-2.5 py-1.5 rounded-md border transition-all duration-200"
              style={{
                background: theme === 'dark'
                  ? 'linear-gradient(135deg, rgba(37, 88, 134, 0.15) 0%, rgba(59, 130, 246, 0.1) 100%)'
                  : 'linear-gradient(135deg, #EFF6FF 0%, #E0F2FE 100%)',
                borderColor: theme === 'dark' ? 'rgba(37, 88, 134, 0.3)' : '#DBEAFE',
              }}
            >
              <Brain className="w-3.5 h-3.5" style={{ color: '#255886' }} />
              <span
                className="text-xs font-medium"
                style={{ color: theme === 'dark' ? '#93C5FD' : '#255886' }}
              >
                Modelo: <span className="font-semibold">{currentModelName}</span>
              </span>
            </div>
          )}
        </div>
      )}

      {status === 'error' && errorMessage && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          {errorMessage}
        </div>
      )}
    </div>
  );
};
