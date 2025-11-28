import React from 'react';
import { FileText, Trash2, CheckCircle, Coins, Users, Calendar, Lock, Edit3 } from 'lucide-react';
import type { Processo } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import { ProcessStatusIndicator } from './ProcessStatusIndicator';
import { TokenValidationService } from '../services/TokenValidationService';

interface ProcessoCardProps {
  processo: Processo;
  onViewDetails: (processo: Processo) => void;
  onDelete?: (processo: Processo) => void;
  isAdmin?: boolean;
  isShared?: boolean;
  shareCount?: number;
  userInfo?: {
    name: string;
    email: string;
    created_at: string;
  };
  workspaceInfo?: {
    sharedWith?: string;
    sharedBy?: string;
    sharedAt?: string;
    permissionLevel?: 'read_only' | 'editor';
    onManageShares?: () => void;
  };
}

export const ProcessoCard: React.FC<ProcessoCardProps> = ({
  processo,
  onViewDetails,
  onDelete,
  isAdmin,
  isShared,
  shareCount,
  userInfo,
  workspaceInfo
}) => {
  const { theme } = useTheme();
  const totalPrompts = processo.total_prompts || 9;
  const currentPrompt = processo.current_prompt_number || 0;

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(processo);
    }
  };

  return (
    <div
        onClick={() => onViewDetails(processo)}
        className="rounded-lg sm:rounded-xl p-4 sm:p-6 transition-all duration-300 ease-out group cursor-pointer border flex flex-col w-full sm:w-[380px] hover:-translate-y-1 hover:shadow-xl"
        style={{
          backgroundColor: theme === 'dark' ? '#141312' : '#FFFFFF',
          borderColor: theme === 'dark' ? 'transparent' : '#E5E7EB',
          boxShadow: theme === 'dark'
            ? '0 1px 3px 0 rgba(0, 0, 0, 0.2)'
            : '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = theme === 'dark'
            ? '0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.2)'
            : '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = theme === 'dark'
            ? '0 1px 3px 0 rgba(0, 0, 0, 0.2)'
            : '0 1px 3px 0 rgba(0, 0, 0, 0.1)';
        }}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <ProcessStatusIndicator
              status={processo.status}
              currentPromptNumber={currentPrompt}
              totalPrompts={totalPrompts}
              currentModelName={processo.current_llm_model_name}
              errorMessage={processo.last_error_type}
              size="md"
            />
          </div>

          <div className="flex items-center gap-2 ml-2">
            {isShared && (
              <div
                className="relative p-2 rounded-lg transition-colors duration-200 flex-shrink-0"
                style={{
                  color: '#3b82f6',
                  backgroundColor: 'rgba(59, 130, 246, 0.1)'
                }}
                title={shareCount && shareCount > 0 ? `Compartilhado com ${shareCount} ${shareCount === 1 ? 'pessoa' : 'pessoas'}` : 'Processo compartilhado'}
              >
                <Users className="w-5 h-5" />
                {shareCount && shareCount > 0 && (
                  <span
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center"
                    style={{
                      backgroundColor: '#3b82f6',
                      color: '#ffffff'
                    }}
                  >
                    {shareCount > 9 ? '9+' : shareCount}
                  </span>
                )}
              </div>
            )}

            {onDelete && (
              <button
                onClick={handleDeleteClick}
                className="p-2 rounded-lg transition-colors duration-200 flex-shrink-0"
                style={{ color: '#C8C8C8' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#A0A0A0';
                  e.currentTarget.style.backgroundColor = 'rgba(200, 200, 200, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#C8C8C8';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
                title="Excluir processo"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3 mb-3 sm:mb-4">
          <div
            className="p-1.5 sm:p-2 rounded-lg flex-shrink-0"
            style={{ backgroundColor: theme === 'dark' ? 'rgba(200, 200, 200, 0.1)' : 'rgba(243, 244, 246, 0.8)' }}
          >
            <FileText
              className="w-5 h-5 sm:w-6 sm:h-6"
              style={{ color: theme === 'dark' ? '#C8C8C8' : '#1F2937' }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3
              className="text-sm sm:text-base font-semibold break-words line-clamp-2"
              style={{ color: theme === 'dark' ? '#C8C8C8' : '#1F2937' }}
            >
              {processo.file_name}
            </h3>
            <p
              className="text-xs sm:text-sm"
              style={{ color: theme === 'dark' ? '#8B8B8B' : '#6B7280' }}
            >
              {formatFileSize(processo.file_size)}
            </p>
          </div>
        </div>

        <div
          className="text-xs"
          style={{ color: theme === 'dark' ? '#8B8B8B' : '#6B7280' }}
        >
          Criado em {new Date(processo.created_at).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </div>

        {workspaceInfo && (
          <div
            className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t space-y-2"
            style={{ borderColor: theme === 'dark' ? 'rgba(200, 200, 200, 0.1)' : 'rgba(229, 231, 235, 0.8)' }}
          >
            {workspaceInfo.sharedWith && (
              <div className="flex items-center text-xs" style={{ color: theme === 'dark' ? '#8B8B8B' : '#6B7280' }}>
                <Users className="w-3.5 h-3.5 mr-2 flex-shrink-0" />
                <span>Compartilhado com {workspaceInfo.sharedWith}</span>
              </div>
            )}
            {workspaceInfo.sharedBy && (
              <div className="flex items-center text-xs" style={{ color: theme === 'dark' ? '#8B8B8B' : '#6B7280' }}>
                <Users className="w-3.5 h-3.5 mr-2 flex-shrink-0" />
                <span>Compartilhado por {workspaceInfo.sharedBy}</span>
              </div>
            )}
            {workspaceInfo.sharedAt && (
              <div className="flex items-center text-xs" style={{ color: theme === 'dark' ? '#8B8B8B' : '#6B7280' }}>
                <Calendar className="w-3.5 h-3.5 mr-2 flex-shrink-0" />
                <span>
                  Compartilhado em {new Date(workspaceInfo.sharedAt).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                  })}
                </span>
              </div>
            )}
            {workspaceInfo.permissionLevel && (
              workspaceInfo.onManageShares ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    workspaceInfo.onManageShares?.();
                  }}
                  className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                  style={{
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    color: '#3b82f6'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                  }}
                  title="Clique para gerenciar compartilhamentos"
                >
                  <Users className="w-3 h-3" />
                  <span>Gerenciar compartilhamento</span>
                </button>
              ) : (
                <div
                  className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: workspaceInfo.permissionLevel === 'read_only' ? 'rgba(251, 191, 36, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                    color: workspaceInfo.permissionLevel === 'read_only' ? '#f59e0b' : '#3b82f6'
                  }}
                >
                  {workspaceInfo.permissionLevel === 'read_only' ? (
                    <>
                      <Lock className="w-3 h-3" />
                      <span>Somente Leitura</span>
                    </>
                  ) : (
                    <>
                      <Edit3 className="w-3 h-3" />
                      <span>Editor</span>
                    </>
                  )}
                </div>
              )
            )}
          </div>
        )}

        {isAdmin && userInfo && (
          <div
            className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t"
            style={{ borderColor: theme === 'dark' ? 'rgba(200, 200, 200, 0.1)' : 'rgba(229, 231, 235, 0.8)' }}
          >
            <div
              className="space-y-1.5 text-xs"
              style={{ color: theme === 'dark' ? '#8B8B8B' : '#6B7280' }}
            >
              <div className="flex justify-between gap-2">
                <span
                  className="font-medium"
                  style={{ color: theme === 'dark' ? '#C8C8C8' : '#1F2937' }}
                >
                  Usuário:
                </span>
                <span className="truncate">{userInfo.name}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span
                  className="font-medium"
                  style={{ color: theme === 'dark' ? '#C8C8C8' : '#1F2937' }}
                >
                  Email:
                </span>
                <span className="truncate">{userInfo.email}</span>
              </div>
            </div>
          </div>
        )}

        {processo.status === 'completed' && (
          <div
            className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t"
            style={{ borderColor: theme === 'dark' ? 'rgba(200, 200, 200, 0.1)' : 'rgba(229, 231, 235, 0.8)' }}
          >
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p
                  className="text-lg font-bold"
                  style={{ color: theme === 'dark' ? '#FFFFFF' : '#141312' }}
                >
                  {processo.transcricao?.totalPages || 0}
                </p>
                <p
                  className="text-xs"
                  style={{ color: theme === 'dark' ? '#8B8B8B' : '#6B7280' }}
                >
                  Páginas
                </p>
              </div>
              <div>
                <p
                  className="text-lg font-bold"
                  style={{ color: theme === 'dark' ? '#FFFFFF' : '#141312' }}
                >
                  {TokenValidationService.formatTokenCount(processo.tokens_consumed || 0)}
                </p>
                <p
                  className="text-xs"
                  style={{ color: theme === 'dark' ? '#8B8B8B' : '#6B7280' }}
                >
                  Tokens
                </p>
              </div>
              <div>
                <p className="text-lg font-bold">
                  <CheckCircle
                    className="w-6 h-6 inline"
                    style={{ color: theme === 'dark' ? '#FFFFFF' : '#141312' }}
                  />
                </p>
                <p
                  className="text-xs"
                  style={{ color: theme === 'dark' ? '#8B8B8B' : '#6B7280' }}
                >
                  Completo
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
  );
};
