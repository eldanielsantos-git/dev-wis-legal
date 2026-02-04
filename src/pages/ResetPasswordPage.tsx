import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Loader, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { validatePasswordCharacters, validatePasswordStrict, sanitizePassword } from '../utils/passwordValidation';
import { translateSupabaseAuthError } from '../utils/errorTranslator';

interface ResetPasswordPageProps {
  onNavigateToSignIn: () => void;
}

export function ResetPasswordPage({ onNavigateToSignIn }: ResetPasswordPageProps) {
  const { updatePassword } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [hasValidToken, setHasValidToken] = useState(false);
  const [checkingToken, setCheckingToken] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({ password: '', confirmPassword: '' });
  const [passwordValidation, setPasswordValidation] = useState({
    minLength: false,
    maxLength: true,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSpecialChar: false,
    isSafe: true
  });


  useEffect(() => {
    const checkRecoveryToken = async () => {
      // Obter token da URL query string
      const searchParams = new URLSearchParams(window.location.search);
      const token = searchParams.get('token');

      if (!token) {
        setError('Link de recuperação inválido. Por favor, solicite um novo link.');
        setCheckingToken(false);
        return;
      }

      try {
        // Validar token com o backend
        const { data, error } = await supabase
          .from('user_profiles')
          .select('id, password_reset_token, password_reset_expires_at')
          .eq('password_reset_token', token)
          .maybeSingle();

        if (error || !data) {
          setError('Link de recuperação inválido. Por favor, solicite um novo link.');
          setCheckingToken(false);
          return;
        }

        // Verificar se o token expirou
        const expiresAt = new Date(data.password_reset_expires_at);
        const now = new Date();

        if (now > expiresAt) {
          setError('Link de recuperação expirado. Por favor, solicite um novo link.');
          setCheckingToken(false);
          return;
        }

        // Token válido
        setHasValidToken(true);
        setCheckingToken(false);
      } catch (err) {
        setError('Erro ao validar link de recuperação. Por favor, tente novamente.');
        setCheckingToken(false);
      }
    };

    checkRecoveryToken();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const passwordValidation = validatePasswordStrict(formData.password);
    if (!passwordValidation.valid) {
      setError(passwordValidation.message!);
      setLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('As senhas não coincidem');
      setLoading(false);
      return;
    }

    try {
      // Obter token da URL
      const searchParams = new URLSearchParams(window.location.search);
      const resetToken = searchParams.get('token');

      if (!resetToken) {
        throw new Error('Token de reset não encontrado');
      }

      // Chamar edge function para atualizar senha
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-user-password`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            resetToken: resetToken,
            newPassword: formData.password
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao atualizar senha');
      }

      setSuccess(true);
      setTimeout(() => {
        onNavigateToSignIn();
      }, 2000);
    } catch (err: any) {
      setError(translateSupabaseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  if (checkingToken) {
    return (
      <div className="min-h-screen flex flex-col md:flex-row font-body">
        <div className="w-full md:w-1/2 bg-wis-dark flex items-center justify-center p-6 md:p-12">
          <div className="text-center">
            <img src="https://rslpleprodloodfsaext.supabase.co/storage/v1/object/public/assets/img/logo-color-white.svg" alt="Wis Legal" className="h-12 md:h-16 mx-auto mb-4 md:mb-6" />
            <p className="text-white text-lg md:text-xl font-title">Plataforma para análise de processos</p>
          </div>
        </div>
        <div className="w-full md:w-1/2 bg-white flex items-center justify-center p-6 md:p-12 rounded-3xl md:rounded-none">
          <div className="max-w-md w-full text-center px-2 sm:px-0">
            <Loader className="w-8 h-8 animate-spin mx-auto mb-4 text-wis-dark" />
            <p className="text-gray-600">Verificando link de recuperação...</p>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex flex-col md:flex-row font-body">
        <div className="w-full md:w-1/2 bg-wis-dark flex items-center justify-center p-6 md:p-12">
          <div className="text-center">
            <img src="https://rslpleprodloodfsaext.supabase.co/storage/v1/object/public/assets/img/logo-color-white.svg" alt="Wis Legal" className="h-12 md:h-16 mx-auto mb-4 md:mb-6" />
            <p className="text-white text-lg md:text-xl font-title">Plataforma para análise de processos</p>
          </div>
        </div>
        <div className="w-full md:w-1/2 bg-white flex items-center justify-center p-6 md:p-12 rounded-3xl md:rounded-none">
          <div className="max-w-md w-full text-center px-2 sm:px-0">
            <div className="mb-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <h1 className="text-2xl md:text-3xl font-title font-bold text-gray-900 mb-3 md:mb-4 text-center">Senha atualizada com sucesso!</h1>
            <p className="text-gray-600 mb-4 md:mb-6 text-center">Você será redirecionado para a página de login em instantes...</p>
            <button onClick={onNavigateToSignIn} className="w-full bg-wis-dark text-white py-2.5 md:py-3 px-4 rounded-lg hover:bg-gray-800 transition-colors font-medium text-sm md:text-base">Ir para Login</button>
          </div>
        </div>
      </div>
    );
  }

  if (!hasValidToken) {
    return (
      <div className="min-h-screen flex flex-col md:flex-row font-body">
        <div className="w-full md:w-1/2 bg-wis-dark flex items-center justify-center p-6 md:p-12">
          <div className="text-center">
            <img src="https://rslpleprodloodfsaext.supabase.co/storage/v1/object/public/assets/img/logo-color-white.svg" alt="Wis Legal" className="h-12 md:h-16 mx-auto mb-4 md:mb-6" />
            <p className="text-white text-lg md:text-xl font-title">Plataforma para análise de processos</p>
          </div>
        </div>
        <div className="w-full md:w-1/2 bg-white flex items-center justify-center p-6 md:p-12 rounded-3xl md:rounded-none">
          <div className="max-w-md w-full text-center px-2 sm:px-0">
            <h1 className="text-2xl md:text-3xl font-title font-bold text-gray-900 mb-3 md:mb-4 text-center">Link Inválido</h1>
            <div className="mb-4 md:mb-6 p-3 md:p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
            <button onClick={onNavigateToSignIn} className="w-full bg-wis-dark text-white py-2.5 md:py-3 px-4 rounded-lg hover:bg-gray-800 transition-colors font-medium text-sm md:text-base">Voltar para Login</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row font-body">
      <div className="w-full md:w-1/2 bg-wis-dark flex items-center justify-center p-6 md:p-12">
        <div className="text-center">
          <img src="https://rslpleprodloodfsaext.supabase.co/storage/v1/object/public/assets/img/logo-color-white.svg" alt="Wis Legal" className="h-12 md:h-16 mx-auto mb-4 md:mb-6" />
          <p className="text-white text-lg md:text-xl font-title">Plataforma para análise de processos</p>
        </div>
      </div>
      <div className="w-full md:w-1/2 bg-white flex items-center justify-center p-6 md:p-12 rounded-3xl md:rounded-none">
        <div className="max-w-sm w-full px-2 sm:px-0">
          <h1 className="text-2xl md:text-3xl font-title font-bold text-gray-900 mb-2 text-center">Nova Senha</h1>
          <p className="text-gray-600 mb-4 md:mb-8 text-center">Digite sua nova senha</p>
          {error && <div className="mb-4 md:mb-6 p-3 md:p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nova Senha</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={formData.password}
                  onChange={(e) => {
                    const sanitized = sanitizePassword(e.target.value);
                    setFormData({ ...formData, password: sanitized });
                    setPasswordValidation(validatePasswordCharacters(sanitized));
                    if (formData.confirmPassword && sanitized !== formData.confirmPassword) {
                      setError('As senhas não coincidem');
                    } else if (sanitized === formData.confirmPassword) {
                      setError(null);
                    }
                  }}
                  minLength={6}
                  maxLength={24}
                  className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-300 bg-transparent text-gray-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-2 text-xs">
                  {passwordValidation.minLength ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : (
                    <XCircle className="w-4 h-4 text-gray-400" />
                  )}
                  <span className={passwordValidation.minLength ? 'text-green-600' : 'text-gray-500'}>
                    Mínimo de 6 caracteres
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {passwordValidation.maxLength ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-600" />
                  )}
                  <span className={passwordValidation.maxLength ? 'text-green-600' : 'text-red-600'}>
                    Máximo de 24 caracteres
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {passwordValidation.hasUppercase ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : (
                    <XCircle className="w-4 h-4 text-gray-400" />
                  )}
                  <span className={passwordValidation.hasUppercase ? 'text-green-600' : 'text-gray-500'}>
                    Letra maiúscula
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {passwordValidation.hasLowercase ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : (
                    <XCircle className="w-4 h-4 text-gray-400" />
                  )}
                  <span className={passwordValidation.hasLowercase ? 'text-green-600' : 'text-gray-500'}>
                    Letra minúscula
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {passwordValidation.hasNumber ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : (
                    <XCircle className="w-4 h-4 text-gray-400" />
                  )}
                  <span className={passwordValidation.hasNumber ? 'text-green-600' : 'text-gray-500'}>
                    Número
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {passwordValidation.hasSpecialChar ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : (
                    <XCircle className="w-4 h-4 text-gray-400" />
                  )}
                  <span className={passwordValidation.hasSpecialChar ? 'text-green-600' : 'text-gray-500'}>
                    Caractere especial (!@$%...)
                  </span>
                </div>
                {!passwordValidation.isSafe && (
                  <div className="flex items-center gap-2 text-xs mt-2 p-2 bg-red-50 rounded-lg border border-red-200">
                    <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                    <span className="text-red-600">
                      Senha contém padrões não permitidos. Use apenas letras, números e caracteres especiais comuns.
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar Senha</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  value={formData.confirmPassword}
                  onChange={(e) => {
                    const sanitized = sanitizePassword(e.target.value);
                    setFormData({ ...formData, confirmPassword: sanitized });
                    if (sanitized && formData.password !== sanitized) {
                      setError('As senhas não coincidem');
                    } else if (formData.password === sanitized) {
                      setError(null);
                    }
                  }}
                  minLength={6}
                  maxLength={24}
                  className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-300 bg-transparent text-gray-600"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {formData.confirmPassword && (
                <div className="flex items-center gap-2 mt-1">
                  {formData.password === formData.confirmPassword ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <p className="text-xs text-green-500">As senhas coincidem</p>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-red-500" />
                      <p className="text-xs text-red-500">As senhas não coincidem</p>
                    </>
                  )}
                </div>
              )}
            </div>
            <button type="submit" disabled={loading} className="w-full bg-wis-dark text-white py-2.5 md:py-3 px-4 rounded-lg hover:bg-gray-800 transition-colors font-medium disabled:opacity-50 flex items-center justify-center text-sm md:text-base">
              {loading ? <><Loader className="w-4 md:w-5 h-4 md:h-5 animate-spin mr-2" />Redefinindo...</> : 'Redefinir Senha'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
