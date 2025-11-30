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
  terms_accepted_at: string;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, profileData: Omit<UserProfile, 'id' | 'is_admin' | 'created_at' | 'updated_at' | 'terms_accepted_at'>) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithMicrosoft: () => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
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
      logger.log('AuthContext', 'Profile already loading, skipping duplicate call');
      return;
    }

    if (hasLoadedProfile.current === userId) {
      logger.log('AuthContext', 'Profile already loaded for this user, skipping');
      setLoading(false);
      return;
    }

    isLoadingProfile.current = true;
    logger.log('AuthContext', 'loadProfile called for userId:', userId);

    try {
      logger.log('AuthContext', 'Carregando perfil do usuário:', userId);
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        logger.error('AuthContext', 'Erro ao carregar perfil:', error);
        throw error;
      }

      logger.log('AuthContext', 'Perfil carregado:', data ? 'Sucesso' : 'Sem dados');
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
      logger.error('AuthContext', 'Erro ao carregar perfil (catch):', error);
      setProfile(null);
    } finally {
      logger.log('AuthContext', 'loadProfile finished, setting loading to false');
      isLoadingProfile.current = false;
      setLoading(false);
    }
  };

  const signUp = async (
    email: string,
    password: string,
    profileData: Omit<UserProfile, 'id' | 'is_admin' | 'created_at' | 'updated_at' | 'terms_accepted_at'>
  ) => {
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
      logger.log('AuthContext', 'User created successfully, sending confirmation email via Mailchimp...');

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;

        if (token) {
          const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-confirmation-email`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              user_id: data.user.id,
              email: email,
              first_name: profileData.first_name,
              last_name: profileData.last_name || '',
              phone: profileData.phone || '',
              phone_country_code: profileData.phone_country_code || ''
            })
          });

          if (!response.ok) {
            const errorData = await response.json();
            logger.error('AuthContext', 'Failed to send confirmation email:', errorData);
          } else {
            logger.log('AuthContext', 'Confirmation email sent successfully via Mailchimp');
          }
        } else {
          logger.warn('AuthContext', 'No session token available, skipping confirmation email');
        }
      } catch (emailError) {
        logger.error('AuthContext', 'Error sending confirmation email (non-blocking):', emailError);
      }

      // With "Confirm email" enabled in Supabase settings, user is created as unconfirmed
      // and cannot login until they confirm their email via the Mailchimp link
      logger.log('AuthContext', 'User created as unconfirmed, waiting for email confirmation');
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
        redirectTo: `${window.location.origin}/app`,
        scopes: 'email profile openid User.Read',
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
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
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

  const value = {
    user,
    profile,
    session,
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    signInWithMicrosoft,
    signOut,
    resetPassword,
    updatePassword,
    refreshProfile,
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
