import React, { useState } from 'react';
import { X, AlertTriangle, FileText, Trash2, Upload } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface InterruptedUpload {
  id: string;
  file_name: string;
  uploaded: number;
  total: number;
}

interface InterruptedUploadsModalProps {
  isOpen: boolean;
  onClose: () => void;
  uploads: InterruptedUpload[];
  onDelete: (processoId: string) => void;
  onResume?: (processoId: string) => void;
}

export function InterruptedUploadsModal({
  isOpen,
  onClose,
  uploads,
  onDelete,
  onResume
}: InterruptedUploadsModalProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; upload: InterruptedUpload | null }>({
    isOpen: false,
    upload: null
  });

  if (!isOpen || uploads.length === 0) return null;

  const getProgressPercent = (uploaded: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((uploaded / total) * 100);
  };

  const handleDeleteClick = (upload: InterruptedUpload) => {
    setDeleteConfirm({ isOpen: true, upload });
  };

  const handleConfirmDelete = () => {
    if (deleteConfirm.upload) {
      onDelete(deleteConfirm.upload.id);
      setDeleteConfirm({ isOpen: false, upload: null });
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirm({ isOpen: false, upload: null });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 animate-fade-in">
      <div
        className="relative w-full max-w-2xl rounded-xl shadow-2xl animate-scale-in"
        style={{ backgroundColor: colors.bgSecondary }}
      >
        <div
          className="flex items-center justify-between p-6 border-b"
          style={{ borderColor: colors.border }}
        >
          <div className="flex items-center space-x-3">
            <div
              className="p-2 rounded-lg"
              style={{ backgroundColor: colors.bgTertiary }}
            >
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
            </div>
            <div>
              <h3
                className="text-lg font-semibold"
                style={{ color: colors.textPrimary }}
              >
                Uploads Interrompidos
              </h3>
              <p className="text-sm" style={{ color: colors.textSecondary }}>
                Encontramos {uploads.length} envio{uploads.length > 1 ? 's' : ''} que não foi{uploads.length > 1 ? 'ram' : ''} concluído{uploads.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors"
            style={{ backgroundColor: colors.bgTertiary }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = colors.bgPrimary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = colors.bgTertiary;
            }}
          >
            <X className="w-5 h-5" style={{ color: colors.textSecondary }} />
          </button>
        </div>

        <div className="p-6 max-h-[60vh] overflow-y-auto">
          <div
            className="mb-4 p-4 rounded-lg border"
            style={{
              backgroundColor: colors.bgTertiary,
              borderColor: colors.border
            }}
          >
            <div className="flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm" style={{ color: colors.textSecondary }}>
                <p className="font-medium mb-1" style={{ color: colors.textPrimary }}>
                  Esses envios foram interrompidos
                </p>
                <p>
                  Isso pode ter acontecido porque você fechou o navegador, perdeu a conexão ou houve um erro durante o processo.
                  Para continuar a análise, você precisará reenviar o arquivo.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {uploads.map((upload) => {
              const progress = getProgressPercent(upload.uploaded, upload.total);

              return (
                <div
                  key={upload.id}
                  className="rounded-lg border p-4"
                  style={{
                    backgroundColor: colors.bgPrimary,
                    borderColor: colors.border
                  }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start space-x-3 flex-1 min-w-0">
                      <div
                        className="p-2 rounded-lg flex-shrink-0"
                        style={{ backgroundColor: colors.bgTertiary }}
                      >
                        <FileText className="w-4 h-4" style={{ color: colors.textSecondary }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4
                          className="text-sm font-medium truncate"
                          style={{ color: colors.textPrimary }}
                        >
                          {upload.file_name}
                        </h4>
                        <p className="text-xs mt-1" style={{ color: colors.textSecondary }}>
                          {upload.uploaded} de {upload.total} partes enviadas ({progress}%)
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      {onResume && (
                        <button
                          onClick={() => onResume(upload.id)}
                          className="p-2 rounded-lg transition-colors"
                          style={{ backgroundColor: colors.bgTertiary }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.1)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = colors.bgTertiary;
                          }}
                          title="Retomar upload"
                        >
                          <Upload className="w-4 h-4 text-green-600" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteClick(upload)}
                        className="p-2 rounded-lg transition-colors"
                        style={{ backgroundColor: colors.bgTertiary }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = colors.bgTertiary;
                        }}
                        title="Deletar"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </div>

                  <div
                    className="w-full h-2 rounded-full overflow-hidden"
                    style={{ backgroundColor: colors.bgTertiary }}
                  >
                    <div
                      className="h-full transition-all duration-300 rounded-full"
                      style={{
                        width: `${progress}%`,
                        backgroundColor: '#F59E0B'
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div
          className="flex items-center justify-between p-6 border-t"
          style={{ borderColor: colors.border }}
        >
          <p className="text-sm" style={{ color: colors.textSecondary }}>
            Para continuar, você precisa reenviar os arquivos
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg font-medium transition-colors"
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
            Entendi
          </button>
        </div>
      </div>

      <ConfirmDeleteModal
        isOpen={deleteConfirm.isOpen}
        fileName={deleteConfirm.upload?.file_name}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  );
}
