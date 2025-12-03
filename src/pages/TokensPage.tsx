import React, { useState, useEffect } from 'react';
import { SidebarWis } from '../components/SidebarWis';
import { FooterWis } from '../components/FooterWis';
import { IntelligentSearch } from '../components/IntelligentSearch';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useTokenBalance } from '../contexts/TokenBalanceContext';
import { getThemeColors } from '../utils/themeUtils';
import { TokenValidationService } from '../services/TokenValidationService';
import { supabase } from '../lib/supabase';
import { Loader, Coins, FileText, Calendar, TrendingUp, RefreshCw } from 'lucide-react';
import { AddTokensSection } from '../components/subscription/AddTokensSection';

interface ProcessHistory {
  id: string;
  file_name: string;
  tokens_consumed: number;
  pages_processed_successfully: number;
  created_at: string;
  status: string;
}

interface TokensPageProps {
  onNavigateToApp: () => void;
  onNavigateToMyProcess: () => void;
  onNavigateToChat?: () => void;
  onNavigateToWorkspace?: () => void;
  onNavigateToAdmin: () => void;
  onNavigateToProfile: () => void;
  onNavigateToSignature: () => void;
  onNavigateToTerms?: () => void;
  onNavigateToPrivacy?: () => void;
  onNavigateToCookies?: () => void;
}

interface TokenUsage {
  tokens_total: number;
  tokens_used: number;
  tokens_remaining: number;
  pages_remaining: number;
  plan_name: string;
}

export function TokensPage({
  onNavigateToApp,
  onNavigateToMyProcess,
  onNavigateToChat, onNavigateToWorkspace,
  onNavigateToAdmin,
  onNavigateToProfile,
  onNavigateToSignature,
  onNavigateToTerms,
  onNavigateToPrivacy,
  onNavigateToCookies
}: TokensPageProps) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { balance, refreshBalance, isRefreshing } = useTokenBalance();
  const colors = getThemeColors(theme);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [processHistory, setProcessHistory] = useState<ProcessHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [displayCount, setDisplayCount] = useState(10);
  const [totalHistoryCount, setTotalHistoryCount] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    loadProcessHistory();

    if (!user) return;

    const channel = supabase
      .channel(`token-history-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'token_usage_history',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          console.log('🔔 Novo débito de tokens detectado, recarregando histórico');
          loadProcessHistory();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const loadProcessHistory = async (limit?: number) => {
    if (!user) return;

    try {
      setLoadingHistory(true);

      // Get total count first (only completed processes)
      const { count: totalCount } = await supabase
        .from('processos')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'completed');

      setTotalHistoryCount(totalCount || 0);

      // Get limited data with transcricao for totalPages
      const { data, error } = await supabase
        .from('processos')
        .select('id, file_name, tokens_consumed, pages_processed_successfully, transcricao, created_at, status')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(limit || displayCount);

      if (error) throw error;

      // Map and extract pages from transcricao if pages_processed_successfully is 0
      const mappedData = (data || []).map(item => ({
        ...item,
        pages_processed_successfully: item.pages_processed_successfully > 0
          ? item.pages_processed_successfully
          : (item.transcricao?.totalPages || 0)
      }));

      // Filter only processes with pages > 0
      const filteredData = mappedData.filter(item => item.pages_processed_successfully > 0);

      setProcessHistory(filteredData);
    } catch (error) {
      console.error('Error loading process history:', error);
    } finally {
      setLoadingHistory(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = async () => {
    setLoadingMore(true);
    const newCount = displayCount + 10;
    setDisplayCount(newCount);
    await loadProcessHistory(newCount);
  };


  const formatNumber = (num: number): string => {
    return num.toLocaleString('pt-BR');
  };

  const calculatePercentage = (): number => {
    if (balance.tokensTotal === 0) return 0;
    return Math.min((balance.tokensRemaining / balance.tokensTotal) * 100, 100);
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
        activePage="tokens"
      />

      <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300 pt-16 lg:pt-0 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="max-w-5xl mx-auto">
            <div className="mb-8 text-center">
              <h1 className="text-3xl sm:text-4xl font-title font-bold mb-2" style={{ color: colors.textPrimary }}>
                Tokens
              </h1>
              <p className="text-lg" style={{ color: colors.textSecondary }}>
                Acompanhe o uso de tokens do seu plano
              </p>
            </div>

            {balance.loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader className="w-8 h-8 animate-spin" style={{ color: colors.textSecondary }} />
              </div>
            ) : (
              <div className="space-y-6">
                <div
                  className="rounded-xl p-6 sm:p-8 shadow-lg"
                  style={{ backgroundColor: colors.card }}
                >
                  <div className="flex items-center justify-between mb-4 sm:mb-6">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <Coins className="w-6 h-6 sm:w-8 sm:h-8" style={{ color: colors.textPrimary }} />
                      <div>
                        <h2 className="text-lg sm:text-2xl font-title font-bold" style={{ color: colors.textPrimary }}>
                          Uso de Tokens
                        </h2>
                        <p className="text-xs sm:text-sm" style={{ color: colors.textSecondary }}>
                          Plano: {balance.planName}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={refreshBalance}
                      disabled={isRefreshing}
                      className="p-2 rounded-lg hover:opacity-80 transition-all disabled:opacity-50"
                      style={{ backgroundColor: colors.bgSecondary }}
                      title="Atualizar saldo"
                    >
                      <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 ${isRefreshing ? 'animate-spin' : ''}`} style={{ color: colors.textPrimary }} />
                    </button>
                  </div>

                  <div className="mb-4 sm:mb-6">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-baseline mb-3 gap-1">
                      <p className="text-base sm:text-lg font-medium" style={{ color: colors.textPrimary }}>
                        Você tem <span className="text-xl sm:text-2xl font-bold">{formatNumber(balance.tokensRemaining)}</span> tokens
                      </p>
                      <p className="text-xs sm:text-sm" style={{ color: colors.textSecondary }}>
                        de {formatNumber(balance.tokensTotal)} tokens
                      </p>
                    </div>

                    <div className="w-full h-6 rounded-full overflow-hidden" style={{ backgroundColor: colors.bgSecondary }}>
                      <div
                        className="h-full transition-all duration-500 ease-out rounded-full"
                        style={{
                          width: `${calculatePercentage()}%`,
                          backgroundColor: calculatePercentage() < 10 ? '#EF4444' : calculatePercentage() < 30 ? '#F59E0B' : '#10B981'
                        }}
                      />
                    </div>

                    <div className="flex justify-between items-center mt-2">
                      <p className="text-sm" style={{ color: colors.textSecondary }}>
                        {formatNumber(balance.tokensUsed)} tokens usados
                      </p>
                      <p className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                        {calculatePercentage().toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  {balance.tokensTotal === 0 && (
                    <div
                      className="p-4 rounded-lg mb-6"
                      style={{ backgroundColor: colors.bgSecondary }}
                    >
                      <p className="text-sm" style={{ color: colors.textSecondary }}>
                        Você não possui um plano ativo. Assine um plano para começar a usar a plataforma.
                      </p>
                    </div>
                  )}

                  {balance.tokensTotal > 0 && (
                    <div
                      className="p-4 rounded-lg mb-6"
                      style={{ backgroundColor: theme === 'dark' ? colors.bgTertiary : '#EFF6FF' }}
                    >
                      <div className="flex items-center gap-2 sm:gap-3 mb-2">
                        <FileText className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: colors.textPrimary }} />
                        <h3 className="text-sm sm:text-base font-semibold" style={{ color: colors.textPrimary }}>
                          Capacidade Disponível
                        </h3>
                      </div>
                      <p className="text-sm" style={{ color: colors.textSecondary }}>
                        Com os tokens restantes, você pode processar aproximadamente{' '}
                        <span className="font-bold" style={{ color: colors.textPrimary }}>
                          {formatNumber(balance.pagesRemaining)} páginas
                        </span>{' '}
                        de documentos.
                      </p>
                      <p className="text-xs mt-2" style={{ color: colors.textSecondary }}>
                        Nosso sistema utiliza aproximadamente 5.500 tokens por página processada.
                      </p>
                    </div>
                  )}

                  <div className="mb-6">
                    <AddTokensSection
                      title={balance.tokensTotal === 0 ? 'Compre tokens para começar' : 'Adicione mais tokens em sua assinatura'}
                      description={balance.tokensTotal === 0 ? 'Compre um pacote de tokens e comece a usar a plataforma:' : 'Escolha uma das opções abaixo:'}
                      onPurchaseComplete={() => {
                        console.log('Compra concluída, atualizando saldo...');
                        refreshBalance();
                      }}
                      onPurchaseError={(error) => {
                        console.error('Erro na compra:', error);
                        alert(`Erro ao processar compra: ${error}`);
                      }}
                    />
                  </div>

                  {processHistory.length > 0 && (
                    <div
                      className="border-t pt-4 sm:pt-6 mb-4 sm:mb-6"
                      style={{ borderColor: colors.border }}
                    >
                      <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                        <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: colors.textPrimary }} />
                        <h3 className="text-lg sm:text-xl font-title font-bold" style={{ color: colors.textPrimary }}>
                          Histórico de Consumo
                        </h3>
                      </div>
                      <p className="text-xs sm:text-sm mb-4" style={{ color: colors.textSecondary }}>
                        Mostrando últimos {processHistory.length} de {totalHistoryCount} processos concluídos com débito de tokens
                      </p>

                      {loadingHistory ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader className="w-6 h-6 animate-spin" style={{ color: colors.textSecondary }} />
                        </div>
                      ) : (
                        <>
                          {/* Mobile View - Cards */}
                          <div className="block sm:hidden space-y-3">
                            {processHistory.map((process) => (
                              <div
                                key={process.id}
                                className="rounded-lg p-4 border"
                                style={{
                                  backgroundColor: colors.bgSecondary,
                                  borderColor: colors.border
                                }}
                              >
                                <div className="flex items-start gap-2 mb-3">
                                  <FileText className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: colors.textSecondary }} />
                                  <span className="font-medium text-sm leading-tight" style={{ color: colors.textPrimary }}>
                                    {process.file_name}
                                  </span>
                                </div>
                                <div className="grid grid-cols-3 gap-3 text-center">
                                  <div>
                                    <p className="text-xs mb-1" style={{ color: colors.textSecondary }}>Páginas</p>
                                    <p className="font-semibold text-sm" style={{ color: colors.textPrimary }}>
                                      {formatNumber(process.pages_processed_successfully)}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs mb-1" style={{ color: colors.textSecondary }}>Tokens</p>
                                    <p className="font-semibold text-sm" style={{ color: colors.textPrimary }}>
                                      {TokenValidationService.formatTokenCount(process.tokens_consumed)}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs mb-1" style={{ color: colors.textSecondary }}>Data</p>
                                    <p className="font-semibold text-xs" style={{ color: colors.textPrimary }}>
                                      {new Date(process.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                    </p>
                                    <p className="text-xs" style={{ color: colors.textSecondary }}>
                                      {new Date(process.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Desktop View - Table */}
                          <div className="hidden sm:block overflow-hidden rounded-lg border" style={{ borderColor: colors.border }}>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead style={{ backgroundColor: theme === 'dark' ? colors.bgTertiary : '#F9FAFB' }}>
                                  <tr>
                                    <th className="px-4 py-3 text-left font-semibold" style={{ color: colors.textPrimary }}>
                                      Processo
                                    </th>
                                    <th className="px-4 py-3 text-center font-semibold" style={{ color: colors.textPrimary }}>
                                      Páginas
                                    </th>
                                    <th className="px-4 py-3 text-center font-semibold" style={{ color: colors.textPrimary }}>
                                      Tokens
                                    </th>
                                    <th className="px-4 py-3 text-right font-semibold" style={{ color: colors.textPrimary }}>
                                      Data
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {processHistory.map((process, index) => (
                                    <tr
                                      key={process.id}
                                      className="border-t hover:opacity-80 transition-opacity"
                                      style={{
                                        borderColor: colors.border,
                                        backgroundColor: index % 2 === 0 ? 'transparent' : (theme === 'dark' ? colors.bgTertiary : '#F9FAFB')
                                      }}
                                    >
                                      <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                          <FileText className="w-4 h-4 flex-shrink-0" style={{ color: colors.textSecondary }} />
                                          <span className="font-medium truncate max-w-xs" style={{ color: colors.textPrimary }}>
                                            {process.file_name}
                                          </span>
                                        </div>
                                      </td>
                                      <td className="px-4 py-3 text-center" style={{ color: colors.textSecondary }}>
                                        {formatNumber(process.pages_processed_successfully)}
                                      </td>
                                      <td className="px-4 py-3 text-center">
                                        <span className="font-semibold" style={{ color: theme === 'dark' ? '#C8C8C8' : '#0F0E0D' }}>
                                          {TokenValidationService.formatTokenCount(process.tokens_consumed)}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3 text-right">
                                        <div className="flex flex-col items-end">
                                          <span style={{ color: colors.textPrimary }}>
                                            {new Date(process.created_at).toLocaleDateString('pt-BR')}
                                          </span>
                                          <span className="text-xs" style={{ color: colors.textSecondary }}>
                                            {new Date(process.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                          </span>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </>
                      )}

                      {/* Load More Button */}
                      {!loadingHistory && processHistory.length < totalHistoryCount && (
                        <div className="flex justify-center mt-4 sm:mt-6">
                          <button
                            onClick={handleLoadMore}
                            disabled={loadingMore}
                            className="w-full sm:w-auto px-6 py-3 rounded-lg font-medium text-sm transition-all duration-200 hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            style={{
                              backgroundColor: theme === 'dark' ? '#C8C8C8' : '#0F0E0D',
                              color: theme === 'dark' ? '#0F0E0D' : '#FFFFFF'
                            }}
                          >
                            {loadingMore ? (
                              <>
                                <Loader className="w-4 h-4 animate-spin" />
                                <span>Carregando...</span>
                              </>
                            ) : (
                              <span>Exibir mais processos</span>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <div
                    className="border-t pt-4 sm:pt-6"
                    style={{ borderColor: colors.border }}
                  >
                    <p className="text-sm sm:text-base mb-4" style={{ color: colors.textSecondary }}>
                      Precisa melhorar seu plano? Conheça todos os nossos planos disponíveis e aumente sua capacidade de trabalho!
                    </p>
                    <button
                      onClick={onNavigateToSignature}
                      className="w-full sm:w-auto px-6 py-3 rounded-lg font-medium text-sm transition-all duration-200 hover:scale-105"
                      style={{
                        backgroundColor: theme === 'dark' ? '#C8C8C8' : '#29323A',
                        color: theme === 'dark' ? '#29323A' : '#FFFFFF'
                      }}
                    >
                      Ver Planos
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>

        <FooterWis />
      </div>

      {isSearchOpen && (
        <IntelligentSearch onClose={() => setIsSearchOpen(false)} />
      )}
    </div>
  );
}
