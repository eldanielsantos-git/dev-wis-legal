import React, { useState, useEffect } from 'react';
import { SidebarWis } from '../components/SidebarWis';
import { FooterWis } from '../components/FooterWis';
import { Bell, Plus, Trash2, Edit2, ArrowLeft, Check, X, Loader, TestTube2 } from 'lucide-react';
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
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={onNavigateToAdmin}
                  className="p-2 rounded-lg transition-colors"
                  style={{
                    backgroundColor: colors.surface,
                    color: colors.textSecondary,
                  }}
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h1 className="text-2xl font-bold" style={{ color: colors.text }}>
                    Notificações Slack
                  </h1>
                  <p className="text-sm" style={{ color: colors.textSecondary }}>
                    Configure webhooks do Slack para receber notificações
                  </p>
                </div>
              </div>
              <button
                onClick={openCreateModal}
                className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
                style={{
                  backgroundColor: colors.primary,
                  color: 'white',
                }}
              >
                <Plus className="w-5 h-5" />
                <span>Nova Configuração</span>
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader className="w-8 h-8 animate-spin" style={{ color: colors.primary }} />
              </div>
            ) : configs.length === 0 ? (
              <div className="text-center py-12">
                <Bell className="w-16 h-16 mx-auto mb-4" style={{ color: colors.textSecondary }} />
                <h3 className="text-lg font-medium mb-2" style={{ color: colors.text }}>
                  Nenhuma configuração encontrada
                </h3>
                <p className="mb-4" style={{ color: colors.textSecondary }}>
                  Crie sua primeira configuração para começar a receber notificações no Slack
                </p>
                <button
                  onClick={openCreateModal}
                  className="px-4 py-2 rounded-lg transition-colors"
                  style={{
                    backgroundColor: colors.primary,
                    color: 'white',
                  }}
                >
                  Criar Configuração
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {configs.map(config => (
                  <div
                    key={config.id}
                    className="p-6 rounded-lg"
                    style={{ backgroundColor: colors.surface }}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold" style={{ color: colors.text }}>
                            {config.channel_name}
                          </h3>
                          <span
                            className="px-2 py-1 rounded text-xs font-medium"
                            style={{
                              backgroundColor: config.is_active
                                ? 'rgba(34, 197, 94, 0.1)'
                                : 'rgba(239, 68, 68, 0.1)',
                              color: config.is_active ? '#22c55e' : '#ef4444',
                            }}
                          >
                            {config.is_active ? 'Ativo' : 'Inativo'}
                          </span>
                        </div>
                        <p
                          className="text-sm mb-3 font-mono"
                          style={{ color: colors.textSecondary }}
                        >
                          {config.webhook_url}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {config.notification_types.map(type => (
                            <span
                              key={type}
                              className="px-3 py-1 rounded-full text-xs"
                              style={{
                                backgroundColor: colors.background,
                                color: colors.text,
                              }}
                            >
                              {slackNotificationService.getNotificationTypeIcon(type)}{' '}
                              {slackNotificationService.getNotificationTypeLabel(type)}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => handleTestWebhook(config.webhook_url, config.id)}
                          disabled={testingWebhook === config.id}
                          className="p-2 rounded-lg transition-colors"
                          style={{
                            backgroundColor: colors.background,
                            color: colors.textSecondary,
                          }}
                          title="Testar webhook"
                        >
                          {testingWebhook === config.id ? (
                            <Loader className="w-5 h-5 animate-spin" />
                          ) : (
                            <TestTube2 className="w-5 h-5" />
                          )}
                        </button>
                        <button
                          onClick={() => handleToggleActive(config.id, config.is_active)}
                          className="p-2 rounded-lg transition-colors"
                          style={{
                            backgroundColor: colors.background,
                            color: config.is_active ? '#22c55e' : colors.textSecondary,
                          }}
                          title={config.is_active ? 'Desativar' : 'Ativar'}
                        >
                          {config.is_active ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
                        </button>
                        <button
                          onClick={() => openEditModal(config)}
                          className="p-2 rounded-lg transition-colors"
                          style={{
                            backgroundColor: colors.background,
                            color: colors.textSecondary,
                          }}
                          title="Editar"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(config.id)}
                          className="p-2 rounded-lg transition-colors"
                          style={{
                            backgroundColor: colors.background,
                            color: '#ef4444',
                          }}
                          title="Deletar"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    <div className="text-xs" style={{ color: colors.textSecondary }}>
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
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div
            className="rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            style={{ backgroundColor: colors.surface }}
          >
            <h2 className="text-xl font-bold mb-4" style={{ color: colors.text }}>
              {editingConfig ? 'Editar Configuração' : 'Nova Configuração'}
            </h2>

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2" style={{ color: colors.text }}>
                  Nome do Canal/Configuração
                </label>
                <input
                  type="text"
                  value={formData.channel_name}
                  onChange={e => setFormData({ ...formData, channel_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg"
                  style={{
                    backgroundColor: colors.background,
                    color: colors.text,
                    border: `1px solid ${formErrors.channel_name ? '#ef4444' : colors.border}`,
                  }}
                  placeholder="Ex: notificacoes-gerais"
                />
                {formErrors.channel_name && (
                  <p className="text-xs text-red-500 mt-1">{formErrors.channel_name}</p>
                )}
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2" style={{ color: colors.text }}>
                  URL do Webhook
                </label>
                <input
                  type="text"
                  value={formData.webhook_url}
                  onChange={e => setFormData({ ...formData, webhook_url: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg font-mono text-sm"
                  style={{
                    backgroundColor: colors.background,
                    color: colors.text,
                    border: `1px solid ${formErrors.webhook_url ? '#ef4444' : colors.border}`,
                  }}
                  placeholder="https://hooks.slack.com/services/..."
                />
                {formErrors.webhook_url && (
                  <p className="text-xs text-red-500 mt-1">{formErrors.webhook_url}</p>
                )}
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium mb-3" style={{ color: colors.text }}>
                  Tipos de Notificação
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {NOTIFICATION_TYPES.map(notifType => (
                    <label
                      key={notifType.value}
                      className="flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors"
                      style={{
                        backgroundColor: formData.notification_types.includes(notifType.value)
                          ? colors.background
                          : 'transparent',
                        border: `1px solid ${
                          formData.notification_types.includes(notifType.value)
                            ? colors.primary
                            : colors.border
                        }`,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={formData.notification_types.includes(notifType.value)}
                        onChange={() => toggleNotificationType(notifType.value)}
                        className="w-4 h-4"
                      />
                      <span className="text-lg">{notifType.icon}</span>
                      <span className="text-sm" style={{ color: colors.text }}>
                        {notifType.label}
                      </span>
                    </label>
                  ))}
                </div>
                {formErrors.notification_types && (
                  <p className="text-xs text-red-500 mt-1">{formErrors.notification_types}</p>
                )}
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 rounded-lg transition-colors"
                  style={{
                    backgroundColor: colors.background,
                    color: colors.text,
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg transition-colors"
                  style={{
                    backgroundColor: colors.primary,
                    color: 'white',
                  }}
                >
                  {editingConfig ? 'Salvar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
