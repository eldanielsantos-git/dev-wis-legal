import React, { useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Loader } from 'lucide-react';
import { logger } from '../utils/logger';

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
  const { user, profile, loading, emailVerified } = useAuth();

  logger.log('RequireEmailVerification', 'RENDER - loading:', loading, 'user:', user?.id, 'profile:', !!profile, 'emailVerified:', emailVerified);

  useEffect(() => {
    logger.log('RequireEmailVerification', 'useEffect triggered - loading:', loading, 'user:', user?.id, 'profile:', !!profile, 'emailVerified:', emailVerified);

    if (loading) {
      logger.log('RequireEmailVerification', 'Still loading, waiting...');
      return;
    }

    if (!user) {
      logger.log('RequireEmailVerification', 'No user, redirecting to sign-in');
      onNavigateToSignIn();
      return;
    }

    if (!profile) {
      logger.log('RequireEmailVerification', 'No profile loaded yet, waiting...');
      return;
    }

    if (!emailVerified) {
      logger.log('RequireEmailVerification', 'Email not verified, redirecting to verify page');
      onNavigateToVerifyEmail();
      return;
    }

    logger.log('RequireEmailVerification', 'All checks passed! User can proceed.');
  }, [user, profile, loading, emailVerified, onNavigateToSignIn, onNavigateToVerifyEmail]);

  if (loading) {
    logger.log('RequireEmailVerification', 'Showing loading spinner');
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0F0E0D' }}>
        <Loader className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  if (!user || !profile) {
    logger.log('RequireEmailVerification', 'No user or profile, returning null');
    return null;
  }

  if (!emailVerified) {
    logger.log('RequireEmailVerification', 'Email not verified, returning null');
    return null;
  }

  logger.log('RequireEmailVerification', 'Rendering children (AppHomePage)');
  return <>{children}</>;
}
