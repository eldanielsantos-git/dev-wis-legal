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
  }, [user, profile, loading, emailVerified, onNavigateToSignIn, onNavigateToVerifyEmail]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0F0E0D' }}>
        <Loader className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  if (!user || !profile) {
    return null;
  }

  if (!emailVerified) {
    return null;
  }

  return <>{children}</>;
}
