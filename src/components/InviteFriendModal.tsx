import React, { useState, useEffect } from 'react';
import { X, UserPlus, Mail, User, Loader, CheckCircle } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';

interface InviteFriendModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInviteSent?: () => void;
}

export function InviteFriendModal({ isOpen, onClose, onInviteSent }: InviteFriendModalProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [invitedName, setInvitedName] = useState('');
  const [invitedEmail, setInvitedEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setInvitedName('');
      setInvitedEmail('');
      setError('');
      setSuccess(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!invitedName.trim()) {
      setError('Por favor, digite o nome do convidado');
      return;
    }

    if (!invitedEmail.trim()) {
      setError('Por favor, digite o email do convidado');
      return;
    }

    if (!validateEmail(invitedEmail)) {
      setError('Por favor, digite um email válido');
      return;
    }

    setIsLoading(true);

    try {
      const { InviteFriendService } = await import('../services/InviteFriendService');
      const result = await InviteFriendService.sendInvite(invitedName.trim(), invitedEmail.trim());

      if (result.success) {
        setSuccess(true);
        onInviteSent?.();

        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        setError(result.error || 'Erro ao enviar convite');
      }
    } catch (err) {
      console.error('Error sending invite:', err);
      setError('Erro ao enviar convite. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-40 backdrop-blur-sm">
      <div
        className="relative w-full max-w-md rounded-xl p-6 shadow-2xl border"
        style={{
          backgroundColor: colors.card,
          borderColor: colors.border
        }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg transition-colors"
          style={{ color: colors.textSecondary }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
          aria-label="Fechar"
          disabled={isLoading}
        >
          <X className="w-5 h-5" />
        </button>

        {success ? (
          <div className="text-center py-8">
            <div className="flex justify-center mb-4">
              <CheckCircle className="w-16 h-16 text-green-500" />
            </div>
            <h2 className="text-2xl font-title font-bold mb-2" style={{ color: colors.textPrimary }}>
              Convite Enviado!
            </h2>
            <p className="text-base" style={{ color: colors.textSecondary }}>
              O convite foi enviado com sucesso para {invitedEmail}
            </p>
          </div>
        ) : (
          <>
            <div className="mb-6 pr-8">
              <div className="flex items-center gap-3 mb-3">
                <UserPlus className="w-7 h-7" style={{ color: colors.textPrimary }} />
                <h2 className="text-xl font-title font-bold" style={{ color: colors.textPrimary }}>
                  Convidar Amigos
                </h2>
              </div>
              <p className="text-sm" style={{ color: colors.textSecondary }}>
                Convide colegas para conhecer a Wis Legal. Digite o nome e o email abaixo que vamos preparar um convite especial.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="invitedName"
                  className="block text-sm font-medium mb-2"
                  style={{ color: colors.textPrimary }}
                >
                  Nome
                </label>
                <div className="relative">
                  <User
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5"
                    style={{ color: colors.textSecondary }}
                  />
                  <input
                    id="invitedName"
                    type="text"
                    value={invitedName}
                    onChange={(e) => setInvitedName(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 rounded-lg border focus:outline-none focus:ring-2 transition-all"
                    style={{
                      backgroundColor: colors.bgSecondary,
                      borderColor: colors.border,
                      color: colors.textPrimary
                    }}
                    placeholder="Nome completo do convidado"
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="invitedEmail"
                  className="block text-sm font-medium mb-2"
                  style={{ color: colors.textPrimary }}
                >
                  Email
                </label>
                <div className="relative">
                  <Mail
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5"
                    style={{ color: colors.textSecondary }}
                  />
                  <input
                    id="invitedEmail"
                    type="email"
                    value={invitedEmail}
                    onChange={(e) => setInvitedEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 rounded-lg border focus:outline-none focus:ring-2 transition-all"
                    style={{
                      backgroundColor: colors.bgSecondary,
                      borderColor: colors.border,
                      color: colors.textPrimary
                    }}
                    placeholder="email@exemplo.com"
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              {error && (
                <div
                  className="p-3 rounded-lg text-sm"
                  style={{
                    backgroundColor: theme === 'dark' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    color: '#EF4444'
                  }}
                >
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isLoading}
                  className="flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                  style={{
                    color: colors.textPrimary,
                    backgroundColor: colors.bgSecondary
                  }}
                  onMouseEnter={(e) => {
                    if (!isLoading) {
                      e.currentTarget.style.opacity = '0.8';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '1';
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{
                    backgroundColor: theme === 'dark' ? '#C8C8C8' : '#0F0E0D',
                    color: theme === 'dark' ? '#0F0E0D' : '#FFFFFF'
                  }}
                  onMouseEnter={(e) => {
                    if (!isLoading) {
                      e.currentTarget.style.opacity = '0.9';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '1';
                  }}
                >
                  {isLoading ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      <span>Enviando...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Enviar Convite</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
