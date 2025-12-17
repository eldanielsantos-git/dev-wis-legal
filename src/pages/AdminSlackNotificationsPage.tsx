import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { adminNotificationsService, NotificationTypeWithConfig, AdminNotification, NotificationStats } from '../services/AdminNotificationsService';
import { SidebarWis } from '../components/SidebarWis';
import { FooterWis } from '../components/FooterWis';
import { Loader } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';

interface AdminSlackNotificationsPageProps {
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

const categoryColors: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  success: { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-800 dark:text-green-400', border: 'border-green-200 dark:border-green-800', icon: '✅' },
  error: { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-800 dark:text-red-400', border: 'border-red-200 dark:border-red-800', icon: '❌' },
  integration: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-800 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800', icon: '🔗' },
  infrastructure: { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-800 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-800', icon: '🏗️' },
  system: { bg: 'bg-gray-50 dark:bg-gray-800/50', text: 'text-gray-800 dark:text-gray-400', border: 'border-gray-200 dark:border-gray-700', icon: '⚙️' },
};

const categoryNames: Record<string, string> = {
  success: 'Sucesso',
  error: 'Erros',
  integration: 'Integrações',
  infrastructure: 'Infraestrutura',
  system: 'Sistema',
};

const severityColors: Record<string, string> = {
  critical: 'bg-red-600 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-500 text-white',
  low: 'bg-blue-500 text-white',
  success: 'bg-green-500 text-white',
};

export function AdminSlackNotificationsPage({
  onNavigateToApp,
  onNavigateToMyProcess,
  onNavigateToChat,
  onNavigateToWorkspace,
  onNavigateToAdmin,
  onNavigateToSettings,
  onNavigateToProfile,
  onNavigateToTerms,
  onNavigateToPrivacy,
  onNavigateToCookies,
}: AdminSlackNotificationsPageProps) {
  console.log('[AdminSlackNotificationsPage] Component mounted');

  const { user, isAdmin, loading: authLoading } = useAuth();
  console.log('[AdminSlackNotificationsPage] Auth state:', { userEmail: user?.email, isAdmin, authLoading });

  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'stats' | 'config' | 'history' | 'test'>('config');

  const [types, setTypes] = useState<NotificationTypeWithConfig[]>([]);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [stats, setStats] = useState<NotificationStats | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [configSearchTerm, setConfigSearchTerm] = useState('');
  const [selectedNotification, setSelectedNotification] = useState<AdminNotification | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['success', 'error', 'integration', 'infrastructure', 'system']));

  const [testTypeSlug, setTestTypeSlug] = useState('');
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!user || !isAdmin) {
      onNavigateToApp();
      return;
    }

    loadData();
  }, [user, isAdmin, authLoading, onNavigateToApp]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([
        loadTypes(),
        loadStats(),
        loadNotifications(),
      ]);
    } catch (error) {
      console.error('Error loading admin notifications data:', error);
      setError(error instanceof Error ? error.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const loadTypes = async () => {
    try {
      const result = await adminNotificationsService.fetchNotificationTypes();
      if (result.success && result.data) {
        setTypes(result.data);
      } else {
        throw new Error(result.error || 'Erro ao buscar tipos de notificação');
      }
    } catch (error) {
      console.error('Error in loadTypes:', error);
      throw error;
    }
  };

  const loadStats = async () => {
    try {
      const result = await adminNotificationsService.fetchNotificationStats();
      if (result.success && result.data) {
        setStats(result.data);
      } else {
        throw new Error(result.error || 'Erro ao buscar estatísticas');
      }
    } catch (error) {
      console.error('Error in loadStats:', error);
      throw error;
    }
  };

  const loadNotifications = async () => {
    try {
      const result = await adminNotificationsService.fetchNotifications({
        limit: 50,
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        severity: selectedSeverity !== 'all' ? selectedSeverity : undefined,
        search: searchTerm || undefined,
      });
      if (result.success && result.data) {
        setNotifications(result.data);
      } else {
        throw new Error(result.error || 'Erro ao buscar notificações');
      }
    } catch (error) {
      console.error('Error in loadNotifications:', error);
      throw error;
    }
  };

  const handleToggleEnabled = async (type: NotificationTypeWithConfig) => {
    const newValue = !type.config?.is_enabled;
    const result = await adminNotificationsService.updateNotificationConfig(type.id, {
      is_enabled: newValue,
    });

    if (result.success) {
      await loadTypes();
    }
  };

  const handleToggleSlack = async (type: NotificationTypeWithConfig) => {
    const newValue = !type.config?.notify_slack;
    const result = await adminNotificationsService.updateNotificationConfig(type.id, {
      notify_slack: newValue,
    });

    if (result.success) {
      await loadTypes();
    }
  };

  const handleToggleCategoryEnabled = async (category: string, enable: boolean) => {
    const categoryTypes = types.filter(t => t.category === category);
    await Promise.all(
      categoryTypes.map(type =>
        adminNotificationsService.updateNotificationConfig(type.id, { is_enabled: enable })
      )
    );
    await loadTypes();
  };

  const handleToggleCategorySlack = async (category: string, enable: boolean) => {
    const categoryTypes = types.filter(t => t.category === category);
    await Promise.all(
      categoryTypes.map(type =>
        adminNotificationsService.updateNotificationConfig(type.id, { notify_slack: enable })
      )
    );
    await loadTypes();
  };

  const handleSendTest = async () => {
    if (!testTypeSlug) {
      setTestResult({ success: false, message: 'Selecione um tipo de notificação' });
      return;
    }

    const result = await adminNotificationsService.sendTestNotification(testTypeSlug);
    setTestResult({
      success: result.success,
      message: result.success ? 'Notificação de teste enviada com sucesso!' : result.error || 'Erro ao enviar',
    });

    if (result.success) {
      setTimeout(() => loadNotifications(), 2000);
    }
  };

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const groupedTypes = types.reduce((acc, type) => {
    if (!acc[type.category]) {
      acc[type.category] = [];
    }
    acc[type.category].push(type);
    return acc;
  }, {} as Record<string, NotificationTypeWithConfig[]>);

  const filteredGroupedTypes = Object.entries(groupedTypes).reduce((acc, [category, categoryTypes]) => {
    if (!configSearchTerm) {
      acc[category] = categoryTypes;
      return acc;
    }

    const filtered = categoryTypes.filter(type =>
      type.name.toLowerCase().includes(configSearchTerm.toLowerCase()) ||
      type.description?.toLowerCase().includes(configSearchTerm.toLowerCase()) ||
      type.slug.toLowerCase().includes(configSearchTerm.toLowerCase())
    );

    if (filtered.length > 0) {
      acc[category] = filtered;
    }

    return acc;
  }, {} as Record<string, NotificationTypeWithConfig[]>);

  const getCategoryStats = (category: string) => {
    const categoryTypes = groupedTypes[category] || [];
    const enabled = categoryTypes.filter(t => t.config?.is_enabled !== false).length;
    const slackEnabled = categoryTypes.filter(t => t.config?.notify_slack !== false && t.config?.is_enabled !== false).length;
    return { total: categoryTypes.length, enabled, slackEnabled };
  };

  if (authLoading || loading) {
    return (
      <div className="flex h-screen" style={{ backgroundColor: colors.background }}>
        <SidebarWis
          isCollapsed={isSidebarCollapsed}
          onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          onNavigateToApp={onNavigateToApp}
          onNavigateToMyProcess={onNavigateToMyProcess}
          onNavigateToChat={onNavigateToChat}
          onNavigateToWorkspace={onNavigateToWorkspace}
          onNavigateToAdmin={onNavigateToAdmin}
          onNavigateToSettings={onNavigateToSettings}
          onNavigateToProfile={onNavigateToProfile}
        />
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <Loader className="w-8 h-8 animate-spin mb-4" style={{ color: colors.primary }} />
          <p style={{ color: colors.textSecondary }}>Carregando sistema de notificações...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen" style={{ backgroundColor: colors.background }}>
        <SidebarWis
          isCollapsed={isSidebarCollapsed}
          onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          onNavigateToApp={onNavigateToApp}
          onNavigateToMyProcess={onNavigateToMyProcess}
          onNavigateToChat={onNavigateToChat}
          onNavigateToWorkspace={onNavigateToWorkspace}
          onNavigateToAdmin={onNavigateToAdmin}
          onNavigateToSettings={onNavigateToSettings}
          onNavigateToProfile={onNavigateToProfile}
        />
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
            <h3 className="text-lg font-semibold text-red-800 mb-2">Erro ao Carregar</h3>
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={() => loadData()}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Tentar Novamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen" style={{ backgroundColor: colors.background }}>
      <SidebarWis
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        onNavigateToApp={onNavigateToApp}
        onNavigateToMyProcess={onNavigateToMyProcess}
        onNavigateToChat={onNavigateToChat}
        onNavigateToWorkspace={onNavigateToWorkspace}
        onNavigateToAdmin={onNavigateToAdmin}
        onNavigateToSettings={onNavigateToSettings}
        onNavigateToProfile={onNavigateToProfile}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">
          <div className="p-8">
            {/* Header */}
            <div className="mb-8">
              <button
                onClick={onNavigateToAdmin}
                className="mb-4 flex items-center gap-2 hover:opacity-80 transition-opacity"
                style={{ color: colors.textSecondary }}
              >
                <span>←</span>
                <span>Voltar ao Painel</span>
              </button>
              <h1 className="text-3xl font-bold mb-2" style={{ color: colors.text }}>
                Sistema de Notificações Administrativas
              </h1>
              <p style={{ color: colors.textSecondary }}>
                Gerencie 35 tipos de notificações em 5 categorias com integração Slack
              </p>
            </div>

            {/* Tabs */}
            <div className="mb-6 border-b" style={{ borderColor: colors.border }}>
              <nav className="flex space-x-8">
                {[
                  { id: 'config', label: 'Configurações', icon: '⚙️' },
                  { id: 'stats', label: 'Estatísticas', icon: '📊' },
                  { id: 'history', label: 'Histórico', icon: '📜' },
                  { id: 'test', label: 'Testar', icon: '🧪' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors`}
                    style={{
                      borderColor: activeTab === tab.id ? colors.primary : 'transparent',
                      color: activeTab === tab.id ? colors.primary : colors.textSecondary,
                    }}
                  >
                    <span>{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Stats Tab */}
            {activeTab === 'stats' && stats && (
              <div className="space-y-6">
                {/* Main Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  {[
                    { label: 'Hoje', value: stats.total_today, color: colors.text },
                    { label: 'Últimas 24h', value: stats.total_last_24h, color: colors.text },
                    { label: 'Enviadas ao Slack', value: stats.sent_to_slack, color: '#10b981' },
                    { label: 'Falhas Slack', value: stats.failed_slack, color: '#ef4444' },
                  ].map((stat, i) => (
                    <div key={i} className="rounded-lg shadow-sm border p-6" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
                      <div className="text-sm font-medium" style={{ color: colors.textSecondary }}>{stat.label}</div>
                      <div className="mt-2 text-3xl font-bold" style={{ color: stat.color }}>{stat.value}</div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Severity Stats */}
                  <div className="rounded-lg shadow-sm border p-6" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
                    <h3 className="text-lg font-semibold mb-4" style={{ color: colors.text }}>Por Severidade</h3>
                    <div className="space-y-3">
                      {Object.entries(stats.by_severity).map(([severity, count]) => (
                        <div key={severity} className="flex items-center justify-between">
                          <span className={`px-3 py-1 text-xs font-semibold rounded-full ${severityColors[severity]}`}>
                            {severity.toUpperCase()}
                          </span>
                          <span className="text-lg font-bold" style={{ color: colors.text }}>{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Category Stats */}
                  <div className="rounded-lg shadow-sm border p-6" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
                    <h3 className="text-lg font-semibold mb-4" style={{ color: colors.text }}>Por Categoria</h3>
                    <div className="space-y-3">
                      {Object.entries(stats.by_category).map(([category, count]) => (
                        <div key={category} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{categoryColors[category]?.icon}</span>
                            <span className={`px-3 py-1 text-xs font-semibold rounded-full ${categoryColors[category]?.bg} ${categoryColors[category]?.text}`}>
                              {categoryNames[category] || category}
                            </span>
                          </div>
                          <span className="text-lg font-bold" style={{ color: colors.text }}>{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Category Overview */}
                <div className="rounded-lg shadow-sm border p-6" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
                  <h3 className="text-lg font-semibold mb-4" style={{ color: colors.text }}>Visão Geral por Categoria</h3>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    {Object.keys(categoryColors).map(category => {
                      const categoryStats = getCategoryStats(category);
                      return (
                        <div key={category} className={`rounded-lg p-4 border-2 ${categoryColors[category].border} ${categoryColors[category].bg}`}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-2xl">{categoryColors[category].icon}</span>
                            <div className={`font-semibold ${categoryColors[category].text}`}>
                              {categoryNames[category]}
                            </div>
                          </div>
                          <div className="space-y-1 text-sm">
                            <div className={categoryColors[category].text}>
                              <span className="font-semibold">{categoryStats.total}</span> tipos
                            </div>
                            <div className={categoryColors[category].text}>
                              <span className="font-semibold">{categoryStats.enabled}</span> ativas
                            </div>
                            <div className={categoryColors[category].text}>
                              <span className="font-semibold">{categoryStats.slackEnabled}</span> com Slack
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Config Tab */}
            {activeTab === 'config' && (
              <div className="space-y-6">
                {/* Search Bar */}
                <div className="rounded-lg shadow-sm border p-4" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
                  <div className="flex items-center gap-3">
                    <span className="text-xl" style={{ color: colors.textSecondary }}>🔍</span>
                    <input
                      type="text"
                      placeholder="Buscar por nome, descrição ou slug..."
                      value={configSearchTerm}
                      onChange={(e) => setConfigSearchTerm(e.target.value)}
                      className="flex-1 border-none focus:ring-0 bg-transparent"
                      style={{ color: colors.text }}
                    />
                    {configSearchTerm && (
                      <button
                        onClick={() => setConfigSearchTerm('')}
                        style={{ color: colors.textSecondary }}
                        className="hover:opacity-80"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* Categories */}
                {Object.entries(filteredGroupedTypes).map(([category, categoryTypes]) => {
                  const categoryStats = getCategoryStats(category);
                  const isExpanded = expandedCategories.has(category);
                  const catColors = categoryColors[category];

                  return (
                    <div key={category} className={`rounded-lg shadow-sm border-2 overflow-hidden`} style={{ borderColor: colors.border, backgroundColor: colors.card }}>
                      {/* Category Header */}
                      <div className={`${catColors.bg} ${catColors.text} px-6 py-4`}>
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => toggleCategory(category)}
                            className="flex items-center gap-3 flex-1"
                          >
                            <span className="text-2xl">{catColors.icon}</span>
                            <div className="text-left">
                              <h3 className="text-lg font-bold">{categoryNames[category]}</h3>
                              <div className="text-sm opacity-80">
                                {categoryStats.total} tipos • {categoryStats.enabled} ativas • {categoryStats.slackEnabled} com Slack
                              </div>
                            </div>
                            <span className="ml-auto text-xl">
                              {isExpanded ? '▼' : '▶'}
                            </span>
                          </button>
                          <div className="flex items-center gap-3 ml-4">
                            <button
                              onClick={() => handleToggleCategoryEnabled(category, true)}
                              className="px-3 py-1 rounded text-sm font-medium hover:opacity-80 transition-opacity"
                              style={{ backgroundColor: colors.card, color: colors.text }}
                            >
                              Ativar Todas
                            </button>
                            <button
                              onClick={() => handleToggleCategoryEnabled(category, false)}
                              className="px-3 py-1 rounded text-sm font-medium hover:opacity-80 transition-opacity"
                              style={{ backgroundColor: colors.card, color: colors.text }}
                            >
                              Desativar Todas
                            </button>
                            <button
                              onClick={() => handleToggleCategorySlack(category, true)}
                              className="px-3 py-1 rounded text-sm font-medium hover:opacity-80 transition-opacity"
                              style={{ backgroundColor: colors.card, color: colors.text }}
                            >
                              Slack ON
                            </button>
                            <button
                              onClick={() => handleToggleCategorySlack(category, false)}
                              className="px-3 py-1 rounded text-sm font-medium hover:opacity-80 transition-opacity"
                              style={{ backgroundColor: colors.card, color: colors.text }}
                            >
                              Slack OFF
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Category Types */}
                      {isExpanded && (
                        <div className="divide-y" style={{ borderColor: colors.border }}>
                          {categoryTypes.map(type => {
                            const isEnabled = type.config?.is_enabled !== false;
                            const slackEnabled = type.config?.notify_slack !== false;

                            return (
                              <div
                                key={type.id}
                                className={`px-6 py-4 hover:opacity-90 transition-opacity ${!isEnabled ? 'opacity-50' : ''}`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-4 flex-1">
                                    <span className="text-3xl">{type.icon}</span>
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <div className="font-semibold" style={{ color: colors.text }}>{type.name}</div>
                                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${severityColors[type.default_severity]}`}>
                                          {type.default_severity}
                                        </span>
                                      </div>
                                      <div className="text-sm" style={{ color: colors.textSecondary }}>{type.description}</div>
                                      <div className="text-xs mt-1 font-mono" style={{ color: colors.textSecondary }}>{type.slug}</div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-6">
                                    {/* Enabled Toggle */}
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                      <div className="relative">
                                        <input
                                          type="checkbox"
                                          checked={isEnabled}
                                          onChange={() => handleToggleEnabled(type)}
                                          className="sr-only"
                                        />
                                        <div className={`w-12 h-6 rounded-full transition-colors ${
                                          isEnabled ? 'bg-green-500' : 'bg-gray-300'
                                        }`}>
                                          <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                                            isEnabled ? 'translate-x-6' : 'translate-x-0'
                                          }`} />
                                        </div>
                                      </div>
                                      <span className="text-sm font-medium" style={{ color: colors.text }}>
                                        {isEnabled ? 'Ativa' : 'Inativa'}
                                      </span>
                                    </label>

                                    {/* Slack Toggle */}
                                    <label className={`flex items-center gap-2 cursor-pointer group ${!isEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                      <div className="relative">
                                        <input
                                          type="checkbox"
                                          checked={slackEnabled}
                                          onChange={() => handleToggleSlack(type)}
                                          disabled={!isEnabled}
                                          className="sr-only"
                                        />
                                        <div className={`w-12 h-6 rounded-full transition-colors ${
                                          slackEnabled && isEnabled ? 'bg-blue-500' : 'bg-gray-300'
                                        }`}>
                                          <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                                            slackEnabled && isEnabled ? 'translate-x-6' : 'translate-x-0'
                                          }`} />
                                        </div>
                                      </div>
                                      <span className="text-sm font-medium" style={{ color: colors.text }}>
                                        Slack {slackEnabled ? 'ON' : 'OFF'}
                                      </span>
                                    </label>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                {Object.keys(filteredGroupedTypes).length === 0 && (
                  <div className="text-center py-12" style={{ color: colors.textSecondary }}>
                    Nenhuma notificação encontrada com o termo "{configSearchTerm}"
                  </div>
                )}
              </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
              <div className="space-y-4">
                <div className="rounded-lg shadow-sm border p-4 flex gap-4" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
                  <select
                    value={selectedCategory}
                    onChange={(e) => { setSelectedCategory(e.target.value); loadNotifications(); }}
                    className="border rounded px-3 py-2"
                    style={{ backgroundColor: colors.card, color: colors.text, borderColor: colors.border }}
                  >
                    <option value="all">Todas Categorias</option>
                    {Object.entries(categoryNames).map(([key, name]) => (
                      <option key={key} value={key}>{name}</option>
                    ))}
                  </select>
                  <select
                    value={selectedSeverity}
                    onChange={(e) => { setSelectedSeverity(e.target.value); loadNotifications(); }}
                    className="border rounded px-3 py-2"
                    style={{ backgroundColor: colors.card, color: colors.text, borderColor: colors.border }}
                  >
                    <option value="all">Todas Severidades</option>
                    {Object.keys(severityColors).map(sev => (
                      <option key={sev} value={sev}>{sev}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Buscar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && loadNotifications()}
                    className="border rounded px-3 py-2 flex-1"
                    style={{ backgroundColor: colors.card, color: colors.text, borderColor: colors.border }}
                  />
                </div>

                <div className="rounded-lg shadow-sm border overflow-hidden" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
                  <table className="min-w-full divide-y" style={{ borderColor: colors.border }}>
                    <thead style={{ backgroundColor: colors.background }}>
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase" style={{ color: colors.textSecondary }}>Data</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase" style={{ color: colors.textSecondary }}>Tipo</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase" style={{ color: colors.textSecondary }}>Severidade</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase" style={{ color: colors.textSecondary }}>Título</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase" style={{ color: colors.textSecondary }}>Slack</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase" style={{ color: colors.textSecondary }}>Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: colors.border }}>
                      {notifications.map(notification => (
                        <tr key={notification.id} className="hover:opacity-90">
                          <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: colors.textSecondary }}>
                            {new Date(notification.created_at).toLocaleString('pt-BR')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-semibold rounded ${categoryColors[(notification.notification_type as any)?.category || 'info']?.bg} ${categoryColors[(notification.notification_type as any)?.category || 'info']?.text}`}>
                              {(notification.notification_type as any)?.name || 'N/A'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-semibold rounded ${severityColors[notification.severity]}`}>
                              {notification.severity}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm" style={{ color: colors.text }}>{notification.title}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {notification.sent_to_slack ? (
                              <span className="text-green-600 font-medium">✓ Enviada</span>
                            ) : notification.error_message ? (
                              <span className="text-red-600 font-medium">✗ Erro</span>
                            ) : (
                              <span style={{ color: colors.textSecondary }}>- Não enviada</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <button
                              onClick={() => setSelectedNotification(notification)}
                              className="font-medium hover:opacity-80"
                              style={{ color: colors.primary }}
                            >
                              Ver detalhes
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Test Tab */}
            {activeTab === 'test' && (
              <div className="rounded-lg shadow-sm border p-6 space-y-6" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
                <div>
                  <h3 className="text-lg font-semibold mb-4" style={{ color: colors.text }}>Enviar Notificação de Teste</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: colors.text }}>
                        Selecione o tipo de notificação
                      </label>
                      <select
                        value={testTypeSlug}
                        onChange={(e) => setTestTypeSlug(e.target.value)}
                        className="w-full border rounded px-3 py-2"
                        style={{ backgroundColor: colors.card, color: colors.text, borderColor: colors.border }}
                      >
                        <option value="">-- Selecione --</option>
                        {Object.entries(groupedTypes).map(([category, categoryTypes]) => (
                          <optgroup key={category} label={categoryNames[category]}>
                            {categoryTypes.map(type => (
                              <option key={type.id} value={type.slug}>
                                {type.icon} {type.name}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={handleSendTest}
                      disabled={!testTypeSlug}
                      className="px-4 py-2 rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                      style={{ backgroundColor: colors.primary, color: '#fff' }}
                    >
                      Enviar Teste
                    </button>
                    {testResult && (
                      <div className={`p-4 rounded ${testResult.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {testResult.message}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Notification Details Modal */}
            {selectedNotification && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-auto" style={{ backgroundColor: colors.card }}>
                  <div className="p-6 border-b" style={{ borderColor: colors.border }}>
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold" style={{ color: colors.text }}>Detalhes da Notificação</h3>
                      <button
                        onClick={() => setSelectedNotification(null)}
                        className="text-xl hover:opacity-80"
                        style={{ color: colors.textSecondary }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <div className="p-6 space-y-4">
                    <div>
                      <div className="text-sm font-medium mb-1" style={{ color: colors.textSecondary }}>Título</div>
                      <div style={{ color: colors.text }}>{selectedNotification.title}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium mb-1" style={{ color: colors.textSecondary }}>Mensagem</div>
                      <div style={{ color: colors.text }}>{selectedNotification.message}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium mb-1" style={{ color: colors.textSecondary }}>Metadata</div>
                      <pre className="text-xs p-3 rounded overflow-auto border" style={{ backgroundColor: colors.background, borderColor: colors.border, color: colors.text }}>
                        {JSON.stringify(selectedNotification.metadata, null, 2)}
                      </pre>
                    </div>
                    {selectedNotification.error_message && (
                      <div>
                        <div className="text-sm font-medium mb-1" style={{ color: colors.textSecondary }}>Erro</div>
                        <div className="bg-red-50 p-3 rounded border border-red-200 text-red-600">{selectedNotification.error_message}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        <FooterWis
          onNavigateToTerms={onNavigateToTerms}
          onNavigateToPrivacy={onNavigateToPrivacy}
          onNavigateToCookies={onNavigateToCookies}
        />
      </div>
    </div>
  );
}
