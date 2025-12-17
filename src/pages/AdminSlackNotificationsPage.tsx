import React, { useState, useEffect } from 'react';
import { SidebarWis } from '../components/SidebarWis';
import { FooterWis } from '../components/FooterWis';
import { Bell, Plus, Trash2, Edit2, Check, X, Loader, TestTube2, ChevronLeft, Power, PowerOff, UserPlus, CreditCard, TrendingUp, TrendingDown, XCircle, Coins, CheckCircle, AlertTriangle } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';
import { slackNotificationService, SlackNotificationConfig, NOTIFICATION_TYPES } from '../services/SlackNotificationService';

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
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [configs, setConfigs] = useState<SlackNotificationConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState<SlackNotificationConfig | null>(null);
  const [testingWebhook, setTestingWebhook] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    webhook_url: '',
    channel_name: '',
    notification_types: [] as string[],
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      setLoading(true);
      const data = await slackNotificationService.getAllConfigs();
      setConfigs(data);
    } catch (error) {
      console.error('Error loading Slack configurations:', error);
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.webhook_url.trim()) {
      errors.webhook_url = 'URL do webhook é obrigatória';
    } else if (!formData.webhook_url.startsWith('https://hooks.slack.com/')) {
      errors.webhook_url = 'URL inválida. Deve começar com https://hooks.slack.com/';
    }

    if (!formData.channel_name.trim()) {
      errors.channel_name = 'Nome do canal é obrigatório';
    }

    if (formData.notification_types.length === 0) {
      errors.notification_types = 'Selecione pelo menos um tipo de notificação';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      if (editingConfig) {
        await slackNotificationService.updateConfig(editingConfig.id, formData);
      } else {
        await slackNotificationService.createConfig(formData);
      }
      await loadConfigs();
      closeModal();
    } catch (error) {
      console.error('Error saving Slack configuration:', error);
      alert('Erro ao salvar configuração');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja deletar esta configuração?')) {
      return;
    }

    try {
      await slackNotificationService.deleteConfig(id);
      await loadConfigs();
    } catch (error) {
      console.error('Error deleting Slack configuration:', error);
      alert('Erro ao deletar configuração');
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      await slackNotificationService.toggleActive(id, !currentStatus);
      await loadConfigs();
    } catch (error) {
      console.error('Error toggling Slack configuration:', error);
      alert('Erro ao alterar status da configuração');
    }
  };

  const handleTestWebhook = async (webhookUrl: string, configId: string) => {
    setTestingWebhook(configId);
    try {
      const success = await slackNotificationService.testWebhook(webhookUrl);
      if (success) {
        alert('Webhook testado com sucesso! Verifique seu canal no Slack.');
      } else {
        alert('Falha ao testar webhook. Verifique a URL e tente novamente.');
      }
    } catch (error) {
      console.error('Error testing webhook:', error);
      alert('Erro ao testar webhook');
    } finally {
      setTestingWebhook(null);
    }
  };

  const openCreateModal = () => {
    setEditingConfig(null);
    setFormData({
      webhook_url: '',
      channel_name: '',
      notification_types: [],
    });
    setFormErrors({});
    setShowModal(true);
  };

  const openEditModal = (config: SlackNotificationConfig) => {
    setEditingConfig(config);
    setFormData({
      webhook_url: config.webhook_url,
      channel_name: config.channel_name,
      notification_types: config.notification_types,
    });
    setFormErrors({});
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingConfig(null);
    setFormData({
      webhook_url: '',
      channel_name: '',
      notification_types: [],
    });
    setFormErrors({});
  };

  const toggleNotificationType = (type: string) => {
    setFormData(prev => ({
      ...prev,
      notification_types: prev.notification_types.includes(type)
        ? prev.notification_types.filter(t => t !== type)
        : [...prev.notification_types, type],
    }));
  };

  const getIconForNotificationType = (type: string) => {
    switch (type) {
      case 'user_signup':
        return <UserPlus className="w-4 h-4" />;
      case 'subscription_created':
        return <CreditCard className="w-4 h-4" />;
      case 'subscription_cancelled':
        return <XCircle className="w-4 h-4" />;
      case 'subscription_upgraded':
        return <TrendingUp className="w-4 h-4" />;
      case 'subscription_downgraded':
        return <TrendingDown className="w-4 h-4" />;
      case 'token_purchase':
        return <Coins className="w-4 h-4" />;
      case 'analysis_completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'analysis_failed':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <Bell className="w-4 h-4" />;
    }
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

      <main className={`flex-1 flex flex-col transition-all duration-300 pt-16 lg:pt-0 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
        <div className="flex-1 px-4 sm:px-6 py-6 sm:py-8 overflow-x-hidden">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors mb-6 hover:opacity-80 max-w-6xl"
            style={{
              backgroundColor: colors.bgSecondary,
              color: colors.textPrimary
            }}
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Voltar ao Painel</span>
          </button>

          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col items-center mb-6 sm:mb-8">
              <div className="p-2.5 sm:p-3 rounded-lg mb-3 sm:mb-4" style={{ backgroundColor: colors.bgSecondary }}>
                <Bell className="w-6 h-6 sm:w-8 sm:h-8" style={{ color: '#10B981' }} />
              </div>
              <div className="text-center">
                <h1 className="text-2xl sm:text-3xl font-title font-bold" style={{ color: colors.textPrimary }}>
                  Notificações Slack
                </h1>
                <p className="text-xs sm:text-sm mt-1 px-4" style={{ color: colors.textSecondary }}>
                  Configure webhooks do Slack para receber notificações de eventos
                </p>
              </div>
            </div>

            <div className="mb-4 sm:mb-6 flex justify-end">
              <button
                onClick={openCreateModal}
                className="flex items-center gap-2 px-4 py-2.5 sm:py-3 rounded-lg transition-colors hover:opacity-90 text-sm sm:text-base font-medium"
                style={{
                  backgroundColor: '#10B981',
                  color: 'white',
                }}
              >
                <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>Nova Configuração</span>
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader className="w-8 h-8 animate-spin" style={{ color: '#10B981' }} />
              </div>
            ) : configs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 rounded-lg" style={{ backgroundColor: colors.bgSecondary }}>
                <div className="p-4 rounded-full mb-4" style={{ backgroundColor: colors.bgPrimary }}>
                  <Bell className="w-12 h-12 sm:w-16 sm:h-16" style={{ color: colors.textSecondary }} />
                </div>
                <h3 className="text-base sm:text-lg font-title font-semibold mb-2 text-center" style={{ color: colors.textPrimary }}>
                  Nenhuma configuração encontrada
                </h3>
                <p className="text-xs sm:text-sm mb-6 text-center max-w-md" style={{ color: colors.textSecondary }}>
                  Crie sua primeira configuração para começar a receber notificações no Slack
                </p>
                <button
                  onClick={openCreateModal}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors hover:opacity-90 text-sm font-medium"
                  style={{
                    backgroundColor: '#10B981',
                    color: 'white',
                  }}
                >
                  <Plus className="w-4 h-4" />
                  <span>Criar Configuração</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {configs.map(config => (
                  <div
                    key={config.id}
                    className="p-4 sm:p-6 rounded-lg shadow-sm"
                    style={{ backgroundColor: colors.bgSecondary }}
                  >
                    <div className="flex flex-col sm:flex-row items-start justify-between gap-4 mb-4">
                      <div className="flex-1 w-full">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <h3 className="text-base sm:text-lg font-title font-semibold" style={{ color: colors.textPrimary }}>
                            {config.channel_name}
                          </h3>
                          <span
                            className="px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1.5"
                            style={{
                              backgroundColor: config.is_active
                                ? 'rgba(16, 185, 129, 0.1)'
                                : 'rgba(239, 68, 68, 0.1)',
                              color: config.is_active ? '#10B981' : '#ef4444',
                            }}
                          >
                            {config.is_active ? <Power className="w-3 h-3" /> : <PowerOff className="w-3 h-3" />}
                            {config.is_active ? 'Ativo' : 'Inativo'}
                          </span>
                        </div>
                        <p
                          className="text-xs sm:text-sm mb-3 font-mono break-all"
                          style={{ color: colors.textSecondary }}
                        >
                          {config.webhook_url}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {config.notification_types.map(type => (
                            <span
                              key={type}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5"
                              style={{
                                backgroundColor: colors.bgPrimary,
                                color: colors.textPrimary,
                                border: `1px solid ${theme === 'dark' ? '#374151' : '#E5E7EB'}`,
                              }}
                            >
                              {getIconForNotificationType(type)}
                              {slackNotificationService.getNotificationTypeLabel(type)}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                          onClick={() => handleTestWebhook(config.webhook_url, config.id)}
                          disabled={testingWebhook === config.id}
                          className="p-2 rounded-lg transition-colors hover:opacity-80"
                          style={{
                            backgroundColor: colors.bgPrimary,
                            color: colors.textSecondary,
                          }}
                          title="Testar webhook"
                        >
                          {testingWebhook === config.id ? (
                            <Loader className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                          ) : (
                            <TestTube2 className="w-4 h-4 sm:w-5 sm:h-5" />
                          )}
                        </button>
                        <button
                          onClick={() => handleToggleActive(config.id, config.is_active)}
                          className="p-2 rounded-lg transition-colors hover:opacity-80"
                          style={{
                            backgroundColor: colors.bgPrimary,
                            color: config.is_active ? '#10B981' : colors.textSecondary,
                          }}
                          title={config.is_active ? 'Desativar' : 'Ativar'}
                        >
                          {config.is_active ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
                        </button>
                        <button
                          onClick={() => openEditModal(config)}
                          className="p-2 rounded-lg transition-colors hover:opacity-80"
                          style={{
                            backgroundColor: colors.bgPrimary,
                            color: colors.textSecondary,
                          }}
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(config.id)}
                          className="p-2 rounded-lg transition-colors hover:opacity-80"
                          style={{
                            backgroundColor: colors.bgPrimary,
                            color: '#ef4444',
                          }}
                          title="Deletar"
                        >
                          <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                      </div>
                    </div>
                    <div className="text-xs mt-3 pt-3 border-t" style={{ color: colors.textSecondary, borderColor: theme === 'dark' ? '#374151' : '#E5E7EB' }}>
                      Criado em: {new Date(config.created_at).toLocaleString('pt-BR')}
                      {config.updated_at !== config.created_at && (
                        <> | Atualizado em: {new Date(config.updated_at).toLocaleString('pt-BR')}</>
                      )}
                    </div>
                  </div>
                ))}
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

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div
            className="rounded-lg p-4 sm:p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl"
            style={{ backgroundColor: colors.bgSecondary }}
          >
            <h2 className="text-lg sm:text-xl font-title font-bold mb-4 sm:mb-6" style={{ color: colors.textPrimary }}>
              {editingConfig ? 'Editar Configuração' : 'Nova Configuração'}
            </h2>

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2" style={{ color: colors.textPrimary }}>
                  Nome do Canal/Configuração
                </label>
                <input
                  type="text"
                  value={formData.channel_name}
                  onChange={e => setFormData({ ...formData, channel_name: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  style={{
                    backgroundColor: colors.bgPrimary,
                    color: colors.textPrimary,
                    border: `1px solid ${formErrors.channel_name ? '#ef4444' : (theme === 'dark' ? '#4B5563' : '#D1D5DB')}`,
                  }}
                  placeholder="Ex: notificacoes-gerais"
                />
                {formErrors.channel_name && (
                  <p className="text-xs text-red-500 mt-1">{formErrors.channel_name}</p>
                )}
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2" style={{ color: colors.textPrimary }}>
                  URL do Webhook
                </label>
                <input
                  type="text"
                  value={formData.webhook_url}
                  onChange={e => setFormData({ ...formData, webhook_url: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg font-mono text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  style={{
                    backgroundColor: colors.bgPrimary,
                    color: colors.textPrimary,
                    border: `1px solid ${formErrors.webhook_url ? '#ef4444' : (theme === 'dark' ? '#4B5563' : '#D1D5DB')}`,
                  }}
                  placeholder="https://hooks.slack.com/services/..."
                />
                {formErrors.webhook_url && (
                  <p className="text-xs text-red-500 mt-1">{formErrors.webhook_url}</p>
                )}
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium mb-3" style={{ color: colors.textPrimary }}>
                  Tipos de Notificação
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                  {NOTIFICATION_TYPES.map(notifType => (
                    <label
                      key={notifType.value}
                      className="flex items-center gap-2.5 p-3 rounded-lg cursor-pointer transition-all hover:opacity-90"
                      style={{
                        backgroundColor: formData.notification_types.includes(notifType.value)
                          ? (theme === 'dark' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.1)')
                          : colors.bgPrimary,
                        border: `1.5px solid ${
                          formData.notification_types.includes(notifType.value)
                            ? '#3B82F6'
                            : (theme === 'dark' ? '#4B5563' : '#D1D5DB')
                        }`,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={formData.notification_types.includes(notifType.value)}
                        onChange={() => toggleNotificationType(notifType.value)}
                        className="w-4 h-4 rounded"
                        style={{ accentColor: '#3B82F6' }}
                      />
                      <span style={{ color: colors.textPrimary }}>
                        {getIconForNotificationType(notifType.value)}
                      </span>
                      <span className="text-xs sm:text-sm flex-1" style={{ color: colors.textPrimary }}>
                        {notifType.label}
                      </span>
                    </label>
                  ))}
                </div>
                {formErrors.notification_types && (
                  <p className="text-xs text-red-500 mt-2">{formErrors.notification_types}</p>
                )}
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2.5 rounded-lg transition-colors hover:opacity-80 text-sm font-medium"
                  style={{
                    backgroundColor: colors.bgPrimary,
                    color: colors.textPrimary,
                    border: `1px solid ${theme === 'dark' ? '#4B5563' : '#D1D5DB'}`,
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-lg transition-colors hover:opacity-90 text-sm font-medium"
                  style={{
                    backgroundColor: '#10B981',
                    color: 'white',
                  }}
                >
                  {editingConfig ? 'Salvar Alterações' : 'Criar Configuração'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
