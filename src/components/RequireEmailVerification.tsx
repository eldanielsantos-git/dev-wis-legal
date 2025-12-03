import React, { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
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
  const { user, profile, loading, emailVerified, isAdmin } = useAuth();

  useEffect(() => {
    logger.log('RequireEmailVerification', 'useEffect triggered - loading:', loading, 'user:', user?.id, 'profile:', !!profile, 'emailVerified:', emailVerified, 'isAdmin:', isAdmin);

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

    if (!emailVerified && !isAdmin) {
      logger.log('RequireEmailVerification', 'Email not verified and not admin, redirecting to verify page');
      onNavigateToVerifyEmail();
      return;
    }

    if (isAdmin) {
      logger.log('RequireEmailVerification', 'User is admin, bypassing email verification');
    }

    logger.log('RequireEmailVerification', 'All checks passed! User can proceed.');
  }, [user, profile, loading, emailVerified, isAdmin, onNavigateToSignIn, onNavigateToVerifyEmail]);

  if (loading || !user || !profile) {
    return null;
  }

  if (!emailVerified && !isAdmin) {
    return null;
  }

  return <>{children}</>;
}
