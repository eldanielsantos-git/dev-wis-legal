import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Mail, Loader, AlertCircle } from 'lucide-react';
import { logger } from '../utils/logger';
import { supabase } from '../lib/supabase';

export function VerifyEmailRequiredPage() {
  const { user, profile, emailVerified, refreshEmailStatus } = useAuth();
  const [resending, setResending] = useState(false);
  const [resendDisabled, setResendDisabled] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    if (emailVerified) {
      window.location.href = '/app';
    }
  }, [emailVerified]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0 && resendDisabled) {
      setResendDisabled(false);
    }
  }, [countdown, resendDisabled]);

  const handleResendEmail = async () => {
    if (resendDisabled || !user || !profile) return;

    setResending(true);
    setMessage(null);

    try {
      logger.log('VerifyEmailRequired', 'Resending confirmation email to:', user.email);

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-confirmation-email`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user.id,
          email: user.email,
          first_name: profile.first_name,
          last_name: profile.last_name,
          phone: profile.phone,
          phone_country_code: profile.phone_country_code,
          city: profile.city,
          state: profile.state
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao reenviar email');
      }

      setMessage({ type: 'success', text: 'Email reenviado com sucesso! Verifique sua caixa de entrada.' });
      setResendDisabled(true);
      setCountdown(60);
    } catch (err: any) {
      logger.error('VerifyEmailRequired', 'Error resending email:', err);
      setMessage({ type: 'error', text: err.message || 'Erro ao reenviar email. Tente novamente.' });
    } finally {
      setResending(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/sign-in';
  };

  const handleCheckVerification = async () => {
    if (!user) return;
    await refreshEmailStatus();

    if (emailVerified) {
      window.location.href = '/app';
    } else {
      setMessage({ type: 'error', text: 'Email ainda não foi verificado. Por favor, clique no link enviado.' });
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row font-body">
      <div className="w-full md:w-1/2 bg-wis-dark flex items-center justify-center p-6 md:p-12">
        <div className="text-center">
          <img
            src="https://rslpleprodloodfsaext.supabase.co/storage/v1/object/public/assets/img/logo-color-white.svg"
            alt="Wis Legal"
            className="h-12 md:h-16 mx-auto mb-4 md:mb-6"
          />
          <p className="text-white text-lg md:text-xl font-title">Simple legal analysis</p>
        </div>
      </div>

      <div className="w-full md:w-1/2 bg-white flex items-center justify-center p-6 md:p-12 rounded-3xl md:rounded-none">
        <div className="max-w-md w-full text-center px-2 sm:px-0">
          <div className="mb-6">
            <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-10 h-10 text-yellow-600" />
            </div>
            <h1 className="text-2xl md:text-3xl font-title font-bold text-gray-900 mb-3">
              Verifique seu Email
            </h1>
            <p className="text-gray-600 text-sm mb-2">
              Enviamos um email de confirmação para:
            </p>
            <p className="text-gray-900 font-semibold text-base mb-4">
              {user?.email || 'seu email'}
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-left text-sm text-blue-900">
                  <p className="font-medium mb-1">Por favor, verifique seu email</p>
                  <p className="text-blue-700">
                    Clique no link de confirmação enviado para acessar sua conta.
                    Se não encontrar, verifique a pasta de spam.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {message && (
            <div className={`mb-4 p-3 rounded-lg text-sm ${
              message.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              {message.text}
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={handleCheckVerification}
              className="w-full bg-wis-dark text-white py-2.5 md:py-3 px-4 rounded-lg hover:bg-gray-800 transition-colors font-medium text-sm md:text-base"
            >
              Já Confirmei - Continuar
            </button>

            <button
              onClick={handleResendEmail}
              disabled={resendDisabled || resending}
              className="w-full bg-white text-gray-700 py-2.5 md:py-3 px-4 rounded-lg border-2 border-gray-300 hover:bg-gray-50 transition-colors font-medium text-sm md:text-base disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {resending ? (
                <>
                  <Loader className="w-4 h-4 animate-spin mr-2" />
                  Reenviando...
                </>
              ) : resendDisabled ? (
                `Reenviar email (${countdown}s)`
              ) : (
                'Reenviar Email de Confirmação'
              )}
            </button>

            <button
              onClick={handleSignOut}
              className="w-full text-gray-600 py-2.5 px-4 hover:text-gray-900 transition-colors text-sm"
            >
              Sair e usar outra conta
            </button>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              Problemas para receber o email?{' '}
              <a href="mailto:contato@wislegal.io" className="text-wis-dark hover:underline font-medium">
                Entre em contato conosco
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
