import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate, useLocation } from 'react-router-dom';
import { LoadingSpinner } from './LoadingSpinner';
import { logger } from '../utils/logger';

interface RequireEmailVerificationProps {
  children: React.ReactNode;
}

export function RequireEmailVerification({ children }: RequireEmailVerificationProps) {
  const { user, profile, loading, emailVerified } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!user) {
      logger.log('RequireEmailVerification', 'No user, redirecting to sign-in');
      navigate('/sign-in', { replace: true, state: { from: location } });
      return;
    }

    if (!profile) {
      logger.log('RequireEmailVerification', 'No profile loaded yet');
      return;
    }

    if (!emailVerified) {
      logger.log('RequireEmailVerification', 'Email not verified, redirecting to verify page');
      navigate('/verify-email-required', { replace: true });
      return;
    }

    setIsChecking(false);
  }, [user, profile, loading, emailVerified, navigate, location]);

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
