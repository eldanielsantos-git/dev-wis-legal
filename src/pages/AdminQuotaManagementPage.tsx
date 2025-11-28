import React, { useEffect, useState } from 'react';
import { SidebarWis } from '../components/SidebarWis';
import { FooterWis } from '../components/FooterWis';
import { IntelligentSearch } from '../components/IntelligentSearch';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';
import {
  Activity,
  CreditCard,
  Users,
  Package,
  DollarSign,
  Hash,
  TrendingUp,
  Edit2,
  Save,
  X,
  Search,
  RefreshCw,
  ArrowLeft,
  Ticket,
  BarChart3,
  Download,
  XCircle
} from 'lucide-react';
import { stripeProducts, tokenPackages, type StripeProduct, type TokenPackage } from '../stripe-config';
import { tokenService, type UserTokenQuota } from '../services/TokenService';
import { supabase } from '../lib/supabase';
import { billingAnalyticsService } from '../services/BillingAnalyticsService';
import type { BillingAnalyticsData, TimePeriod, BillingDataView } from '../types/billing';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

type TabType = 'plans' | 'users' | 'billing';

interface UserQuotaWithProfile extends UserTokenQuota {
  email: string;
  first_name: string;
  last_name: string;
}

interface StripeCoupon {
  id: string;
  name: string | null;
  percent_off: number | null;
  amount_off: number | null;
  currency: string;
  duration: string;
  duration_in_months: number | null;
  times_redeemed: number;
  max_redemptions: number | null;
  valid: boolean;
  created_at: string;
  updated_at: string;
}

interface AdminQuotaManagementPageProps {
  onNavigateToApp: () => void;
  onNavigateToMyProcess: () => void;
  onNavigateToChat?: () => void;
  onNavigateToWorkspace?: () => void;
  onNavigateToAdmin: () => void;
  onNavigateToProfile?: () => void;
  onNavigateToTerms?: () => void;
  onNavigateToPrivacy?: () => void;
  onNavigateToCookies?: () => void;
}

export function AdminQuotaManagementPage({ onNavigateToApp, onNavigateToMyProcess, onNavigateToChat, onNavigateToWorkspace, onNavigateToAdmin, onNavigateToProfile, onNavigateToTerms, onNavigateToPrivacy, onNavigateToCookies }: AdminQuotaManagementPageProps) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('billing');
  const [users, setUsers] = useState<UserQuotaWithProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserQuotaWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [coupons, setCoupons] = useState<StripeCoupon[]>([]);
  const [loadingCoupons, setLoadingCoupons] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [billingData, setBillingData] = useState<BillingAnalyticsData | null>(null);
  const [loadingBilling, setLoadingBilling] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<TimePeriod>('month');
  const [billingView, setBillingView] = useState<BillingDataView>('all');

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        setCheckingAdmin(false);
        setIsAdmin(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('is_admin')
          .eq('id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error checking admin status:', error);
          setIsAdmin(false);
        } else {
          setIsAdmin(data?.is_admin || false);
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
        setIsAdmin(false);
      } finally {
        setCheckingAdmin(false);
      }
    };

    checkAdminStatus();
  }, [user]);

  useEffect(() => {
    if (activeTab === 'users') {
      loadUsers();
      loadSubscriptions();
    } else if (activeTab === 'plans') {
      syncCouponsFromStripe();
    } else if (activeTab === 'billing') {
      loadBillingData();
    }
  }, [activeTab, billingPeriod, billingView]);

  useEffect(() => {
    filterUsers();
  }, [searchTerm, users]);

  const loadUsers = async () => {
    setLoading(true);
    const data = await tokenService.getAllUsersTokenQuotas();
    setUsers(data);
    setLoading(false);
  };


  const loadCoupons = async () => {
    setLoadingCoupons(true);
    try {
      const { data, error } = await supabase
        .from('stripe_coupons')
        .select('*')
        .eq('valid', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCoupons(data || []);
    } catch (error) {
      console.error('Error loading coupons:', error);
      setCoupons([]);
    } finally {
      setLoadingCoupons(false);
    }
  };

  const syncCouponsFromStripe = async () => {
    setLoadingCoupons(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Não autenticado');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-stripe-coupons`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Erro ao sincronizar cupons');
      }

      const result = await response.json();
      console.log('Cupons sincronizados:', result);

      await loadCoupons();
    } catch (error) {
      console.error('Error syncing coupons:', error);
      setCoupons([]);
    } finally {
      setLoadingCoupons(false);
    }
  };

  const loadBillingData = async () => {
    setLoadingBilling(true);
    try {
      const data = await billingAnalyticsService.fetchBillingData(billingPeriod, billingView);
      setBillingData(data);
    } catch (error) {
      console.error('Error loading billing data:', error);
      setBillingData(null);
    } finally {
      setLoadingBilling(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadUsers();
    setRefreshing(false);
  };

  const filterUsers = () => {
    if (!searchTerm.trim()) {
      setFilteredUsers(users);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = users.filter(
      (user) =>
        user.email.toLowerCase().includes(term) ||
        user.first_name?.toLowerCase().includes(term) ||
        user.last_name?.toLowerCase().includes(term)
    );
    setFilteredUsers(filtered);
  };

  const handleEditQuota = (userId: string, currentQuota: number) => {
    setEditingUserId(userId);
    setEditValue(currentQuota);
  };

  const handleSaveQuota = async (userId: string) => {
    const success = await tokenService.updateUserQuota(userId, editValue);
    if (success) {
      setEditingUserId(null);
      loadUsers();
    }
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
    setEditValue(0);
  };

  const parseTokenValue = (tokenStr: string): number => {
    const cleanStr = tokenStr.replace(/[^\d,]/g, '').replace(',', '.');
    const value = parseFloat(cleanStr);
    if (tokenStr.toLowerCase().includes('milhão') || tokenStr.toLowerCase().includes('milhões')) {
      return value * 1000000;
    }
    return value;
  };

  const getPriceFromPriceId = (priceId: string | null): number => {
    if (!priceId) return 0;
    const product = stripeProducts.find(p => p.priceId === priceId);
    return product?.price || 0;
  };

  const [subscriptions, setSubscriptions] = useState<any[]>([]);

  const loadSubscriptions = async () => {
    try {
      const { data, error } = await supabase
        .from('stripe_subscriptions')
        .select('price_id, status')
        .is('deleted_at', null)
        .eq('status', 'active');

      if (error) throw error;
      setSubscriptions(data || []);
    } catch (error) {
      console.error('Error loading subscriptions:', error);
    }
  };

  const totalUsersWithQuota = users.length;
  const totalTokensUsedAllUsers = users.reduce(
    (sum, user) => sum + user.tokens_used_this_month,
    0
  );
  const totalQuotaAllUsers = users.reduce((sum, user) => sum + user.monthly_quota, 0);
  const totalRevenue = subscriptions.reduce(
    (sum, sub) => sum + getPriceFromPriceId(sub.price_id),
    0
  );

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const isDark = theme === 'dark';

  if (checkingAdmin) {
    return (
      <div className="flex min-h-screen font-body items-center justify-center" style={{ backgroundColor: colors.bgPrimary }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: colors.textPrimary }}></div>
          <p style={{ color: colors.textSecondary }}>Verificando permissões...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen font-body" style={{ backgroundColor: colors.bgPrimary }}>
        <SidebarWis
          onNavigateToApp={onNavigateToApp}
          onNavigateToMyProcess={onNavigateToMyProcess}
          onNavigateToAdmin={onNavigateToAdmin}
          onNavigateToProfile={onNavigateToProfile}
          onNavigateToSettings={() => {
            window.history.pushState({}, '', '/admin-settings');
            window.dispatchEvent(new PopStateEvent('popstate'));
          }}
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
          activePage="settings"
        />

        <main className={`flex-1 flex flex-col transition-all duration-300 pt-16 lg:pt-0 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'} overflow-x-hidden`}>
          <div className="flex-1 px-4 sm:px-6 py-6 sm:py-8 flex items-center justify-center">
            <div className="max-w-md w-full text-center p-8 rounded-lg" style={{ backgroundColor: colors.bgSecondary }}>
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: colors.bgTertiary }}>
                <X className="w-8 h-8" style={{ color: colors.textSecondary }} />
              </div>
              <h2 className="text-2xl font-bold mb-2" style={{ color: colors.textPrimary }}>
                Acesso Negado
              </h2>
              <p className="mb-6" style={{ color: colors.textSecondary }}>
                Você não tem permissão para acessar esta página. Apenas administradores podem visualizar as configurações do sistema.
              </p>
              <button
                onClick={onNavigateToApp}
                className="px-6 py-3 rounded-lg font-medium transition-colors hover:opacity-90"
                style={{ backgroundColor: colors.textPrimary, color: colors.bgPrimary }}
              >
                Voltar para Início
              </button>
            </div>
          </div>
        </main>

        <FooterWis
          onNavigateToTerms={onNavigateToTerms}
          onNavigateToPrivacy={onNavigateToPrivacy}
          onNavigateToCookies={onNavigateToCookies}
        />
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
        onNavigateToAdmin={onNavigateToAdmin}
        onNavigateToProfile={onNavigateToProfile}
        onNavigateToSettings={() => {
          window.history.pushState({}, '', '/admin-settings');
          window.dispatchEvent(new PopStateEvent('popstate'));
        }}
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
        activePage="settings"
      />

      <main className={`flex-1 flex flex-col transition-all duration-300 pt-16 lg:pt-0 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'} overflow-x-hidden`}>
        <div className="flex-1 px-4 sm:px-6 py-6 sm:py-8">
          <div className="max-w-6xl mx-auto w-full">
            <button
              onClick={() => {
                window.history.pushState({}, '', '/profile#admin');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors mb-6 hover:opacity-80"
              style={{
                backgroundColor: colors.bgSecondary,
                color: colors.textPrimary
              }}
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm font-medium">Voltar ao Painel</span>
            </button>

            <div className="flex flex-col items-center mb-6 sm:mb-8">
              <div className="p-2 sm:p-3 rounded-lg mb-3 sm:mb-4" style={{ backgroundColor: colors.bgSecondary }}>
                <CreditCard className="w-6 h-6 sm:w-8 sm:h-8" style={{ color: '#3B82F6' }} />
              </div>
              <div className="text-center">
                <h1 className="text-2xl sm:text-3xl font-title font-bold" style={{ color: colors.textPrimary }}>
                  Gerenciamento de Cotas e Tokens
                </h1>
                <p className="text-xs sm:text-sm mt-1 px-4 sm:px-0" style={{ color: colors.textSecondary }}>
                  Gerencie planos Stripe e monitore uso de tokens por usuário
                </p>
              </div>
            </div>

            <div className="mb-6 border-b overflow-x-auto -mx-4 sm:mx-0" style={{ borderColor: theme === 'dark' ? '#1f2937' : '#E5E7EB' }}>
              <div className="flex gap-2 sm:gap-6 justify-start sm:justify-center px-4 sm:px-0 min-w-max sm:min-w-0">
                <button
                  onClick={() => setActiveTab('billing')}
                  className="py-4 px-3 sm:px-2 font-medium transition-all relative whitespace-nowrap flex-shrink-0"
                  style={{
                    color: activeTab === 'billing' ? '#3B82F6' : colors.textSecondary,
                    borderBottom: activeTab === 'billing' ? '2px solid #3B82F6' : 'none'
                  }}
                >
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="text-xs sm:text-base">Faturamento</span>
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('plans')}
                  className="py-4 px-3 sm:px-2 font-medium transition-all relative whitespace-nowrap flex-shrink-0"
                  style={{
                    color: activeTab === 'plans' ? '#3B82F6' : colors.textSecondary,
                    borderBottom: activeTab === 'plans' ? '2px solid #3B82F6' : 'none'
                  }}
                >
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="text-xs sm:text-base">Planos e Pacotes Stripe</span>
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('users')}
                  className="py-4 px-3 sm:px-2 font-medium transition-all relative whitespace-nowrap flex-shrink-0"
                  style={{
                    color: activeTab === 'users' ? '#3B82F6' : colors.textSecondary,
                    borderBottom: activeTab === 'users' ? '2px solid #3B82F6' : 'none'
                  }}
                >
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="text-xs sm:text-base">Financeiro por Usuários</span>
                  </div>
                </button>
              </div>
            </div>

            {activeTab === 'plans' && (
              <>
                <div
                  className="rounded-lg shadow-sm p-4 sm:p-6 border"
                  style={{
                    backgroundColor: isDark ? '#14181B' : '#FFFFFF',
                    borderColor: isDark ? '#1f2937' : '#E5E7EB'
                  }}
                >
                  <h2
                    className="text-base sm:text-lg font-semibold mb-4 flex items-center gap-2"
                    style={{ color: isDark ? '#FFFFFF' : '#111827' }}
                  >
                    <Package className="w-5 h-5" style={{ color: '#3B82F6' }} />
                    Planos de Assinatura
                  </h2>

                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                      <thead
                        style={{ backgroundColor: isDark ? '#1f2937' : '#F9FAFB' }}
                      >
                        <tr>
                          <th
                            className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                            style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}
                          >
                            Nome do Plano
                          </th>
                          <th
                            className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                            style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}
                          >
                            Tokens Mensais
                          </th>
                          <th
                            className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                            style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}
                          >
                            Limite de Páginas
                          </th>
                          <th
                            className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                            style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}
                          >
                            Valor
                          </th>
                          <th
                            className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                            style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}
                          >
                            Product ID
                          </th>
                          <th
                            className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                            style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}
                          >
                            Price ID
                          </th>
                        </tr>
                      </thead>
                      <tbody
                        className="divide-y"
                        style={{
                          backgroundColor: isDark ? '#14181B' : '#FFFFFF',
                          borderColor: isDark ? '#1f2937' : '#E5E7EB'
                        }}
                      >
                        {stripeProducts.map((product) => (
                          <tr
                            key={product.id}
                            className="hover:bg-opacity-50 transition-colors"
                            style={{
                              backgroundColor: product.recommended
                                ? isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)'
                                : 'transparent'
                            }}
                          >
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-2">
                                <span
                                  className="font-semibold"
                                  style={{ color: isDark ? '#FFFFFF' : '#111827' }}
                                >
                                  {product.name}
                                </span>
                                {product.recommended && (
                                  <span
                                    className="px-2 py-1 text-xs font-medium rounded"
                                    style={{
                                      backgroundColor: '#3B82F6',
                                      color: '#FFFFFF'
                                    }}
                                  >
                                    Recomendado
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <span
                                className="font-medium"
                                style={{ color: isDark ? '#60A5FA' : '#2563EB' }}
                              >
                                {product.tokens}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <span style={{ color: isDark ? '#D1D5DB' : '#374151' }}>
                                {product.pageLimit}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <span
                                className="font-semibold"
                                style={{ color: isDark ? '#34D399' : '#059669' }}
                              >
                                R$ {product.price.toFixed(2)}/mês
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <code
                                className="text-xs px-2 py-1 rounded"
                                style={{
                                  backgroundColor: isDark ? '#1f2937' : '#F3F4F6',
                                  color: isDark ? '#9CA3AF' : '#6B7280'
                                }}
                              >
                                {product.id}
                              </code>
                            </td>
                            <td className="px-4 py-4">
                              <code
                                className="text-xs px-2 py-1 rounded"
                                style={{
                                  backgroundColor: isDark ? '#1f2937' : '#F3F4F6',
                                  color: isDark ? '#9CA3AF' : '#6B7280'
                                }}
                              >
                                {product.priceId}
                              </code>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="md:hidden space-y-4">
                    {stripeProducts.map((product) => (
                      <div
                        key={product.id}
                        className="p-4 rounded-lg border"
                        style={{
                          backgroundColor: product.recommended
                            ? isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)'
                            : isDark ? '#1f2937' : '#F9FAFB',
                          borderColor: isDark ? '#374151' : '#E5E7EB'
                        }}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-semibold" style={{ color: isDark ? '#FFFFFF' : '#111827' }}>
                              {product.name}
                            </h3>
                            {product.recommended && (
                              <span
                                className="inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded"
                                style={{
                                  backgroundColor: '#3B82F6',
                                  color: '#FFFFFF'
                                }}
                              >
                                Recomendado
                              </span>
                            )}
                          </div>
                          <span
                            className="font-semibold text-lg"
                            style={{ color: isDark ? '#34D399' : '#059669' }}
                          >
                            R$ {product.price.toFixed(2)}
                          </span>
                        </div>

                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span style={{ color: colors.textSecondary }}>Tokens:</span>
                            <span className="font-medium" style={{ color: isDark ? '#60A5FA' : '#2563EB' }}>
                              {product.tokens}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span style={{ color: colors.textSecondary }}>Páginas:</span>
                            <span style={{ color: isDark ? '#D1D5DB' : '#374151' }}>
                              {product.pageLimit}
                            </span>
                          </div>
                          <div className="pt-2 border-t" style={{ borderColor: isDark ? '#374151' : '#E5E7EB' }}>
                            <p className="text-xs" style={{ color: colors.textTertiary }}>Product ID:</p>
                            <code
                              className="text-xs block mt-1 p-1 rounded break-all"
                              style={{
                                backgroundColor: isDark ? '#0f1419' : '#F3F4F6',
                                color: isDark ? '#9CA3AF' : '#6B7280'
                              }}
                            >
                              {product.id}
                            </code>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div
                  className="rounded-lg shadow-sm p-4 sm:p-6 border mt-6"
                  style={{
                    backgroundColor: isDark ? '#14181B' : '#FFFFFF',
                    borderColor: isDark ? '#1f2937' : '#E5E7EB'
                  }}
                >
                  <h2
                    className="text-base sm:text-lg font-semibold mb-4 flex items-center gap-2"
                    style={{ color: isDark ? '#FFFFFF' : '#111827' }}
                  >
                    <Activity className="w-5 h-5" style={{ color: '#10B981' }} />
                    Pacotes Extras de Tokens
                  </h2>

                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                      <thead
                        style={{ backgroundColor: isDark ? '#1f2937' : '#F9FAFB' }}
                      >
                        <tr>
                          <th
                            className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                            style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}
                          >
                            Nome do Pacote
                          </th>
                          <th
                            className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                            style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}
                          >
                            Quantidade de Tokens
                          </th>
                          <th
                            className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                            style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}
                          >
                            Valor
                          </th>
                          <th
                            className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                            style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}
                          >
                            Product ID
                          </th>
                          <th
                            className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                            style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}
                          >
                            Price ID
                          </th>
                        </tr>
                      </thead>
                      <tbody
                        className="divide-y"
                        style={{
                          backgroundColor: isDark ? '#14181B' : '#FFFFFF',
                          borderColor: isDark ? '#1f2937' : '#E5E7EB'
                        }}
                      >
                        {tokenPackages.map((pkg) => (
                          <tr key={pkg.id} className="hover:bg-opacity-50 transition-colors">
                            <td className="px-4 py-4">
                              <span
                                className="font-semibold"
                                style={{ color: isDark ? '#FFFFFF' : '#111827' }}
                              >
                                {pkg.name}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <span
                                className="font-medium"
                                style={{ color: isDark ? '#60A5FA' : '#2563EB' }}
                              >
                                {pkg.tokens}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <span
                                className="font-semibold"
                                style={{ color: isDark ? '#34D399' : '#059669' }}
                              >
                                R$ {pkg.price.toFixed(2)}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <code
                                className="text-xs px-2 py-1 rounded"
                                style={{
                                  backgroundColor: isDark ? '#1f2937' : '#F3F4F6',
                                  color: isDark ? '#9CA3AF' : '#6B7280'
                                }}
                              >
                                {pkg.id}
                              </code>
                            </td>
                            <td className="px-4 py-4">
                              <code
                                className="text-xs px-2 py-1 rounded"
                                style={{
                                  backgroundColor: isDark ? '#1f2937' : '#F3F4F6',
                                  color: isDark ? '#9CA3AF' : '#6B7280'
                                }}
                              >
                                {pkg.priceId}
                              </code>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="md:hidden space-y-3">
                    {tokenPackages.map((pkg) => (
                      <div
                        key={pkg.id}
                        className="p-4 rounded-lg border"
                        style={{
                          backgroundColor: isDark ? '#1f2937' : '#F9FAFB',
                          borderColor: isDark ? '#374151' : '#E5E7EB'
                        }}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="font-semibold" style={{ color: isDark ? '#FFFFFF' : '#111827' }}>
                            {pkg.name}
                          </h3>
                          <span
                            className="font-semibold text-lg"
                            style={{ color: isDark ? '#34D399' : '#059669' }}
                          >
                            R$ {pkg.price.toFixed(2)}
                          </span>
                        </div>

                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span style={{ color: colors.textSecondary }}>Tokens:</span>
                            <span className="font-medium" style={{ color: isDark ? '#60A5FA' : '#2563EB' }}>
                              {pkg.tokens}
                            </span>
                          </div>
                          <div className="pt-2 border-t" style={{ borderColor: isDark ? '#374151' : '#E5E7EB' }}>
                            <p className="text-xs" style={{ color: colors.textTertiary }}>Product ID:</p>
                            <code
                              className="text-xs block mt-1 p-1 rounded break-all"
                              style={{
                                backgroundColor: isDark ? '#0f1419' : '#F3F4F6',
                                color: isDark ? '#9CA3AF' : '#6B7280'
                              }}
                            >
                              {pkg.id}
                            </code>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div
                  className="rounded-lg shadow-sm p-4 sm:p-6 border mt-6"
                  style={{
                    backgroundColor: isDark ? '#14181B' : '#FFFFFF',
                    borderColor: isDark ? '#1f2937' : '#E5E7EB'
                  }}
                >
                  <h2
                    className="text-base sm:text-lg font-semibold mb-4 flex items-center gap-2"
                    style={{ color: isDark ? '#FFFFFF' : '#111827' }}
                  >
                    <Ticket className="w-5 h-5" style={{ color: '#F59E0B' }} />
                    Cupons Ativos
                  </h2>

                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                      <thead
                        style={{ backgroundColor: isDark ? '#1f2937' : '#F9FAFB' }}
                      >
                        <tr>
                          <th
                            className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                            style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}
                          >
                            ID do Cupom
                          </th>
                          <th
                            className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                            style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}
                          >
                            Nome
                          </th>
                          <th
                            className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                            style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}
                          >
                            Desconto
                          </th>
                          <th
                            className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                            style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}
                          >
                            Duração
                          </th>
                          <th
                            className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                            style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}
                          >
                            Utilizações
                          </th>
                          <th
                            className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                            style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}
                          >
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody
                        className="divide-y"
                        style={{
                          backgroundColor: isDark ? '#14181B' : '#FFFFFF',
                          borderColor: isDark ? '#1f2937' : '#E5E7EB'
                        }}
                      >
                        {loadingCoupons ? (
                          <tr>
                            <td
                              colSpan={6}
                              className="px-4 py-4 text-center"
                              style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}
                            >
                              Carregando cupons...
                            </td>
                          </tr>
                        ) : coupons.length === 0 ? (
                          <tr>
                            <td
                              colSpan={6}
                              className="px-4 py-4 text-center"
                              style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}
                            >
                              Nenhum cupom ativo encontrado
                            </td>
                          </tr>
                        ) : (
                          coupons.map((coupon) => {
                            const discountText = coupon.percent_off
                              ? `${coupon.percent_off}% de desconto`
                              : coupon.amount_off
                              ? `${coupon.currency.toUpperCase()} ${(coupon.amount_off / 100).toFixed(2)} de desconto`
                              : 'N/A';

                            const durationText =
                              coupon.duration === 'once'
                                ? 'Uma vez'
                                : coupon.duration === 'forever'
                                ? 'Para sempre'
                                : `${coupon.duration_in_months} meses`;

                            const utilizationText = coupon.max_redemptions
                              ? `${coupon.times_redeemed} / ${coupon.max_redemptions < 1000 ? coupon.max_redemptions : 'ilimitado'}`
                              : `${coupon.times_redeemed} / ilimitado`;

                            return (
                              <tr
                                key={coupon.id}
                                className="hover:bg-opacity-50 transition-colors"
                              >
                                <td className="px-4 py-4">
                                  <code
                                    className="text-xs px-2 py-1 rounded"
                                    style={{
                                      backgroundColor: isDark ? '#1f2937' : '#F3F4F6',
                                      color: isDark ? '#9CA3AF' : '#6B7280'
                                    }}
                                  >
                                    {coupon.id}
                                  </code>
                                </td>
                                <td className="px-4 py-4">
                                  <span
                                    className="font-medium"
                                    style={{ color: isDark ? '#FFFFFF' : '#111827' }}
                                  >
                                    {coupon.name || '-'}
                                  </span>
                                </td>
                                <td className="px-4 py-4">
                                  <span
                                    className="font-semibold"
                                    style={{ color: isDark ? '#F59E0B' : '#D97706' }}
                                  >
                                    {discountText}
                                  </span>
                                </td>
                                <td className="px-4 py-4">
                                  <span style={{ color: isDark ? '#D1D5DB' : '#374151' }}>
                                    {durationText}
                                  </span>
                                </td>
                                <td className="px-4 py-4">
                                  <span
                                    className="font-medium"
                                    style={{ color: isDark ? '#60A5FA' : '#2563EB' }}
                                  >
                                    {utilizationText}
                                  </span>
                                </td>
                                <td className="px-4 py-4">
                                  <span
                                    className="px-2 py-1 text-xs font-medium rounded"
                                    style={{
                                      backgroundColor: coupon.valid
                                        ? isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.1)'
                                        : isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)',
                                      color: coupon.valid ? '#10B981' : '#EF4444'
                                    }}
                                  >
                                    {coupon.valid ? 'Ativo' : 'Inativo'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="md:hidden space-y-3">
                    {loadingCoupons ? (
                      <div className="text-center py-8" style={{ color: colors.textSecondary }}>
                        Carregando cupons...
                      </div>
                    ) : coupons.length === 0 ? (
                      <div className="text-center py-8" style={{ color: colors.textSecondary }}>
                        Nenhum cupom ativo encontrado
                      </div>
                    ) : (
                      coupons.map((coupon) => {
                        const discountText = coupon.percent_off
                          ? `${coupon.percent_off}% de desconto`
                          : coupon.amount_off
                          ? `BRL ${(coupon.amount_off / 100).toFixed(2)} de desconto`
                          : 'N/A';

                        const durationText =
                          coupon.duration === 'once'
                            ? 'Uma vez'
                            : coupon.duration === 'forever'
                            ? 'Para sempre'
                            : `${coupon.duration_in_months} meses`;

                        const utilizationText = coupon.max_redemptions
                          ? `${coupon.times_redeemed} / ${coupon.max_redemptions < 1000 ? coupon.max_redemptions : 'ilimitado'}`
                          : `${coupon.times_redeemed} / ilimitado`;

                        return (
                          <div
                            key={coupon.id}
                            className="p-4 rounded-lg border"
                            style={{
                              backgroundColor: isDark ? '#1f2937' : '#F9FAFB',
                              borderColor: isDark ? '#374151' : '#E5E7EB'
                            }}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <h3 className="font-semibold text-sm mb-1" style={{ color: isDark ? '#FFFFFF' : '#111827' }}>
                                  {coupon.name || 'Sem nome'}
                                </h3>
                                <code
                                  className="text-xs px-2 py-0.5 rounded break-all max-w-[200px] inline-block"
                                  style={{
                                    backgroundColor: isDark ? '#0f1419' : '#F3F4F6',
                                    color: isDark ? '#9CA3AF' : '#6B7280'
                                  }}
                                >
                                  {coupon.id}
                                </code>
                              </div>
                              <span
                                className="px-2 py-1 text-xs font-medium rounded whitespace-nowrap ml-2"
                                style={{
                                  backgroundColor: coupon.valid
                                    ? isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.1)'
                                    : isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)',
                                  color: coupon.valid ? '#10B981' : '#EF4444'
                                }}
                              >
                                {coupon.valid ? 'Ativo' : 'Inativo'}
                              </span>
                            </div>

                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span style={{ color: colors.textSecondary }}>Desconto:</span>
                                <span className="font-semibold" style={{ color: isDark ? '#F59E0B' : '#D97706' }}>
                                  {discountText}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span style={{ color: colors.textSecondary }}>Duração:</span>
                                <span style={{ color: isDark ? '#D1D5DB' : '#374151' }}>
                                  {durationText}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span style={{ color: colors.textSecondary }}>Utilizações:</span>
                                <span className="font-medium" style={{ color: isDark ? '#60A5FA' : '#2563EB' }}>
                                  {utilizationText}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            )}

            {activeTab === 'users' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                  <div
                    className="rounded-lg shadow-sm p-4 sm:p-6 border"
                    style={{
                      backgroundColor: isDark ? '#14181B' : '#FFFFFF',
                      borderColor: isDark ? '#1f2937' : '#E5E7EB'
                    }}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <Users className="w-5 h-5" style={{ color: '#3B82F6' }} />
                      <h3
                        className="text-sm font-medium"
                        style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}
                      >
                        Usuários com Cota
                      </h3>
                    </div>
                    <p
                      className="text-2xl sm:text-3xl font-bold"
                      style={{ color: isDark ? '#FFFFFF' : '#111827' }}
                    >
                      {totalUsersWithQuota}
                    </p>
                  </div>

                  <div
                    className="rounded-lg shadow-sm p-4 sm:p-6 border"
                    style={{
                      backgroundColor: isDark ? '#14181B' : '#FFFFFF',
                      borderColor: isDark ? '#1f2937' : '#E5E7EB'
                    }}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <Activity className="w-5 h-5" style={{ color: '#10B981' }} />
                      <h3
                        className="text-sm font-medium"
                        style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}
                      >
                        Total Usado Este Mês
                      </h3>
                    </div>
                    <p
                      className="text-2xl sm:text-3xl font-bold"
                      style={{ color: isDark ? '#FFFFFF' : '#111827' }}
                    >
                      {tokenService.formatTokenCount(totalTokensUsedAllUsers)}
                    </p>
                  </div>

                  <div
                    className="rounded-lg shadow-sm p-4 sm:p-6 border"
                    style={{
                      backgroundColor: isDark ? '#14181B' : '#FFFFFF',
                      borderColor: isDark ? '#1f2937' : '#E5E7EB'
                    }}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <TrendingUp className="w-5 h-5" style={{ color: '#8B5CF6' }} />
                      <h3
                        className="text-sm font-medium"
                        style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}
                      >
                        Cota Total Alocada
                      </h3>
                    </div>
                    <p
                      className="text-2xl sm:text-3xl font-bold"
                      style={{ color: isDark ? '#FFFFFF' : '#111827' }}
                    >
                      {tokenService.formatTokenCount(totalQuotaAllUsers)}
                    </p>
                  </div>

                  <div
                    className="rounded-lg shadow-sm p-4 sm:p-6 border"
                    style={{
                      backgroundColor: isDark ? '#14181B' : '#FFFFFF',
                      borderColor: isDark ? '#1f2937' : '#E5E7EB'
                    }}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <DollarSign className="w-5 h-5" style={{ color: '#10B981' }} />
                      <h3
                        className="text-sm font-medium"
                        style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}
                      >
                        Total Faturado
                      </h3>
                    </div>
                    <p
                      className="text-2xl sm:text-3xl font-bold"
                      style={{ color: isDark ? '#FFFFFF' : '#111827' }}
                    >
                      {formatCurrency(totalRevenue)}
                    </p>
                  </div>
                </div>

                <div
                  className="rounded-lg shadow-sm border mt-6"
                  style={{
                    backgroundColor: isDark ? '#14181B' : '#FFFFFF',
                    borderColor: isDark ? '#1f2937' : '#E5E7EB'
                  }}
                >
                  <div className="p-4 sm:p-6 border-b" style={{ borderColor: isDark ? '#1f2937' : '#E5E7EB' }}>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <h2
                        className="text-base sm:text-lg font-semibold"
                        style={{ color: isDark ? '#FFFFFF' : '#111827' }}
                      >
                        Usuários e Cotas de Tokens
                      </h2>
                      <div className="flex items-center gap-3">
                        <div className="relative flex-1 sm:flex-initial">
                          <Search
                            className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4"
                            style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}
                          />
                          <input
                            type="text"
                            placeholder="Buscar usuários..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full sm:w-auto pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                            style={{
                              backgroundColor: isDark ? '#1f2937' : '#FFFFFF',
                              borderColor: isDark ? '#374151' : '#D1D5DB',
                              color: isDark ? '#FFFFFF' : '#111827'
                            }}
                          />
                        </div>
                        <button
                          onClick={handleRefresh}
                          disabled={refreshing}
                          className="p-2 rounded-lg border transition-colors"
                          style={{
                            backgroundColor: isDark ? '#1f2937' : '#F9FAFB',
                            borderColor: isDark ? '#374151' : '#D1D5DB',
                            color: isDark ? '#9CA3AF' : '#6B7280'
                          }}
                          title="Atualizar"
                        >
                          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                      <thead
                        style={{ backgroundColor: isDark ? '#1f2937' : '#F9FAFB' }}
                      >
                        <tr>
                          <th
                            className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider"
                            style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}
                          >
                            Usuário
                          </th>
                          <th
                            className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider"
                            style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}
                          >
                            Cota Mensal
                          </th>
                          <th
                            className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider"
                            style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}
                          >
                            Usado Este Mês
                          </th>
                          <th
                            className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider"
                            style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}
                          >
                            Restante
                          </th>
                          <th
                            className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider"
                            style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}
                          >
                            Uso %
                          </th>
                          <th
                            className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider"
                            style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}
                          >
                            Ações
                          </th>
                        </tr>
                      </thead>
                      <tbody
                        className="divide-y"
                        style={{
                          backgroundColor: isDark ? '#14181B' : '#FFFFFF',
                          borderColor: isDark ? '#1f2937' : '#E5E7EB'
                        }}
                      >
                        {loading ? (
                          <tr>
                            <td
                              colSpan={6}
                              className="px-6 py-4 text-center"
                              style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}
                            >
                              Carregando...
                            </td>
                          </tr>
                        ) : filteredUsers.length === 0 ? (
                          <tr>
                            <td
                              colSpan={6}
                              className="px-6 py-4 text-center"
                              style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}
                            >
                              Nenhum usuário encontrado
                            </td>
                          </tr>
                        ) : (
                          filteredUsers.map((userQuota) => {
                            const usagePercent = tokenService.getUsagePercentage(
                              userQuota.tokens_used_this_month,
                              userQuota.monthly_quota
                            );
                            const remaining = userQuota.monthly_quota - userQuota.tokens_used_this_month;

                            return (
                              <tr
                                key={userQuota.user_id}
                                className="hover:bg-opacity-50 transition-colors"
                              >
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div>
                                    <div
                                      className="text-sm font-medium"
                                      style={{ color: isDark ? '#FFFFFF' : '#111827' }}
                                    >
                                      {userQuota.first_name} {userQuota.last_name}
                                    </div>
                                    <div
                                      className="text-sm"
                                      style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}
                                    >
                                      {userQuota.email}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  {editingUserId === userQuota.user_id ? (
                                    <input
                                      type="number"
                                      value={editValue}
                                      onChange={(e) => setEditValue(parseInt(e.target.value) || 0)}
                                      className="w-32 px-2 py-1 border rounded focus:ring-2 focus:ring-blue-500"
                                      style={{
                                        backgroundColor: isDark ? '#1f2937' : '#FFFFFF',
                                        borderColor: isDark ? '#374151' : '#D1D5DB',
                                        color: isDark ? '#FFFFFF' : '#111827'
                                      }}
                                    />
                                  ) : userQuota.monthly_quota === 0 ? (
                                    <span
                                      className="text-sm italic"
                                      style={{ color: '#EF4444' }}
                                    >
                                      Sem licença
                                    </span>
                                  ) : (
                                    <span
                                      className="text-sm"
                                      style={{ color: isDark ? '#FFFFFF' : '#111827' }}
                                    >
                                      {tokenService.formatTokenCount(userQuota.monthly_quota)}
                                    </span>
                                  )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  {userQuota.monthly_quota === 0 ? (
                                    <span
                                      className="text-sm italic"
                                      style={{ color: isDark ? '#6B7280' : '#9CA3AF' }}
                                    >
                                      -
                                    </span>
                                  ) : (
                                    <span
                                      className="text-sm"
                                      style={{ color: isDark ? '#FFFFFF' : '#111827' }}
                                    >
                                      {tokenService.formatTokenCount(userQuota.tokens_used_this_month)}
                                    </span>
                                  )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  {userQuota.monthly_quota === 0 ? (
                                    <span
                                      className="text-sm italic"
                                      style={{ color: isDark ? '#6B7280' : '#9CA3AF' }}
                                    >
                                      -
                                    </span>
                                  ) : (
                                    <span
                                      className="text-sm font-medium"
                                      style={{
                                        color: remaining > 0
                                          ? isDark ? '#34D399' : '#059669'
                                          : '#EF4444'
                                      }}
                                    >
                                      {tokenService.formatTokenCount(remaining)}
                                    </span>
                                  )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  {userQuota.monthly_quota === 0 ? (
                                    <span
                                      className="text-sm italic"
                                      style={{ color: isDark ? '#6B7280' : '#9CA3AF' }}
                                    >
                                      -
                                    </span>
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <div
                                        className="w-16 rounded-full h-2"
                                        style={{ backgroundColor: isDark ? '#1f2937' : '#E5E7EB' }}
                                      >
                                        <div
                                          className="h-2 rounded-full transition-all"
                                          style={{
                                            width: `${Math.min(usagePercent, 100)}%`,
                                            backgroundColor:
                                              usagePercent >= 90 ? '#EF4444' :
                                              usagePercent >= 75 ? '#F59E0B' :
                                              '#10B981'
                                          }}
                                        />
                                      </div>
                                      <span
                                        className="text-sm font-medium"
                                        style={{
                                          color:
                                            usagePercent >= 90 ? '#EF4444' :
                                            usagePercent >= 75 ? '#F59E0B' :
                                            isDark ? '#34D399' : '#059669'
                                        }}
                                      >
                                        {usagePercent.toFixed(0)}%
                                      </span>
                                    </div>
                                  )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                  {editingUserId === userQuota.user_id ? (
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => handleSaveQuota(userQuota.user_id)}
                                        style={{ color: '#10B981' }}
                                        className="hover:opacity-70 transition-opacity"
                                      >
                                        <Save className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={handleCancelEdit}
                                        style={{ color: '#EF4444' }}
                                        className="hover:opacity-70 transition-opacity"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() =>
                                        handleEditQuota(userQuota.user_id, userQuota.monthly_quota)
                                      }
                                      className="flex items-center gap-1 hover:opacity-70 transition-opacity"
                                      style={{ color: '#3B82F6' }}
                                    >
                                      <Edit2 className="w-4 h-4" />
                                      Editar
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="md:hidden divide-y" style={{ borderColor: isDark ? '#1f2937' : '#E5E7EB' }}>
                    {loading ? (
                      <div className="p-6 text-center" style={{ color: colors.textSecondary }}>
                        Carregando...
                      </div>
                    ) : filteredUsers.length === 0 ? (
                      <div className="p-6 text-center" style={{ color: colors.textSecondary }}>
                        Nenhum usuário encontrado
                      </div>
                    ) : (
                      filteredUsers.map((userQuota) => {
                        const usagePercent = tokenService.getUsagePercentage(
                          userQuota.tokens_used_this_month,
                          userQuota.monthly_quota
                        );
                        const remaining = userQuota.monthly_quota - userQuota.tokens_used_this_month;

                        return (
                          <div
                            key={userQuota.user_id}
                            className="p-4"
                            style={{ borderColor: isDark ? '#1f2937' : '#E5E7EB' }}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1 min-w-0">
                                <h3 className="font-medium text-sm" style={{ color: colors.textPrimary }}>
                                  {userQuota.first_name} {userQuota.last_name}
                                </h3>
                                <p className="text-xs mt-0.5 break-all" style={{ color: colors.textSecondary }}>
                                  {userQuota.email}
                                </p>
                              </div>
                              {editingUserId === userQuota.user_id ? (
                                <div className="flex items-center gap-2 ml-2">
                                  <button
                                    onClick={() => handleSaveQuota(userQuota.user_id)}
                                    style={{ color: '#10B981' }}
                                    className="p-1.5 hover:opacity-70 transition-opacity"
                                  >
                                    <Save className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={handleCancelEdit}
                                    style={{ color: '#EF4444' }}
                                    className="p-1.5 hover:opacity-70 transition-opacity"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() =>
                                    handleEditQuota(userQuota.user_id, userQuota.monthly_quota)
                                  }
                                  className="flex items-center gap-1 text-xs hover:opacity-70 transition-opacity ml-2"
                                  style={{ color: '#3B82F6' }}
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                  <span>Editar</span>
                                </button>
                              )}
                            </div>

                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between items-center">
                                <span style={{ color: colors.textSecondary }}>Cota Mensal:</span>
                                {editingUserId === userQuota.user_id ? (
                                  <input
                                    type="number"
                                    value={editValue}
                                    onChange={(e) => setEditValue(parseInt(e.target.value) || 0)}
                                    className="w-32 px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-blue-500"
                                    style={{
                                      backgroundColor: isDark ? '#1f2937' : '#FFFFFF',
                                      borderColor: isDark ? '#374151' : '#D1D5DB',
                                      color: isDark ? '#FFFFFF' : '#111827'
                                    }}
                                  />
                                ) : userQuota.monthly_quota === 0 ? (
                                  <span className="text-sm italic" style={{ color: '#EF4444' }}>
                                    Sem licença
                                  </span>
                                ) : (
                                  <span className="font-medium" style={{ color: colors.textPrimary }}>
                                    {tokenService.formatTokenCount(userQuota.monthly_quota)}
                                  </span>
                                )}
                              </div>

                              {userQuota.monthly_quota > 0 && (
                                <>
                                  <div className="flex justify-between">
                                    <span style={{ color: colors.textSecondary }}>Usado:</span>
                                    <span className="font-medium" style={{ color: colors.textPrimary }}>
                                      {tokenService.formatTokenCount(userQuota.tokens_used_this_month)}
                                    </span>
                                  </div>

                                  <div className="flex justify-between">
                                    <span style={{ color: colors.textSecondary }}>Restante:</span>
                                    <span
                                      className="font-medium"
                                      style={{
                                        color: remaining > 0
                                          ? isDark ? '#34D399' : '#059669'
                                          : '#EF4444'
                                      }}
                                    >
                                      {tokenService.formatTokenCount(remaining)}
                                    </span>
                                  </div>

                                  <div className="pt-2">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-xs" style={{ color: colors.textSecondary }}>Uso:</span>
                                      <span
                                        className="text-xs font-medium"
                                        style={{
                                          color:
                                            usagePercent >= 90 ? '#EF4444' :
                                            usagePercent >= 75 ? '#F59E0B' :
                                            isDark ? '#34D399' : '#059669'
                                        }}
                                      >
                                        {usagePercent.toFixed(0)}%
                                      </span>
                                    </div>
                                    <div
                                      className="w-full rounded-full h-2"
                                      style={{ backgroundColor: isDark ? '#1f2937' : '#E5E7EB' }}
                                    >
                                      <div
                                        className="h-2 rounded-full transition-all"
                                        style={{
                                          width: `${Math.min(usagePercent, 100)}%`,
                                          backgroundColor:
                                            usagePercent >= 90 ? '#EF4444' :
                                            usagePercent >= 75 ? '#F59E0B' :
                                            '#10B981'
                                        }}
                                      />
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            )}

            {activeTab === 'billing' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                  <div className="flex gap-2 flex-wrap">
                    {(['day', 'week', 'month', 'year', 'all_time'] as TimePeriod[]).map((period) => (
                      <button
                        key={period}
                        onClick={() => setBillingPeriod(period)}
                        className="px-3 py-1.5 text-sm rounded-lg transition-colors"
                        style={{
                          backgroundColor: billingPeriod === period ? '#3B82F6' : (isDark ? '#1f2937' : '#F3F4F6'),
                          color: billingPeriod === period ? '#FFFFFF' : colors.textSecondary
                        }}
                      >
                        {billingAnalyticsService.getTimePeriodLabel(period)}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {(['all', 'subscriptions', 'tokens', 'canceled'] as BillingDataView[]).map((view) => (
                      <button
                        key={view}
                        onClick={() => setBillingView(view)}
                        className="px-3 py-1.5 text-sm rounded-lg transition-colors"
                        style={{
                          backgroundColor: billingView === view ? '#10B981' : (isDark ? '#1f2937' : '#F3F4F6'),
                          color: billingView === view ? '#FFFFFF' : colors.textSecondary
                        }}
                      >
                        {billingAnalyticsService.getDataViewLabel(view)}
                      </button>
                    ))}
                  </div>
                </div>

                {loadingBilling ? (
                  <div className="rounded-xl shadow-lg p-12 border text-center" style={{
                    backgroundColor: isDark ? '#14181B' : '#FFFFFF',
                    borderColor: isDark ? '#1f2937' : '#E5E7EB',
                  }}>
                    <RefreshCw className="w-8 h-8 mx-auto mb-4 animate-spin" style={{ color: colors.textSecondary }} />
                    <p className="text-sm" style={{ color: colors.textSecondary }}>
                      Carregando dados de faturamento...
                    </p>
                  </div>
                ) : !billingData ? (
                  <div className="rounded-xl shadow-lg p-12 border text-center" style={{
                    backgroundColor: isDark ? '#14181B' : '#FFFFFF',
                    borderColor: isDark ? '#1f2937' : '#E5E7EB',
                  }}>
                    <XCircle className="w-16 h-16 mx-auto mb-4" style={{ color: '#EF4444' }} />
                    <h3 className="text-lg font-semibold mb-2" style={{ color: colors.textPrimary }}>
                      Erro ao Carregar Dados
                    </h3>
                    <p className="text-sm mb-4" style={{ color: colors.textSecondary }}>
                      Não foi possível carregar os dados de faturamento
                    </p>
                    <button
                      onClick={loadBillingData}
                      className="px-4 py-2 rounded-lg transition-colors"
                      style={{ backgroundColor: '#3B82F6', color: '#FFFFFF' }}
                    >
                      Tentar Novamente
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Cards de Métricas */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {(billingView === 'all' || billingView === 'subscriptions' || billingView === 'tokens') && (
                        <div className="rounded-lg shadow-sm p-6 border" style={{
                          backgroundColor: isDark ? '#14181B' : '#FFFFFF',
                          borderColor: isDark ? '#1f2937' : '#E5E7EB'
                        }}>
                          <div className="flex items-center gap-3 mb-2">
                            <DollarSign className="w-5 h-5" style={{ color: '#10B981' }} />
                            <h3 className="text-sm font-medium" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
                              {billingView === 'all' ? 'Receita Total' :
                               billingView === 'subscriptions' ? 'Receita Assinaturas' :
                               'Receita Tokens'}
                            </h3>
                          </div>
                          <p className="text-3xl font-bold" style={{ color: isDark ? '#FFFFFF' : '#111827' }}>
                            {billingView === 'all' && billingAnalyticsService.formatCurrency(billingData.totalRevenue)}
                            {billingView === 'subscriptions' && billingAnalyticsService.formatCurrency(billingData.subscriptionMetrics.totalRevenue)}
                            {billingView === 'tokens' && billingAnalyticsService.formatCurrency(billingData.tokenMetrics.totalRevenue)}
                          </p>
                          <p className="text-xs mt-1" style={{
                            color: billingAnalyticsService.calculateTrendColor(billingData.revenueGrowth)
                          }}>
                            {billingAnalyticsService.formatPercentage(billingData.revenueGrowth)} vs período anterior
                          </p>
                        </div>
                      )}

                      {(billingView === 'all' || billingView === 'subscriptions') && (
                        <div className="rounded-lg shadow-sm p-6 border" style={{
                          backgroundColor: isDark ? '#14181B' : '#FFFFFF',
                          borderColor: isDark ? '#1f2937' : '#E5E7EB'
                        }}>
                          <div className="flex items-center gap-3 mb-2">
                            <Users className="w-5 h-5" style={{ color: '#3B82F6' }} />
                            <h3 className="text-sm font-medium" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
                              Assinaturas Ativas
                            </h3>
                          </div>
                          <p className="text-3xl font-bold" style={{ color: isDark ? '#FFFFFF' : '#111827' }}>
                            {billingAnalyticsService.formatNumber(billingData.subscriptionMetrics.activeCount)}
                          </p>
                          <p className="text-xs mt-1" style={{ color: colors.textSecondary }}>
                            MRR: {billingAnalyticsService.formatCurrency(billingData.subscriptionMetrics.mrr)}
                          </p>
                        </div>
                      )}

                      {(billingView === 'all' || billingView === 'tokens') && (
                        <div className="rounded-lg shadow-sm p-6 border" style={{
                          backgroundColor: isDark ? '#14181B' : '#FFFFFF',
                          borderColor: isDark ? '#1f2937' : '#E5E7EB'
                        }}>
                          <div className="flex items-center gap-3 mb-2">
                            <Activity className="w-5 h-5" style={{ color: '#F59E0B' }} />
                            <h3 className="text-sm font-medium" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
                              Tokens Vendidos
                            </h3>
                          </div>
                          <p className="text-3xl font-bold" style={{ color: isDark ? '#FFFFFF' : '#111827' }}>
                            {billingAnalyticsService.formatNumber(billingData.tokenMetrics.purchaseCount)}
                          </p>
                          <p className="text-xs mt-1" style={{ color: colors.textSecondary }}>
                            {billingView === 'tokens' ? 'Total de vendas' : `Receita: ${billingAnalyticsService.formatCurrency(billingData.tokenMetrics.totalRevenue)}`}
                          </p>
                        </div>
                      )}

                      {billingView === 'all' && (
                        <div className="rounded-lg shadow-sm p-6 border" style={{
                          backgroundColor: isDark ? '#14181B' : '#FFFFFF',
                          borderColor: isDark ? '#1f2937' : '#E5E7EB'
                        }}>
                          <div className="flex items-center gap-3 mb-2">
                            <TrendingUp className="w-5 h-5" style={{ color: '#8B5CF6' }} />
                            <h3 className="text-sm font-medium" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
                              ARPU
                            </h3>
                          </div>
                          <p className="text-3xl font-bold" style={{ color: isDark ? '#FFFFFF' : '#111827' }}>
                            {billingAnalyticsService.formatCurrency(billingData.subscriptionMetrics.averageRevenuePerUser)}
                          </p>
                          <p className="text-xs mt-1" style={{ color: colors.textSecondary }}>
                            Receita média por usuário
                          </p>
                        </div>
                      )}

                      {billingView === 'subscriptions' && (
                        <div className="rounded-lg shadow-sm p-6 border" style={{
                          backgroundColor: isDark ? '#14181B' : '#FFFFFF',
                          borderColor: isDark ? '#1f2937' : '#E5E7EB'
                        }}>
                          <div className="flex items-center gap-3 mb-2">
                            <TrendingUp className="w-5 h-5" style={{ color: '#8B5CF6' }} />
                            <h3 className="text-sm font-medium" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
                              ARPU
                            </h3>
                          </div>
                          <p className="text-3xl font-bold" style={{ color: isDark ? '#FFFFFF' : '#111827' }}>
                            {billingAnalyticsService.formatCurrency(billingData.subscriptionMetrics.averageRevenuePerUser)}
                          </p>
                          <p className="text-xs mt-1" style={{ color: colors.textSecondary }}>
                            Receita média por usuário
                          </p>
                        </div>
                      )}

                      {billingView === 'tokens' && (
                        <>
                          <div className="rounded-lg shadow-sm p-6 border" style={{
                            backgroundColor: isDark ? '#14181B' : '#FFFFFF',
                            borderColor: isDark ? '#1f2937' : '#E5E7EB'
                          }}>
                            <div className="flex items-center gap-3 mb-2">
                              <Users className="w-5 h-5" style={{ color: '#3B82F6' }} />
                              <h3 className="text-sm font-medium" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
                                Compradores Recorrentes
                              </h3>
                            </div>
                            <p className="text-3xl font-bold" style={{ color: isDark ? '#FFFFFF' : '#111827' }}>
                              {billingAnalyticsService.formatNumber(billingData.tokenMetrics.repeatCustomers)}
                            </p>
                            <p className="text-xs mt-1" style={{ color: colors.textSecondary }}>
                              {billingAnalyticsService.formatNumber(billingData.tokenMetrics.firstTimeBuyers)} novos compradores
                            </p>
                          </div>

                          <div className="rounded-lg shadow-sm p-6 border" style={{
                            backgroundColor: isDark ? '#14181B' : '#FFFFFF',
                            borderColor: isDark ? '#1f2937' : '#E5E7EB'
                          }}>
                            <div className="flex items-center gap-3 mb-2">
                              <DollarSign className="w-5 h-5" style={{ color: '#10B981' }} />
                              <h3 className="text-sm font-medium" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
                                Ticket Médio
                              </h3>
                            </div>
                            <p className="text-3xl font-bold" style={{ color: isDark ? '#FFFFFF' : '#111827' }}>
                              {billingAnalyticsService.formatCurrency(billingData.tokenMetrics.averagePurchaseValue)}
                            </p>
                            <p className="text-xs mt-1" style={{ color: colors.textSecondary }}>
                              Valor médio por compra
                            </p>
                          </div>
                        </>
                      )}

                      {billingView === 'canceled' && (
                        <>
                          <div className="rounded-lg shadow-sm p-6 border" style={{
                            backgroundColor: isDark ? '#14181B' : '#FFFFFF',
                            borderColor: isDark ? '#1f2937' : '#E5E7EB'
                          }}>
                            <div className="flex items-center gap-3 mb-2">
                              <XCircle className="w-5 h-5" style={{ color: '#EF4444' }} />
                              <h3 className="text-sm font-medium" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
                                Receita Perdida
                              </h3>
                            </div>
                            <p className="text-3xl font-bold" style={{ color: '#EF4444' }}>
                              {billingAnalyticsService.formatCurrency(billingData.canceledMetrics.lostRevenue)}
                            </p>
                            <p className="text-xs mt-1" style={{ color: colors.textSecondary }}>
                              MRR perdido
                            </p>
                          </div>

                          <div className="rounded-lg shadow-sm p-6 border" style={{
                            backgroundColor: isDark ? '#14181B' : '#FFFFFF',
                            borderColor: isDark ? '#1f2937' : '#E5E7EB'
                          }}>
                            <div className="flex items-center gap-3 mb-2">
                              <Users className="w-5 h-5" style={{ color: '#F59E0B' }} />
                              <h3 className="text-sm font-medium" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
                                Cancelamentos
                              </h3>
                            </div>
                            <p className="text-3xl font-bold" style={{ color: isDark ? '#FFFFFF' : '#111827' }}>
                              {billingAnalyticsService.formatNumber(billingData.canceledMetrics.cancellationCount)}
                            </p>
                            <p className="text-xs mt-1" style={{ color: colors.textSecondary }}>
                              Total no período
                            </p>
                          </div>

                          <div className="rounded-lg shadow-sm p-6 border" style={{
                            backgroundColor: isDark ? '#14181B' : '#FFFFFF',
                            borderColor: isDark ? '#1f2937' : '#E5E7EB'
                          }}>
                            <div className="flex items-center gap-3 mb-2">
                              <TrendingUp className="w-5 h-5" style={{ color: '#8B5CF6' }} />
                              <h3 className="text-sm font-medium" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
                                Taxa de Churn
                              </h3>
                            </div>
                            <p className="text-3xl font-bold" style={{ color: isDark ? '#FFFFFF' : '#111827' }}>
                              {billingData.canceledMetrics.churnRate.toFixed(1)}%
                            </p>
                            <p className="text-xs mt-1" style={{ color: colors.textSecondary }}>
                              Cancelamentos/Total
                            </p>
                          </div>

                          <div className="rounded-lg shadow-sm p-6 border" style={{
                            backgroundColor: isDark ? '#14181B' : '#FFFFFF',
                            borderColor: isDark ? '#1f2937' : '#E5E7EB'
                          }}>
                            <div className="flex items-center gap-3 mb-2">
                              <Activity className="w-5 h-5" style={{ color: '#3B82F6' }} />
                              <h3 className="text-sm font-medium" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
                                Tempo Médio
                              </h3>
                            </div>
                            <p className="text-3xl font-bold" style={{ color: isDark ? '#FFFFFF' : '#111827' }}>
                              {Math.round(billingData.canceledMetrics.averageTenureDays)} dias
                            </p>
                            <p className="text-xs mt-1" style={{ color: colors.textSecondary }}>
                              Antes do cancelamento
                            </p>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="rounded-lg shadow-sm p-6 border" style={{
                      backgroundColor: isDark ? '#14181B' : '#FFFFFF',
                      borderColor: isDark ? '#1f2937' : '#E5E7EB'
                    }}>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
                          {billingView === 'all' && 'Evolução de Receita'}
                          {billingView === 'subscriptions' && 'Evolução - Assinaturas'}
                          {billingView === 'tokens' && 'Evolução - Tokens Extras'}
                          {billingView === 'canceled' && 'Evolução - Cancelamentos'}
                        </h3>
                        <button
                          onClick={() => billingAnalyticsService.exportToCSV(billingData)}
                          className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors"
                          style={{ backgroundColor: isDark ? '#1f2937' : '#F3F4F6', color: colors.textSecondary }}
                        >
                          <Download className="w-4 h-4" />
                          Exportar CSV
                        </button>
                      </div>
                      <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={billingData.revenueData}>
                          <defs>
                            <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                              <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorSubs" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                              <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.8}/>
                              <stop offset="95%" stopColor="#F59E0B" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorCanceled" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#EF4444" stopOpacity={0.8}/>
                              <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#E5E7EB'} />
                          <XAxis
                            dataKey="date"
                            stroke={colors.textSecondary}
                            tick={{ fontSize: 12 }}
                          />
                          <YAxis
                            stroke={colors.textSecondary}
                            tick={{ fontSize: 12 }}
                            tickFormatter={(value) => billingAnalyticsService.formatCurrency(value)}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: isDark ? '#1f2937' : '#FFFFFF',
                              border: `1px solid ${isDark ? '#374151' : '#E5E7EB'}`,
                              borderRadius: '8px',
                              color: colors.textPrimary
                            }}
                            formatter={(value: any) => billingAnalyticsService.formatCurrency(value)}
                          />
                          <Legend />
                          {billingView === 'all' && (
                            <>
                              <Area
                                type="monotone"
                                dataKey="subscriptionRevenue"
                                stackId="1"
                                stroke="#10B981"
                                fill="#10B981"
                                fillOpacity={0.6}
                                name="Assinaturas"
                              />
                              <Area
                                type="monotone"
                                dataKey="tokenRevenue"
                                stackId="1"
                                stroke="#F59E0B"
                                fill="#F59E0B"
                                fillOpacity={0.6}
                                name="Tokens"
                              />
                            </>
                          )}
                          {billingView === 'subscriptions' && (
                            <Area
                              type="monotone"
                              dataKey="subscriptionRevenue"
                              stroke="#10B981"
                              fillOpacity={1}
                              fill="url(#colorSubs)"
                              name="Receita Assinaturas"
                            />
                          )}
                          {billingView === 'tokens' && (
                            <Area
                              type="monotone"
                              dataKey="tokenRevenue"
                              stroke="#F59E0B"
                              fillOpacity={1}
                              fill="url(#colorTokens)"
                              name="Receita Tokens"
                            />
                          )}
                          {billingView === 'canceled' && (
                            <Area
                              type="monotone"
                              dataKey="canceledRevenue"
                              stroke="#EF4444"
                              fillOpacity={1}
                              fill="url(#colorCanceled)"
                              name="Receita Cancelada"
                            />
                          )}
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    {(billingView === 'all' || billingView === 'subscriptions') && (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="rounded-lg shadow-sm p-6 border" style={{
                          backgroundColor: isDark ? '#14181B' : '#FFFFFF',
                          borderColor: isDark ? '#1f2937' : '#E5E7EB'
                        }}>
                          <h3 className="text-lg font-semibold mb-4" style={{ color: colors.textPrimary }}>
                            Distribuição por Plano
                          </h3>
                          <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                              <Pie
                                data={billingData.subscriptionMetrics.planBreakdown}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({planName, percentage}) => `${planName}: ${percentage.toFixed(1)}%`}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="count"
                              >
                                {billingData.subscriptionMetrics.planBreakdown.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'][index % 4]} />
                                ))}
                              </Pie>
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: isDark ? '#1f2937' : '#FFFFFF',
                                  border: `1px solid ${isDark ? '#374151' : '#E5E7EB'}`,
                                  borderRadius: '8px'
                                }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>

                        <div className="rounded-lg shadow-sm p-6 border" style={{
                          backgroundColor: isDark ? '#14181B' : '#FFFFFF',
                          borderColor: isDark ? '#1f2937' : '#E5E7EB'
                        }}>
                          <h3 className="text-lg font-semibold mb-4" style={{ color: colors.textPrimary }}>
                            Top Planos por Receita
                          </h3>
                          <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={billingData.subscriptionMetrics.planBreakdown}>
                              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#E5E7EB'} />
                              <XAxis
                                dataKey="planName"
                                stroke={colors.textSecondary}
                                tick={{ fontSize: 12 }}
                              />
                              <YAxis
                                stroke={colors.textSecondary}
                                tick={{ fontSize: 12 }}
                                tickFormatter={(value) => billingAnalyticsService.formatCurrency(value)}
                              />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: isDark ? '#1f2937' : '#FFFFFF',
                                  border: `1px solid ${isDark ? '#374151' : '#E5E7EB'}`,
                                  borderRadius: '8px'
                                }}
                                formatter={(value: any) => billingAnalyticsService.formatCurrency(value)}
                              />
                              <Bar dataKey="revenue" fill="#10B981" name="Receita" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}

                    {billingView === 'tokens' && (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="rounded-lg shadow-sm p-6 border" style={{
                          backgroundColor: isDark ? '#14181B' : '#FFFFFF',
                          borderColor: isDark ? '#1f2937' : '#E5E7EB'
                        }}>
                          <h3 className="text-lg font-semibold mb-4" style={{ color: colors.textPrimary }}>
                            Distribuição por Pacote
                          </h3>
                          <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                              <Pie
                                data={billingData.tokenMetrics.packageBreakdown}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({packageName, percentage}) => `${packageName}: ${percentage.toFixed(1)}%`}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="count"
                              >
                                {billingData.tokenMetrics.packageBreakdown.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={['#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'][index % 4]} />
                                ))}
                              </Pie>
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: isDark ? '#1f2937' : '#FFFFFF',
                                  border: `1px solid ${isDark ? '#374151' : '#E5E7EB'}`,
                                  borderRadius: '8px'
                                }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>

                        <div className="rounded-lg shadow-sm p-6 border" style={{
                          backgroundColor: isDark ? '#14181B' : '#FFFFFF',
                          borderColor: isDark ? '#1f2937' : '#E5E7EB'
                        }}>
                          <h3 className="text-lg font-semibold mb-4" style={{ color: colors.textPrimary }}>
                            Top Pacotes por Receita
                          </h3>
                          <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={billingData.tokenMetrics.packageBreakdown}>
                              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#E5E7EB'} />
                              <XAxis
                                dataKey="packageName"
                                stroke={colors.textSecondary}
                                tick={{ fontSize: 12 }}
                              />
                              <YAxis
                                stroke={colors.textSecondary}
                                tick={{ fontSize: 12 }}
                                tickFormatter={(value) => billingAnalyticsService.formatCurrency(value)}
                              />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: isDark ? '#1f2937' : '#FFFFFF',
                                  border: `1px solid ${isDark ? '#374151' : '#E5E7EB'}`,
                                  borderRadius: '8px'
                                }}
                                formatter={(value: any) => billingAnalyticsService.formatCurrency(value)}
                              />
                              <Bar dataKey="revenue" fill="#F59E0B" name="Receita" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}

                    {billingView === 'canceled' && (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="rounded-lg shadow-sm p-6 border" style={{
                          backgroundColor: isDark ? '#14181B' : '#FFFFFF',
                          borderColor: isDark ? '#1f2937' : '#E5E7EB'
                        }}>
                          <h3 className="text-lg font-semibold mb-4" style={{ color: colors.textPrimary }}>
                            Cancelamentos por Plano
                          </h3>
                          <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                              <Pie
                                data={billingData.canceledMetrics.canceledByPlan}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({planName, percentage}) => `${planName}: ${percentage.toFixed(1)}%`}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="count"
                              >
                                {billingData.canceledMetrics.canceledByPlan.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={['#EF4444', '#F59E0B', '#F97316', '#DC2626'][index % 4]} />
                                ))}
                              </Pie>
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: isDark ? '#1f2937' : '#FFFFFF',
                                  border: `1px solid ${isDark ? '#374151' : '#E5E7EB'}`,
                                  borderRadius: '8px'
                                }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>

                        <div className="rounded-lg shadow-sm p-6 border" style={{
                          backgroundColor: isDark ? '#14181B' : '#FFFFFF',
                          borderColor: isDark ? '#1f2937' : '#E5E7EB'
                        }}>
                          <h3 className="text-lg font-semibold mb-4" style={{ color: colors.textPrimary }}>
                            Receita Perdida por Plano
                          </h3>
                          <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={billingData.canceledMetrics.canceledByPlan}>
                              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#E5E7EB'} />
                              <XAxis
                                dataKey="planName"
                                stroke={colors.textSecondary}
                                tick={{ fontSize: 12 }}
                              />
                              <YAxis
                                stroke={colors.textSecondary}
                                tick={{ fontSize: 12 }}
                                tickFormatter={(value) => billingAnalyticsService.formatCurrency(value)}
                              />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: isDark ? '#1f2937' : '#FFFFFF',
                                  border: `1px solid ${isDark ? '#374151' : '#E5E7EB'}`,
                                  borderRadius: '8px'
                                }}
                                formatter={(value: any) => billingAnalyticsService.formatCurrency(value)}
                              />
                              <Bar dataKey="revenue" fill="#EF4444" name="Receita Perdida" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <FooterWis
          onNavigateToTerms={onNavigateToTerms}
          onNavigateToPrivacy={onNavigateToPrivacy}
          onNavigateToCookies={onNavigateToCookies}
        />
      </main>

      {isSearchOpen && (
        <IntelligentSearch
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
