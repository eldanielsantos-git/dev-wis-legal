import { useEffect, useState } from 'react';
import { SidebarWis } from '../components/SidebarWis';
import { FooterWis } from '../components/FooterWis';
import { IntelligentSearch } from '../components/IntelligentSearch';
import { ProcessHistoryService, ProcessHistoryRecord, ProcessHistoryFilters } from '../services/ProcessHistoryService';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';
import { History, RefreshCw, ArrowLeft, FileText, User, Calendar, Cpu, Zap, ChevronDown, Filter, X, Copy, Check, Search } from 'lucide-react';

interface AdminProcessHistoryPageProps {
  onNavigateToApp: () => void;
  onNavigateToMyProcess: () => void;
  onNavigateToChat?: () => void;
  onNavigateToWorkspace?: () => void;
  onNavigateToSchedule?: () => void;
  onNavigateToAdmin: () => void;
  onNavigateToProfile?: () => void;
  onNavigateToNotifications?: () => void;
  onNavigateToTokens?: () => void;
  onNavigateToSubscription?: () => void;
  onNavigateToTerms?: () => void;
  onNavigateToPrivacy?: () => void;
  onNavigateToCookies?: () => void;
}

const ITEMS_PER_PAGE = 100;

export function AdminProcessHistoryPage({
  onNavigateToApp,
  onNavigateToMyProcess,
  onNavigateToChat,
  onNavigateToWorkspace,
  onNavigateToSchedule,
  onNavigateToAdmin,
  onNavigateToProfile,
  onNavigateToNotifications,
  onNavigateToTokens,
  onNavigateToSubscription,
  onNavigateToTerms,
  onNavigateToPrivacy,
  onNavigateToCookies
}: AdminProcessHistoryPageProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [records, setRecords] = useState<ProcessHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<ProcessHistoryFilters>({});
  const [tempFilters, setTempFilters] = useState<ProcessHistoryFilters>({});
  const [selectedRecord, setSelectedRecord] = useState<ProcessHistoryRecord | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [data, count] = await Promise.all([
        ProcessHistoryService.getHistory(ITEMS_PER_PAGE, 0, filters),
        ProcessHistoryService.getTotalCount(filters)
      ]);
      setRecords(data);
      setTotalCount(count);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const data = await ProcessHistoryService.getHistory(ITEMS_PER_PAGE, records.length, filters);
      setRecords(prev => [...prev, ...data]);
    } catch (error) {
    } finally {
      setLoadingMore(false);
    }
  };

  const loadAll = async () => {
    setLoadingMore(true);
    try {
      const data = await ProcessHistoryService.getAllHistory(filters);
      setRecords(data);
    } catch (error) {
    } finally {
      setLoadingMore(false);
    }
  };

  const applyFilters = async () => {
    setFilters(tempFilters);
    setShowFilters(false);
    setLoading(true);
    try {
      const [data, count] = await Promise.all([
        ProcessHistoryService.getHistory(ITEMS_PER_PAGE, 0, tempFilters),
        ProcessHistoryService.getTotalCount(tempFilters)
      ]);
      setRecords(data);
      setTotalCount(count);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = async () => {
    setTempFilters({});
    setFilters({});
    setShowFilters(false);
    setLoading(true);
    try {
      const [data, count] = await Promise.all([
        ProcessHistoryService.getHistory(ITEMS_PER_PAGE, 0, {}),
        ProcessHistoryService.getTotalCount({})
      ]);
      setRecords(data);
      setTotalCount(count);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const formatTokens = (tokens: number | null): string => {
    if (tokens === null || tokens === undefined) return 'N/A';
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
    return tokens.toString();
  };

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDateShort = (dateStr: string): string => {
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getUserDisplayName = (record: ProcessHistoryRecord): string => {
    if (record.user_first_name || record.user_last_name) {
      return `${record.user_first_name || ''} ${record.user_last_name || ''}`.trim();
    }
    return record.user_email || 'Usuario desconhecido';
  };

  const hasActiveFilters = filters.startDate || filters.endDate;
  const hasMoreToLoad = records.length < totalCount;

  const filteredRecords = searchQuery.trim()
    ? records.filter(record => {
        const query = searchQuery.toLowerCase();
        return (
          record.file_name.toLowerCase().includes(query) ||
          (record.user_email && record.user_email.toLowerCase().includes(query)) ||
          (record.user_first_name && record.user_first_name.toLowerCase().includes(query)) ||
          (record.user_last_name && record.user_last_name.toLowerCase().includes(query)) ||
          record.process_id.toLowerCase().includes(query) ||
          (record.llm_model_name && record.llm_model_name.toLowerCase().includes(query))
        );
      })
    : records;

  const searchResults = searchQuery.trim() ? filteredRecords.slice(0, 10) : [];

  const copyToClipboard = async (text: string, fieldName: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const formatFullDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatTokensFull = (tokens: number | null): string => {
    if (tokens === null || tokens === undefined) return 'N/A';
    return tokens.toLocaleString('pt-BR');
  };

  return (
    <div className="flex min-h-screen font-body" style={{ backgroundColor: colors.bgPrimary }}>
      <SidebarWis
        onNavigateToApp={onNavigateToApp}
        onNavigateToMyProcess={onNavigateToMyProcess}
        onNavigateToChat={onNavigateToChat}
        onNavigateToWorkspace={onNavigateToWorkspace}
        onNavigateToSchedule={onNavigateToSchedule}
        onNavigateToAdmin={onNavigateToAdmin}
        onNavigateToSettings={onNavigateToAdmin}
        onNavigateToProfile={onNavigateToProfile}
        onNavigateToNotifications={onNavigateToNotifications}
        onNavigateToTokens={onNavigateToTokens}
        onNavigateToSubscription={onNavigateToSubscription}
        onNavigateToTerms={onNavigateToTerms}
        onNavigateToPrivacy={onNavigateToPrivacy}
        onNavigateToCookies={onNavigateToCookies}
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
                <History className="w-6 h-6 sm:w-8 sm:h-8 text-amber-600" />
              </div>
              <div className="text-center">
                <h1 className="text-2xl sm:text-3xl font-title font-bold" style={{ color: colors.textPrimary }}>
                  Historico de Processos
                </h1>
                <p className="text-xs sm:text-sm mt-1 px-4 sm:px-0" style={{ color: colors.textSecondary }}>
                  Registro permanente de todos os processos concluidos
                </p>
              </div>
            </div>

            <div className="relative mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: colors.textSecondary }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                  placeholder="Buscar por arquivo, usuario, email, modelo ou ID..."
                  className="w-full pl-10 pr-10 py-3 border rounded-lg text-sm transition-all"
                  style={{
                    backgroundColor: colors.bgSecondary,
                    borderColor: isSearchFocused ? '#3b82f6' : colors.border,
                    color: colors.textPrimary,
                    boxShadow: isSearchFocused ? '0 0 0 3px rgba(59, 130, 246, 0.1)' : 'none'
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    <X className="w-4 h-4" style={{ color: colors.textSecondary }} />
                  </button>
                )}
              </div>

              {isSearchFocused && searchQuery.trim() && (
                <div
                  className="absolute top-full left-0 right-0 mt-2 rounded-lg border shadow-xl z-20 max-h-96 overflow-y-auto"
                  style={{ backgroundColor: colors.bgSecondary, borderColor: colors.border }}
                >
                  {searchResults.length > 0 ? (
                    <>
                      <div className="px-4 py-2 border-b" style={{ borderColor: colors.border }}>
                        <span className="text-xs font-medium" style={{ color: colors.textSecondary }}>
                          {filteredRecords.length} resultado{filteredRecords.length !== 1 ? 's' : ''} encontrado{filteredRecords.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      {searchResults.map((record) => (
                        <button
                          key={record.id}
                          onClick={() => {
                            setSelectedRecord(record);
                            setSearchQuery('');
                          }}
                          className="w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border-b last:border-b-0"
                          style={{ borderColor: colors.border }}
                        >
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg flex-shrink-0" style={{ backgroundColor: colors.bgPrimary }}>
                              <FileText className="w-4 h-4 text-amber-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate" style={{ color: colors.textPrimary }}>
                                {record.file_name}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <User className="w-3 h-3" style={{ color: colors.textSecondary }} />
                                <span className="text-xs truncate" style={{ color: colors.textSecondary }}>
                                  {getUserDisplayName(record)}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-xs" style={{ color: colors.textSecondary }}>
                                  {formatDateShort(record.processed_at)}
                                </span>
                                <span className="text-xs font-mono" style={{ color: colors.textSecondary }}>
                                  {formatTokens(record.llm_tokens_used)} tokens
                                </span>
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                      {filteredRecords.length > 10 && (
                        <div className="px-4 py-2 text-center" style={{ backgroundColor: colors.bgPrimary }}>
                          <span className="text-xs" style={{ color: colors.textSecondary }}>
                            Mostrando 10 de {filteredRecords.length} resultados
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="px-4 py-8 text-center">
                      <Search className="w-8 h-8 mx-auto mb-2" style={{ color: colors.textSecondary }} />
                      <p className="text-sm" style={{ color: colors.textSecondary }}>
                        Nenhum resultado encontrado para "{searchQuery}"
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <button
                  onClick={loadInitialData}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  Atualizar
                </button>

                <button
                  onClick={() => {
                    setTempFilters(filters);
                    setShowFilters(true);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors border ${
                    hasActiveFilters ? 'bg-amber-50 border-amber-300 text-amber-700' : ''
                  }`}
                  style={!hasActiveFilters ? {
                    backgroundColor: colors.bgSecondary,
                    borderColor: colors.border,
                    color: colors.textPrimary
                  } : undefined}
                >
                  <Filter className="w-4 h-4" />
                  Filtros
                  {hasActiveFilters && (
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                  )}
                </button>

                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-1 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                    Limpar
                  </button>
                )}
              </div>

              <div className="text-sm" style={{ color: colors.textSecondary }}>
                {searchQuery.trim() ? (
                  <>
                    <span className="font-medium" style={{ color: colors.textPrimary }}>{filteredRecords.length}</span> resultado{filteredRecords.length !== 1 ? 's' : ''} de{' '}
                    <span className="font-medium" style={{ color: colors.textPrimary }}>{totalCount}</span> registros
                  </>
                ) : (
                  <>
                    Exibindo <span className="font-medium" style={{ color: colors.textPrimary }}>{records.length}</span> de{' '}
                    <span className="font-medium" style={{ color: colors.textPrimary }}>{totalCount}</span> registros
                  </>
                )}
              </div>
            </div>

            {showFilters && (
              <div className="mb-6 p-4 rounded-lg border" style={{ backgroundColor: colors.bgSecondary, borderColor: colors.border }}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium" style={{ color: colors.textPrimary }}>Filtrar por periodo</h3>
                  <button onClick={() => setShowFilters(false)} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700">
                    <X className="w-4 h-4" style={{ color: colors.textSecondary }} />
                  </button>
                </div>
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <label className="block text-xs font-medium mb-1" style={{ color: colors.textSecondary }}>Data inicial</label>
                    <input
                      type="date"
                      value={tempFilters.startDate || ''}
                      onChange={(e) => setTempFilters(prev => ({ ...prev, startDate: e.target.value || undefined }))}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      style={{
                        backgroundColor: colors.bgPrimary,
                        borderColor: colors.border,
                        color: colors.textPrimary
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium mb-1" style={{ color: colors.textSecondary }}>Data final</label>
                    <input
                      type="date"
                      value={tempFilters.endDate || ''}
                      onChange={(e) => setTempFilters(prev => ({ ...prev, endDate: e.target.value || undefined }))}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      style={{
                        backgroundColor: colors.bgPrimary,
                        borderColor: colors.border,
                        color: colors.textPrimary
                      }}
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={applyFilters}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                    >
                      Aplicar
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-lg shadow-sm border overflow-hidden" style={{ backgroundColor: colors.bgSecondary, borderColor: colors.border }}>
              {loading ? (
                <div className="p-12 text-center">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-600" />
                  <p className="text-sm" style={{ color: colors.textSecondary }}>Carregando historico...</p>
                </div>
              ) : filteredRecords.length === 0 ? (
                <div className="p-12 text-center">
                  <History className="w-12 h-12 mx-auto mb-3" style={{ color: colors.textSecondary }} />
                  <p className="text-sm" style={{ color: colors.textSecondary }}>
                    {searchQuery.trim()
                      ? `Nenhum resultado encontrado para "${searchQuery}"`
                      : hasActiveFilters
                        ? 'Nenhum registro encontrado para o periodo selecionado'
                        : 'Nenhum registro de processo encontrado'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="hidden lg:block overflow-x-auto">
                    <table className="w-full">
                      <thead style={{ backgroundColor: theme === 'dark' ? '#1a1d21' : '#f9fafb' }}>
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase" style={{ color: colors.textSecondary }}>
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Data/Hora
                            </div>
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase" style={{ color: colors.textSecondary }}>
                            <div className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              Usuario
                            </div>
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase" style={{ color: colors.textSecondary }}>
                            <div className="flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              Arquivo
                            </div>
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium uppercase" style={{ color: colors.textSecondary }}>Paginas</th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase" style={{ color: colors.textSecondary }}>
                            <div className="flex items-center gap-1">
                              <Cpu className="w-3 h-3" />
                              Modelo IA
                            </div>
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium uppercase" style={{ color: colors.textSecondary }}>
                            <div className="flex items-center justify-end gap-1">
                              <Zap className="w-3 h-3" />
                              Tokens LLM
                            </div>
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase" style={{ color: colors.textSecondary }}>ID</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y" style={{ borderColor: colors.border }}>
                        {filteredRecords.map((record) => (
                          <tr
                            key={record.id}
                            className="hover:opacity-80 cursor-pointer transition-colors"
                            onClick={() => setSelectedRecord(record)}
                            style={{ backgroundColor: 'inherit' }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme === 'dark' ? '#2a2d31' : '#f3f4f6'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'inherit'}
                          >
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="text-sm" style={{ color: colors.textPrimary }}>
                                {formatDate(record.processed_at)}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                                {getUserDisplayName(record)}
                              </div>
                              {record.user_email && record.user_first_name && (
                                <div className="text-xs" style={{ color: colors.textSecondary }}>
                                  {record.user_email}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 max-w-[250px]">
                              <div className="text-sm truncate" title={record.file_name} style={{ color: colors.textPrimary }}>
                                {record.file_name}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                                {record.total_pages}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-sm" style={{ color: colors.textPrimary }}>
                                {record.llm_model_name || 'N/A'}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="text-sm font-mono" style={{ color: colors.textPrimary }}>
                                {formatTokens(record.llm_tokens_used)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-xs font-mono truncate max-w-[100px]" title={record.process_id} style={{ color: colors.textSecondary }}>
                                {record.process_id.slice(0, 8)}...
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="lg:hidden divide-y" style={{ borderColor: colors.border }}>
                    {filteredRecords.map((record) => (
                      <div
                        key={record.id}
                        className="p-4 space-y-3 cursor-pointer transition-colors"
                        onClick={() => setSelectedRecord(record)}
                        style={{ backgroundColor: 'inherit' }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate" style={{ color: colors.textPrimary }}>
                              {record.file_name}
                            </div>
                            <div className="text-xs mt-1" style={{ color: colors.textSecondary }}>
                              {getUserDisplayName(record)}
                            </div>
                          </div>
                          <div className="text-xs text-right flex-shrink-0" style={{ color: colors.textSecondary }}>
                            {formatDateShort(record.processed_at)}
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <div className="text-xs font-medium mb-1" style={{ color: colors.textSecondary }}>Paginas</div>
                            <div className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                              {record.total_pages}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-medium mb-1" style={{ color: colors.textSecondary }}>Modelo</div>
                            <div className="text-sm truncate" style={{ color: colors.textPrimary }}>
                              {record.llm_model_name || 'N/A'}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-medium mb-1" style={{ color: colors.textSecondary }}>Tokens</div>
                            <div className="text-sm font-mono" style={{ color: colors.textPrimary }}>
                              {formatTokens(record.llm_tokens_used)}
                            </div>
                          </div>
                        </div>

                        <div className="text-xs font-mono" style={{ color: colors.textSecondary }}>
                          ID: {record.process_id.slice(0, 8)}...
                        </div>
                      </div>
                    ))}
                  </div>

                  {hasMoreToLoad && !searchQuery.trim() && (
                    <div className="p-4 border-t flex flex-col sm:flex-row items-center justify-center gap-3" style={{ borderColor: colors.border }}>
                      <button
                        onClick={loadMore}
                        disabled={loadingMore}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        {loadingMore ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                        Carregar +{ITEMS_PER_PAGE}
                      </button>
                      <button
                        onClick={loadAll}
                        disabled={loadingMore}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors border disabled:opacity-50"
                        style={{
                          backgroundColor: colors.bgPrimary,
                          borderColor: colors.border,
                          color: colors.textPrimary
                        }}
                      >
                        Carregar Todos ({totalCount - records.length} restantes)
                      </button>
                    </div>
                  )}
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
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          onSelectProcess={(processoId) => {
            setIsSearchOpen(false);
            window.history.pushState({}, '', `/processo/${processoId}`);
            window.dispatchEvent(new PopStateEvent('popstate'));
          }}
        />
      )}

      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelectedRecord(null)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl"
            style={{ backgroundColor: colors.bgSecondary }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between p-4 border-b" style={{ borderColor: colors.border, backgroundColor: colors.bgSecondary }}>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ backgroundColor: colors.bgPrimary }}>
                  <FileText className="w-5 h-5 text-amber-600" />
                </div>
                <h2 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
                  Detalhes do Processo
                </h2>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <X className="w-5 h-5" style={{ color: colors.textSecondary }} />
              </button>
            </div>

            <div className="p-4 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg" style={{ backgroundColor: colors.bgPrimary }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-4 h-4 text-blue-500" />
                    <span className="text-xs font-medium uppercase" style={{ color: colors.textSecondary }}>Data de Processamento</span>
                  </div>
                  <div className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                    {formatFullDate(selectedRecord.processed_at)}
                  </div>
                </div>

                <div className="p-4 rounded-lg" style={{ backgroundColor: colors.bgPrimary }}>
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-green-500" />
                    <span className="text-xs font-medium uppercase" style={{ color: colors.textSecondary }}>Total de Paginas</span>
                  </div>
                  <div className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
                    {selectedRecord.total_pages}
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg" style={{ backgroundColor: colors.bgPrimary }}>
                <div className="flex items-center gap-2 mb-3">
                  <User className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-medium uppercase" style={{ color: colors.textSecondary }}>Usuario</span>
                </div>
                <div className="space-y-2">
                  <div className="text-base font-medium" style={{ color: colors.textPrimary }}>
                    {getUserDisplayName(selectedRecord)}
                  </div>
                  {selectedRecord.user_email && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm" style={{ color: colors.textSecondary }}>{selectedRecord.user_email}</span>
                      <button
                        onClick={() => copyToClipboard(selectedRecord.user_email!, 'email')}
                        className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        title="Copiar email"
                      >
                        {copiedField === 'email' ? (
                          <Check className="w-3 h-3 text-green-500" />
                        ) : (
                          <Copy className="w-3 h-3" style={{ color: colors.textSecondary }} />
                        )}
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono" style={{ color: colors.textSecondary }}>
                      ID: {selectedRecord.user_id}
                    </span>
                    <button
                      onClick={() => copyToClipboard(selectedRecord.user_id, 'userId')}
                      className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      title="Copiar ID do usuario"
                    >
                      {copiedField === 'userId' ? (
                        <Check className="w-3 h-3 text-green-500" />
                      ) : (
                        <Copy className="w-3 h-3" style={{ color: colors.textSecondary }} />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg" style={{ backgroundColor: colors.bgPrimary }}>
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4 text-blue-500" />
                  <span className="text-xs font-medium uppercase" style={{ color: colors.textSecondary }}>Arquivo</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="flex-1 break-all text-sm font-medium" style={{ color: colors.textPrimary }}>
                    {selectedRecord.file_name}
                  </div>
                  <button
                    onClick={() => copyToClipboard(selectedRecord.file_name, 'fileName')}
                    className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex-shrink-0"
                    title="Copiar nome do arquivo"
                  >
                    {copiedField === 'fileName' ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" style={{ color: colors.textSecondary }} />
                    )}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg" style={{ backgroundColor: colors.bgPrimary }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Cpu className="w-4 h-4 text-purple-500" />
                    <span className="text-xs font-medium uppercase" style={{ color: colors.textSecondary }}>Modelo de IA</span>
                  </div>
                  <div className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                    {selectedRecord.llm_model_name || 'N/A'}
                  </div>
                </div>

                <div className="p-4 rounded-lg" style={{ backgroundColor: colors.bgPrimary }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-4 h-4 text-yellow-500" />
                    <span className="text-xs font-medium uppercase" style={{ color: colors.textSecondary }}>Tokens LLM Utilizados</span>
                  </div>
                  <div className="text-2xl font-bold font-mono" style={{ color: colors.textPrimary }}>
                    {formatTokensFull(selectedRecord.llm_tokens_used)}
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg" style={{ backgroundColor: colors.bgPrimary }}>
                <div className="flex items-center gap-2 mb-3">
                  <History className="w-4 h-4 text-gray-500" />
                  <span className="text-xs font-medium uppercase" style={{ color: colors.textSecondary }}>Identificadores</span>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs" style={{ color: colors.textSecondary }}>ID do Processo</label>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="flex-1 text-sm font-mono p-2 rounded break-all" style={{ backgroundColor: colors.bgSecondary, color: colors.textPrimary }}>
                        {selectedRecord.process_id}
                      </code>
                      <button
                        onClick={() => copyToClipboard(selectedRecord.process_id, 'processId')}
                        className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex-shrink-0"
                        title="Copiar ID do processo"
                      >
                        {copiedField === 'processId' ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4" style={{ color: colors.textSecondary }} />
                        )}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs" style={{ color: colors.textSecondary }}>ID do Registro</label>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="flex-1 text-sm font-mono p-2 rounded break-all" style={{ backgroundColor: colors.bgSecondary, color: colors.textPrimary }}>
                        {selectedRecord.id}
                      </code>
                      <button
                        onClick={() => copyToClipboard(selectedRecord.id, 'recordId')}
                        className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex-shrink-0"
                        title="Copiar ID do registro"
                      >
                        {copiedField === 'recordId' ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4" style={{ color: colors.textSecondary }} />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
