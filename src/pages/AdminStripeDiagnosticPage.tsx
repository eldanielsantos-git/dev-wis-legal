import React, { useState } from 'react';
import { SidebarWis } from '../components/SidebarWis';
import { FooterWis } from '../components/FooterWis';
import { IntelligentSearch } from '../components/IntelligentSearch';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';
import { CreditCard, RefreshCw, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AdminStripeDiagnosticPageProps {
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

interface DiagnosticResult {
  email: string;
  database: {
    customer_id: string;
    subscription_id: string | null;
    status: string;
    price_id: string | null;
    tokens_total: number;
    tokens_used: number;
    extra_tokens: number;
  };
  stripe: {
    has_customer: boolean;
    has_subscription: boolean;
    subscription_id?: string;
    status?: string;
    price_id?: string;
    current_period_start?: number;
    current_period_end?: number;
  };
  sync_needed: boolean;
  issues: string[];
}

interface DiagnosticResponse {
  message: string;
  total_users: number;
  users_with_issues: number;
  diagnostics: DiagnosticResult[];
}

export function AdminStripeDiagnosticPage({
  onNavigateToApp,
  onNavigateToMyProcess,
  onNavigateToChat, onNavigateToWorkspace,
  onNavigateToAdmin,
  onNavigateToProfile,
  onNavigateToTerms,
  onNavigateToPrivacy,
  onNavigateToCookies
}: AdminStripeDiagnosticPageProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [smartSyncing, setSmartSyncing] = useState(false);
  const [syncingExtraTokens, setSyncingExtraTokens] = useState(false);
  const [reconcilingOrphans, setReconcilingOrphans] = useState(false);
  const [diagnosticData, setDiagnosticData] = useState<DiagnosticResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [extraTokensSyncResult, setExtraTokensSyncResult] = useState<any>(null);
  const [orphanReconciliationResult, setOrphanReconciliationResult] = useState<any>(null);
  const [fixingCustomer, setFixingCustomer] = useState<string | null>(null);

  const runDiagnostic = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Sessão não encontrada. Faça login novamente.');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/diagnose-stripe-sync`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao executar diagnóstico');
      }

      const data: DiagnosticResponse = await response.json();
      setDiagnosticData(data);
    } catch (err: any) {
      setError(err.message || 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const syncAllSubscriptions = async () => {
    setSyncing(true);
    setError(null);
    setSyncResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Sessão não encontrada. Faça login novamente.');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-all-stripe-subscriptions`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao sincronizar assinaturas');
      }

      const data = await response.json();
      setSyncResult(data);

      await runDiagnostic();
    } catch (err: any) {
      setError(err.message || 'Erro desconhecido');
    } finally {
      setSyncing(false);
    }
  };

  const smartSyncSubscriptions = async () => {
    setSmartSyncing(true);
    setError(null);
    setSyncResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Sessão não encontrada. Faça login novamente.');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/smart-sync-stripe-subscriptions`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao sincronizar assinaturas');
      }

      const data = await response.json();
      setSyncResult(data);

      await runDiagnostic();
    } catch (err: any) {
      setError(err.message || 'Erro desconhecido');
    } finally {
      setSmartSyncing(false);
    }
  };

  const fixSingleCustomer = async (customerId: string) => {
    console.log(`[fixSingleCustomer] Iniciando correção para: ${customerId}`);
    setFixingCustomer(customerId);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('[fixSingleCustomer] Sessão não encontrada');
        setError('Sessão não encontrada. Faça login novamente.');
        setFixingCustomer(null);
        return;
      }

      console.log(`[fixSingleCustomer] Sessão obtida, chamando edge function...`);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-stripe-subscription`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ customer_id: customerId }),
        }
      );

      console.log(`[fixSingleCustomer] Resposta recebida. Status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[fixSingleCustomer] Erro na resposta:', errorText);
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        throw new Error(errorData.error || `Erro ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log('[fixSingleCustomer] Sincronização concluída com sucesso:', result);

      console.log('[fixSingleCustomer] Aguardando 1.5 segundos antes de recarregar diagnóstico...');
      await new Promise(resolve => setTimeout(resolve, 1500));

      console.log('[fixSingleCustomer] Recarregando diagnóstico...');
      await runDiagnostic();
      console.log('[fixSingleCustomer] Diagnóstico recarregado com sucesso');
    } catch (err: any) {
      console.error('[fixSingleCustomer] Erro ao corrigir customer:', err);
      setError(`Erro ao corrigir ${customerId}: ${err.message || 'Erro desconhecido'}`);
    } finally {
      console.log('[fixSingleCustomer] Finalizando, removendo loading...');
      setFixingCustomer(null);
    }
  };

  const syncExtraTokens = async () => {
    setSyncingExtraTokens(true);
    setError(null);
    setExtraTokensSyncResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Sessão não encontrada. Faça login novamente.');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-stripe-extra-tokens`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao sincronizar tokens extras');
      }

      const data = await response.json();
      setExtraTokensSyncResult(data);

      await runDiagnostic();
    } catch (err: any) {
      setError(err.message || 'Erro desconhecido');
    } finally {
      setSyncingExtraTokens(false);
    }
  };

  const reconcileOrphanSubscriptions = async () => {
    setReconcilingOrphans(true);
    setError(null);
    setOrphanReconciliationResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Sessão não encontrada. Faça login novamente.');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reconcile-orphan-subscriptions`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao reconciliar órfãs');
      }

      const data = await response.json();
      setOrphanReconciliationResult(data);

      await runDiagnostic();
    } catch (err: any) {
      setError(err.message || 'Erro desconhecido');
    } finally {
      setReconcilingOrphans(false);
    }
  };

  const getPlanName = (priceId: string | null | undefined) => {
    if (!priceId) return 'Nenhum';
    const plans: Record<string, string> = {
      'price_1SG3zEJrr43cGTt4oUj89h9u': 'Básico (1.2M)',
      'price_1SG40ZJrr43cGTt4SGCX0JUZ': 'Intermediário (4M)',
      'price_1SG41xJrr43cGTt4MQwqdEiv': 'Avançado (8M)',
      'price_1SG43JJrr43cGTt4URQn0TxZ': 'Enterprise (20M)',
    };
    return plans[priceId] || priceId;
  };

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

      <main className={`flex-1 flex flex-col transition-all duration-300 pt-16 lg:pt-0 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
        <div className="flex-1 px-4 sm:px-6 py-6 sm:py-8">
          <div className="max-w-5xl mx-auto">
            <div className="flex flex-col items-center mb-6 sm:mb-8 max-w-2xl mx-auto">
              <div className="p-2 sm:p-3 rounded-lg mb-3 sm:mb-4" style={{ backgroundColor: colors.bgSecondary }}>
                <CreditCard className="w-6 h-6 sm:w-8 sm:h-8" style={{ color: '#EF4444' }} />
              </div>
              <div className="text-center">
                <h1 className="text-2xl sm:text-3xl font-title font-bold" style={{ color: colors.textPrimary }}>
                  Diagnóstico Stripe
                </h1>
                <p className="text-xs sm:text-sm mt-1 px-4 sm:px-0" style={{ color: colors.textSecondary }}>
                  Verifique a sincronização entre Stripe e banco de dados
                </p>
              </div>
            </div>

            <div className="mb-6 flex flex-wrap gap-2 justify-center">
              <button
                onClick={runDiagnostic}
                disabled={loading || syncing || smartSyncing || syncingExtraTokens || reconcilingOrphans}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ backgroundColor: '#EF4444', color: '#FFFFFF' }}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Executando...' : 'Executar Diagnóstico'}
              </button>
              <button
                onClick={smartSyncSubscriptions}
                disabled={loading || syncing || smartSyncing || syncingExtraTokens || reconcilingOrphans}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ backgroundColor: '#3B82F6', color: '#FFFFFF' }}
              >
                <RefreshCw className={`w-4 h-4 ${smartSyncing ? 'animate-spin' : ''}`} />
                {smartSyncing ? 'Sincronizando...' : 'Sincronizar Inteligente'}
              </button>
              <button
                onClick={syncAllSubscriptions}
                disabled={loading || syncing || smartSyncing || syncingExtraTokens || reconcilingOrphans}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ backgroundColor: '#10B981', color: '#FFFFFF' }}
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Sincronizando...' : 'Forçar Sincronização Total'}
              </button>
              <button
                onClick={syncExtraTokens}
                disabled={loading || syncing || smartSyncing || syncingExtraTokens || reconcilingOrphans}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ backgroundColor: '#F59E0B', color: '#FFFFFF' }}
              >
                <RefreshCw className={`w-4 h-4 ${syncingExtraTokens ? 'animate-spin' : ''}`} />
                {syncingExtraTokens ? 'Sincronizando...' : 'Sincronizar Tokens Extras do Stripe'}
              </button>
              <button
                onClick={reconcileOrphanSubscriptions}
                disabled={loading || syncing || smartSyncing || syncingExtraTokens || reconcilingOrphans}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ backgroundColor: '#8B5CF6', color: '#FFFFFF' }}
              >
                <RefreshCw className={`w-4 h-4 ${reconcilingOrphans ? 'animate-spin' : ''}`} />
                {reconcilingOrphans ? 'Reconciliando...' : 'Reconciliar Subscriptions Órfãs'}
              </button>
            </div>

            {orphanReconciliationResult && (
              <div className="mb-6 p-4 rounded-lg border-2 border-purple-500" style={{ backgroundColor: colors.bgSecondary }}>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-bold text-purple-500 mb-2">Reconciliação de Órfãs Concluída</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                      <div>
                        <div className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
                          {orphanReconciliationResult.summary.total_orphans}
                        </div>
                        <div className="text-xs" style={{ color: colors.textSecondary }}>Órfãs Encontradas</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-green-500">
                          {orphanReconciliationResult.summary.reconciled}
                        </div>
                        <div className="text-xs" style={{ color: colors.textSecondary }}>Reconciliadas</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-yellow-500">
                          {orphanReconciliationResult.summary.no_match}
                        </div>
                        <div className="text-xs" style={{ color: colors.textSecondary }}>Sem Match</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-red-500">
                          {orphanReconciliationResult.summary.errors}
                        </div>
                        <div className="text-xs" style={{ color: colors.textSecondary }}>Erros</div>
                      </div>
                    </div>
                    {orphanReconciliationResult.reconciled && orphanReconciliationResult.reconciled.length > 0 && (
                      <div className="pt-3 border-t" style={{ borderColor: colors.border }}>
                        <div className="text-xs font-semibold mb-2" style={{ color: colors.textSecondary }}>
                          Órfãs Reconciliadas:
                        </div>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {orphanReconciliationResult.reconciled.map((item: any, idx: number) => (
                            <div key={idx} className="text-xs p-2 rounded" style={{ backgroundColor: theme === 'dark' ? '#1F2229' : '#F9FAFB' }}>
                              <div className="font-bold" style={{ color: colors.textPrimary }}>
                                {item.customer_id}
                              </div>
                              <div style={{ color: colors.textSecondary }}>
                                Email: {item.email} → User ID: {item.user_id}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {extraTokensSyncResult && (
              <div className="mb-6 p-4 rounded-lg border-2 border-orange-500" style={{ backgroundColor: colors.bgSecondary }}>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-bold text-orange-500 mb-2">Sincronização de Tokens Extras Concluída</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                      <div>
                        <div className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
                          {extraTokensSyncResult.summary.total_customers}
                        </div>
                        <div className="text-xs" style={{ color: colors.textSecondary }}>Total Clientes</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-green-500">
                          {extraTokensSyncResult.summary.customers_with_purchases}
                        </div>
                        <div className="text-xs" style={{ color: colors.textSecondary }}>Com Compras</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-orange-500">
                          {(extraTokensSyncResult.summary.total_extra_tokens_synced / 1000000).toFixed(1)}M
                        </div>
                        <div className="text-xs" style={{ color: colors.textSecondary }}>Tokens Sincronizados</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-red-500">
                          {extraTokensSyncResult.summary.errors}
                        </div>
                        <div className="text-xs" style={{ color: colors.textSecondary }}>Erros</div>
                      </div>
                    </div>
                    {extraTokensSyncResult.details && extraTokensSyncResult.details.length > 0 && (
                      <div className="pt-3 border-t" style={{ borderColor: colors.border }}>
                        <div className="text-xs font-semibold mb-2" style={{ color: colors.textSecondary }}>
                          Detalhes das Compras:
                        </div>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {extraTokensSyncResult.details.map((detail: any, idx: number) => (
                            <div key={idx} className="text-xs p-2 rounded" style={{ backgroundColor: theme === 'dark' ? '#1F2229' : '#F9FAFB' }}>
                              <div className="font-bold" style={{ color: colors.textPrimary }}>
                                {detail.customer_id}
                              </div>
                              <div style={{ color: colors.textSecondary }}>
                                Tokens: {detail.previous_extra_tokens.toLocaleString()} → {detail.new_extra_tokens.toLocaleString()}
                              </div>
                              <div style={{ color: colors.textSecondary }}>
                                {detail.purchases.length} compra(s) encontrada(s)
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {syncResult && (
              <div className="mb-6 p-4 rounded-lg border-2 border-green-500" style={{ backgroundColor: colors.bgSecondary }}>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-bold text-green-500 mb-2">Sincronização Concluída</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                      <div>
                        <div className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
                          {syncResult.summary.total}
                        </div>
                        <div className="text-xs" style={{ color: colors.textSecondary }}>Total</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-green-500">
                          {syncResult.summary.synced || syncResult.summary.success || 0}
                        </div>
                        <div className="text-xs" style={{ color: colors.textSecondary }}>Sincronizados</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-blue-500">
                          {syncResult.summary.skipped || syncResult.summary.no_subscription || 0}
                        </div>
                        <div className="text-xs" style={{ color: colors.textSecondary }}>Ignorados</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-red-500">
                          {syncResult.summary.errors}
                        </div>
                        <div className="text-xs" style={{ color: colors.textSecondary }}>Erros</div>
                      </div>
                    </div>
                    {syncResult.summary.by_action && (
                      <div className="pt-3 border-t" style={{ borderColor: colors.border }}>
                        <div className="text-xs font-semibold mb-2" style={{ color: colors.textSecondary }}>
                          Detalhes das Ações:
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                          <div>
                            <span className="font-bold" style={{ color: colors.textPrimary }}>
                              {syncResult.summary.by_action.created}
                            </span>
                            <span style={{ color: colors.textSecondary }}> Criadas</span>
                          </div>
                          <div>
                            <span className="font-bold" style={{ color: colors.textPrimary }}>
                              {syncResult.summary.by_action.updated}
                            </span>
                            <span style={{ color: colors.textSecondary }}> Atualizadas</span>
                          </div>
                          <div>
                            <span className="font-bold" style={{ color: colors.textPrimary }}>
                              {syncResult.summary.by_action.reset_tokens}
                            </span>
                            <span style={{ color: colors.textSecondary }}> Tokens Reset</span>
                          </div>
                          <div>
                            <span className="font-bold" style={{ color: colors.textPrimary }}>
                              {syncResult.summary.by_action.upgraded}
                            </span>
                            <span style={{ color: colors.textSecondary }}> Upgrades</span>
                          </div>
                          <div>
                            <span className="font-bold" style={{ color: colors.textPrimary }}>
                              {syncResult.summary.by_action.skipped}
                            </span>
                            <span style={{ color: colors.textSecondary }}> Sem Mudanças</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="mb-6 p-4 rounded-lg border-2 border-red-500" style={{ backgroundColor: colors.bgSecondary }}>
                <div className="flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-bold text-red-500 mb-1">Erro</h3>
                    <p className="text-sm" style={{ color: colors.textSecondary }}>{error}</p>
                  </div>
                </div>
              </div>
            )}

            {diagnosticData && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  <div className="p-4 rounded-lg" style={{ backgroundColor: colors.bgSecondary }}>
                    <div className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
                      {diagnosticData.total_users}
                    </div>
                    <div className="text-sm" style={{ color: colors.textSecondary }}>
                      Total de Usuários
                    </div>
                  </div>
                  <div className="p-4 rounded-lg" style={{ backgroundColor: colors.bgSecondary }}>
                    <div className="text-2xl font-bold text-red-500">
                      {diagnosticData.users_with_issues}
                    </div>
                    <div className="text-sm" style={{ color: colors.textSecondary }}>
                      Com Problemas
                    </div>
                  </div>
                  <div className="p-4 rounded-lg" style={{ backgroundColor: colors.bgSecondary }}>
                    <div className="text-2xl font-bold text-green-500">
                      {diagnosticData.total_users - diagnosticData.users_with_issues}
                    </div>
                    <div className="text-sm" style={{ color: colors.textSecondary }}>
                      Sincronizados
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {diagnosticData.diagnostics
                    .filter(diagnostic => diagnostic.sync_needed)
                    .map((diagnostic, index) => (
                    <div
                      key={index}
                      className="p-4 rounded-lg border"
                      style={{
                        backgroundColor: colors.bgSecondary,
                        borderColor: diagnostic.sync_needed ? '#EF4444' : '#10B981',
                      }}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          {diagnostic.sync_needed ? (
                            <XCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
                          ) : (
                            <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
                          )}
                          <div>
                            <h3 className="font-bold" style={{ color: colors.textPrimary }}>
                              {diagnostic.email}
                            </h3>
                            <p className="text-sm" style={{ color: colors.textSecondary }}>
                              Customer ID: {diagnostic.database.customer_id}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <h4 className="text-sm font-bold mb-2" style={{ color: colors.textPrimary }}>
                            Banco de Dados
                          </h4>
                          <div className="text-sm space-y-1" style={{ color: colors.textSecondary }}>
                            <div>Status: <span className="font-medium">{diagnostic.database.status}</span></div>
                            <div>Plano: <span className="font-medium">{getPlanName(diagnostic.database.price_id)}</span></div>
                            <div>Tokens: <span className="font-medium">{diagnostic.database.tokens_total.toLocaleString()}</span></div>
                            <div>Tokens Usados: <span className="font-medium">{diagnostic.database.tokens_used.toLocaleString()}</span></div>
                            <div>Tokens Extras: <span className="font-medium text-green-500">{diagnostic.database.extra_tokens?.toLocaleString() || 0}</span></div>
                            <div>Total Disponível: <span className="font-bold text-blue-500">{((diagnostic.database.tokens_total + (diagnostic.database.extra_tokens || 0)) - diagnostic.database.tokens_used).toLocaleString()}</span></div>
                            <div>Subscription ID: <span className="font-mono text-xs">{diagnostic.database.subscription_id || 'N/A'}</span></div>
                          </div>
                        </div>

                        <div>
                          <h4 className="text-sm font-bold mb-2" style={{ color: colors.textPrimary }}>
                            Stripe
                          </h4>
                          <div className="text-sm space-y-1" style={{ color: colors.textSecondary }}>
                            <div>Customer: <span className="font-medium">{diagnostic.stripe.has_customer ? 'Existe' : 'Não existe'}</span></div>
                            <div>Subscription: <span className="font-medium">{diagnostic.stripe.has_subscription ? 'Existe' : 'Não existe'}</span></div>
                            {diagnostic.stripe.has_subscription && (
                              <>
                                <div>Status: <span className="font-medium">{diagnostic.stripe.status}</span></div>
                                <div>Plano: <span className="font-medium">{getPlanName(diagnostic.stripe.price_id)}</span></div>
                                <div>Subscription ID: <span className="font-mono text-xs">{diagnostic.stripe.subscription_id}</span></div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {diagnostic.issues.length > 0 && (
                        <div className="mt-4 p-3 rounded-lg" style={{ backgroundColor: theme === 'dark' ? '#1F2229' : '#FEF2F2' }}>
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="text-sm font-bold text-red-500">Problemas Encontrados:</h4>
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    console.log(`[Button Click] Customer ID: ${diagnostic.database.customer_id}`);
                                    fixSingleCustomer(diagnostic.database.customer_id);
                                  }}
                                  disabled={fixingCustomer === diagnostic.database.customer_id || !diagnostic.database.customer_id}
                                  className="px-3 py-1 text-xs font-medium rounded-lg transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                  style={{ backgroundColor: '#EF4444', color: '#FFFFFF' }}
                                >
                                  <RefreshCw className={`w-3 h-3 ${fixingCustomer === diagnostic.database.customer_id ? 'animate-spin' : ''}`} />
                                  {fixingCustomer === diagnostic.database.customer_id ? 'Corrigindo...' : 'Corrigir Problema'}
                                </button>
                              </div>
                              <ul className="text-sm space-y-1" style={{ color: colors.textSecondary }}>
                                {diagnostic.issues.map((issue, idx) => (
                                  <li key={idx} className="flex items-start">
                                    <span className="mr-2">•</span>
                                    <span>{issue}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
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
