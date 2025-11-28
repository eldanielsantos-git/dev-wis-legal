import React, { useState } from 'react';
import { X, Lock, Edit3, MessageSquare, Loader } from 'lucide-react';
import { WorkspaceService } from '../services/WorkspaceService';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';

interface ShareProcessModalProps {
  isOpen: boolean;
  onClose: () => void;
  processoId: string;
  processoName: string;
  onShareSuccess?: () => void;
}

export function ShareProcessModal({
  isOpen,
  onClose,
  processoId,
  processoName,
  onShareSuccess
}: ShareProcessModalProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [permissionLevel, setPermissionLevel] = useState<'read_only' | 'editor'>('read_only');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!name.trim()) {
      setError('Por favor, informe o nome');
      return;
    }

    if (!email.trim()) {
      setError('Por favor, informe o email');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Por favor, informe um email válido');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await WorkspaceService.shareProcess({
        processoId,
        email: email.trim(),
        name: name.trim(),
        permissionLevel
      });

      if (result.success) {
        setSuccess(true);
        setName('');
        setEmail('');
        setPermissionLevel('read_only');

        setTimeout(() => {
          onShareSuccess?.();
          onClose();
          setSuccess(false);
        }, 1500);
      } else {
        setError(result.error || 'Erro ao compartilhar processo');
      }
    } catch (err) {
      setError('Erro ao compartilhar processo');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setName('');
      setEmail('');
      setPermissionLevel('read_only');
      setError(null);
      setSuccess(false);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={handleClose}
      />

      <div
        className="relative w-full max-w-md rounded-xl shadow-xl"
        style={{ backgroundColor: colors.bgSecondary }}
      >
        <div
          className="flex items-center justify-between p-6 border-b"
          style={{ borderColor: colors.border }}
        >
          <h2
            className="text-xl font-semibold"
            style={{ color: colors.textPrimary }}
          >
            Compartilhar Processo
          </h2>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="p-1 rounded-lg hover:opacity-70 transition-opacity disabled:opacity-50"
            style={{ color: colors.textSecondary }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: colors.textPrimary }}
            >
              Processo
            </label>
            <div
              className="px-4 py-2 rounded-lg text-sm"
              style={{ backgroundColor: colors.bgTertiary, color: colors.textSecondary }}
            >
              {processoName}
            </div>
          </div>

          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium mb-2"
              style={{ color: colors.textPrimary }}
            >
              Nome
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Com quem você irá compartilhar este processo?"
              className="w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{
                backgroundColor: colors.bgPrimary,
                borderColor: colors.border,
                color: colors.textPrimary
              }}
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium mb-2"
              style={{ color: colors.textPrimary }}
            >
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email do seu colega"
              className="w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{
                backgroundColor: colors.bgPrimary,
                borderColor: colors.border,
                color: colors.textPrimary
              }}
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label
              className="block text-sm font-medium mb-3"
              style={{ color: colors.textPrimary }}
            >
              Nível de Permissão
            </label>

            <div className="space-y-3">
              <label
                className="flex items-start p-4 rounded-lg border cursor-pointer transition-all"
                style={{
                  borderColor: permissionLevel === 'read_only' ? '#3b82f6' : colors.border,
                  backgroundColor: permissionLevel === 'read_only' ? 'rgba(59, 130, 246, 0.1)' : colors.bgPrimary
                }}
              >
                <input
                  type="radio"
                  name="permission"
                  value="read_only"
                  checked={permissionLevel === 'read_only'}
                  onChange={(e) => setPermissionLevel(e.target.value as 'read_only')}
                  className="mt-1 mr-3"
                  disabled={isSubmitting}
                />
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <Lock className="w-4 h-4" style={{ color: colors.textPrimary }} />
                    <span
                      className="font-medium"
                      style={{ color: colors.textPrimary }}
                    >
                      Somente Leitura
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: colors.textSecondary }}>
                    Pode visualizar análises e conversar no chat. Não pode deletar o processo.
                  </p>
                </div>
              </label>

              <label
                className="flex items-start p-4 rounded-lg border cursor-pointer transition-all"
                style={{
                  borderColor: permissionLevel === 'editor' ? '#3b82f6' : colors.border,
                  backgroundColor: permissionLevel === 'editor' ? 'rgba(59, 130, 246, 0.1)' : colors.bgPrimary
                }}
              >
                <input
                  type="radio"
                  name="permission"
                  value="editor"
                  checked={permissionLevel === 'editor'}
                  onChange={(e) => setPermissionLevel(e.target.value as 'editor')}
                  className="mt-1 mr-3"
                  disabled={isSubmitting}
                />
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <Edit3 className="w-4 h-4" style={{ color: colors.textPrimary }} />
                    <span
                      className="font-medium"
                      style={{ color: colors.textPrimary }}
                    >
                      Editor
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: colors.textSecondary }}>
                    Pode visualizar análises, conversar no chat e deletar o processo.
                  </p>
                </div>
              </label>
            </div>

            <div
              className="flex items-start space-x-2 mt-3 p-3 rounded-lg"
              style={{ backgroundColor: colors.bgTertiary }}
            >
              <MessageSquare className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#3b82f6' }} />
              <p className="text-xs" style={{ color: colors.textSecondary }}>
                Em ambas as permissões, o usuário convidado poderá iniciar chat com o processo.
              </p>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {success && (
            <div className="p-3 rounded-lg bg-green-50 border border-green-200">
              <p className="text-sm text-green-600">Processo compartilhado com sucesso!</p>
            </div>
          )}

          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
              style={{
                backgroundColor: colors.bgTertiary,
                color: colors.textPrimary
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  <span>Compartilhando...</span>
                </>
              ) : (
                <span>Compartilhar</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
