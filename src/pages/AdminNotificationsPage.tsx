import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { adminNotificationsService, NotificationTypeWithConfig, AdminNotification, NotificationStats } from '../services/AdminNotificationsService';
import Sidebar from '../components/Sidebar';
import LoadingSpinner from '../components/LoadingSpinner';

const categoryColors: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  success: { bg: 'bg-green-50', text: 'text-green-800', border: 'border-green-200', icon: '✅' },
  error: { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200', icon: '❌' },
  integration: { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200', icon: '🔗' },
  infrastructure: { bg: 'bg-orange-50', text: 'text-orange-800', border: 'border-orange-200', icon: '🏗️' },
  system: { bg: 'bg-gray-50', text: 'text-gray-800', border: 'border-gray-200', icon: '⚙️' },
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

export default function AdminNotificationsPage() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
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
    if (!user || !isAdmin) {
      navigate('/');
      return;
    }

    loadData();
  }, [user, isAdmin, navigate]);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([
      loadTypes(),
      loadStats(),
      loadNotifications(),
    ]);
    setLoading(false);
  };

  const loadTypes = async () => {
    const result = await adminNotificationsService.fetchNotificationTypes();
    if (result.success && result.data) {
      setTypes(result.data);
    }
  };

  const loadStats = async () => {
    const result = await adminNotificationsService.fetchNotificationStats();
    if (result.success && result.data) {
      setStats(result.data);
    }
  };

  const loadNotifications = async () => {
    const result = await adminNotificationsService.fetchNotifications({
      limit: 50,
      category: selectedCategory !== 'all' ? selectedCategory : undefined,
      severity: selectedSeverity !== 'all' ? selectedSeverity : undefined,
      search: searchTerm || undefined,
    });
    if (result.success && result.data) {
      setNotifications(result.data);
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

  // Filtrar tipos por busca
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

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Sistema de Notificações Administrativas</h1>
            <p className="text-gray-600">
              Gerencie 35 tipos de notificações em 5 categorias com integração Slack
            </p>
          </div>

          {/* Tabs */}
          <div className="mb-6 border-b border-gray-200">
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
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
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
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="text-sm font-medium text-gray-500">Hoje</div>
                  <div className="mt-2 text-3xl font-bold text-gray-900">{stats.total_today}</div>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="text-sm font-medium text-gray-500">Últimas 24h</div>
                  <div className="mt-2 text-3xl font-bold text-gray-900">{stats.total_last_24h}</div>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="text-sm font-medium text-gray-500">Enviadas ao Slack</div>
                  <div className="mt-2 text-3xl font-bold text-green-600">{stats.sent_to_slack}</div>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="text-sm font-medium text-gray-500">Falhas Slack</div>
                  <div className="mt-2 text-3xl font-bold text-red-600">{stats.failed_slack}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Severity Stats */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold mb-4">Por Severidade</h3>
                  <div className="space-y-3">
                    {Object.entries(stats.by_severity).map(([severity, count]) => (
                      <div key={severity} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`px-3 py-1 text-xs font-semibold rounded-full ${severityColors[severity]}`}>
                            {severity.toUpperCase()}
                          </span>
                        </div>
                        <span className="text-lg font-bold text-gray-900">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Category Stats */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold mb-4">Por Categoria</h3>
                  <div className="space-y-3">
                    {Object.entries(stats.by_category).map(([category, count]) => (
                      <div key={category} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{categoryColors[category]?.icon}</span>
                          <span className={`px-3 py-1 text-xs font-semibold rounded-full ${categoryColors[category]?.bg} ${categoryColors[category]?.text}`}>
                            {categoryNames[category] || category}
                          </span>
                        </div>
                        <span className="text-lg font-bold text-gray-900">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Category Overview */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold mb-4">Visão Geral por Categoria</h3>
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
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex items-center gap-3">
                  <span className="text-gray-400 text-xl">🔍</span>
                  <input
                    type="text"
                    placeholder="Buscar por nome, descrição ou slug..."
                    value={configSearchTerm}
                    onChange={(e) => setConfigSearchTerm(e.target.value)}
                    className="flex-1 border-none focus:ring-0 text-gray-900 placeholder-gray-400"
                  />
                  {configSearchTerm && (
                    <button
                      onClick={() => setConfigSearchTerm('')}
                      className="text-gray-400 hover:text-gray-600"
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
                const colors = categoryColors[category];

                return (
                  <div key={category} className={`bg-white rounded-lg shadow-sm border-2 ${colors.border} overflow-hidden`}>
                    {/* Category Header */}
                    <div className={`${colors.bg} ${colors.text} px-6 py-4`}>
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => toggleCategory(category)}
                          className="flex items-center gap-3 flex-1"
                        >
                          <span className="text-2xl">{colors.icon}</span>
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
                            className="px-3 py-1 bg-white rounded text-sm font-medium hover:bg-gray-50 transition-colors"
                          >
                            Ativar Todas
                          </button>
                          <button
                            onClick={() => handleToggleCategoryEnabled(category, false)}
                            className="px-3 py-1 bg-white rounded text-sm font-medium hover:bg-gray-50 transition-colors"
                          >
                            Desativar Todas
                          </button>
                          <button
                            onClick={() => handleToggleCategorySlack(category, true)}
                            className="px-3 py-1 bg-white rounded text-sm font-medium hover:bg-gray-50 transition-colors"
                          >
                            Slack ON
                          </button>
                          <button
                            onClick={() => handleToggleCategorySlack(category, false)}
                            className="px-3 py-1 bg-white rounded text-sm font-medium hover:bg-gray-50 transition-colors"
                          >
                            Slack OFF
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Category Types */}
                    {isExpanded && (
                      <div className="divide-y divide-gray-100">
                        {categoryTypes.map(type => {
                          const isEnabled = type.config?.is_enabled !== false;
                          const slackEnabled = type.config?.notify_slack !== false;

                          return (
                            <div
                              key={type.id}
                              className={`px-6 py-4 hover:bg-gray-50 transition-colors ${!isEnabled ? 'opacity-50' : ''}`}
                            >
                              <div className="flex items-center justify-between">
                                {/* Icon & Info */}
                                <div className="flex items-center gap-4 flex-1">
                                  <span className="text-3xl">{type.icon}</span>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <div className="font-semibold text-gray-900">{type.name}</div>
                                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${severityColors[type.default_severity]}`}>
                                        {type.default_severity}
                                      </span>
                                    </div>
                                    <div className="text-sm text-gray-600">{type.description}</div>
                                    <div className="text-xs text-gray-400 mt-1 font-mono">{type.slug}</div>
                                  </div>
                                </div>

                                {/* Toggles */}
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
                                    <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
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
                                    <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
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
                <div className="text-center py-12 text-gray-500">
                  Nenhuma notificação encontrada com o termo "{configSearchTerm}"
                </div>
              )}
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex gap-4">
                <select
                  value={selectedCategory}
                  onChange={(e) => { setSelectedCategory(e.target.value); loadNotifications(); }}
                  className="border border-gray-300 rounded px-3 py-2"
                >
                  <option value="all">Todas Categorias</option>
                  {Object.entries(categoryNames).map(([key, name]) => (
                    <option key={key} value={key}>{name}</option>
                  ))}
                </select>
                <select
                  value={selectedSeverity}
                  onChange={(e) => { setSelectedSeverity(e.target.value); loadNotifications(); }}
                  className="border border-gray-300 rounded px-3 py-2"
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
                  className="border border-gray-300 rounded px-3 py-2 flex-1"
                />
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Severidade</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Título</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Slack</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {notifications.map(notification => (
                      <tr key={notification.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
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
                        <td className="px-6 py-4 text-sm text-gray-900">{notification.title}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {notification.sent_to_slack ? (
                            <span className="text-green-600 font-medium">✓ Enviada</span>
                          ) : notification.error_message ? (
                            <span className="text-red-600 font-medium">✗ Erro</span>
                          ) : (
                            <span className="text-gray-400">- Não enviada</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => setSelectedNotification(notification)}
                            className="text-blue-600 hover:text-blue-800 font-medium"
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
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Enviar Notificação de Teste</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Selecione o tipo de notificação
                    </label>
                    <select
                      value={testTypeSlug}
                      onChange={(e) => setTestTypeSlug(e.target.value)}
                      className="w-full border border-gray-300 rounded px-3 py-2"
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
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
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
              <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-auto">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Detalhes da Notificação</h3>
                    <button
                      onClick={() => setSelectedNotification(null)}
                      className="text-gray-400 hover:text-gray-600 text-xl"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <div className="text-sm font-medium text-gray-500 mb-1">Título</div>
                    <div className="text-gray-900">{selectedNotification.title}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-500 mb-1">Mensagem</div>
                    <div className="text-gray-900">{selectedNotification.message}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-500 mb-1">Metadata</div>
                    <pre className="text-xs bg-gray-50 p-3 rounded overflow-auto border border-gray-200">
                      {JSON.stringify(selectedNotification.metadata, null, 2)}
                    </pre>
                  </div>
                  {selectedNotification.error_message && (
                    <div>
                      <div className="text-sm font-medium text-gray-500 mb-1">Erro</div>
                      <div className="text-red-600 bg-red-50 p-3 rounded border border-red-200">{selectedNotification.error_message}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
