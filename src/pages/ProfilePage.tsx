import React, { useState, useRef, useEffect } from 'react';
import { SidebarWis } from '../components/SidebarWis';
import { FooterWis } from '../components/FooterWis';
import { IntelligentSearch } from '../components/IntelligentSearch';
import { UserAvatar } from '../components/UserAvatar';
import { SubscriptionPlans } from '../components/subscription/SubscriptionPlans';
import { AdminSettingsPage } from './AdminSettingsPage';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';
import { supabase } from '../lib/supabase';
import { Camera, Save, Loader, Trash2, AlertTriangle, ChevronDown, Eye, EyeOff, CheckCircle2, XCircle, User, CreditCard, Settings, LogOut } from 'lucide-react';
import Select from 'react-select';
import { brazilianStates, type State } from '../data/brazilianLocations';

interface ProfilePageProps {
  onNavigateToApp: () => void;
  onNavigateToMyProcess: () => void;
  onNavigateToChat?: () => void;
  onNavigateToAdmin: () => void;
  onNavigateToSettings?: () => void;
  onNavigateToProfile?: () => void;
  onNavigateToTerms?: () => void;
  onNavigateToPrivacy?: () => void;
  onNavigateToCookies?: () => void;
  onNavigateToSignIn?: () => void;
}

export function ProfilePage({ onNavigateToApp, onNavigateToMyProcess, onNavigateToChat, onNavigateToAdmin, onNavigateToSettings, onNavigateToProfile, onNavigateToTerms, onNavigateToPrivacy, onNavigateToCookies, onNavigateToSignIn }: ProfilePageProps) {
  const { profile, user, refreshProfile, loading, isAdmin, signOut } = useAuth();
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [activeTab, setActiveTab] = useState<'profile' | 'subscription' | 'admin'>(() => {
    const hash = window.location.hash;
    if (hash === '#admin' && isAdmin) return 'admin';
    if (hash === '#profile') return 'profile';
    if (hash === '#subscription') return 'subscription';
    return 'subscription';
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash === '#admin' && isAdmin) setActiveTab('admin');
      else if (hash === '#profile') setActiveTab('profile');
      else if (hash === '#subscription') setActiveTab('subscription');
      window.scrollTo(0, 0);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [isAdmin]);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    phoneCountryCode: '+55',
    oab: '',
    city: '',
    state: '',
    avatar_url: '',
  });

  const [selectedState, setSelectedState] = useState<State | null>(null);

  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: '',
  });

  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const [isEmailPasswordUser, setIsEmailPasswordUser] = useState(false);
  const [showPasswordSuccessModal, setShowPasswordSuccessModal] = useState(false);
  const [showDeleteSuccessModal, setShowDeleteSuccessModal] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState({
    subscription: false,
    processos: false,
    chat: false,
    profile: false,
    auth: false
  });
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [showEmailSuccessModal, setShowEmailSuccessModal] = useState(false);

  const [passwordValidation, setPasswordValidation] = useState({
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSpecialChar: false
  });

  const formatPhoneBrazil = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 11);
    if (numbers.length <= 10) {
      return numbers.replace(/(\d{2})(\d{4})(\d{0,4})/, (match, p1, p2, p3) => {
        let formatted = `(${p1})`;
        if (p2) formatted += ` ${p2}`;
        if (p3) formatted += `-${p3}`;
        return formatted;
      });
    }
    return numbers.replace(/(\d{2})(\d{5})(\d{0,4})/, (match, p1, p2, p3) => {
      let formatted = `(${p1})`;
      if (p2) formatted += ` ${p2}`;
      if (p3) formatted += `-${p3}`;
      return formatted;
    });
  };

  const formatOAB = (value: string) => {
    const cleaned = value.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
    const numbers = cleaned.replace(/[A-Z]/g, '');
    const letters = cleaned.replace(/[0-9]/g, '');

    if (numbers.length <= 3) {
      return cleaned;
    }

    const formattedNumbers = numbers.replace(/(\d{1,3})(?=(\d{3})+(?!\d))/g, '$1.');
    return formattedNumbers + letters;
  };

  const validatePassword = (password: string) => {
    return {
      minLength: password.length >= 6,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
    };
  };

  const countryCodes = [
    { code: '+55', country: 'Brasil', flag: '🇧🇷', example: '(11) 98765-4321' },
    { code: '+1', country: 'EUA/Canadá', flag: '🇺🇸', example: '(555) 123-4567' },
    { code: '+44', country: 'Reino Unido', flag: '🇬🇧', example: '7911 123456' },
    { code: '+33', country: 'França', flag: '🇫🇷', example: '6 12 34 56 78' },
    { code: '+49', country: 'Alemanha', flag: '🇩🇪', example: '1512 3456789' },
    { code: '+39', country: 'Itália', flag: '🇮🇹', example: '312 345 6789' },
    { code: '+34', country: 'Espanha', flag: '🇪🇸', example: '612 34 56 78' },
    { code: '+351', country: 'Portugal', flag: '🇵🇹', example: '912 345 678' },
    { code: '+52', country: 'México', flag: '🇲🇽', example: '55 1234 5678' },
    { code: '+54', country: 'Argentina', flag: '🇦🇷', example: '11 2345-6789' },
    { code: '+56', country: 'Chile', flag: '🇨🇱', example: '9 1234 5678' },
    { code: '+57', country: 'Colômbia', flag: '🇨🇴', example: '321 1234567' },
    { code: '+51', country: 'Peru', flag: '🇵🇪', example: '987 654 321' },
    { code: '+598', country: 'Uruguai', flag: '🇺🇾', example: '94 123 456' },
    { code: '+595', country: 'Paraguai', flag: '🇵🇾', example: '981 123456' },
    { code: '+593', country: 'Equador', flag: '🇪🇨', example: '99 123 4567' },
    { code: '+591', country: 'Bolívia', flag: '🇧🇴', example: '71234567' },
    { code: '+81', country: 'Japão', flag: '🇯🇵', example: '90-1234-5678' },
    { code: '+86', country: 'China', flag: '🇨🇳', example: '138 0013 8000' },
    { code: '+91', country: 'Índia', flag: '🇮🇳', example: '98765 43210' },
    { code: '+61', country: 'Austrália', flag: '🇦🇺', example: '412 345 678' }
  ];

  useEffect(() => {
    if (profile) {
      console.log('Profile loaded:', profile);
      const phoneValue = profile.phone || '';
      let countryCode = '+55';
      let phoneNumber = phoneValue;

      if (phoneValue) {
        const match = phoneValue.match(/^(\+\d{1,4})\s*(.*)$/);
        if (match) {
          countryCode = match[1];
          phoneNumber = match[2];
        }
      }

      const stateValue = profile.state || '';
      const stateOption = brazilianStates.find(s => s.label === stateValue);
      setSelectedState(stateOption || null);

      setFormData({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        phone: phoneNumber,
        phoneCountryCode: countryCode,
        oab: profile.oab || '',
        city: profile.city || '',
        state: stateValue,
        avatar_url: profile.avatar_url || '',
      });
    }
  }, [profile]);

  useEffect(() => {
    const checkAuthProvider = async () => {
      if (user) {
        const { data } = await supabase.auth.getUser();
        const provider = data.user?.app_metadata?.provider;
        setIsEmailPasswordUser(provider === 'email');
      }
    };
    checkAuthProvider();
  }, [user]);

  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash === '#admin' && isAdmin) {
        setActiveTab('admin');
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [isAdmin]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let newValue = value;

    if (name === 'first_name' || name === 'last_name') {
      newValue = value.replace(/[^a-zA-ZÀ-ÿ\s]/g, '');
    }

    if (name === 'phone') {
      const numbersOnly = value.replace(/\D/g, '');
      if (formData.phoneCountryCode === '+55') {
        newValue = formatPhoneBrazil(numbersOnly);
      } else {
        newValue = numbersOnly;
      }
    }

    if (name === 'city') {
      newValue = value.replace(/[0-9]/g, '');
    }

    if (name === 'oab') {
      newValue = formatOAB(value);
    }

    setFormData({
      ...formData,
      [name]: newValue,
    });
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const newData = {
      ...passwordData,
      [name]: value,
    };
    setPasswordData(newData);

    if (name === 'newPassword') {
      setPasswordValidation(validatePassword(value));
    }

    if (name === 'confirmPassword' || (name === 'newPassword' && newData.confirmPassword)) {
      if (newData.newPassword && newData.confirmPassword && newData.newPassword !== newData.confirmPassword) {
        setMessage({ type: 'error', text: 'As senhas não coincidem' });
      } else if (newData.newPassword === newData.confirmPassword && newData.newPassword.length >= 6) {
        setMessage(null);
      }
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) return;

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'As senhas não coincidem' });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setMessage({ type: 'error', text: 'A nova senha deve ter pelo menos 6 caracteres' });
      return;
    }

    if (!/[a-z]/.test(passwordData.newPassword)) {
      setMessage({ type: 'error', text: 'A senha deve conter pelo menos uma letra minúscula' });
      return;
    }

    if (!/[A-Z]/.test(passwordData.newPassword)) {
      setMessage({ type: 'error', text: 'A senha deve conter pelo menos uma letra maiúscula' });
      return;
    }

    if (!/[0-9]/.test(passwordData.newPassword)) {
      setMessage({ type: 'error', text: 'A senha deve conter pelo menos um número' });
      return;
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(passwordData.newPassword)) {
      setMessage({ type: 'error', text: 'A senha deve conter pelo menos um caractere especial' });
      return;
    }

    try {
      setIsPasswordLoading(true);
      setMessage(null);

      const { data, error: updateError } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      });

      if (updateError) {
        throw updateError;
      }

      if (!data.user) {
        throw new Error('Erro ao atualizar senha');
      }

      setPasswordData({
        newPassword: '',
        confirmPassword: '',
      });

      setPasswordValidation({
        minLength: false,
        hasUppercase: false,
        hasLowercase: false,
        hasNumber: false,
        hasSpecialChar: false
      });

      setShowPasswordSuccessModal(true);
      setTimeout(() => {
        setShowPasswordSuccessModal(false);
      }, 3000);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Erro ao atualizar senha' });
    } finally {
      setIsPasswordLoading(false);
    }
  };

  const handleEmailUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(newEmail)) {
      setMessage({ type: 'error', text: 'Digite um email válido' });
      return;
    }

    if (newEmail === user.email) {
      setMessage({ type: 'error', text: 'O novo email é igual ao atual' });
      return;
    }

    try {
      setIsEmailLoading(true);
      setMessage(null);

      const { data, error: updateError } = await supabase.auth.updateUser({
        email: newEmail,
      });

      if (updateError) {
        throw updateError;
      }

      if (!data.user) {
        throw new Error('Erro ao atualizar email');
      }

      setNewEmail('');
      setIsEditingEmail(false);
      setShowEmailSuccessModal(true);
      setTimeout(() => {
        setShowEmailSuccessModal(false);
      }, 3000);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Erro ao atualizar email' });
    } finally {
      setIsEmailLoading(false);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    try {
      setIsUploadingAvatar(true);
      setMessage(null);

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      setFormData({ ...formData, avatar_url: publicUrl });
      setMessage({ type: 'success', text: 'Foto atualizada com sucesso!' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Erro ao fazer upload da foto' });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) return;

    try {
      setIsLoading(true);
      setMessage(null);

      const fullPhone = formData.phone ? `${formData.phoneCountryCode} ${formData.phone}` : '';

      const { error } = await supabase
        .from('user_profiles')
        .update({
          first_name: formData.first_name,
          last_name: formData.last_name,
          phone: fullPhone,
          phone_country_code: formData.phoneCountryCode,
          oab: formData.oab || null,
          city: formData.city,
          state: formData.state,
          avatar_url: formData.avatar_url,
        })
        .eq('id', user.id);

      if (error) throw error;

      await refreshProfile();
      setMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Erro ao atualizar perfil' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;

    try {
      setIsDeleting(true);
      setMessage(null);
      setDeleteProgress({ subscription: false, processos: false, chat: false, profile: false, auth: false });

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Sessão não encontrada. Por favor, faça login novamente.');
      }

      // Simulate progress updates
      setTimeout(() => setDeleteProgress(prev => ({ ...prev, subscription: true })), 500);
      setTimeout(() => setDeleteProgress(prev => ({ ...prev, processos: true })), 1000);
      setTimeout(() => setDeleteProgress(prev => ({ ...prev, chat: true })), 2000);
      setTimeout(() => setDeleteProgress(prev => ({ ...prev, profile: true })), 3000);

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao excluir conta');
      }

      // Mark auth as complete
      setDeleteProgress(prev => ({ ...prev, auth: true }));

      // Wait a bit to show completion
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Sign out and redirect
      await supabase.auth.signOut();
      window.location.href = 'https://app.wislegal.io/sign-in';
    } catch (error: any) {
      console.error('Error deleting account:', error);
      setMessage({ type: 'error', text: error.message || 'Erro ao excluir conta' });
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen font-body" style={{ backgroundColor: colors.bgPrimary }}>
        <SidebarWis
          onNavigateToApp={onNavigateToApp}
          onNavigateToMyProcess={onNavigateToMyProcess}
          onNavigateToChat={onNavigateToChat}
          onNavigateToAdmin={onNavigateToAdmin}
          onNavigateToSettings={onNavigateToSettings}
          onNavigateToProfile={onNavigateToProfile}
          onNavigateToNotifications={() => {
            window.history.pushState({}, '', '/notifications');
            window.dispatchEvent(new PopStateEvent('popstate'));
          }}
          onNavigateToTokens={() => {
            window.history.pushState({}, '', '/tokens');
            window.dispatchEvent(new PopStateEvent('popstate'));
          }}
          onNavigateToSubscription={() => {
            window.history.pushState({}, '', '/signature');
            window.dispatchEvent(new PopStateEvent('popstate'));
          }}
          onCollapsedChange={setIsSidebarCollapsed}
        />
        <div className={`${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'} pt-16 lg:pt-0 flex-1 flex flex-col transition-[margin-left] duration-300 ease-in-out`}>
          <main className="flex-1 p-8 flex items-center justify-center">
            <Loader className="w-8 h-8 animate-spin" style={{ color: colors.textPrimary }} />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen font-body" style={{ backgroundColor: colors.bgPrimary }}>
      <SidebarWis
        onNavigateToApp={onNavigateToApp}
        onNavigateToMyProcess={onNavigateToMyProcess}
        onNavigateToChat={onNavigateToChat}
        onNavigateToAdmin={onNavigateToAdmin}
        onNavigateToSettings={onNavigateToSettings}
        onNavigateToProfile={onNavigateToProfile}
        onNavigateToNotifications={() => {
          window.history.pushState({}, '', '/notifications');
          window.dispatchEvent(new PopStateEvent('popstate'));
        }}
        onNavigateToTokens={() => {
          window.history.pushState({}, '', '/tokens');
          window.dispatchEvent(new PopStateEvent('popstate'));
        }}
        onNavigateToSubscription={() => {
          window.history.pushState({}, '', '/signature');
          window.dispatchEvent(new PopStateEvent('popstate'));
        }}
        onCollapsedChange={setIsSidebarCollapsed}
        onSearchClick={() => setIsSearchOpen(true)}
      />
      <div className={`${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'} pt-16 lg:pt-0 flex-1 flex flex-col transition-[margin-left] duration-300 ease-in-out`}>
        <main className="flex-1 p-4 sm:p-6 lg:p-8 w-full">
          <section className="mb-6 sm:mb-8 text-center">
            <h1 className="text-3xl sm:text-4xl font-title font-bold mb-2" style={{ color: colors.textPrimary }}>Meu Perfil</h1>
            <p className="text-sm sm:text-base text-gray-400">Gerencie suas informações pessoais e configurações</p>
          </section>

          {/* Tabs Navigation */}
          <div className="mb-6 flex justify-center px-4">
            <div className="inline-flex flex-wrap justify-center items-center rounded-lg p-1 gap-1" style={{ backgroundColor: colors.bgSecondary }}>
              <button
                onClick={() => setActiveTab('subscription')}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg transition-all duration-200 font-medium text-xs sm:text-sm whitespace-nowrap"
                style={{
                  backgroundColor: activeTab === 'subscription' ? colors.bgPrimary : 'transparent',
                  color: activeTab === 'subscription' ? colors.textPrimary : colors.textSecondary
                }}
              >
                <CreditCard className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                <span>Assinatura</span>
              </button>
              <button
                onClick={() => setActiveTab('profile')}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg transition-all duration-200 font-medium text-xs sm:text-sm whitespace-nowrap"
                style={{
                  backgroundColor: activeTab === 'profile' ? colors.bgPrimary : 'transparent',
                  color: activeTab === 'profile' ? colors.textPrimary : colors.textSecondary
                }}
              >
                <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                <span className="hidden xs:inline">Editar meu Perfil</span>
                <span className="xs:hidden">Perfil</span>
              </button>
              {isAdmin && (
                <button
                  onClick={() => setActiveTab('admin')}
                  className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg transition-all duration-200 font-medium text-xs sm:text-sm whitespace-nowrap"
                  style={{
                    backgroundColor: activeTab === 'admin' ? colors.bgPrimary : 'transparent',
                    color: activeTab === 'admin' ? colors.textPrimary : colors.textSecondary
                  }}
                >
                  <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                  <span>Admin</span>
                </button>
              )}
              <div className="hidden sm:block w-px h-6 mx-1" style={{ backgroundColor: colors.textSecondary, opacity: 0.2 }}></div>
              <button
                onClick={async () => {
                  try {
                    await signOut();
                    window.location.href = 'https://app.wislegal.io/sign-in';
                  } catch (error) {
                    console.error('Error signing out:', error);
                  }
                }}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg transition-all duration-200 font-medium text-xs sm:text-sm whitespace-nowrap hover:bg-opacity-10"
                style={{
                  backgroundColor: 'transparent',
                  color: colors.textSecondary
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = colors.bgPrimary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                <span>Sair</span>
              </button>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'profile' && (
            <div className="max-w-3xl mx-auto space-y-6 overflow-x-hidden">
            <form onSubmit={handleSubmit} className="rounded-lg p-4 sm:p-6 lg:p-8 shadow-lg" style={{ backgroundColor: colors.bgSecondary }}>
              <div className="mb-8 flex flex-col items-center">
                <div className="relative group">
                  <div className="cursor-pointer">
                    <UserAvatar
                      avatarUrl={formData.avatar_url}
                      firstName={formData.first_name}
                      lastName={formData.last_name}
                      size="lg"
                      className="text-3xl"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAvatarClick}
                    disabled={isUploadingAvatar}
                    className="absolute bottom-0 right-[-4px] rounded-full p-2 shadow-lg transition-colors disabled:opacity-50 hover:opacity-80"
                    style={{ backgroundColor: colors.bgSecondary, color: colors.textPrimary }}
                  >
                    {isUploadingAvatar ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : (
                      <Camera className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
                <p className="text-sm mt-3" style={{ color: colors.textSecondary }}>Clique no ícone para alterar a foto</p>
              </div>

              {message && (
                <div className="mb-6 p-4 rounded-lg" style={{
                  backgroundColor: message.type === 'success' ? (theme === 'dark' ? '#065f4620' : '#dcfce7') : (theme === 'dark' ? '#7f1d1d20' : '#fee2e2'),
                  color: message.type === 'success' ? (theme === 'dark' ? '#4ade80' : '#15803d') : (theme === 'dark' ? '#f87171' : '#991b1b'),
                  border: `1px solid ${message.type === 'success' ? (theme === 'dark' ? '#065f46' : '#86efac') : (theme === 'dark' ? '#7f1d1d' : '#fca5a5')}`
                }}>
                  {message.text}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label htmlFor="first_name" className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
                    Nome *
                  </label>
                  <input
                    type="text"
                    id="first_name"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleInputChange}
                    required
                    className="w-full min-w-0 px-3 sm:px-4 py-2 rounded-lg focus:outline-none text-sm"
                    style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary, borderColor: colors.border, border: `1px solid ${colors.border}` }}
                  />
                </div>

                <div>
                  <label htmlFor="last_name" className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
                    Sobrenome *
                  </label>
                  <input
                    type="text"
                    id="last_name"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleInputChange}
                    required
                    className="w-full min-w-0 px-3 sm:px-4 py-2 rounded-lg focus:outline-none text-sm"
                    style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary, borderColor: colors.border, border: `1px solid ${colors.border}` }}
                  />
                </div>
              </div>

              <div className="mb-6">
                <label htmlFor="phone" className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
                  Telefone *
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-shrink-0">
                    <select
                      value={formData.phoneCountryCode}
                      onChange={(e) => setFormData({ ...formData, phoneCountryCode: e.target.value })}
                      className="appearance-none w-24 sm:w-28 px-2 sm:px-3 py-2 pr-7 rounded-lg focus:outline-none cursor-pointer text-sm"
                      style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary, borderColor: colors.border, border: `1px solid ${colors.border}` }}
                    >
                      {countryCodes.map((country) => (
                        <option key={country.code} value={country.code}>
                          {country.flag} {country.code}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: colors.textSecondary }} />
                  </div>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    required
                    placeholder={countryCodes.find(c => c.code === formData.phoneCountryCode)?.example || '(11) 98765-4321'}
                    className="flex-1 min-w-0 px-3 sm:px-4 py-2 rounded-lg focus:outline-none text-sm"
                    style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary, borderColor: colors.border, border: `1px solid ${colors.border}` }}
                  />
                </div>
              </div>

              <div className="mb-6">
                <label htmlFor="oab" className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
                  OAB <span className="text-xs opacity-60">(opcional)</span>
                </label>
                <input
                  type="text"
                  id="oab"
                  name="oab"
                  value={formData.oab}
                  onChange={handleInputChange}
                  placeholder="Digite o número da OAB (opcional)"
                  className="w-full min-w-0 px-3 sm:px-4 py-2 rounded-lg focus:outline-none text-sm"
                  style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary, borderColor: colors.border, border: `1px solid ${colors.border}` }}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label htmlFor="state" className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
                    Seccional *
                  </label>
                  <Select
                    value={selectedState}
                    onChange={(option) => {
                      setSelectedState(option);
                      setFormData({ ...formData, state: option?.label || '' });
                    }}
                    options={brazilianStates}
                    placeholder="Selecione um estado"
                    isClearable={false}
                    styles={{
                      control: (base) => ({
                        ...base,
                        backgroundColor: colors.bgPrimary,
                        borderColor: colors.border,
                        borderRadius: '0.5rem',
                        padding: '0.125rem 0.5rem',
                        minHeight: '42px',
                        '&:hover': { borderColor: colors.border },
                      }),
                      placeholder: (base) => ({
                        ...base,
                        color: colors.textSecondary,
                        opacity: 0.6,
                      }),
                      singleValue: (base) => ({
                        ...base,
                        color: colors.textPrimary,
                      }),
                      input: (base) => ({
                        ...base,
                        color: colors.textPrimary,
                      }),
                      option: (base, state) => ({
                        ...base,
                        color: theme === 'dark' ? '#000000' : '#6b7280',
                        backgroundColor: state.isFocused ? (theme === 'dark' ? '#e5e7eb' : '#f3f4f6') : '#ffffff',
                        '&:hover': {
                          backgroundColor: theme === 'dark' ? '#e5e7eb' : '#f3f4f6',
                        },
                      }),
                      menu: (base) => ({
                        ...base,
                        backgroundColor: '#ffffff',
                        borderRadius: '0.5rem',
                        marginTop: '0.25rem',
                      }),
                    }}
                  />
                </div>

                <div>
                  <label htmlFor="city" className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
                    Cidade *
                  </label>
                  <input
                    type="text"
                    id="city"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    required
                    placeholder="Digite sua cidade"
                    className="w-full min-w-0 px-3 sm:px-4 py-2 rounded-lg focus:outline-none text-sm"
                    style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary, borderColor: colors.border, border: `1px solid ${colors.border}` }}
                  />
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
                  Email
                </label>
                {!isEditingEmail ? (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <input
                      type="email"
                      value={user?.email || ''}
                      disabled
                      className="flex-1 min-w-0 px-4 py-2 rounded-lg cursor-not-allowed text-sm"
                      style={{ backgroundColor: theme === 'dark' ? '#1a1f26' : '#f3f4f6', color: colors.textSecondary, borderColor: colors.border, border: `1px solid ${colors.border}` }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingEmail(true);
                        setNewEmail(user?.email || '');
                      }}
                      className="px-4 py-2 font-medium rounded-lg transition-colors hover:opacity-80 flex-shrink-0 text-sm"
                      style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary, border: `1px solid ${colors.border}` }}
                    >
                      Alterar
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="Digite o novo email"
                      className="w-full px-4 py-2 rounded-lg focus:outline-none"
                      style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary, borderColor: colors.border, border: `1px solid ${colors.border}` }}
                    />
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        type="button"
                        onClick={handleEmailUpdate}
                        disabled={isEmailLoading}
                        className="flex items-center justify-center space-x-2 px-4 py-2 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-80 text-sm"
                        style={{ backgroundColor: '#C8C8C8', color: '#29323A' }}
                      >
                        {isEmailLoading ? (
                          <>
                            <Loader className="w-4 h-4 animate-spin" />
                            <span>Salvando...</span>
                          </>
                        ) : (
                          <span>Salvar Email</span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingEmail(false);
                          setNewEmail('');
                          setMessage(null);
                        }}
                        disabled={isEmailLoading}
                        className="px-4 py-2 font-medium rounded-lg transition-colors disabled:opacity-50 hover:opacity-80 text-sm"
                        style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary, border: `1px solid ${colors.border}` }}
                      >
                        Cancelar
                      </button>
                    </div>
                    <p className="text-xs" style={{ color: colors.textSecondary }}>
                      Um email de confirmação será enviado para o novo endereço
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex items-center space-x-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-80"
                  style={{ backgroundColor: '#C8C8C8', color: '#29323A' }}
                >
                  {isLoading ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Salvar Alterações</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {isEmailPasswordUser && (
              <form onSubmit={handlePasswordUpdate} className="rounded-lg p-4 sm:p-6 lg:p-8 shadow-lg" style={{ backgroundColor: colors.bgSecondary }}>
                <h3 className="text-lg font-semibold mb-4" style={{ color: colors.textPrimary }}>Alterar Senha</h3>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="newPassword" className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
                      Nova Senha *
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? "text" : "password"}
                        id="newPassword"
                        name="newPassword"
                        value={passwordData.newPassword}
                        onChange={handlePasswordChange}
                        required
                        minLength={6}
                        className="w-full px-4 py-2 pr-10 rounded-lg focus:outline-none"
                        style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary, borderColor: colors.border, border: `1px solid ${colors.border}` }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-70 transition-opacity"
                        style={{ color: colors.textSecondary }}
                      >
                        {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    {passwordData.newPassword && (
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center gap-2">
                          {passwordValidation.minLength ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                          )}
                          <p className="text-xs" style={{ color: passwordValidation.minLength ? '#10b981' : '#ef4444' }}>
                            Mínimo de 6 caracteres
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {passwordValidation.hasUppercase ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                          )}
                          <p className="text-xs" style={{ color: passwordValidation.hasUppercase ? '#10b981' : '#ef4444' }}>
                            Pelo menos uma letra maiúscula
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {passwordValidation.hasLowercase ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                          )}
                          <p className="text-xs" style={{ color: passwordValidation.hasLowercase ? '#10b981' : '#ef4444' }}>
                            Pelo menos uma letra minúscula
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {passwordValidation.hasNumber ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                          )}
                          <p className="text-xs" style={{ color: passwordValidation.hasNumber ? '#10b981' : '#ef4444' }}>
                            Pelo menos um número
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {passwordValidation.hasSpecialChar ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                          )}
                          <p className="text-xs" style={{ color: passwordValidation.hasSpecialChar ? '#10b981' : '#ef4444' }}>
                            Pelo menos um caractere especial (!@#$%^&*)
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
                      Confirmar Nova Senha *
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        id="confirmPassword"
                        name="confirmPassword"
                        value={passwordData.confirmPassword}
                        onChange={handlePasswordChange}
                        required
                        minLength={6}
                        className="w-full px-4 py-2 pr-10 rounded-lg focus:outline-none"
                        style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary, borderColor: colors.border, border: `1px solid ${colors.border}` }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-70 transition-opacity"
                        style={{ color: colors.textSecondary }}
                      >
                        {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    {passwordData.confirmPassword && (
                      <div className="flex items-center gap-2 mt-1">
                        {passwordData.newPassword === passwordData.confirmPassword ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            <p className="text-xs text-green-500">As senhas coincidem</p>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-4 h-4 text-red-500" />
                            <p className="text-xs text-red-500">As senhas não coincidem</p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isPasswordLoading}
                      className="flex items-center space-x-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-80"
                      style={{ backgroundColor: '#C8C8C8', color: '#29323A' }}
                    >
                      {isPasswordLoading ? (
                        <>
                          <Loader className="w-4 h-4 animate-spin" />
                          <span>Atualizando...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          <span>Atualizar Senha</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            )}

            <div className="rounded-lg p-4 sm:p-6 lg:p-8 shadow-lg" style={{ backgroundColor: colors.bgSecondary }}>
              <div className="flex items-start gap-3 sm:gap-4 mb-4">
                <div className="flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: colors.textTertiary }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg sm:text-xl font-bold mb-2" style={{ color: colors.textSecondary }}>
                    Deletar minha conta
                  </h2>
                  <p className="text-xs sm:text-sm break-words" style={{ color: colors.textTertiary }}>
                    Ao deletar sua conta, todos os seus processos analisados serão excluídos, tenha certeza antes de realizar a exclusão de sua conta. Esta é uma ação irreversível.
                  </p>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center justify-center space-x-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors hover:opacity-70"
                  style={{ backgroundColor: colors.textTertiary, color: colors.bgPrimary }}
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Deletar minha conta</span>
                </button>
              </div>
            </div>
          </div>
          )}

          {/* Subscription Tab */}
          {activeTab === 'subscription' && (
            <div className="w-full">
              <SubscriptionPlans />
            </div>
          )}

          {/* Admin Tab */}
          {activeTab === 'admin' && isAdmin && (
            <div className="w-full">
              <AdminSettingsPage
                onNavigateToApp={onNavigateToApp}
                onNavigateToMyProcess={onNavigateToMyProcess}
                onNavigateToChat={onNavigateToChat}
                onNavigateToAdmin={onNavigateToAdmin}
                onNavigateToProfile={onNavigateToProfile}
                onNavigateToTerms={onNavigateToTerms}
                onNavigateToPrivacy={onNavigateToPrivacy}
                onNavigateToCookies={onNavigateToCookies}
              />
            </div>
          )}
        </main>
      </div>
      {isSearchOpen && (
        <IntelligentSearch
          onClose={() => setIsSearchOpen(false)}
          onSelectProcess={(processoId) => {
            window.history.pushState({}, '', `/lawsuits-detail/${processoId}`);
            window.dispatchEvent(new PopStateEvent('popstate'));
          }}
        />
      )}

      {showPasswordSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="rounded-xl shadow-xl max-w-md w-full p-8 text-center" style={{ backgroundColor: colors.bgSecondary }}>
            <div className="mb-4 flex justify-center">
              <div className="rounded-full p-3" style={{ backgroundColor: theme === 'dark' ? '#065f4620' : '#dcfce7' }}>
                <svg className="w-12 h-12" style={{ color: theme === 'dark' ? '#4ade80' : '#15803d' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <h3 className="text-2xl font-bold mb-2" style={{ color: colors.textPrimary }}>Senha Alterada!</h3>
            <p className="text-sm" style={{ color: colors.textSecondary }}>
              Sua senha foi atualizada com sucesso.
            </p>
          </div>
        </div>
      )}

      {showEmailSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="rounded-xl shadow-xl max-w-md w-full p-8 text-center" style={{ backgroundColor: colors.bgSecondary }}>
            <div className="mb-4 flex justify-center">
              <div className="rounded-full p-3" style={{ backgroundColor: theme === 'dark' ? '#065f4620' : '#dcfce7' }}>
                <svg className="w-12 h-12" style={{ color: theme === 'dark' ? '#4ade80' : '#15803d' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <h3 className="text-2xl font-bold mb-2" style={{ color: colors.textPrimary }}>Email Atualizado!</h3>
            <p className="text-sm" style={{ color: colors.textSecondary }}>
              Um email de confirmação foi enviado para o novo endereço. Verifique sua caixa de entrada.
            </p>
          </div>
        </div>
      )}

      {showDeleteSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="rounded-xl shadow-xl max-w-md w-full p-8 text-center" style={{ backgroundColor: colors.bgSecondary }}>
            <div className="mb-4 flex justify-center">
              <div className="rounded-full p-3" style={{ backgroundColor: theme === 'dark' ? '#065f4620' : '#dcfce7' }}>
                <svg className="w-12 h-12" style={{ color: theme === 'dark' ? '#4ade80' : '#15803d' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <h3 className="text-2xl font-bold mb-2" style={{ color: colors.textPrimary }}>Conta Deletada!</h3>
            <p className="text-sm" style={{ color: colors.textSecondary }}>
              Sua conta foi excluída com sucesso. Redirecionando...
            </p>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="rounded-xl shadow-xl max-w-2xl w-full p-6" style={{ backgroundColor: '#000000' }}>
            {!isDeleting ? (
              <>
                <div className="flex items-start space-x-3 mb-6">
                  <AlertTriangle className="w-6 h-6 flex-shrink-0 mt-1" style={{ color: '#C8C8C8' }} />
                  <div className="flex-1">
                    <h3 className="text-xl font-bold mb-4" style={{ color: '#C8C8C8' }}>Deletar minha conta</h3>
                    <p className="text-sm leading-relaxed" style={{ color: '#C8C8C8' }}>
                      Ao deletar sua conta, todos os seus processos analisados serão excluídos, tenha certeza antes de realizar a exclusão de sua conta. Esta é uma ação irreversível.
                    </p>
                  </div>
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-6 py-3 text-sm font-medium rounded-lg transition-colors"
                    style={{ backgroundColor: '#29323A', color: '#C8C8C8' }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    className="flex items-center space-x-2 px-6 py-3 text-sm font-medium rounded-lg transition-all"
                    style={{ backgroundColor: '#EF4444', color: '#FFFFFF' }}
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Deletar minha conta</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="py-8">
                <div className="flex items-start space-x-3 mb-8">
                  <Loader className="w-6 h-6 flex-shrink-0 mt-1 animate-spin" style={{ color: '#C8C8C8' }} />
                  <div className="flex-1">
                    <h3 className="text-xl font-bold" style={{ color: '#C8C8C8' }}>Deletando seus dados</h3>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    {deleteProgress.subscription ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                    ) : (
                      <Loader className="w-5 h-5 animate-spin flex-shrink-0" style={{ color: '#C8C8C8' }} />
                    )}
                    <span className="text-sm" style={{ color: deleteProgress.subscription ? '#10b981' : '#C8C8C8' }}>
                      Cancelando sua assinatura
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    {deleteProgress.processos ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                    ) : (
                      <Loader className="w-5 h-5 animate-spin flex-shrink-0" style={{ color: '#C8C8C8' }} />
                    )}
                    <span className="text-sm" style={{ color: deleteProgress.processos ? '#10b981' : '#C8C8C8' }}>
                      Apagando seus processos
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    {deleteProgress.chat ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                    ) : (
                      <Loader className="w-5 h-5 animate-spin flex-shrink-0" style={{ color: '#C8C8C8' }} />
                    )}
                    <span className="text-sm" style={{ color: deleteProgress.chat ? '#10b981' : '#C8C8C8' }}>
                      Apagando seu histórico de chat
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    {deleteProgress.profile ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                    ) : (
                      <Loader className="w-5 h-5 animate-spin flex-shrink-0" style={{ color: '#C8C8C8' }} />
                    )}
                    <span className="text-sm" style={{ color: deleteProgress.profile ? '#10b981' : '#C8C8C8' }}>
                      Apagando seus dados de cadastro
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    {deleteProgress.auth ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                    ) : (
                      <Loader className="w-5 h-5 animate-spin flex-shrink-0" style={{ color: '#C8C8C8' }} />
                    )}
                    <span className="text-sm" style={{ color: deleteProgress.auth ? '#10b981' : '#C8C8C8' }}>
                      Apagando suas informações de login
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
