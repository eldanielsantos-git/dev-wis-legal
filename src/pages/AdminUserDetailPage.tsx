import React, { useState, useEffect } from 'react';
import { SidebarWis } from '../components/SidebarWis';
import { FooterWis } from '../components/FooterWis';
import { IntelligentSearch } from '../components/IntelligentSearch';
import { UserAvatar } from '../components/UserAvatar';
import { Users, ArrowLeft, Loader, Shield, User as UserIcon, Check, Coins, Key, Copy, Trash2, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { playErrorSound } from '../utils/notificationSound';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';
import { UserDeletionProgressModal } from '../components/UserDeletionProgressModal';

interface UserProfile {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  phone_country_code: string | null;
  oab: string | null;
  city: string | null;
  state: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  created_at: string;
}

interface AdminUserDetailPageProps {
  userId: string;
  onNavigateBack: () => void;
  onNavigateToApp: () => void;
  onNavigateToMyProcess: () => void;
  onNavigateToChat?: () => void;
  onNavigateToWorkspace?: () => void;
  onNavigateToSchedule?: () => void;
  onNavigateToAdmin: () => void;
  onNavigateToSettings?: () => void;
  onNavigateToProfile?: () => void;
  onNavigateToTerms?: () => void;
  onNavigateToPrivacy?: () => void;
  onNavigateToCookies?: () => void;
}

export function AdminUserDetailPage({
  userId,
  onNavigateBack,
  onNavigateToApp,
  onNavigateToMyProcess,
  onNavigateToChat,
  onNavigateToWorkspace,
  onNavigateToSchedule,
  onNavigateToAdmin,
  onNavigateToSettings,
  onNavigateToProfile,
  onNavigateToTerms,
  onNavigateToPrivacy,
  onNavigateToCookies
}: AdminUserDetailPageProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedTokenAmount, setSelectedTokenAmount] = useState<number | null>(null);
  const [isTokenConfirmModalOpen, setIsTokenConfirmModalOpen] = useState(false);
  const [isAddingTokens, setIsAddingTokens] = useState(false);
  const [tokenSuccessMessage, setTokenSuccessMessage] = useState<string | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [isGeneratingPassword, setIsGeneratingPassword] = useState(false);
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [isDeletionModalOpen, setIsDeletionModalOpen] = useState(false);
  const [deletionProgress, setDeletionProgress] = useState<any[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletionError, setDeletionError] = useState<string | null>(null);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [userProcessCount, setUserProcessCount] = useState<number>(0);
  const [loadingProcessCount, setLoadingProcessCount] = useState(false);

  useEffect(() => {
    loadUser();
    loadUserProcessCount();
  }, [userId]);

  const loadUser = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setUser(data);
    } catch (error: any) {
      console.error('Error loading user:', error);
      setMessage({ type: 'error', text: 'Erro ao carregar usuário' });
      playErrorSound();
    } finally {
      setLoading(false);
    }
  };

  const loadUserProcessCount = async () => {
    try {
      setLoadingProcessCount(true);

      const [{ count, error }] = await Promise.all([
        supabase
          .from('processos')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId),
        new Promise(resolve => setTimeout(resolve, 500))
      ]);

      if (error) throw error;
      setUserProcessCount(count || 0);
    } catch (error) {
      console.error('Error loading process count:', error);
      setUserProcessCount(0);
    } finally {
      setLoadingProcessCount(false);
    }
  };

  const generateStrongPassword = (): string => {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%&*()_+-=[]{}|;:,.<>?';
    const allChars = uppercase + lowercase + numbers + symbols;

    let password = '';
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];

    for (let i = 4; i < 16; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    return password.split('').sort(() => Math.random() - 0.5).join('');
  };

  const handleGeneratePassword = async () => {
    if (!user || !user.email) return;

    try {
      setIsGeneratingPassword(true);
      setMessage(null);
      setGeneratedPassword(null);

      const newPassword = generateStrongPassword();

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Sessão não encontrada. Faça login novamente.');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-user-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          userId: user.id,
          newPassword: newPassword
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao atualizar senha');
      }

      setGeneratedPassword(newPassword);
      setMessage({ type: 'success', text: 'Nova senha gerada com sucesso!' });
    } catch (error: any) {
      console.error('Erro ao gerar senha:', error);
      setMessage({ type: 'error', text: error.message || 'Erro ao gerar nova senha' });
      playErrorSound();
      setGeneratedPassword(null);
    } finally {
      setIsGeneratingPassword(false);
    }
  };

  const handleCopyPassword = async () => {
    if (!generatedPassword) return;

    try {
      await navigator.clipboard.writeText(generatedPassword);
      setPasswordCopied(true);
      setTimeout(() => setPasswordCopied(false), 2000);
    } catch (error) {
      console.error('Erro ao copiar senha:', error);
    }
  };

  const handleToggleAdmin = async () => {
    if (!user) return;

    try {
      setIsSaving(true);
      setMessage(null);

      const newAdminStatus = !user.is_admin;

      const { data, error } = await supabase
        .from('user_profiles')
        .update({ is_admin: newAdminStatus })
        .eq('id', user.id)
        .select();

      if (error) throw error;

      if (!data || data.length === 0) {
        throw new Error('Nenhum registro foi atualizado. Verifique suas permissões.');
      }

      setMessage({
        type: 'success',
        text: `Usuário ${newAdminStatus ? 'promovido a' : 'removido de'} administrador com sucesso!`
      });

      setUser(prev => prev ? { ...prev, is_admin: newAdminStatus } : null);
    } catch (error: any) {
      console.error('Error in handleToggleAdmin:', error);
      setMessage({ type: 'error', text: error.message || 'Erro ao atualizar permissões' });
      playErrorSound();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUserClick = () => {
    setIsConfirmDeleteOpen(true);
  };

  const handleConfirmDeleteUser = async () => {
    if (!user) return;

    let pollingInterval: NodeJS.Timeout | null = null;
    const operationId = crypto.randomUUID();

    try {
      setIsConfirmDeleteOpen(false);
      setIsDeletionModalOpen(true);
      setIsDeleting(true);
      setDeletionProgress([{ step: 'Iniciando exclusão do usuário...', completed: false }]);
      setDeletionError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Sessão não encontrada. Faça login novamente.');
      }

      const pollProgress = async () => {
        try {
          const { data, error } = await supabase
            .from('admin_operation_progress')
            .select('*')
            .eq('operation_id', operationId)
            .maybeSingle();

          if (error) {
            console.error('Polling error:', error);
            return;
          }

          if (data && data.progress && data.progress.length > 0) {
            setDeletionProgress(data.progress);

            if (data.status === 'completed') {
              if (pollingInterval) {
                clearInterval(pollingInterval);
                pollingInterval = null;
              }
              setMessage({ type: 'success', text: 'Usuário excluído com sucesso!' });
              setIsDeleting(false);

              setTimeout(() => {
                setIsDeletionModalOpen(false);
                onNavigateBack();
              }, 2000);
            } else if (data.status === 'error') {
              if (pollingInterval) {
                clearInterval(pollingInterval);
                pollingInterval = null;
              }
              setDeletionError(data.error || 'Erro ao excluir usuário');
              setMessage({ type: 'error', text: data.error || 'Erro ao excluir usuário' });
              setIsDeleting(false);
              playErrorSound();
            }
          }
        } catch (error) {
          console.error('Exception during polling:', error);
        }
      };

      pollingInterval = setInterval(pollProgress, 300);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      try {
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-delete-user`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            targetUserId: user.id,
            operationId: operationId
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Erro ao excluir usuário');
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          throw new Error('Operação excedeu o tempo limite. Por favor, tente novamente.');
        }
        throw fetchError;
      }
    } catch (error: any) {
      console.error('Erro ao excluir usuário:', error);

      let errorMessage = 'Erro ao excluir usuário';
      if (error.message) {
        errorMessage = error.message;
      } else if (error.error) {
        errorMessage = error.error;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      const finalProgress = deletionProgress.length > 0
        ? [...deletionProgress.slice(0, -1), {
            ...deletionProgress[deletionProgress.length - 1],
            completed: false,
            error: errorMessage
          }]
        : [{ step: 'Erro ao processar exclusão', completed: false, error: errorMessage }];

      setDeletionProgress(finalProgress);
      setDeletionError(errorMessage);
      setMessage({ type: 'error', text: errorMessage });
      playErrorSound();
      setIsDeleting(false);

      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    }
  };

  const handleTokenCardClick = (amount: number) => {
    setSelectedTokenAmount(amount);
    setIsTokenConfirmModalOpen(true);
  };

  const handleConfirmAddTokens = async () => {
    if (!user || !selectedTokenAmount) return;

    try {
      setIsAddingTokens(true);
      setMessage(null);

      const { data: customer, error: customerError } = await supabase
        .from('stripe_customers')
        .select('customer_id')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .maybeSingle();

      if (customerError) throw customerError;

      if (!customer) {
        throw new Error('Usuário não possui conta Stripe');
      }

      const { data: subscription, error: fetchError } = await supabase
        .from('stripe_subscriptions')
        .select('extra_tokens')
        .eq('customer_id', customer.customer_id)
        .eq('status', 'active')
        .is('deleted_at', null)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!subscription) {
        throw new Error('Usuário não possui assinatura ativa');
      }

      const currentExtraTokens = subscription.extra_tokens || 0;
      const newExtraTokens = currentExtraTokens + selectedTokenAmount;

      const { error: updateError } = await supabase
        .from('stripe_subscriptions')
        .update({ extra_tokens: newExtraTokens })
        .eq('customer_id', customer.customer_id)
        .eq('status', 'active');

      if (updateError) throw updateError;

      setTokenSuccessMessage(`${(selectedTokenAmount / 1_000_000).toLocaleString('pt-BR')}M tokens adicionados com sucesso!`);

      setTimeout(() => {
        setIsTokenConfirmModalOpen(false);
        setSelectedTokenAmount(null);
        setTokenSuccessMessage(null);
      }, 3000);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Erro ao adicionar tokens' });
      playErrorSound();
    } finally {
      setIsAddingTokens(false);
    }
  };

  const formatTokenAmount = (amount: number): string => {
    if (amount >= 1_000_000_000) {
      return `${(amount / 1_000_000_000).toLocaleString('pt-BR')} Bilhão`;
    } else if (amount >= 1_000_000) {
      return `${(amount / 1_000_000).toLocaleString('pt-BR')} Milhão`;
    }
    return amount.toLocaleString('pt-BR');
  };

  const tokenOptions = [
    { amount: 1_000_000, label: '1 Milhão de tokens' },
    { amount: 2_000_000, label: '2 Milhões de tokens' },
    { amount: 3_000_000, label: '3 Milhões de tokens' },
    { amount: 5_000_000, label: '5 Milhões de tokens' },
    { amount: 10_000_000, label: '10 Milhões de tokens' },
    { amount: 20_000_000, label: '20 Milhões de tokens' },
    { amount: 30_000_000, label: '30 Milhões de tokens' },
    { amount: 50_000_000, label: '50 Milhões de tokens' },
    { amount: 100_000_000, label: '100 Milhões de tokens' },
    { amount: 500_000_000, label: '500 Milhões de tokens' },
    { amount: 1_000_000_000, label: '1 Bilhão de tokens' }
  ];

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen font-body" style={{ backgroundColor: colors.bgPrimary }}>
        <SidebarWis
          onNavigateToApp={onNavigateToApp}
          onNavigateToMyProcess={onNavigateToMyProcess}
          onNavigateToChat={onNavigateToChat}
          onNavigateToWorkspace={onNavigateToWorkspace}
          onNavigateToSchedule={onNavigateToSchedule}
          onNavigateToAdmin={onNavigateToAdmin}
          onNavigateToSettings={onNavigateToSettings}
          onNavigateToProfile={onNavigateToProfile}
          onNavigateToNotifications={() => {}}
          onNavigateToTokens={() => {}}
          onNavigateToSubscription={() => {}}
          onCollapsedChange={setIsSidebarCollapsed}
          onSearchClick={() => setIsSearchOpen(true)}
        />
        <main className={`flex-1 flex items-center justify-center transition-all duration-300 pt-16 lg:pt-0 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
          <Loader className="w-8 h-8 animate-spin" style={{ color: '#3B82F6' }} />
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen font-body" style={{ backgroundColor: colors.bgPrimary }}>
        <SidebarWis
          onNavigateToApp={onNavigateToApp}
          onNavigateToMyProcess={onNavigateToMyProcess}
          onNavigateToChat={onNavigateToChat}
          onNavigateToWorkspace={onNavigateToWorkspace}
          onNavigateToSchedule={onNavigateToSchedule}
          onNavigateToAdmin={onNavigateToAdmin}
          onNavigateToSettings={onNavigateToSettings}
          onNavigateToProfile={onNavigateToProfile}
          onNavigateToNotifications={() => {}}
          onNavigateToTokens={() => {}}
          onNavigateToSubscription={() => {}}
          onCollapsedChange={setIsSidebarCollapsed}
          onSearchClick={() => setIsSearchOpen(true)}
        />
        <main className={`flex-1 flex items-center justify-center transition-all duration-300 pt-16 lg:pt-0 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
          <p style={{ color: colors.textSecondary }}>Usuário não encontrado</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen font-body" style={{ backgroundColor: colors.bgPrimary }}>
      <SidebarWis
        onNavigateToApp={onNavigateToApp}
        onNavigateToMyProcess={onNavigateToMyProcess}
        onNavigateToChat={onNavigateToChat}
        onNavigateToWorkspace={onNavigateToWorkspace}
        onNavigateToSchedule={onNavigateToSchedule}
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

      <main className={`flex-1 flex flex-col transition-all duration-300 pt-16 lg:pt-0 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
        <div className="flex-1 px-4 sm:px-6 py-6 sm:py-8">
          <button
            onClick={onNavigateBack}
            className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors mb-6 hover:opacity-80 max-w-6xl"
            style={{
              backgroundColor: colors.bgSecondary,
              color: colors.textPrimary
            }}
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Voltar para Usuários</span>
          </button>

          <div className="max-w-4xl mx-auto">
            {message && (
              <div className={`mb-4 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-900/20 border border-green-600' : 'bg-red-900/20 border border-red-600'}`}>
                <p className={`text-sm ${message.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                  {message.text}
                </p>
              </div>
            )}

            <div className="rounded-lg shadow-sm p-6 mb-6" style={{ backgroundColor: colors.bgSecondary }}>
              <div className="flex flex-col items-center mb-6">
                <div className="mb-4">
                  <UserAvatar
                    avatarUrl={user.avatar_url}
                    firstName={user.first_name}
                    lastName={user.last_name}
                    size="lg"
                    className="w-24 h-24 text-2xl"
                  />
                </div>
                <h1 className="text-2xl font-bold mb-2 text-center" style={{ color: colors.textPrimary }}>
                  {user.first_name?.trim() && user.last_name?.trim()
                    ? `${user.first_name.trim()} ${user.last_name.trim()}`
                    : user.email || 'Nome não definido'}
                </h1>
                <p className="text-sm mb-2" style={{ color: colors.textSecondary }}>
                  Cadastrado em {formatDate(user.created_at)}
                </p>
                <span className="text-xs px-3 py-1 rounded" style={{
                  backgroundColor: user.is_admin ? colors.successAccent : '#3B82F620',
                  color: user.is_admin ? colors.successIcon : '#3B82F6'
                }}>
                  {user.is_admin ? 'Administrador' : 'Usuário'}
                </span>
              </div>

              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-4" style={{ color: colors.textPrimary }}>
                    Dados de Cadastro
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
                        Email
                      </label>
                      <p className="text-base break-words" style={{ color: colors.textPrimary }}>
                        {user.email || 'Não informado'}
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
                        Telefone
                      </label>
                      <p className="text-base" style={{ color: colors.textPrimary }}>
                        {user.phone ? `${user.phone_country_code || ''} ${user.phone}`.trim() : 'Não informado'}
                      </p>
                    </div>

                    {user.oab && (
                      <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
                          OAB
                        </label>
                        <p className="text-base" style={{ color: colors.textPrimary }}>
                          {user.oab}
                        </p>
                      </div>
                    )}

                    {user.city && (
                      <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
                          Cidade
                        </label>
                        <p className="text-base" style={{ color: colors.textPrimary }}>
                          {user.city}
                        </p>
                      </div>
                    )}

                    {user.state && (
                      <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
                          Estado
                        </label>
                        <p className="text-base" style={{ color: colors.textPrimary }}>
                          {user.state}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => {
                    window.history.pushState({}, '', `/admin-user/${user.id}/processes`);
                    window.dispatchEvent(new PopStateEvent('popstate'));
                  }}
                  className="w-full p-4 rounded-lg transition-all hover:opacity-80 hover:scale-[1.02] text-left"
                  style={{ backgroundColor: colors.bgPrimary }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: colors.textSecondary }}>
                        Processos Analisados
                      </label>
                      {loadingProcessCount ? (
                        <div className="flex items-center mt-1">
                          <Loader className="w-4 h-4 animate-spin mr-2" style={{ color: '#3B82F6' }} />
                          <span className="text-xs" style={{ color: colors.textSecondary }}>Carregando...</span>
                        </div>
                      ) : (
                        <p className="text-3xl font-bold" style={{ color: colors.textPrimary }}>
                          {userProcessCount}
                        </p>
                      )}
                    </div>
                    <div className="p-3 rounded-full" style={{ backgroundColor: '#3B82F620' }}>
                      <FileText className="w-8 h-8" style={{ color: '#3B82F6' }} />
                    </div>
                  </div>
                  <p className="text-xs mt-2" style={{ color: colors.textSecondary }}>
                    Total de processos cadastrados pelo usuário • Clique para ver
                  </p>
                </button>

                <div className="pt-4 border-t" style={{ borderColor: theme === 'dark' ? '#4B5563' : '#E5E7EB' }}>
                  <h2 className="text-lg font-semibold mb-4" style={{ color: colors.textPrimary }}>
                    Gerar Nova Senha
                  </h2>
                  <p className="text-sm mb-4" style={{ color: colors.textSecondary }}>
                    Gera uma senha forte e atualiza no sistema
                  </p>

                  <div className="flex items-start gap-3">
                    {generatedPassword ? (
                      <div className="flex-1 p-4 rounded-lg border" style={{ backgroundColor: theme === 'dark' ? '#1F2229' : '#F0FDF4', borderColor: '#10B981' }}>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-medium" style={{ color: '#10B981' }}>
                            Nova senha gerada:
                          </p>
                          <button
                            onClick={handleCopyPassword}
                            className="p-1.5 rounded hover:bg-green-500/20 transition-colors"
                            title="Copiar senha"
                          >
                            {passwordCopied ? (
                              <Check className="w-4 h-4" style={{ color: '#10B981' }} />
                            ) : (
                              <Copy className="w-4 h-4" style={{ color: '#10B981' }} />
                            )}
                          </button>
                        </div>
                        <p className="text-sm font-mono break-all p-2 rounded" style={{ backgroundColor: theme === 'dark' ? '#0F1419' : '#DCFCE7', color: colors.textPrimary }}>
                          {generatedPassword}
                        </p>
                        <p className="text-xs mt-2" style={{ color: colors.textSecondary }}>
                          Copie e envie esta senha para o usuário
                        </p>
                      </div>
                    ) : (
                      <div className="flex-1"></div>
                    )}

                    <button
                      onClick={handleGeneratePassword}
                      disabled={isGeneratingPassword}
                      className="flex items-center justify-center p-4 rounded-lg border transition-all hover:border-blue-500 hover:bg-blue-500/10 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                      style={{
                        borderColor: theme === 'dark' ? '#3F3F46' : '#E5E7EB',
                        minWidth: generatedPassword ? 'auto' : '100%'
                      }}
                    >
                      {isGeneratingPassword ? (
                        <Loader className="w-6 h-6 animate-spin" style={{ color: '#3B82F6' }} />
                      ) : (
                        <>
                          <Key className="w-6 h-6" style={{ color: '#3B82F6' }} />
                          {!generatedPassword && (
                            <span className="ml-3 text-base font-medium" style={{ color: colors.textPrimary }}>
                              Gerar Nova Senha
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t" style={{ borderColor: theme === 'dark' ? '#4B5563' : '#E5E7EB' }}>
                  <h2 className="text-lg font-semibold mb-4" style={{ color: colors.textPrimary }}>
                    Permissões
                  </h2>
                  <div className="space-y-3">
                    <button
                      onClick={handleToggleAdmin}
                      disabled={isSaving}
                      className={`w-full flex items-center justify-between p-4 rounded-lg border transition-all ${
                        user.is_admin
                          ? 'border-green-600 bg-green-900/20'
                          : 'hover:border-gray-400 hover:bg-gray-500/5 cursor-pointer'
                      } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                      style={{
                        borderColor: user.is_admin ? undefined : (theme === 'dark' ? '#3F3F46' : '#E5E7EB')
                      }}
                    >
                      <div className="flex items-center space-x-3">
                        <Shield className="w-5 h-5" style={{ color: user.is_admin ? colors.successIcon : '#808080' }} />
                        <div className="text-left">
                          <p className="text-base font-medium" style={{ color: colors.textPrimary }}>Administrador</p>
                          <p className="text-xs" style={{ color: colors.textSecondary }}>Acesso completo ao sistema</p>
                        </div>
                      </div>
                      {user.is_admin && (
                        <Check className="w-5 h-5" style={{ color: colors.successIcon }} />
                      )}
                    </button>

                    <button
                      onClick={handleToggleAdmin}
                      disabled={isSaving}
                      className={`w-full flex items-center justify-between p-4 rounded-lg border transition-all ${
                        !user.is_admin
                          ? 'border-blue-600 bg-blue-900/20'
                          : 'hover:border-gray-400 hover:bg-gray-500/5 cursor-pointer'
                      } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                      style={{
                        borderColor: !user.is_admin ? undefined : (theme === 'dark' ? '#3F3F46' : '#E5E7EB')
                      }}
                    >
                      <div className="flex items-center space-x-3">
                        <UserIcon className="w-5 h-5" style={{ color: !user.is_admin ? '#3B82F6' : '#808080' }} />
                        <div className="text-left">
                          <p className="text-base font-medium" style={{ color: colors.textPrimary }}>Usuário</p>
                          <p className="text-xs" style={{ color: colors.textSecondary }}>Acesso básico ao sistema</p>
                        </div>
                      </div>
                      {!user.is_admin && (
                        <Check className="w-5 h-5" style={{ color: '#3B82F6' }} />
                      )}
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t" style={{ borderColor: theme === 'dark' ? '#4B5563' : '#E5E7EB' }}>
                  <h2 className="text-lg font-semibold mb-4" style={{ color: colors.textPrimary }}>
                    Gerar Tokens
                  </h2>
                  <p className="text-sm mb-4" style={{ color: colors.textSecondary }}>
                    Bonifique o usuário com tokens extras
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {tokenOptions.map((option) => (
                      <button
                        key={option.amount}
                        onClick={() => handleTokenCardClick(option.amount)}
                        disabled={isAddingTokens}
                        className="flex items-center p-3 rounded-lg border transition-all hover:border-green-500 hover:bg-green-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                          borderColor: theme === 'dark' ? '#3F3F46' : '#E5E7EB'
                        }}
                      >
                        <Coins className="w-5 h-5 mr-3" style={{ color: '#10B981' }} />
                        <p className="text-sm font-medium text-left" style={{ color: colors.textPrimary }}>
                          {option.label}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-red-900/30">
                  <h2 className="text-lg font-semibold mb-4 text-red-500">
                    Zona de Perigo
                  </h2>
                  <button
                    onClick={handleDeleteUserClick}
                    disabled={isDeleting}
                    className="w-full flex items-center justify-center gap-2 p-4 rounded-lg border border-red-500 bg-red-500/10 hover:bg-red-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-5 h-5" style={{ color: '#EF4444' }} />
                    <span className="text-base font-medium text-red-500">
                      Excluir Usuário
                    </span>
                  </button>
                  <p className="text-xs mt-2" style={{ color: colors.textSecondary }}>
                    Esta ação é irreversível e excluirá todos os dados do usuário permanentemente.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <FooterWis
          onNavigateToTerms={onNavigateToTerms}
          onNavigateToPrivacy={onNavigateToPrivacy}
          onNavigateToCookies={onNavigateToCookies}
        />
      </main>

      {isTokenConfirmModalOpen && selectedTokenAmount && user && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="rounded-lg shadow-2xl max-w-md w-full" style={{ backgroundColor: colors.bgSecondary }}>
            <div className="p-6">
              {!tokenSuccessMessage ? (
                <>
                  <div className="flex items-center justify-center mb-4">
                    <div className="p-3 rounded-full" style={{ backgroundColor: '#F59E0B20' }}>
                      <Coins className="w-8 h-8" style={{ color: '#F59E0B' }} />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-center mb-2" style={{ color: colors.textPrimary }}>
                    Confirmar Bonificação
                  </h3>
                  <p className="text-center mb-6" style={{ color: colors.textSecondary }}>
                    Você está prestes a adicionar <span className="font-bold" style={{ color: '#F59E0B' }}>{formatTokenAmount(selectedTokenAmount)}</span> de tokens para:
                  </p>
                  <div className="p-4 rounded-lg mb-6" style={{ backgroundColor: colors.bgPrimary }}>
                    <div className="flex items-center space-x-3">
                      <UserAvatar
                        avatarUrl={user.avatar_url}
                        firstName={user.first_name}
                        lastName={user.last_name}
                        size="sm"
                      />
                      <div>
                        <p className="font-semibold" style={{ color: colors.textPrimary }}>
                          {user.first_name?.trim() && user.last_name?.trim()
                            ? `${user.first_name.trim()} ${user.last_name.trim()}`
                            : user.email}
                        </p>
                        <p className="text-sm" style={{ color: colors.textSecondary }}>
                          {user.email}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-center mb-4">
                    <div className="p-3 rounded-full bg-green-600">
                      <Check className="w-8 h-8 text-white" />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-center mb-2 text-green-400">
                    Tokens Adicionados!
                  </h3>
                  <p className="text-center mb-6" style={{ color: colors.textSecondary }}>
                    {tokenSuccessMessage}
                  </p>
                  <div className="p-4 rounded-lg mb-6 bg-green-900/20 border border-green-600">
                    <div className="flex items-center space-x-3">
                      <UserAvatar
                        avatarUrl={user.avatar_url}
                        firstName={user.first_name}
                        lastName={user.last_name}
                        size="sm"
                      />
                      <div>
                        <p className="font-semibold" style={{ color: colors.textPrimary }}>
                          {user.first_name?.trim() && user.last_name?.trim()
                            ? `${user.first_name.trim()} ${user.last_name.trim()}`
                            : user.email}
                        </p>
                        <p className="text-sm text-green-400 font-medium">
                          Bonificação aplicada com sucesso
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
              <div className="flex gap-3">
                {!tokenSuccessMessage ? (
                  <>
                    <button
                      onClick={() => {
                        setIsTokenConfirmModalOpen(false);
                        setSelectedTokenAmount(null);
                        setTokenSuccessMessage(null);
                      }}
                      disabled={isAddingTokens}
                      className="flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50"
                      style={{ backgroundColor: theme === 'dark' ? '#1F2229' : '#F9FAFB', color: colors.textPrimary }}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleConfirmAddTokens}
                      disabled={isAddingTokens}
                      className="flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors hover:opacity-90 disabled:opacity-50 flex items-center justify-center"
                      style={{ backgroundColor: '#F59E0B', color: '#FFFFFF' }}
                    >
                      {isAddingTokens ? (
                        <>
                          <Loader className="w-4 h-4 animate-spin mr-2" />
                          Adicionando...
                        </>
                      ) : (
                        'Confirmar'
                      )}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      setIsTokenConfirmModalOpen(false);
                      setSelectedTokenAmount(null);
                      setTokenSuccessMessage(null);
                    }}
                    className="w-full px-4 py-2.5 rounded-lg font-medium transition-colors hover:opacity-90"
                    style={{ backgroundColor: '#22C55E', color: '#FFFFFF' }}
                  >
                    Fechar
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {isConfirmDeleteOpen && user && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="rounded-lg shadow-2xl max-w-md w-full" style={{ backgroundColor: colors.bgSecondary }}>
            <div className="p-6">
              <div className="flex items-center justify-center mb-4">
                <div className="p-3 rounded-full bg-red-500/20">
                  <Trash2 className="w-8 h-8 text-red-500" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-center mb-2" style={{ color: colors.textPrimary }}>
                Confirmar Exclusão
              </h3>
              <p className="text-center mb-4" style={{ color: colors.textSecondary }}>
                Tem certeza que deseja excluir permanentemente o usuário:
              </p>
              <div className="p-4 rounded-lg mb-6" style={{ backgroundColor: colors.bgPrimary }}>
                <div className="flex items-center space-x-3">
                  <UserAvatar
                    avatarUrl={user.avatar_url}
                    firstName={user.first_name}
                    lastName={user.last_name}
                    size="sm"
                  />
                  <div>
                    <p className="font-semibold" style={{ color: colors.textPrimary }}>
                      {user.first_name?.trim() && user.last_name?.trim()
                        ? `${user.first_name.trim()} ${user.last_name.trim()}`
                        : user.email}
                    </p>
                    {user.email && (
                      <p className="text-sm" style={{ color: colors.textSecondary }}>
                        {user.email}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <p className="text-sm text-center mb-6 text-red-400">
                Esta ação é irreversível e excluirá todos os dados do usuário incluindo processos, notificações e histórico de tokens.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsConfirmDeleteOpen(false)}
                  className="flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors"
                  style={{ backgroundColor: theme === 'dark' ? '#1F2229' : '#F9FAFB', color: colors.textPrimary }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmDeleteUser}
                  className="flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors hover:opacity-90 bg-red-500 text-white"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <UserDeletionProgressModal
        isOpen={isDeletionModalOpen}
        progress={deletionProgress}
        isDeleting={isDeleting}
        error={deletionError}
        onClose={() => {
          setIsDeletionModalOpen(false);
          setDeletionProgress([]);
          setDeletionError(null);
        }}
      />

      {isSearchOpen && (
        <IntelligentSearch
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          onSelectProcess={(processoId) => {
            window.history.pushState({}, '', `/lawsuits-detail/${processoId}`);
            window.dispatchEvent(new PopStateEvent('popstate'));
          }}
        />
      )}
    </div>
  );
}
