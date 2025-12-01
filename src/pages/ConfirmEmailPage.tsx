import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Loader, CheckCircle, XCircle } from 'lucide-react';
import { logger } from '../utils/logger';

export function ConfirmEmailPage() {
  // Parse URL params manually (not using React Router)
  const getHashParams = () => {
    const hash = window.location.hash.substring(1);
    return new URLSearchParams(hash);
  };

  const getQueryParams = () => {
    return new URLSearchParams(window.location.search);
  };
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Confirmando seu email...');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    const confirmEmail = async () => {
      try {
        const hashParams = getHashParams();
        const queryParams = getQueryParams();

        // Check for errors in URL hash (from Supabase redirect)
        const errorFromHash = hashParams.get('error');
        const errorDescription = hashParams.get('error_description');

        if (errorFromHash) {
          logger.error('ConfirmEmail', 'Error from URL hash:', errorFromHash, errorDescription);
          setStatus('error');
          setMessage(
            errorDescription?.replace(/\+/g, ' ') ||
            'Link de confirmação inválido ou expirado. Por favor, solicite um novo link.'
          );
          return;
        }

        // Try to get token from hash first (new format), then from query params (old format)
        let token = hashParams.get('token') || queryParams.get('token');
        let type = hashParams.get('type') || queryParams.get('type') || 'signup';
        let email = hashParams.get('email') || queryParams.get('email');

        if (email) {
          setUserEmail(decodeURIComponent(email));
        }

        if (!token) {
          logger.error('ConfirmEmail', 'No token provided in URL');
          setStatus('error');
          setMessage('Link de confirmação inválido. Token não encontrado.');
          return;
        }

        logger.log('ConfirmEmail', 'Attempting to verify email with token, type:', type);

        // For magiclink type, use 'magiclink', otherwise use 'signup' or 'email'
        let supabaseType: 'signup' | 'email' | 'magiclink' = 'signup';
        if (type === 'magiclink') {
          supabaseType = 'magiclink';
        } else if (type === 'email') {
          supabaseType = 'email';
        }

        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: supabaseType,
        });

        if (error) {
          logger.error('ConfirmEmail', 'Error verifying token:', error);
          setStatus('error');
          setMessage(error.message || 'Erro ao confirmar email. O link pode ter expirado.');
          return;
        }

        if (data?.user) {
          logger.log('ConfirmEmail', 'Email confirmed successfully:', data.user.email);

          // Step 1: Update email_verified in user_profiles
          try {
            const { error: updateError } = await supabase
              .from('user_profiles')
              .update({
                email_verified: true,
                email_verified_at: new Date().toISOString()
              })
              .eq('id', data.user.id);

            if (updateError) {
              logger.error('ConfirmEmail', 'Failed to update email_verified:', updateError);
            } else {
              logger.log('ConfirmEmail', 'email_verified updated successfully');
            }
          } catch (updateErr) {
            logger.error('ConfirmEmail', 'Exception updating email_verified:', updateErr);
          }

          // Email verified successfully - no additional actions needed

          setStatus('success');
          setMessage('Email confirmado com sucesso! Redirecionando...');

          setTimeout(() => {
            window.location.href = '/app';
          }, 2000);
        } else {
          logger.error('ConfirmEmail', 'No user data returned after verification');
          setStatus('error');
          setMessage('Erro ao confirmar email. Tente novamente.');
        }
      } catch (err) {
        logger.error('ConfirmEmail', 'Unexpected error during confirmation:', err);
        setStatus('error');
        setMessage('Erro inesperado ao confirmar email. Tente novamente.');
      }
    };

    confirmEmail();
  }, []);

  const handleResendEmail = async () => {
    if (!userEmail || isResending) return;

    setIsResending(true);
    try {
      logger.log('ConfirmEmail', 'Resending confirmation email to:', userEmail);

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: userEmail,
      });

      if (error) {
        logger.error('ConfirmEmail', 'Error resending email:', error);
        setMessage('Erro ao reenviar email. Tente novamente mais tarde.');
      } else {
        logger.log('ConfirmEmail', 'Email resent successfully');
        setMessage('Email reenviado com sucesso! Verifique sua caixa de entrada.');
        setStatus('success');
      }
    } catch (err) {
      logger.error('ConfirmEmail', 'Unexpected error resending email:', err);
      setMessage('Erro ao reenviar email. Tente novamente mais tarde.');
    } finally {
      setIsResending(false);
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
          {status === 'loading' && (
            <>
              <Loader className="w-16 h-16 animate-spin mx-auto mb-6 text-wis-dark" />
              <h1 className="text-2xl md:text-3xl font-title font-bold text-gray-900 mb-3 md:mb-4">
                Confirmando Email
              </h1>
              <p className="text-gray-600 mb-6 text-sm">
                {message}
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle className="w-16 h-16 mx-auto mb-6 text-green-600" />
              <h1 className="text-2xl md:text-3xl font-title font-bold text-gray-900 mb-3 md:mb-4">
                Email Confirmado!
              </h1>
              <p className="text-gray-600 mb-6 text-sm">
                {message}
              </p>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircle className="w-16 h-16 mx-auto mb-6 text-red-600" />
              <h1 className="text-2xl md:text-3xl font-title font-bold text-gray-900 mb-3 md:mb-4">
                Erro na Confirmação
              </h1>
              <p className="text-gray-600 mb-6 text-sm">
                {message}
              </p>
              <div className="space-y-3">
                {userEmail && (
                  <button
                    onClick={handleResendEmail}
                    disabled={isResending}
                    className="w-full bg-blue-600 text-white py-2.5 md:py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm md:text-base disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isResending ? 'Reenviando...' : 'Reenviar Email de Confirmação'}
                  </button>
                )}
                <button
                  onClick={() => window.location.href = '/sign-in'}
                  className="w-full bg-wis-dark text-white py-2.5 md:py-3 px-4 rounded-lg hover:bg-gray-800 transition-colors font-medium text-sm md:text-base"
                >
                  Ir para Login
                </button>
                <button
                  onClick={() => window.location.href = '/sign-up'}
                  className="w-full bg-white text-gray-700 py-2.5 md:py-3 px-4 rounded-lg border-2 border-gray-300 hover:bg-gray-50 transition-colors font-medium text-sm md:text-base"
                >
                  Criar Nova Conta
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
