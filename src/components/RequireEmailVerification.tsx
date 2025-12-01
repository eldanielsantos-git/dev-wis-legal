import React, { useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
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

  logger.log('RequireEmailVerification', 'RENDER - loading:', loading, 'user:', user?.id, 'profile:', !!profile, 'emailVerified:', emailVerified, 'isAdmin:', isAdmin);

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
    logger.log('RequireEmailVerification', 'Loading, no user, or no profile - returning null (App.tsx handles loading)');
    return null;
  }

  if (!emailVerified && !isAdmin) {
    logger.log('RequireEmailVerification', 'Email not verified and not admin, returning null');
    return null;
  }

  if (isAdmin) {
    logger.log('RequireEmailVerification', 'Admin user detected, allowing access');
  }

  logger.log('RequireEmailVerification', 'Rendering children (AppHomePage)');
  return <>{children}</>;
}
