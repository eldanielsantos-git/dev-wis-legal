import React, { useState, useEffect } from 'react';
import { X, Users, Lock, Edit3, Trash2, Loader } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { WorkspaceService, WorkspaceShare } from '../services/WorkspaceService';

interface ManageSharesModalProps {
  isOpen: boolean;
  onClose: () => void;
  processoId: string;
  processoName: string;
}

export const ManageSharesModal: React.FC<ManageSharesModalProps> = ({
  isOpen,
  onClose,
  processoId,
  processoName
}) => {
  const { theme } = useTheme();
  const [shares, setShares] = useState<WorkspaceShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadShares();
    }
  }, [isOpen, processoId]);

  const loadShares = async () => {
    setLoading(true);
    try {
      const data = await WorkspaceService.getProcessShares(processoId);
      setShares(data);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveShare = async (shareId: string) => {
    if (!confirm('Tem certeza que deseja remover este acesso?')) {
      return;
    }

    setRemovingId(shareId);
    try {
      const result = await WorkspaceService.removeShare(shareId);
      if (result.success) {
        setShares(shares.filter(s => s.id !== shareId));
      } else {
        alert(result.error || 'Erro ao remover compartilhamento');
      }
    } catch (error) {
      alert('Erro ao remover compartilhamento');
    } finally {
      setRemovingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onClose}
    >
      <div
        className="rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
        style={{
          backgroundColor: theme === 'dark' ? '#1A1A1A' : '#FFFFFF'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-6 py-4 border-b flex items-center justify-between"
          style={{
            borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
          }}
        >
          <div className="flex items-center gap-3">
            <Users
              className="w-6 h-6"
              style={{ color: theme === 'dark' ? '#FFFFFF' : '#000000' }}
            />
            <div>
              <h2
                className="text-xl font-semibold"
                style={{ color: theme === 'dark' ? '#FFFFFF' : '#000000' }}
              >
                Gerenciar Compartilhamento
              </h2>
              <p
                className="text-sm"
                style={{ color: theme === 'dark' ? '#8B8B8B' : '#6B7280' }}
              >
                {processoName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors"
            style={{ color: theme === 'dark' ? '#8B8B8B' : '#6B7280' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader
                className="w-8 h-8 animate-spin"
                style={{ color: theme === 'dark' ? '#FFFFFF' : '#000000' }}
              />
            </div>
          ) : shares.length === 0 ? (
            <div className="text-center py-12">
              <div
                className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
                style={{
                  backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'
                }}
              >
                <Users
                  className="w-8 h-8"
                  style={{ color: theme === 'dark' ? '#8B8B8B' : '#6B7280' }}
                />
              </div>
              <p
                className="text-lg font-medium"
                style={{ color: theme === 'dark' ? '#FFFFFF' : '#000000' }}
              >
                Nenhum compartilhamento ativo
              </p>
              <p
                className="text-sm mt-2"
                style={{ color: theme === 'dark' ? '#8B8B8B' : '#6B7280' }}
              >
                Este processo ainda não foi compartilhado com ninguém
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {shares.map((share) => (
                <div
                  key={share.id}
                  className="p-4 rounded-lg border"
                  style={{
                    backgroundColor: theme === 'dark' ? '#141312' : '#F9FAFB',
                    borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                  }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3
                          className="font-medium truncate"
                          style={{ color: theme === 'dark' ? '#FFFFFF' : '#000000' }}
                        >
                          {share.shared_with_name}
                        </h3>
                        {share.invitation_status === 'pending' && (
                          <span
                            className="text-xs px-2 py-0.5 rounded-full"
                            style={{
                              backgroundColor: 'rgba(251, 191, 36, 0.1)',
                              color: '#f59e0b'
                            }}
                          >
                            Pendente
                          </span>
                        )}
                      </div>
                      <p
                        className="text-sm truncate mb-2"
                        style={{ color: theme === 'dark' ? '#8B8B8B' : '#6B7280' }}
                      >
                        {share.shared_with_email}
                      </p>
                      <div className="flex items-center gap-4 text-xs">
                        <div
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                          style={{
                            backgroundColor: share.permission_level === 'read_only'
                              ? 'rgba(251, 191, 36, 0.1)'
                              : 'rgba(59, 130, 246, 0.1)',
                            color: share.permission_level === 'read_only' ? '#f59e0b' : '#3b82f6'
                          }}
                        >
                          {share.permission_level === 'read_only' ? (
                            <Lock className="w-3 h-3" />
                          ) : (
                            <Edit3 className="w-3 h-3" />
                          )}
                          <span>
                            {share.permission_level === 'read_only' ? 'Somente Leitura' : 'Editor'}
                          </span>
                        </div>
                        <span style={{ color: theme === 'dark' ? '#8B8B8B' : '#6B7280' }}>
                          Desde {formatDate(share.created_at)}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveShare(share.id)}
                      disabled={removingId === share.id}
                      className="p-2 rounded-lg transition-colors flex-shrink-0"
                      style={{
                        color: '#ef4444',
                        opacity: removingId === share.id ? 0.5 : 1
                      }}
                      onMouseEnter={(e) => {
                        if (removingId !== share.id) {
                          e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                      title="Remover acesso"
                    >
                      {removingId === share.id ? (
                        <Loader className="w-5 h-5 animate-spin" />
                      ) : (
                        <Trash2 className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 border-t flex justify-end"
          style={{
            borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
          }}
        >
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-lg font-medium transition-colors"
            style={{
              backgroundColor: theme === 'dark' ? '#FFFFFF' : '#000000',
              color: theme === 'dark' ? '#000000' : '#FFFFFF'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = theme === 'dark' ? '#E5E5E5' : '#1A1A1A';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = theme === 'dark' ? '#FFFFFF' : '#000000';
            }}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
