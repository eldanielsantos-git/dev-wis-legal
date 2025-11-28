import React, { useState, useEffect } from 'react';
import { SidebarWis } from '../components/SidebarWis';
import { FooterWis } from '../components/FooterWis';
import { IntelligentSearch } from '../components/IntelligentSearch';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';
import { supabase } from '../lib/supabase';
import { CreditCard, Plus, Edit2, Save, X, Loader, AlertCircle, CheckCircle, Package, Award, Sparkles, Trash2 } from 'lucide-react';

interface AdminSubscriptionManagementPageProps {
  onNavigateToApp: () => void;
  onNavigateToMyProcess: () => void;
  onNavigateToChat?: () => void;
  onNavigateToWorkspace?: () => void;
  onNavigateToAdmin: () => void;
  onNavigateToSettings?: () => void;
  onNavigateToProfile?: () => void;
  onNavigateToTerms?: () => void;
  onNavigateToPrivacy?: () => void;
  onNavigateToCookies?: () => void;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string | null;
  stripe_product_id: string | null;
  stripe_price_id: string;
  checkout_url: string | null;
  price_brl: number;
  tokens_included: number;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

interface PlanBenefit {
  id: string;
  plan_id: string;
  benefit_text: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

interface TokenPackage {
  id: string;
  name: string;
  description: string | null;
  stripe_product_id: string | null;
  stripe_price_id: string;
  checkout_url: string | null;
  price_brl: number;
  tokens_amount: number;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export function AdminSubscriptionManagementPage({
  onNavigateToApp,
  onNavigateToMyProcess,
  onNavigateToChat,
  onNavigateToWorkspace,
  onNavigateToAdmin,
  onNavigateToSettings,
  onNavigateToProfile,
  onNavigateToTerms,
  onNavigateToPrivacy,
  onNavigateToCookies
}: AdminSubscriptionManagementPageProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [activeTab, setActiveTab] = useState<'plans' | 'benefits' | 'tokens'>('plans');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [benefits, setBenefits] = useState<PlanBenefit[]>([]);
  const [tokenPackages, setTokenPackages] = useState<TokenPackage[]>([]);
  const [selectedPlanForBenefits, setSelectedPlanForBenefits] = useState<string | null>(null);

  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [editingBenefit, setEditingBenefit] = useState<PlanBenefit | null>(null);
  const [editingToken, setEditingToken] = useState<TokenPackage | null>(null);

  const [isCreatingPlan, setIsCreatingPlan] = useState(false);
  const [isCreatingBenefit, setIsCreatingBenefit] = useState(false);
  const [isCreatingToken, setIsCreatingToken] = useState(false);

  useEffect(() => {
    console.log('[AdminSubscriptionManagementPage] Component mounted');
    window.scrollTo(0, 0);
    loadAllData();
  }, []);

  const loadAllData = async () => {
    console.log('[AdminSubscriptionManagementPage] Loading all data...');
    setIsLoading(true);
    await Promise.all([loadPlans(), loadBenefits(), loadTokenPackages()]);
    setIsLoading(false);
    console.log('[AdminSubscriptionManagementPage] All data loaded');
  };

  const loadPlans = async () => {
    try {
      console.log('[AdminSubscriptionManagementPage] Loading plans...');
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) {
        console.error('[AdminSubscriptionManagementPage] Plans error:', error);
        throw error;
      }
      console.log('[AdminSubscriptionManagementPage] Plans loaded:', data?.length || 0);
      setPlans(data || []);
    } catch (error: any) {
      console.error('[AdminSubscriptionManagementPage] Error loading plans:', error);
      setMessage({ type: 'error', text: 'Erro ao carregar planos' });
    }
  };

  const loadBenefits = async (planId?: string) => {
    try {
      console.log('[AdminSubscriptionManagementPage] Loading benefits for plan:', planId || 'all');
      let query = supabase
        .from('subscription_plan_benefits')
        .select('*')
        .order('display_order', { ascending: true });

      if (planId) {
        query = query.eq('plan_id', planId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[AdminSubscriptionManagementPage] Benefits error:', error);
        throw error;
      }
      console.log('[AdminSubscriptionManagementPage] Benefits loaded:', data?.length || 0);
      setBenefits(data || []);
    } catch (error: any) {
      console.error('Error loading benefits:', error);
      setMessage({ type: 'error', text: 'Erro ao carregar benefícios' });
    }
  };

  const loadTokenPackages = async () => {
    try {
      const { data, error } = await supabase
        .from('token_packages')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      setTokenPackages(data || []);
    } catch (error: any) {
      console.error('Error loading token packages:', error);
      setMessage({ type: 'error', text: 'Erro ao carregar pacotes de tokens' });
    }
  };

  const handleSavePlan = async (plan: SubscriptionPlan) => {
    try {
      const { error } = await supabase
        .from('subscription_plans')
        .update({
          name: plan.name,
          description: plan.description,
          stripe_product_id: plan.stripe_product_id,
          stripe_price_id: plan.stripe_price_id,
          checkout_url: plan.checkout_url,
          price_brl: plan.price_brl,
          tokens_included: plan.tokens_included,
          is_active: plan.is_active,
          display_order: plan.display_order,
          updated_at: new Date().toISOString()
        })
        .eq('id', plan.id);

      if (error) throw error;

      await loadPlans();
      setEditingPlan(null);
      setMessage({ type: 'success', text: 'Plano atualizado com sucesso!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      console.error('Error saving plan:', error);
      setMessage({ type: 'error', text: 'Erro ao salvar plano' });
    }
  };

  const handleSaveBenefit = async (benefit: PlanBenefit) => {
    try {
      const { error } = await supabase
        .from('subscription_plan_benefits')
        .update({
          benefit_text: benefit.benefit_text,
          is_active: benefit.is_active,
          display_order: benefit.display_order
        })
        .eq('id', benefit.id);

      if (error) throw error;

      await loadBenefits(selectedPlanForBenefits || undefined);
      setEditingBenefit(null);
      setMessage({ type: 'success', text: 'Benefício atualizado com sucesso!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      console.error('Error saving benefit:', error);
      setMessage({ type: 'error', text: 'Erro ao salvar benefício' });
    }
  };

  const handleSaveToken = async (token: TokenPackage) => {
    try {
      const { error } = await supabase
        .from('token_packages')
        .update({
          name: token.name,
          description: token.description,
          stripe_product_id: token.stripe_product_id,
          stripe_price_id: token.stripe_price_id,
          checkout_url: token.checkout_url,
          price_brl: token.price_brl,
          tokens_amount: token.tokens_amount,
          is_active: token.is_active,
          display_order: token.display_order,
          updated_at: new Date().toISOString()
        })
        .eq('id', token.id);

      if (error) throw error;

      await loadTokenPackages();
      setEditingToken(null);
      setMessage({ type: 'success', text: 'Pacote atualizado com sucesso!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      console.error('Error saving token package:', error);
      setMessage({ type: 'error', text: 'Erro ao salvar pacote' });
    }
  };

  const handleCreateBenefit = async () => {
    if (!selectedPlanForBenefits) {
      setMessage({ type: 'error', text: 'Selecione um plano primeiro' });
      return;
    }

    try {
      const maxOrder = benefits.reduce((max, b) => Math.max(max, b.display_order), 0);

      const { error } = await supabase
        .from('subscription_plan_benefits')
        .insert({
          plan_id: selectedPlanForBenefits,
          benefit_text: 'Novo benefício',
          is_active: true,
          display_order: maxOrder + 1
        });

      if (error) throw error;

      await loadBenefits(selectedPlanForBenefits);
      setIsCreatingBenefit(false);
      setMessage({ type: 'success', text: 'Benefício criado com sucesso!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      console.error('Error creating benefit:', error);
      setMessage({ type: 'error', text: 'Erro ao criar benefício' });
    }
  };

  const handleDeleteBenefit = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este benefício?')) return;

    try {
      const { error } = await supabase
        .from('subscription_plan_benefits')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await loadBenefits(selectedPlanForBenefits || undefined);
      setMessage({ type: 'success', text: 'Benefício excluído com sucesso!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      console.error('Error deleting benefit:', error);
      setMessage({ type: 'error', text: 'Erro ao excluir benefício' });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`;
    }
    return tokens.toLocaleString('pt-BR');
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen font-body" style={{ backgroundColor: colors.bgPrimary }}>
        <SidebarWis
          onNavigateToApp={onNavigateToApp}
          onNavigateToMyProcess={onNavigateToMyProcess}
          onNavigateToChat={onNavigateToChat}
          onNavigateToWorkspace={onNavigateToWorkspace}
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
        onNavigateToWorkspace={onNavigateToWorkspace}
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
        <main className="flex-1 p-4 sm:p-6 lg:p-8 w-full max-w-7xl mx-auto">
          <section className="mb-6 sm:mb-8 text-center">
            <div className="flex items-center justify-center gap-3 mb-2">
              <CreditCard className="w-8 h-8" style={{ color: colors.textPrimary }} />
              <h1 className="text-3xl sm:text-4xl font-title font-bold" style={{ color: colors.textPrimary }}>
                Gestão de Planos
              </h1>
            </div>
            <p className="text-sm sm:text-base text-gray-400">
              Configure planos de assinatura, benefícios e pacotes de tokens
            </p>
          </section>

          {message && (
            <div className="mb-6 p-4 rounded-lg flex items-center gap-3" style={{
              backgroundColor: message.type === 'success' ? (theme === 'dark' ? '#065f4620' : '#dcfce7') : (theme === 'dark' ? '#7f1d1d20' : '#fee2e2'),
              color: message.type === 'success' ? (theme === 'dark' ? '#4ade80' : '#15803d') : (theme === 'dark' ? '#f87171' : '#991b1b'),
              border: `1px solid ${message.type === 'success' ? (theme === 'dark' ? '#065f46' : '#86efac') : (theme === 'dark' ? '#7f1d1d' : '#fca5a5')}`
            }}>
              {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              <span>{message.text}</span>
            </div>
          )}

          <div className="mb-6 flex justify-center">
            <div className="inline-flex rounded-lg p-1 gap-1" style={{ backgroundColor: colors.bgSecondary }}>
              <button
                onClick={() => setActiveTab('plans')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 font-medium text-sm"
                style={{
                  backgroundColor: activeTab === 'plans' ? colors.bgPrimary : 'transparent',
                  color: activeTab === 'plans' ? colors.textPrimary : colors.textSecondary
                }}
              >
                <Package className="w-4 h-4" />
                <span>Planos</span>
              </button>
              <button
                onClick={() => setActiveTab('benefits')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 font-medium text-sm"
                style={{
                  backgroundColor: activeTab === 'benefits' ? colors.bgPrimary : 'transparent',
                  color: activeTab === 'benefits' ? colors.textPrimary : colors.textSecondary
                }}
              >
                <Award className="w-4 h-4" />
                <span>Benefícios</span>
              </button>
              <button
                onClick={() => setActiveTab('tokens')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 font-medium text-sm"
                style={{
                  backgroundColor: activeTab === 'tokens' ? colors.bgPrimary : 'transparent',
                  color: activeTab === 'tokens' ? colors.textPrimary : colors.textSecondary
                }}
              >
                <Sparkles className="w-4 h-4" />
                <span>Pacotes de Tokens</span>
              </button>
            </div>
          </div>

          {activeTab === 'plans' && (
            <div className="space-y-4">
              <div className="rounded-lg p-4" style={{ backgroundColor: colors.bgSecondary }}>
                <p className="text-sm" style={{ color: colors.textSecondary }}>
                  Os Stripe Price IDs não podem ser alterados. Para modificar preços ou tokens, ajuste os valores diretamente no banco de dados.
                </p>
              </div>

              {plans.map((plan) => (
                <div key={plan.id} className="rounded-lg p-6 shadow-lg" style={{ backgroundColor: colors.bgSecondary }}>
                  {editingPlan?.id === plan.id ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
                            Nome do Plano
                          </label>
                          <input
                            type="text"
                            value={editingPlan.name}
                            onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                            className="w-full px-4 py-2 rounded-lg"
                            style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary, border: `1px solid ${colors.border}` }}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
                            Stripe Product ID
                          </label>
                          <input
                            type="text"
                            value={editingPlan.stripe_product_id || ''}
                            onChange={(e) => setEditingPlan({ ...editingPlan, stripe_product_id: e.target.value })}
                            className="w-full px-4 py-2 rounded-lg"
                            style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary, border: `1px solid ${colors.border}` }}
                            placeholder="prod_XXXXXXXXXXXXX"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
                            Stripe Price ID
                          </label>
                          <input
                            type="text"
                            value={editingPlan.stripe_price_id}
                            onChange={(e) => setEditingPlan({ ...editingPlan, stripe_price_id: e.target.value })}
                            className="w-full px-4 py-2 rounded-lg"
                            style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary, border: `1px solid ${colors.border}` }}
                            placeholder="price_XXXXXXXXXXXXX"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
                            Link do Plano (Checkout URL)
                          </label>
                          <input
                            type="text"
                            value={editingPlan.checkout_url || ''}
                            onChange={(e) => setEditingPlan({ ...editingPlan, checkout_url: e.target.value })}
                            className="w-full px-4 py-2 rounded-lg"
                            style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary, border: `1px solid ${colors.border}` }}
                            placeholder="https://buy.stripe.com/..."
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
                          Descrição
                        </label>
                        <textarea
                          value={editingPlan.description || ''}
                          onChange={(e) => setEditingPlan({ ...editingPlan, description: e.target.value })}
                          rows={2}
                          className="w-full px-4 py-2 rounded-lg"
                          style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary, border: `1px solid ${colors.border}` }}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
                            Preço (R$)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={editingPlan.price_brl}
                            onChange={(e) => setEditingPlan({ ...editingPlan, price_brl: parseFloat(e.target.value) })}
                            className="w-full px-4 py-2 rounded-lg"
                            style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary, border: `1px solid ${colors.border}` }}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
                            Tokens Incluídos
                          </label>
                          <input
                            type="number"
                            value={editingPlan.tokens_included}
                            onChange={(e) => setEditingPlan({ ...editingPlan, tokens_included: parseInt(e.target.value) })}
                            className="w-full px-4 py-2 rounded-lg"
                            style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary, border: `1px solid ${colors.border}` }}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
                            Ordem de Exibição
                          </label>
                          <input
                            type="number"
                            value={editingPlan.display_order}
                            onChange={(e) => setEditingPlan({ ...editingPlan, display_order: parseInt(e.target.value) })}
                            className="w-full px-4 py-2 rounded-lg"
                            style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary, border: `1px solid ${colors.border}` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`active-${plan.id}`}
                          checked={editingPlan.is_active}
                          onChange={(e) => setEditingPlan({ ...editingPlan, is_active: e.target.checked })}
                          className="w-4 h-4"
                        />
                        <label htmlFor={`active-${plan.id}`} className="text-sm" style={{ color: colors.textSecondary }}>
                          Plano Ativo
                        </label>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSavePlan(editingPlan)}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
                          style={{ backgroundColor: '#10B981', color: '#FFFFFF' }}
                        >
                          <Save className="w-4 h-4" />
                          Salvar
                        </button>
                        <button
                          onClick={() => setEditingPlan(null)}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
                          style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary, border: `1px solid ${colors.border}` }}
                        >
                          <X className="w-4 h-4" />
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-bold" style={{ color: colors.textPrimary }}>{plan.name}</h3>
                          {!plan.is_active && (
                            <span className="px-2 py-1 rounded text-xs font-medium" style={{ backgroundColor: '#EF4444', color: '#FFFFFF' }}>
                              Inativo
                            </span>
                          )}
                        </div>
                        {plan.description && (
                          <p className="text-sm mb-3" style={{ color: colors.textSecondary }}>{plan.description}</p>
                        )}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                          <div>
                            <span className="block font-medium" style={{ color: colors.textSecondary }}>Preço</span>
                            <span className="text-lg font-bold" style={{ color: colors.textPrimary }}>{formatCurrency(plan.price_brl)}</span>
                          </div>
                          <div>
                            <span className="block font-medium" style={{ color: colors.textSecondary }}>Tokens</span>
                            <span className="text-lg font-bold" style={{ color: colors.textPrimary }}>{formatTokens(plan.tokens_included)}</span>
                          </div>
                          <div>
                            <span className="block font-medium" style={{ color: colors.textSecondary }}>Ordem</span>
                            <span className="text-lg font-bold" style={{ color: colors.textPrimary }}>{plan.display_order}</span>
                          </div>
                          <div>
                            <span className="block font-medium text-xs" style={{ color: colors.textSecondary }}>Product ID</span>
                            <span className="text-xs font-mono" style={{ color: colors.textPrimary }}>{plan.stripe_product_id || 'N/A'}</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                          <div>
                            <span className="block font-medium mb-1" style={{ color: colors.textSecondary }}>Price ID</span>
                            <span className="font-mono break-all" style={{ color: colors.textPrimary }}>{plan.stripe_price_id}</span>
                          </div>
                          {plan.checkout_url && (
                            <div>
                              <span className="block font-medium mb-1" style={{ color: colors.textSecondary }}>Checkout URL</span>
                              <a
                                href={plan.checkout_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-mono break-all hover:underline"
                                style={{ color: '#3B82F6' }}
                              >
                                {plan.checkout_url}
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => setEditingPlan(plan)}
                        className="ml-4 p-2 rounded-lg transition-colors hover:opacity-80"
                        style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary }}
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'benefits' && (
            <div className="space-y-4">
              <div className="rounded-lg p-4 mb-6" style={{ backgroundColor: colors.bgSecondary }}>
                <label className="block text-sm font-medium mb-3" style={{ color: colors.textPrimary }}>
                  Selecione o Plano para Gerenciar Benefícios
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {plans.map((plan) => (
                    <button
                      key={plan.id}
                      onClick={() => {
                        setSelectedPlanForBenefits(plan.id);
                        loadBenefits(plan.id);
                      }}
                      className="p-3 rounded-lg transition-all font-medium text-sm"
                      style={{
                        backgroundColor: selectedPlanForBenefits === plan.id ? '#10B981' : colors.bgPrimary,
                        color: selectedPlanForBenefits === plan.id ? '#FFFFFF' : colors.textPrimary,
                        border: `2px solid ${selectedPlanForBenefits === plan.id ? '#10B981' : colors.border}`
                      }}
                    >
                      {plan.name}
                    </button>
                  ))}
                </div>
              </div>

              {selectedPlanForBenefits ? (
                <>
                  <div className="flex justify-between items-center">
                    <p className="text-sm" style={{ color: colors.textSecondary }}>
                      Gerenciando benefícios do plano: <strong>{plans.find(p => p.id === selectedPlanForBenefits)?.name}</strong>
                    </p>
                    <button
                      onClick={handleCreateBenefit}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
                      style={{ backgroundColor: '#10B981', color: '#FFFFFF' }}
                    >
                      <Plus className="w-4 h-4" />
                      Novo Benefício
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-12 rounded-lg" style={{ backgroundColor: colors.bgSecondary }}>
                  <Package className="w-12 h-12 mx-auto mb-3 opacity-50" style={{ color: colors.textSecondary }} />
                  <p className="text-sm" style={{ color: colors.textSecondary }}>
                    Selecione um plano acima para gerenciar seus benefícios
                  </p>
                </div>
              )}

              {selectedPlanForBenefits && benefits.length === 0 && (
                <div className="text-center py-8 rounded-lg" style={{ backgroundColor: colors.bgSecondary }}>
                  <p className="text-sm" style={{ color: colors.textSecondary }}>
                    Nenhum benefício cadastrado para este plano
                  </p>
                </div>
              )}

              {benefits.map((benefit) => (
                <div key={benefit.id} className="rounded-lg p-4 shadow-lg" style={{ backgroundColor: colors.bgSecondary }}>
                  {editingBenefit?.id === benefit.id ? (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
                          Texto do Benefício
                        </label>
                        <input
                          type="text"
                          value={editingBenefit.benefit_text}
                          onChange={(e) => setEditingBenefit({ ...editingBenefit, benefit_text: e.target.value })}
                          className="w-full px-4 py-2 rounded-lg"
                          style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary, border: `1px solid ${colors.border}` }}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={`benefit-active-${benefit.id}`}
                              checked={editingBenefit.is_active}
                              onChange={(e) => setEditingBenefit({ ...editingBenefit, is_active: e.target.checked })}
                              className="w-4 h-4"
                            />
                            <label htmlFor={`benefit-active-${benefit.id}`} className="text-sm" style={{ color: colors.textSecondary }}>
                              Ativo
                            </label>
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-sm" style={{ color: colors.textSecondary }}>Ordem:</label>
                            <input
                              type="number"
                              value={editingBenefit.display_order}
                              onChange={(e) => setEditingBenefit({ ...editingBenefit, display_order: parseInt(e.target.value) })}
                              className="w-20 px-2 py-1 rounded"
                              style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary, border: `1px solid ${colors.border}` }}
                            />
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveBenefit(editingBenefit)}
                            className="flex items-center gap-2 px-3 py-1 rounded-lg transition-colors"
                            style={{ backgroundColor: '#10B981', color: '#FFFFFF' }}
                          >
                            <Save className="w-4 h-4" />
                            Salvar
                          </button>
                          <button
                            onClick={() => setEditingBenefit(null)}
                            className="flex items-center gap-2 px-3 py-1 rounded-lg transition-colors"
                            style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary, border: `1px solid ${colors.border}` }}
                          >
                            <X className="w-4 h-4" />
                            Cancelar
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium" style={{ color: colors.textSecondary }}>#{benefit.display_order}</span>
                        <span className="text-sm" style={{ color: colors.textPrimary }}>{benefit.benefit_text}</span>
                        {!benefit.is_active && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: '#EF4444', color: '#FFFFFF' }}>
                            Inativo
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingBenefit(benefit)}
                          className="p-2 rounded-lg transition-colors hover:opacity-80"
                          style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary }}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteBenefit(benefit.id)}
                          className="p-2 rounded-lg transition-colors hover:opacity-80"
                          style={{ backgroundColor: '#EF4444', color: '#FFFFFF' }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'tokens' && (
            <div className="space-y-4">
              <div className="rounded-lg p-4" style={{ backgroundColor: colors.bgSecondary }}>
                <p className="text-sm" style={{ color: colors.textSecondary }}>
                  Pacotes de tokens disponíveis para compra avulsa. Os Stripe Price IDs não podem ser alterados.
                </p>
              </div>

              {tokenPackages.map((token) => (
                <div key={token.id} className="rounded-lg p-6 shadow-lg" style={{ backgroundColor: colors.bgSecondary }}>
                  {editingToken?.id === token.id ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
                            Nome do Pacote
                          </label>
                          <input
                            type="text"
                            value={editingToken.name}
                            onChange={(e) => setEditingToken({ ...editingToken, name: e.target.value })}
                            className="w-full px-4 py-2 rounded-lg"
                            style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary, border: `1px solid ${colors.border}` }}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
                            Stripe Product ID
                          </label>
                          <input
                            type="text"
                            value={editingToken.stripe_product_id || ''}
                            onChange={(e) => setEditingToken({ ...editingToken, stripe_product_id: e.target.value })}
                            className="w-full px-4 py-2 rounded-lg"
                            style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary, border: `1px solid ${colors.border}` }}
                            placeholder="prod_XXXXXXXXXXXXX"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
                            Stripe Price ID
                          </label>
                          <input
                            type="text"
                            value={editingToken.stripe_price_id}
                            onChange={(e) => setEditingToken({ ...editingToken, stripe_price_id: e.target.value })}
                            className="w-full px-4 py-2 rounded-lg"
                            style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary, border: `1px solid ${colors.border}` }}
                            placeholder="price_XXXXXXXXXXXXX"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
                            Link do Plano (Checkout URL)
                          </label>
                          <input
                            type="text"
                            value={editingToken.checkout_url || ''}
                            onChange={(e) => setEditingToken({ ...editingToken, checkout_url: e.target.value })}
                            className="w-full px-4 py-2 rounded-lg"
                            style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary, border: `1px solid ${colors.border}` }}
                            placeholder="https://buy.stripe.com/..."
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
                          Descrição
                        </label>
                        <textarea
                          value={editingToken.description || ''}
                          onChange={(e) => setEditingToken({ ...editingToken, description: e.target.value })}
                          rows={2}
                          className="w-full px-4 py-2 rounded-lg"
                          style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary, border: `1px solid ${colors.border}` }}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
                            Preço (R$)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={editingToken.price_brl}
                            onChange={(e) => setEditingToken({ ...editingToken, price_brl: parseFloat(e.target.value) })}
                            className="w-full px-4 py-2 rounded-lg"
                            style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary, border: `1px solid ${colors.border}` }}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
                            Quantidade de Tokens
                          </label>
                          <input
                            type="number"
                            value={editingToken.tokens_amount}
                            onChange={(e) => setEditingToken({ ...editingToken, tokens_amount: parseInt(e.target.value) })}
                            className="w-full px-4 py-2 rounded-lg"
                            style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary, border: `1px solid ${colors.border}` }}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
                            Ordem de Exibição
                          </label>
                          <input
                            type="number"
                            value={editingToken.display_order}
                            onChange={(e) => setEditingToken({ ...editingToken, display_order: parseInt(e.target.value) })}
                            className="w-full px-4 py-2 rounded-lg"
                            style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary, border: `1px solid ${colors.border}` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`token-active-${token.id}`}
                          checked={editingToken.is_active}
                          onChange={(e) => setEditingToken({ ...editingToken, is_active: e.target.checked })}
                          className="w-4 h-4"
                        />
                        <label htmlFor={`token-active-${token.id}`} className="text-sm" style={{ color: colors.textSecondary }}>
                          Pacote Ativo
                        </label>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveToken(editingToken)}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
                          style={{ backgroundColor: '#10B981', color: '#FFFFFF' }}
                        >
                          <Save className="w-4 h-4" />
                          Salvar
                        </button>
                        <button
                          onClick={() => setEditingToken(null)}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
                          style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary, border: `1px solid ${colors.border}` }}
                        >
                          <X className="w-4 h-4" />
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-bold" style={{ color: colors.textPrimary }}>{token.name}</h3>
                          {!token.is_active && (
                            <span className="px-2 py-1 rounded text-xs font-medium" style={{ backgroundColor: '#EF4444', color: '#FFFFFF' }}>
                              Inativo
                            </span>
                          )}
                        </div>
                        {token.description && (
                          <p className="text-sm mb-3" style={{ color: colors.textSecondary }}>{token.description}</p>
                        )}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                          <div>
                            <span className="block font-medium" style={{ color: colors.textSecondary }}>Preço</span>
                            <span className="text-lg font-bold" style={{ color: colors.textPrimary }}>{formatCurrency(token.price_brl)}</span>
                          </div>
                          <div>
                            <span className="block font-medium" style={{ color: colors.textSecondary }}>Tokens</span>
                            <span className="text-lg font-bold" style={{ color: colors.textPrimary }}>{formatTokens(token.tokens_amount)}</span>
                          </div>
                          <div>
                            <span className="block font-medium" style={{ color: colors.textSecondary }}>Ordem</span>
                            <span className="text-lg font-bold" style={{ color: colors.textPrimary }}>{token.display_order}</span>
                          </div>
                          <div>
                            <span className="block font-medium text-xs" style={{ color: colors.textSecondary }}>Product ID</span>
                            <span className="text-xs font-mono" style={{ color: colors.textPrimary }}>{token.stripe_product_id || 'N/A'}</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                          <div>
                            <span className="block font-medium mb-1" style={{ color: colors.textSecondary }}>Price ID</span>
                            <span className="font-mono break-all" style={{ color: colors.textPrimary }}>{token.stripe_price_id}</span>
                          </div>
                          {token.checkout_url && (
                            <div>
                              <span className="block font-medium mb-1" style={{ color: colors.textSecondary }}>Checkout URL</span>
                              <a
                                href={token.checkout_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-mono break-all hover:underline"
                                style={{ color: '#3B82F6' }}
                              >
                                {token.checkout_url}
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => setEditingToken(token)}
                        className="ml-4 p-2 rounded-lg transition-colors hover:opacity-80"
                        style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary }}
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </main>
        <FooterWis
          onNavigateToTerms={onNavigateToTerms}
          onNavigateToPrivacy={onNavigateToPrivacy}
          onNavigateToCookies={onNavigateToCookies}
        />
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
    </div>
  );
}
