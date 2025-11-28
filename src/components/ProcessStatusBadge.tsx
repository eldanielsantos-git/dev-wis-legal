import React from 'react';
import { Clock, CheckCircle, AlertCircle, Loader, Layers, Brain } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface ProcessStatusBadgeProps {
  status: string;
  forensicAnalysisStatus?: string | null;
}

export const ProcessStatusBadge: React.FC<ProcessStatusBadgeProps> = ({
  status,
  forensicAnalysisStatus
}) => {
  const { theme } = useTheme();

  const getStatusInfo = (currentStatus: string) => {
    switch (currentStatus) {
      case 'created':
        return {
          icon: Clock,
          label: 'Criado',
          bgColor: theme === 'dark' ? '#374151' : '#F3F4F6',
          textColor: theme === 'dark' ? '#D1D5DB' : '#1F2937',
          iconColor: theme === 'dark' ? '#9CA3AF' : '#6B7280'
        };
      case 'queuing':
        return {
          icon: Loader,
          label: 'Enviando',
          bgColor: theme === 'dark' ? '#1E3A8A' : '#DBEAFE',
          textColor: theme === 'dark' ? '#BFDBFE' : '#1E40AF',
          iconColor: theme === 'dark' ? '#60A5FA' : '#3B82F6'
        };
      case 'processing_batch':
        return {
          icon: Loader,
          label: 'Processando',
          bgColor: theme === 'dark' ? '#1E3A8A' : '#DBEAFE',
          textColor: theme === 'dark' ? '#BFDBFE' : '#1E40AF',
          iconColor: theme === 'dark' ? '#60A5FA' : '#3B82F6'
        };
      case 'finalizing':
        return {
          icon: Layers,
          label: 'Extraindo',
          bgColor: theme === 'dark' ? '#1E40AF' : '#BFDBFE',
          textColor: theme === 'dark' ? '#93C5FD' : '#1E3A8A',
          iconColor: theme === 'dark' ? '#60A5FA' : '#2563EB'
        };
      case 'processing_forensic':
        return {
          icon: Brain,
          label: 'Análise',
          bgColor: theme === 'dark' ? '#1e3a52' : '#E0F2FE',
          textColor: theme === 'dark' ? '#BAE6FD' : '#255886',
          iconColor: theme === 'dark' ? '#7DD3FC' : '#255886'
        };
      case 'completed':
        return {
          icon: CheckCircle,
          label: 'Concluído',
          bgColor: theme === 'dark' ? '#065F46' : '#D1FAE5',
          textColor: theme === 'dark' ? '#A7F3D0' : '#065F46',
          iconColor: theme === 'dark' ? '#34D399' : '#059669'
        };
      case 'error':
        return {
          icon: AlertCircle,
          label: 'Erro',
          bgColor: theme === 'dark' ? '#7F1D1D' : '#FEE2E2',
          textColor: theme === 'dark' ? '#FCA5A5' : '#991B1B',
          iconColor: theme === 'dark' ? '#EF4444' : '#DC2626'
        };
      default:
        return {
          icon: Clock,
          label: currentStatus,
          bgColor: theme === 'dark' ? '#374151' : '#F3F4F6',
          textColor: theme === 'dark' ? '#D1D5DB' : '#1F2937',
          iconColor: theme === 'dark' ? '#9CA3AF' : '#6B7280'
        };
    }
  };

  const statusInfo = getStatusInfo(status);
  const StatusIcon = statusInfo.icon;

  const isAnimating = ['queuing', 'processing_batch', 'finalizing', 'processing_forensic'].includes(status);

  return (
    <div
      className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-1 rounded-full transition-all duration-300"
      style={{ backgroundColor: statusInfo.bgColor }}
    >
      <StatusIcon
        className={`w-3 h-3 sm:w-4 sm:h-4 transition-transform ${isAnimating ? 'animate-spin' : ''}`}
        style={{ color: statusInfo.iconColor }}
      />
      <span
        className="text-xs sm:text-sm font-medium"
        style={{ color: statusInfo.textColor }}
      >
        {statusInfo.label}
      </span>
    </div>
  );
};
