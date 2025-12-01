import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { LoadingSpinner } from './LoadingSpinner';
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
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!user) {
      logger.log('RequireEmailVerification', 'No user, redirecting to sign-in');
      onNavigateToSignIn();
      return;
    }

    if (!profile) {
      logger.log('RequireEmailVerification', 'No profile loaded yet');
      return;
    }

    if (!emailVerified) {
      logger.log('RequireEmailVerification', 'Email not verified, redirecting to verify page');
      onNavigateToVerifyEmail();
      return;
    }

    setIsChecking(false);
  }, [user, profile, loading, emailVerified, onNavigateToSignIn, onNavigateToVerifyEmail]);

  if (loading || isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user || !profile || !emailVerified) {
    return null;
  }

  return <>{children}</>;
}
