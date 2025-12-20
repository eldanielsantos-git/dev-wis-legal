import React from 'react';
import { FileText, Trash2, CheckCircle, Loader, Clock, AlertCircle, Eye } from 'lucide-react';
import type { Processo } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';
import TierBadge from './TierBadge';

interface ProcessoListItemProps {
  processo: Processo;
  onViewDetails: (processo: Processo) => void;
  onDelete?: (processo: Processo) => void;
  isAdmin?: boolean;
  userInfo?: {
    name: string;
    email: string;
    created_at: string;
  };
}

export const ProcessoListItem: React.FC<ProcessoListItemProps> = ({ processo, onViewDetails, onDelete, isAdmin, userInfo }) => {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const totalPrompts = 9;

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusInfo = () => {
    const completedPrompts = processo.current_prompt_number || 0;
    const isAnalysisComplete = completedPrompts >= totalPrompts;

    switch (processo.status) {
      case 'created':
        return {
          icon: CheckCircle,
          text: 'Upload concluído',
          color: '#10B981',
          progress: 0
        };
      case 'processing':
        return {
          icon: Loader,
          text: 'Processando PDF',
          color: '#3B82F6',
          progress: 10
        };
      case 'analyzing':
        if (isAnalysisComplete) {
          return {
            icon: CheckCircle,
            text: 'Análise concluída',
            color: '#10B981',
            progress: 100
          };
        }
        return {
          icon: Loader,
          text: `Analisando (${completedPrompts}/${totalPrompts})`,
          color: '#F59E0B',
          progress: Math.round((completedPrompts / totalPrompts) * 100)
        };
      case 'completed':
        return {
          icon: CheckCircle,
          text: 'Completo',
          color: '#10B981',
          progress: 100
        };
      case 'error':
        return {
          icon: AlertCircle,
          text: 'Erro no processamento',
          color: '#EF4444',
          progress: 0
        };
      default:
        return {
          icon: Clock,
          text: 'Aguardando',
          color: '#6B7280',
          progress: 0
        };
    }
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;
  const isAnimating = ['processing', 'analyzing'].includes(processo.status) && statusInfo.progress < 100;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(processo);
    }
  };

  return (
    <div
        className="rounded-lg p-4 transition-all duration-200 hover:shadow-lg cursor-pointer"
        style={{ backgroundColor: colors.bgSecondary }}
        onClick={() => onViewDetails(processo)}
      >
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0">
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: colors.bgTertiary }}
            >
              <FileText className="w-6 h-6" style={{ color: colors.textPrimary }} />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h3
                  className="text-base font-semibold truncate mb-1"
                  style={{ color: colors.textPrimary }}
                  title={processo.file_name}
                >
                  {processo.file_name}
                </h3>
                <div className="flex items-center gap-4 text-sm" style={{ color: colors.textSecondary }}>
                  <span>{formatFileSize(processo.file_size || 0)}</span>
                  <span>•</span>
                  <span>{processo.transcricao?.totalPages || 0} páginas</span>
                  {processo.tier_name && (
                    <>
                      <span>•</span>
                      <TierBadge
                        tierName={processo.tier_name}
                        size="sm"
                        showIcon={true}
                        showLabel={true}
                      />
                    </>
                  )}
                  <span>•</span>
                  <span>{new Date(processo.created_at).toLocaleDateString('pt-BR')}</span>
                  {(userInfo || processo.user_profile) && (
                    <>
                      <span>•</span>
                      <span className="truncate max-w-xs" title={userInfo?.email || processo.user_profile?.email}>
                        {userInfo?.name || `${processo.user_profile?.first_name || ''} ${processo.user_profile?.last_name || ''}`.trim() || userInfo?.email || processo.user_profile?.email}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <StatusIcon
                    className={`w-5 h-5 ${isAnimating ? 'animate-spin' : ''}`}
                    style={{ color: statusInfo.color }}
                  />
                  <span className="text-sm font-medium whitespace-nowrap" style={{ color: statusInfo.color }}>
                    {statusInfo.text}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewDetails(processo);
                    }}
                    className="p-2 rounded-lg transition-all duration-200 hover:scale-110"
                    style={{ backgroundColor: colors.bgTertiary }}
                    title="Ver detalhes"
                  >
                    <Eye className="w-4 h-4" style={{ color: colors.textPrimary }} />
                  </button>

                  {onDelete && (
                    <button
                      onClick={handleDelete}
                      className="p-2 rounded-lg transition-all duration-200 hover:scale-110"
                      style={{ backgroundColor: colors.bgTertiary }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(200, 200, 200, 0.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = colors.bgTertiary;
                      }}
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" style={{ color: '#C8C8C8' }} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {statusInfo.progress > 0 && statusInfo.progress < 100 && (
              <div className="mt-3">
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${statusInfo.progress}%`,
                      backgroundColor: statusInfo.color
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
  );
};
