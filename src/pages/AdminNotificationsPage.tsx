import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { adminNotificationsService, NotificationTypeWithConfig, AdminNotification, NotificationStats } from '../services/AdminNotificationsService';
import Sidebar from '../components/Sidebar';
import LoadingSpinner from '../components/LoadingSpinner';

const categoryColors: Record<string, string> = {
  success: 'bg-green-100 text-green-800',
  error: 'bg-red-100 text-red-800',
  warning: 'bg-yellow-100 text-yellow-800',
  info: 'bg-blue-100 text-blue-800',
  system: 'bg-gray-100 text-gray-800',
  integration: 'bg-purple-100 text-purple-800',
  infrastructure: 'bg-indigo-100 text-indigo-800',
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
  const [activeTab, setActiveTab] = useState<'stats' | 'config' | 'history' | 'test'>('stats');

  const [types, setTypes] = useState<NotificationTypeWithConfig[]>([]);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [stats, setStats] = useState<NotificationStats | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNotification, setSelectedNotification] = useState<AdminNotification | null>(null);

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

  const groupedTypes = types.reduce((acc, type) => {
    if (!acc[type.category]) {
      acc[type.category] = [];
    }
    acc[type.category].push(type);
    return acc;
  }, {} as Record<string, NotificationTypeWithConfig[]>);

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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Sistema de Notificações Administrativas</h1>
          <p className="text-gray-600 mb-8">Gerencie notificações e integrações com Slack</p>

          <div className="mb-6 border-b border-gray-200">
            <nav className="flex space-x-8">
              <button
                onClick={() => setActiveTab('stats')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'stats'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Estatísticas
              </button>
              <button
                onClick={() => setActiveTab('config')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'config'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Configurações
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'history'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Histórico
              </button>
              <button
                onClick={() => setActiveTab('test')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'test'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Testar
              </button>
            </nav>
          </div>

          {activeTab === 'stats' && stats && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="text-sm font-medium text-gray-500">Hoje</div>
                  <div className="mt-2 text-3xl font-bold text-gray-900">{stats.total_today}</div>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="text-sm font-medium text-gray-500">Últimas 24h</div>
                  <div className="mt-2 text-3xl font-bold text-gray-900">{stats.total_last_24h}</div>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="text-sm font-medium text-gray-500">Enviadas ao Slack</div>
                  <div className="mt-2 text-3xl font-bold text-green-600">{stats.sent_to_slack}</div>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="text-sm font-medium text-gray-500">Falhas Slack</div>
                  <div className="mt-2 text-3xl font-bold text-red-600">{stats.failed_slack}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4">Por Severidade</h3>
                  <div className="space-y-2">
                    {Object.entries(stats.by_severity).map(([severity, count]) => (
                      <div key={severity} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 text-xs font-semibold rounded ${severityColors[severity]}`}>
                            {severity.toUpperCase()}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-gray-900">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4">Por Categoria</h3>
                  <div className="space-y-2">
                    {Object.entries(stats.by_category).map(([category, count]) => (
                      <div key={category} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 text-xs font-semibold rounded ${categoryColors[category]}`}>
                            {category}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-gray-900">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'config' && (
            <div className="space-y-6">
              {Object.entries(groupedTypes).map(([category, categoryTypes]) => (
                <div key={category} className="bg-white rounded-lg shadow">
                  <div className={`px-6 py-4 border-b ${categoryColors[category]}`}>
                    <h3 className="text-lg font-semibold capitalize">{category}</h3>
                  </div>
                  <div className="divide-y">
                    {categoryTypes.map(type => (
                      <div key={type.id} className="px-6 py-4 flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{type.icon}</span>
                            <div>
                              <div className="font-medium text-gray-900">{type.name}</div>
                              <div className="text-sm text-gray-500">{type.description}</div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={type.config?.is_enabled ?? true}
                              onChange={() => handleToggleEnabled(type)}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">Habilitada</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={type.config?.notify_slack ?? true}
                              onChange={() => handleToggleSlack(type)}
                              disabled={!type.config?.is_enabled}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 disabled:opacity-50"
                            />
                            <span className="text-sm text-gray-700">Slack</span>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="bg-white rounded-lg shadow p-4 flex gap-4">
                <select
                  value={selectedCategory}
                  onChange={(e) => { setSelectedCategory(e.target.value); loadNotifications(); }}
                  className="border rounded px-3 py-2"
                >
                  <option value="all">Todas Categorias</option>
                  {Object.keys(categoryColors).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <select
                  value={selectedSeverity}
                  onChange={(e) => { setSelectedSeverity(e.target.value); loadNotifications(); }}
                  className="border rounded px-3 py-2"
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
                />
              </div>

              <div className="bg-white rounded-lg shadow overflow-hidden">
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
                          <span className={`px-2 py-1 text-xs font-semibold rounded ${categoryColors[(notification.notification_type as any)?.category || 'info']}`}>
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
                            <span className="text-green-600">✓ Enviada</span>
                          ) : notification.error_message ? (
                            <span className="text-red-600">✗ Erro</span>
                          ) : (
                            <span className="text-gray-400">- Não enviada</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => setSelectedNotification(notification)}
                            className="text-blue-600 hover:text-blue-800"
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

          {activeTab === 'test' && (
            <div className="bg-white rounded-lg shadow p-6 space-y-6">
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
                      className="w-full border rounded px-3 py-2"
                    >
                      <option value="">-- Selecione --</option>
                      {types.map(type => (
                        <option key={type.id} value={type.slug}>
                          {type.icon} {type.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={handleSendTest}
                    disabled={!testTypeSlug}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
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

          {selectedNotification && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-auto">
                <div className="p-6 border-b">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Detalhes da Notificação</h3>
                    <button
                      onClick={() => setSelectedNotification(null)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <div className="text-sm font-medium text-gray-500">Título</div>
                    <div className="mt-1 text-gray-900">{selectedNotification.title}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-500">Mensagem</div>
                    <div className="mt-1 text-gray-900">{selectedNotification.message}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-500">Metadata</div>
                    <pre className="mt-1 text-xs bg-gray-50 p-3 rounded overflow-auto">
                      {JSON.stringify(selectedNotification.metadata, null, 2)}
                    </pre>
                  </div>
                  {selectedNotification.error_message && (
                    <div>
                      <div className="text-sm font-medium text-gray-500">Erro</div>
                      <div className="mt-1 text-red-600">{selectedNotification.error_message}</div>
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
