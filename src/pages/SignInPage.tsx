import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Loader, Eye, EyeOff } from 'lucide-react';
import { sanitizePassword } from '../utils/passwordValidation';
import { translateSupabaseAuthError } from '../utils/errorTranslator';

interface SignInPageProps {
  onNavigateToSignUp: () => void;
  onNavigateToForgotPassword: () => void;
  onNavigateToTerms?: () => void;
  onNavigateToPrivacy?: () => void;
  onNavigateToCookies?: () => void;
}

export function SignInPage({ onNavigateToSignUp, onNavigateToForgotPassword, onNavigateToTerms, onNavigateToPrivacy, onNavigateToCookies }: SignInPageProps) {
  const { signIn, signInWithGoogle, signInWithMicrosoft } = useAuth();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [microsoftLoading, setMicrosoftLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn(formData.email, formData.password);
    } catch (err: any) {
      setError(translateSupabaseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row font-body">
      <div className="w-full md:w-1/2 bg-wis-dark flex items-center justify-center p-6 md:p-12">
        <div className="text-center">
          <img src="https://rslpleprodloodfsaext.supabase.co/storage/v1/object/public/assets/img/logo-color-white.svg" alt="Wis Legal" className="h-16 md:h-20 mx-auto mb-4 md:mb-6" />
          <p className="text-white text-lg md:text-xl font-title">Plataforma para análise de processos</p>
        </div>
      </div>
      <div className="w-full md:w-1/2 bg-white flex items-center justify-center p-6 md:p-12 rounded-3xl md:rounded-none">
        <div className="max-w-sm w-full px-2 sm:px-0">
          <h1 className="text-2xl md:text-3xl font-title font-bold text-gray-900 mb-2 text-center">Entrar</h1>
          <p className="text-gray-600 mb-6 md:mb-8 text-center">Acesse sua conta Wis Legal</p>
          {error && <div className="mb-4 md:mb-6 p-3 md:p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-300 bg-transparent text-gray-600" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: sanitizePassword(e.target.value) })}
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
            </div>
            <div className="flex items-center justify-between">
              <button type="button" onClick={onNavigateToForgotPassword} className="text-sm text-gray-600 hover:text-gray-900">Esqueceu sua senha?</button>
            </div>
            <button type="submit" disabled={loading || googleLoading || microsoftLoading} className="w-full bg-wis-dark text-white py-2.5 md:py-3 px-4 rounded-lg hover:bg-gray-800 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm md:text-base">
              {loading ? <><Loader className="w-4 md:w-5 h-4 md:h-5 animate-spin mr-2" />Entrando...</> : 'Entrar'}
            </button>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">ou</span>
              </div>
            </div>
            <button
              type="button"
              onClick={async () => {
                setGoogleLoading(true);
                setError(null);
                try {
                  await signInWithGoogle();
                } catch (err: any) {
                  setError(translateSupabaseAuthError(err));
                  setGoogleLoading(false);
                }
              }}
              disabled={loading || googleLoading || microsoftLoading}
              className="w-full bg-white text-gray-700 py-2.5 md:py-3 px-4 rounded-lg border-2 border-gray-300 hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm md:text-base"
            >
              {googleLoading ? (
                <><Loader className="w-4 md:w-5 h-4 md:h-5 animate-spin mr-2" />Conectando...</>
              ) : (
                <>
                  <svg className="w-4 md:w-5 h-4 md:h-5 mr-2" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Entrar com Google
                </>
              )}
            </button>
            <button
              type="button"
              onClick={async () => {
                setMicrosoftLoading(true);
                setError(null);
                try {
                  await signInWithMicrosoft();
                } catch (err: any) {
                  setError(translateSupabaseAuthError(err));
                  setMicrosoftLoading(false);
                }
              }}
              disabled={loading || googleLoading || microsoftLoading}
              className="w-full bg-white text-gray-700 py-2.5 md:py-3 px-4 rounded-lg border-2 border-gray-300 hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm md:text-base"
            >
              {microsoftLoading ? (
                <><Loader className="w-4 md:w-5 h-4 md:h-5 animate-spin mr-2" />Conectando...</>
              ) : (
                <>
                  <svg className="w-4 md:w-5 h-4 md:h-5 mr-2" viewBox="0 0 21 21">
                    <path fill="#f25022" d="M0 0h10v10H0z"/>
                    <path fill="#00a4ef" d="M11 0h10v10H11z"/>
                    <path fill="#7fba00" d="M0 11h10v10H0z"/>
                    <path fill="#ffb900" d="M11 11h10v10H11z"/>
                  </svg>
                  Entrar com Microsoft
                </>
              )}
            </button>
            <div className="text-center mt-4">
              <button type="button" onClick={onNavigateToSignUp} className="text-sm text-gray-600 hover:text-gray-900">
                Não tem uma conta? <span className="font-medium">Criar conta</span>
              </button>
            </div>
          </form>
          <div className="mt-4 md:mt-6 pt-4 md:pt-6 border-t border-gray-200">
            <p className="text-xs text-center text-gray-500 leading-relaxed">
              Ao fazer login, você concorda com nossos{' '}
              <a href="http://wislegal.io/terms" target="_blank" rel="noopener noreferrer" className="text-wis-dark hover:underline">
                Termos de Uso
              </a>
              {', '}
              <a href="http://wislegal.io/privacy" target="_blank" rel="noopener noreferrer" className="text-wis-dark hover:underline">
                Política de Privacidade
              </a>
              {' e '}
              <a href="http://wislegal.io/cookies" target="_blank" rel="noopener noreferrer" className="text-wis-dark hover:underline">
                Política de Cookies
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
