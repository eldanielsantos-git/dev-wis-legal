import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../utils/logger';
import { Loader } from 'lucide-react';

interface RequireEmailVerificationProps {
  children: React.ReactNode;
  onNavigateToSignIn: () => void;
  onNavigateToVerifyEmail: () => void;
}

export function RequireEmailVerification({
  children,
  onNavigateToSignIn,
  onNavigateToVerifyEmail
}: RequireEmailVerificationProps) {
  const { user, profile, loading, emailVerified, isAdmin, refreshProfile } = useAuth();
  const [profileRetryCount, setProfileRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  const authEmailConfirmed = !!user?.email_confirmed_at;
  const isEmailVerified = emailVerified || authEmailConfirmed;

  useEffect(() => {
    logger.log('RequireEmailVerification', 'useEffect triggered - loading:', loading, 'user:', user?.id, 'profile:', !!profile, 'emailVerified:', emailVerified, 'authEmailConfirmed:', authEmailConfirmed, 'isAdmin:', isAdmin);

    if (loading) {
      logger.log('RequireEmailVerification', 'Still loading, waiting...');
      return;
    }

    if (!user) {
      logger.log('RequireEmailVerification', 'No user, redirecting to sign-in');
      onNavigateToSignIn();
      return;
    }

    if (!profile && profileRetryCount < 3 && !isRetrying) {
      logger.log('RequireEmailVerification', `No profile loaded, attempting retry ${profileRetryCount + 1}/3...`);
      setIsRetrying(true);
      setTimeout(async () => {
        try {
          await refreshProfile();
        } catch (err) {
          logger.error('RequireEmailVerification', 'Error refreshing profile:', err);
        }
        setProfileRetryCount(prev => prev + 1);
        setIsRetrying(false);
      }, 1000);
      return;
    }

    if (!profile && profileRetryCount >= 3) {
      logger.error('RequireEmailVerification', 'Failed to load profile after 3 retries, redirecting to sign-in');
      onNavigateToSignIn();
      return;
    }

    if (!isEmailVerified && !isAdmin) {
      logger.log('RequireEmailVerification', 'Email not verified and not admin, redirecting to verify page');
      onNavigateToVerifyEmail();
      return;
    }

    if (isAdmin) {
      logger.log('RequireEmailVerification', 'User is admin, bypassing email verification');
    }

    logger.log('RequireEmailVerification', 'All checks passed! User can proceed.');
  }, [user, profile, loading, emailVerified, authEmailConfirmed, isEmailVerified, isAdmin, onNavigateToSignIn, onNavigateToVerifyEmail, profileRetryCount, isRetrying, refreshProfile]);

  if (loading || !user || (!profile && profileRetryCount < 3)) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0F0E0D' }}>
        <div className="text-center">
          <Loader className="w-8 h-8 text-white animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">
            {!profile && profileRetryCount > 0 ? `Carregando perfil... (tentativa ${profileRetryCount}/3)` : 'Carregando...'}
          </p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  if (!isEmailVerified && !isAdmin) {
    return null;
  }

  return <>{children}</>;
}
