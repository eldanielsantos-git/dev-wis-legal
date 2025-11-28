import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Loader } from 'lucide-react';

interface ForgotPasswordPageProps {
  onNavigateToSignIn: () => void;
}

export function ForgotPasswordPage({ onNavigateToSignIn }: ForgotPasswordPageProps) {
  const { resetPassword } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [email, setEmail] = useState('');

  const translateError = (errorMessage: string): string => {
    const errorMap: Record<string, string> = {
      'Email not confirmed': 'Email não confirmado. Verifique sua caixa de entrada.',
      'Invalid login credentials': 'Credenciais inválidas',
      'Email link is invalid or has expired': 'Link de email inválido ou expirado',
      'User not found': 'Usuário não encontrado',
      'Unable to validate email address': 'Não foi possível validar o endereço de email'
    };

    for (const [key, value] of Object.entries(errorMap)) {
      if (errorMessage.includes(key)) {
        return value;
      }
    }

    return errorMessage;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await resetPassword(email);
      setSuccess(true);
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao enviar email';
      setError(translateError(errorMessage));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex flex-col md:flex-row font-body">
        <div className="w-full md:w-1/2 bg-wis-dark flex items-center justify-center p-6 md:p-12">
          <div className="text-center">
            <img src="https://rslpleprodloodfsaext.supabase.co/storage/v1/object/public/assets/img/logo-color-white.svg" alt="Wis Legal" className="h-12 md:h-16 mx-auto mb-4 md:mb-6" />
            <p className="text-white text-lg md:text-xl font-title">Simple legal analysis</p>
          </div>
        </div>
        <div className="w-full md:w-1/2 bg-white flex items-center justify-center p-6 md:p-12 rounded-3xl md:rounded-none">
          <div className="max-w-md w-full text-center px-2 sm:px-0">
            <h1 className="text-2xl md:text-3xl font-title font-bold text-gray-900 mb-3 md:mb-4 text-center">Email enviado!</h1>
            <p className="text-gray-600 mb-4 md:mb-6 text-center">Verifique sua caixa de entrada</p>
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
          <p className="text-white text-lg md:text-xl font-title">Simple legal analysis</p>
        </div>
      </div>
      <div className="w-full md:w-1/2 bg-white flex items-center justify-center p-6 md:p-12 rounded-3xl md:rounded-none">
        <div className="max-w-sm w-full px-2 sm:px-0">
          <h1 className="text-2xl md:text-3xl font-title font-bold text-gray-900 mb-2 text-center">Recuperar Senha</h1>
          <p className="text-gray-600 mb-4 md:mb-8 text-center">Digite seu email</p>
          {error && <div className="mb-4 md:mb-6 p-3 md:p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-300 bg-transparent text-gray-600" /></div>
            <button type="submit" disabled={loading} className="w-full bg-wis-dark text-white py-2.5 md:py-3 px-4 rounded-lg hover:bg-gray-800 transition-colors font-medium disabled:opacity-50 flex items-center justify-center text-sm md:text-base">
              {loading ? <><Loader className="w-4 md:w-5 h-4 md:h-5 animate-spin mr-2" />Enviando...</> : 'Enviar Link'}
            </button>
            <div className="text-center mt-4"><button type="button" onClick={onNavigateToSignIn} className="text-sm text-gray-600 hover:text-gray-900 font-medium">Voltar para login</button></div>
          </form>
        </div>
      </div>
    </div>
  );
}
