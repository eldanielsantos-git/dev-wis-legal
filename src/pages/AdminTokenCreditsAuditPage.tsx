import { useEffect, useState } from 'react';
import { SidebarWis } from '../components/SidebarWis';
import { FooterWis } from '../components/FooterWis';
import { IntelligentSearch } from '../components/IntelligentSearch';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';
import { FileText, CheckCircle, XCircle, AlertCircle, Clock, RefreshCw, ArrowLeft } from 'lucide-react';

interface TokenCreditAudit {
  id: number;
  event_id: string | null;
  event_type: string;
  customer_id: string;
  checkout_session_id: string | null;
  price_id: string | null;
  tokens_amount: number;
  operation: string;
  status: string;
  error_message: string | null;
  subscription_found: boolean;
  before_plan_tokens: number | null;
  before_extra_tokens: number | null;
  before_tokens_total: number | null;
  after_plan_tokens: number | null;
  after_extra_tokens: number | null;
  after_tokens_total: number | null;
  processing_time_ms: number | null;
  metadata: any;
  created_at: string;
}

interface AdminTokenCreditsAuditPageProps {
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

export function AdminTokenCreditsAuditPage({
  onNavigateToApp,
  onNavigateToMyProcess,
  onNavigateToChat, onNavigateToWorkspace,
  onNavigateToAdmin,
  onNavigateToProfile,
  onNavigateToTerms,
  onNavigateToPrivacy,
  onNavigateToCookies
}: AdminTokenCreditsAuditPageProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [audits, setAudits] = useState<TokenCreditAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    loadAudits();
  }, []);

  useEffect(() => {
    loadAudits();
  }, [filter]);

  const loadAudits = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('token_credits_audit')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setAudits(data || []);
    } catch (error) {
      console.error('Error loading audits:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'skipped':
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'skipped':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatTokens = (tokens: number | null): string => {
    if (tokens === null) return 'N/A';
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
    return tokens.toString();
  };

  const stats = {
    total: audits.length,
    success: audits.filter(a => a.status === 'success').length,
    failed: audits.filter(a => a.status === 'failed').length,
    skipped: audits.filter(a => a.status === 'skipped').length,
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
          <button
            onClick={() => {
              window.history.pushState({}, '', '/profile#admin');
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors mb-6 hover:opacity-80 max-w-6xl"
            style={{
              backgroundColor: colors.bgSecondary,
              color: colors.textPrimary
            }}
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Voltar ao Painel</span>
          </button>

          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col items-center mb-6 sm:mb-8">
              <div className="p-2 sm:p-3 rounded-lg mb-3 sm:mb-4" style={{ backgroundColor: colors.bgSecondary }}>
                <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
              </div>
              <div className="text-center">
                <h1 className="text-2xl sm:text-3xl font-title font-bold" style={{ color: colors.textPrimary }}>
                  Auditoria de Créditos de Tokens
                </h1>
                <p className="text-xs sm:text-sm mt-1 px-4 sm:px-0" style={{ color: colors.textSecondary }}>
                  Rastreamento completo de todas as tentativas de crédito de tokens
                </p>
              </div>
            </div>

            <div className="mb-6">
              <button
                onClick={loadAudits}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Atualizar
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <div className="rounded-lg shadow-sm p-6 border" style={{ backgroundColor: colors.bgSecondary, borderColor: colors.border }}>
                <div className="flex items-center gap-3 mb-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <h3 className="text-sm font-medium" style={{ color: colors.textSecondary }}>Total</h3>
                </div>
                <p className="text-3xl font-bold" style={{ color: colors.textPrimary }}>{stats.total}</p>
              </div>

              <div className="rounded-lg shadow-sm p-6 border" style={{ backgroundColor: colors.bgSecondary, borderColor: colors.border }}>
                <div className="flex items-center gap-3 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <h3 className="text-sm font-medium" style={{ color: colors.textSecondary }}>Sucesso</h3>
                </div>
                <p className="text-3xl font-bold text-green-600">{stats.success}</p>
              </div>

              <div className="rounded-lg shadow-sm p-6 border" style={{ backgroundColor: colors.bgSecondary, borderColor: colors.border }}>
                <div className="flex items-center gap-3 mb-2">
                  <XCircle className="w-5 h-5 text-red-600" />
                  <h3 className="text-sm font-medium" style={{ color: colors.textSecondary }}>Falhas</h3>
                </div>
                <p className="text-3xl font-bold text-red-600">{stats.failed}</p>
              </div>

              <div className="rounded-lg shadow-sm p-6 border" style={{ backgroundColor: colors.bgSecondary, borderColor: colors.border }}>
                <div className="flex items-center gap-3 mb-2">
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                  <h3 className="text-sm font-medium" style={{ color: colors.textSecondary }}>Ignorados</h3>
                </div>
                <p className="text-3xl font-bold text-yellow-600">{stats.skipped}</p>
              </div>
            </div>

            <div className="rounded-lg shadow-sm border overflow-hidden" style={{ backgroundColor: colors.bgSecondary, borderColor: colors.border }}>
              <div className="p-4 sm:p-6 border-b" style={{ borderColor: colors.border }}>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <label className="text-sm font-medium whitespace-nowrap" style={{ color: colors.textPrimary }}>Filtro:</label>
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 w-full sm:w-auto"
                    style={{
                      backgroundColor: colors.bgPrimary,
                      borderColor: colors.border,
                      color: colors.textPrimary
                    }}
                  >
                    <option value="all">Todos</option>
                    <option value="success">Sucesso</option>
                    <option value="failed">Falhas</option>
                    <option value="skipped">Ignorados</option>
                  </select>
                </div>
              </div>

              {loading ? (
                <div className="p-6 text-center text-sm" style={{ color: colors.textSecondary }}>
                  Carregando...
                </div>
              ) : audits.length === 0 ? (
                <div className="p-6 text-center text-sm" style={{ color: colors.textSecondary }}>
                  Nenhum registro encontrado
                </div>
              ) : (
                <>
                  <div className="hidden lg:block overflow-x-auto">
                    <table className="w-full">
                      <thead style={{ backgroundColor: theme === 'dark' ? '#1a1d21' : '#f9fafb' }}>
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase whitespace-nowrap" style={{ color: colors.textSecondary }}>Status</th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase" style={{ color: colors.textSecondary }}>Operação</th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase whitespace-nowrap" style={{ color: colors.textSecondary }}>Tokens</th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase" style={{ color: colors.textSecondary }}>Customer ID</th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase" style={{ color: colors.textSecondary }}>Price ID</th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase whitespace-nowrap" style={{ color: colors.textSecondary }}>Antes → Depois</th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase whitespace-nowrap" style={{ color: colors.textSecondary }}>Tempo</th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase whitespace-nowrap" style={{ color: colors.textSecondary }}>Data</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y" style={{ borderColor: colors.border }}>
                        {audits.map((audit) => (
                          <tr key={audit.id} className="hover:opacity-80">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                {getStatusIcon(audit.status)}
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(audit.status)}`}>
                                  {audit.status}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 max-w-[200px]">
                              <div className="text-sm" style={{ color: colors.textPrimary }}>{audit.operation}</div>
                              {audit.error_message && (
                                <div className="text-xs text-red-600 mt-1 line-clamp-2" title={audit.error_message}>
                                  {audit.error_message}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                                {formatTokens(audit.tokens_amount)}
                              </span>
                            </td>
                            <td className="px-6 py-4 max-w-[150px]">
                              <div className="text-sm font-mono break-all" style={{ color: colors.textPrimary }}>
                                {audit.customer_id}
                              </div>
                            </td>
                            <td className="px-6 py-4 max-w-[150px]">
                              <div className="text-xs font-mono break-all" style={{ color: colors.textSecondary }}>
                                {audit.price_id || 'N/A'}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {audit.before_tokens_total !== null && audit.after_tokens_total !== null ? (
                                <div className="text-sm">
                                  <span style={{ color: colors.textSecondary }}>
                                    {formatTokens(audit.before_tokens_total)}
                                  </span>
                                  <span className="mx-2 text-gray-400">→</span>
                                  <span className="text-green-600 font-medium">
                                    {formatTokens(audit.after_tokens_total)}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-sm text-gray-400">N/A</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm" style={{ color: colors.textPrimary }}>
                                {audit.processing_time_ms ? `${audit.processing_time_ms}ms` : 'N/A'}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm" style={{ color: colors.textPrimary }}>
                                {new Date(audit.created_at).toLocaleString('pt-BR')}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="lg:hidden divide-y" style={{ borderColor: colors.border }}>
                    {audits.map((audit) => (
                      <div key={audit.id} className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {getStatusIcon(audit.status)}
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(audit.status)}`}>
                              {audit.status}
                            </span>
                          </div>
                          <div className="text-xs text-right flex-shrink-0" style={{ color: colors.textSecondary }}>
                            {new Date(audit.created_at).toLocaleString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div>
                            <div className="text-xs font-medium mb-1" style={{ color: colors.textSecondary }}>Operação</div>
                            <div className="text-sm" style={{ color: colors.textPrimary }}>{audit.operation}</div>
                            {audit.error_message && (
                              <div className="text-xs text-red-600 mt-1 break-words">
                                {audit.error_message}
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <div className="text-xs font-medium mb-1" style={{ color: colors.textSecondary }}>Tokens</div>
                              <div className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                                {formatTokens(audit.tokens_amount)}
                              </div>
                            </div>

                            {audit.processing_time_ms && (
                              <div>
                                <div className="text-xs font-medium mb-1" style={{ color: colors.textSecondary }}>Tempo</div>
                                <div className="text-sm" style={{ color: colors.textPrimary }}>
                                  {audit.processing_time_ms}ms
                                </div>
                              </div>
                            )}
                          </div>

                          {(audit.before_tokens_total !== null && audit.after_tokens_total !== null) && (
                            <div>
                              <div className="text-xs font-medium mb-1" style={{ color: colors.textSecondary }}>Saldo</div>
                              <div className="text-sm">
                                <span style={{ color: colors.textSecondary }}>
                                  {formatTokens(audit.before_tokens_total)}
                                </span>
                                <span className="mx-2 text-gray-400">→</span>
                                <span className="text-green-600 font-medium">
                                  {formatTokens(audit.after_tokens_total)}
                                </span>
                              </div>
                            </div>
                          )}

                          <div>
                            <div className="text-xs font-medium mb-1" style={{ color: colors.textSecondary }}>Customer ID</div>
                            <div className="text-xs font-mono break-all" style={{ color: colors.textPrimary }}>
                              {audit.customer_id}
                            </div>
                          </div>

                          {audit.price_id && (
                            <div>
                              <div className="text-xs font-medium mb-1" style={{ color: colors.textSecondary }}>Price ID</div>
                              <div className="text-xs font-mono break-all" style={{ color: colors.textSecondary }}>
                                {audit.price_id}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
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
            setIsSearchOpen(false);
            window.history.pushState({}, '', `/processo/${processoId}`);
            window.dispatchEvent(new PopStateEvent('popstate'));
          }}
        />
      )}
    </div>
  );
}
