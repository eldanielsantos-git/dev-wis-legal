import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';

interface UserProfile {
  id: string;
  avatar_url?: string;
  first_name: string;
  last_name: string;
  phone?: string;
  phone_country_code?: string;
  oab?: string;
  city?: string;
  state?: string;
  is_admin: boolean;
  email_verified: boolean;
  email_verified_at?: string;
  terms_accepted_at: string;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  emailVerified: boolean;
  signUp: (email: string, password: string, profileData: Omit<UserProfile, 'id' | 'is_admin' | 'created_at' | 'updated_at' | 'terms_accepted_at' | 'email_verified' | 'email_verified_at'>) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithMicrosoft: () => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshEmailStatus: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  logger.log('AuthProvider', 'Initializing AuthProvider');
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const isLoadingProfile = useRef(false);
  const hasLoadedProfile = useRef<string | null>(null);

  useEffect(() => {
    logger.log('AuthProvider', 'useEffect running - getting session');
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        logger.log('AuthContext', 'Session obtida:', session ? 'Usuário autenticado' : 'Sem sessão');
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          logger.log('AuthContext', 'Loading profile for user:', session.user.id);
          loadProfile(session.user.id);
        } else {
          logger.log('AuthContext', 'No user, setting loading to false');
          setLoading(false);
        }
      })
      .catch((error) => {
        logger.error('AuthContext', 'Erro ao obter sessão:', error);
        setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      logger.log('AuthContext', 'Mudança de estado de autenticação:', _event);
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setProfile(null);
        hasLoadedProfile.current = null;
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (userId: string) => {
    if (isLoadingProfile.current) {
      return;
    }

    if (hasLoadedProfile.current === userId) {
      setLoading(false);
      return;
    }

    isLoadingProfile.current = true;

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        throw error;
      }
      setProfile(data);
      hasLoadedProfile.current = userId;

      // Auto-accept pending workspace invitations on login
      if (data?.email) {
        try {
          const { data: acceptedCount, error: acceptError } = await supabase.rpc(
            'accept_pending_invitations_by_email',
            {
              p_user_id: userId,
              p_email: data.email
            }
          );

          if (!acceptError && acceptedCount && acceptedCount > 0) {
            logger.log('AuthContext', `Auto-accepted ${acceptedCount} pending invitations`);
          }
        } catch (acceptError) {
          logger.error('AuthContext', 'Erro ao aceitar convites pendentes:', acceptError);
        }
      }
    } catch (error) {
      setProfile(null);
    } finally {
      isLoadingProfile.current = false;
      setLoading(false);
    }
  };

  const signUp = async (
    email: string,
    password: string,
    profileData: Omit<UserProfile, 'id' | 'is_admin' | 'created_at' | 'updated_at' | 'terms_accepted_at'>
  ) => {
    // Check if user already exists BEFORE attempting signup
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('id, email')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (existingProfile) {
      throw new Error('Este email já está cadastrado. Faça login ou use outro email.');
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/confirm-email`,
        emailConfirmation: true,
        data: {
          first_name: profileData.first_name,
          last_name: profileData.last_name,
          phone: profileData.phone,
          phone_country_code: profileData.phone_country_code,
          cpf: profileData.cpf,
          oab: profileData.oab,
          city: profileData.city,
          state: profileData.state,
          avatar_url: profileData.avatar_url,
        }
      }
    });

    // If user already exists, check if they're confirmed
    if (error && error.message.includes('already')) {
      logger.log('AuthContext', 'User already exists, checking if confirmed...');

      // Query the user_profiles to get user_id
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id, email')
        .eq('email', email.toLowerCase())
        .maybeSingle();

      if (profile) {
        // User exists and has a profile - they should login instead
        throw new Error('Este email já está cadastrado. Faça login ou use outro email.');
      } else {
        // User exists in auth.users but no profile - they might not be confirmed
        // Try to re-send confirmation email
        logger.log('AuthContext', 'User exists in auth but no profile, attempting to re-send email');
        throw new Error('Este email já foi registrado mas não confirmado. Use "Esqueci minha senha" para redefinir ou contate o suporte.');
      }
    }

    if (error) throw error;

    if (data?.user) {
      logger.log('AuthContext', 'User created successfully, sending confirmation email via Resend...');

      // Send confirmation email - Fire and forget (errors logged but don't block signup)
      fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-confirmation-email`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: data.user.id,
          email: email,
          first_name: profileData.first_name,
          last_name: profileData.last_name || '',
          cpf: profileData.cpf || '',
          phone: profileData.phone || '',
          phone_country_code: profileData.phone_country_code || '',
          city: profileData.city || '',
          state: profileData.state || ''
        })
      })
        .then(response => {
          if (!response.ok) {
            return response.text().then(errorText => {
              logger.error('AuthContext', 'Failed to send confirmation email:', errorText);
            });
          } else {
            logger.log('AuthContext', 'Confirmation email sent successfully via Resend');
          }
        })
        .catch(emailError => {
          logger.error('AuthContext', 'Error sending confirmation email (non-blocking):', emailError);
        });

      // Force logout after signup to prevent automatic login
      // User must confirm email before accessing the app
      logger.log('AuthContext', 'User created as unconfirmed, forcing logout');

      // Clear state immediately (don't wait for signOut)
      setUser(null);
      setProfile(null);
      setSession(null);

      // Sign out in background (errors don't matter since we already cleared state)
      supabase.auth.signOut().catch(logoutError => {
        logger.error('AuthContext', 'Error during forced logout (non-critical):', logoutError);
      });
    }
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) throw error;

    // Check if email is confirmed
    if (data?.user && !data.user.email_confirmed_at) {
      logger.warn('AuthContext', 'User email not confirmed, signing out...');
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      setSession(null);
      throw new Error('Por favor, confirme seu email antes de fazer login. Verifique sua caixa de entrada.');
    }
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/app`,
        scopes: 'email profile https://www.googleapis.com/auth/userinfo.profile',
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
    if (error) throw error;
  };

  const signInWithMicrosoft = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        redirectTo: window.location.origin,
        scopes: 'email offline_access',
      },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    logger.log('AuthContext', 'Iniciando logout...');

    try {
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) {
        logger.error('AuthContext', 'Erro ao fazer logout:', error);
        throw error;
      }

      logger.log('AuthContext', 'Logout bem-sucedido');

      setUser(null);
      setSession(null);
      setProfile(null);
      hasLoadedProfile.current = null;

      localStorage.clear();
      sessionStorage.clear();

      const cookies = document.cookie.split(';');
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i];
        const eqPos = cookie.indexOf('=');
        const name = eqPos > -1 ? cookie.substring(0, eqPos) : cookie;
        document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
      }

      window.location.href = '/sign-in';
    } catch (error) {
      logger.error('AuthContext', 'Erro durante logout:', error);
      localStorage.clear();
      sessionStorage.clear();
      hasLoadedProfile.current = null;
      window.location.href = '/sign-in';
    }
  };

  const resetPassword = async (email: string) => {
    logger.log('AuthContext', 'Sending password reset email via edge function...');

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-reset-password-email`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email })
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      logger.error('AuthContext', 'Failed to send reset password email:', errorData);
      throw new Error(errorData.error || 'Erro ao enviar email de redefinição');
    }

    logger.log('AuthContext', 'Password reset email sent successfully');
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  };

  const refreshProfile = async () => {
    if (user) {
      hasLoadedProfile.current = null;
      await loadProfile(user.id);
    }
  };

  const refreshEmailStatus = async () => {
    if (!user) return;
    try {
      logger.log('AuthContext', 'Refreshing email verification status for:', user.id);
      const { data, error } = await supabase
        .from('user_profiles')
        .select('email_verified, email_verified_at')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        logger.error('AuthContext', 'Error refreshing email status:', error);
        return;
      }

      if (data && profile) {
        setProfile({
          ...profile,
          email_verified: data.email_verified,
          email_verified_at: data.email_verified_at
        });
        logger.log('AuthContext', 'Email verification status updated:', data.email_verified);
      }
    } catch (error) {
      logger.error('AuthContext', 'Exception refreshing email status:', error);
    }
  };

  const value = {
    user,
    profile,
    session,
    loading,
    emailVerified: profile?.email_verified ?? false,
    signUp,
    signIn,
    signInWithGoogle,
    signInWithMicrosoft,
    signOut,
    resetPassword,
    updatePassword,
    refreshProfile,
    refreshEmailStatus,
    isAdmin: profile?.is_admin ?? false,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
