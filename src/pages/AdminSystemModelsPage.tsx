import React, { useState, useEffect } from 'react';
import { Cpu, Plus, Save, X, CheckCircle, AlertCircle, Trash2, ChevronUp, ChevronDown, ToggleLeft, ToggleRight, Edit2, ArrowLeft } from 'lucide-react';
import { SidebarWis } from '../components/SidebarWis';
import { FooterWis } from '../components/FooterWis';
import { IntelligentSearch } from '../components/IntelligentSearch';
import { AdminSystemModelsService } from '../services/AdminSystemModelsService';
import type { AdminSystemModel } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';

interface AdminSystemModelsPageProps {
  onBack: () => void;
  onNavigateToApp?: () => void;
  onNavigateToMyProcess?: () => void;
  onNavigateToChat?: () => void;
  onNavigateToWorkspace?: () => void;
  onNavigateToSchedule?: () => void;
  onNavigateToAdmin?: () => void;
  onNavigateToProfile?: () => void;
  onNavigateToNotifications?: () => void;
  onNavigateToTokens?: () => void;
  onNavigateToSubscription?: () => void;
  onNavigateToTerms?: () => void;
  onNavigateToPrivacy?: () => void;
  onNavigateToCookies?: () => void;
}

const LLM_PROVIDERS = [
  { value: 'Google', label: 'Google' },
  { value: 'Anthropic', label: 'Anthropic' },
  { value: 'OpenAI', label: 'OpenAI' },
  { value: 'Deepseek', label: 'Deepseek' },
  { value: 'Grok', label: 'Grok' },
  { value: 'Outro', label: 'Incluir novo' },
];

type TabType = 'analysis' | 'chat';

export function AdminSystemModelsPage({
  onBack,
  onNavigateToApp,
  onNavigateToMyProcess,
  onNavigateToChat, onNavigateToWorkspace,
  onNavigateToSchedule,
  onNavigateToAdmin,
  onNavigateToProfile,
  onNavigateToNotifications,
  onNavigateToTokens,
  onNavigateToSubscription,
  onNavigateToTerms,
  onNavigateToPrivacy,
  onNavigateToCookies,
}: AdminSystemModelsPageProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('analysis');
  const [models, setModels] = useState<AdminSystemModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingModel, setEditingModel] = useState<AdminSystemModel | null>(null);
  const [llmProvider, setLlmProvider] = useState('Google');
  const [displayName, setDisplayName] = useState('');
  const [systemModel, setSystemModel] = useState('');
  const [temperature, setTemperature] = useState('');
  const [priority, setPriority] = useState('');
  const [creating, setCreating] = useState(false);

  const [showConfirmCreate, setShowConfirmCreate] = useState(false);
  const [showConfirmEdit, setShowConfirmEdit] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    try {
      setLoading(true);
      setError(null);
      const allModels = await AdminSystemModelsService.getAllModels();
      setModels(allModels);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar modelos');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClick = () => {
    setShowCreateForm(true);
    setError(null);
    setSuccessMessage(null);
  };

  const handleCancelCreate = () => {
    setShowCreateForm(false);
    setEditingModel(null);
    setShowConfirmCreate(false);
    setShowConfirmEdit(false);
    setLlmProvider('Google');
    setDisplayName('');
    setSystemModel('');
    setTemperature('');
    setPriority('');
    setError(null);
  };

  const handleEditClick = (model: AdminSystemModel) => {
    setEditingModel(model);
    setLlmProvider(model.llm_provider || 'Google');
    setDisplayName(model.display_name || model.name || '');
    setSystemModel(model.system_model || model.model_id || '');
    setTemperature(model.temperature !== null ? model.temperature.toString() : '');
    setPriority(model.priority !== null ? model.priority.toString() : '');
    setShowCreateForm(true);
    setError(null);
    setSuccessMessage(null);
  };

  const handleSaveNewModel = () => {
    if (!llmProvider.trim() || !displayName.trim() || !systemModel.trim()) {
      setError('LLM, Nome de exibição e System Model são obrigatórios');
      return;
    }

    if (temperature && (parseFloat(temperature) < 0 || parseFloat(temperature) > 2)) {
      setError('Temperatura deve estar entre 0 e 2');
      return;
    }

    if (priority && parseInt(priority) <= 0) {
      setError('Prioridade deve ser maior que zero');
      return;
    }

    if (editingModel) {
      setShowConfirmEdit(true);
    } else {
      setShowConfirmCreate(true);
    }
  };

  const handleConfirmCreate = async () => {
    try {
      setCreating(true);
      setError(null);

      await AdminSystemModelsService.createModel({
        llm_provider: llmProvider,
        display_name: displayName,
        system_model: systemModel,
        temperature: temperature ? parseFloat(temperature) : null,
        priority: priority ? parseInt(priority) : null,
      });

      await loadModels();
      setSuccessMessage('Modelo cadastrado com sucesso!');
      setTimeout(() => setSuccessMessage(null), 5000);
      handleCancelCreate();
    } catch (err: any) {
      setError(err.message || 'Erro ao criar modelo');
    } finally {
      setCreating(false);
      setShowConfirmCreate(false);
    }
  };

  const handleConfirmEdit = async () => {
    if (!editingModel) return;

    try {
      setCreating(true);
      setError(null);

      await AdminSystemModelsService.updateModel(editingModel.id, {
        llm_provider: llmProvider,
        display_name: displayName,
        system_model: systemModel,
        temperature: temperature ? parseFloat(temperature) : null,
        priority: priority ? parseInt(priority) : null,
      });

      await loadModels();
      setSuccessMessage('Modelo atualizado com sucesso!');
      setTimeout(() => setSuccessMessage(null), 5000);
      handleCancelCreate();
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar modelo');
    } finally {
      setCreating(false);
      setShowConfirmEdit(false);
    }
  };

  const handleToggleActive = async (model: AdminSystemModel) => {
    try {
      setError(null);
      await AdminSystemModelsService.updateModelStatus(model.id, !model.is_active);
      await loadModels();
      setSuccessMessage(model.is_active ? 'Modelo desativado' : 'Modelo ativado com sucesso!');
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setError(err.message || 'Erro ao alterar status do modelo');
    }
  };

  const handleMovePriorityUp = async (model: AdminSystemModel) => {
    if (model.priority <= 1) {
      setError('Prioridade já está no mínimo (1)');
      setTimeout(() => setError(null), 3000);
      return;
    }
    try {
      setError(null);
      await AdminSystemModelsService.updateModelPriority(model.id, model.priority - 1);
      await loadModels();
      setSuccessMessage('Prioridade atualizada');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar prioridade');
    }
  };

  const handleMovePriorityDown = async (model: AdminSystemModel) => {
    try {
      setError(null);
      await AdminSystemModelsService.updateModelPriority(model.id, model.priority + 1);
      await loadModels();
      setSuccessMessage('Prioridade atualizada');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar prioridade');
    }
  };

  const handleDeleteModel = async (model: AdminSystemModel) => {
    if (!confirm(`Tem certeza que deseja excluir o modelo ${model.display_name || model.name}?`)) {
      return;
    }

    try {
      setError(null);
      await AdminSystemModelsService.deleteModel(model.id);
      await loadModels();
      setSuccessMessage('Modelo excluído com sucesso!');
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setError(err.message || 'Erro ao excluir modelo');
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div className="flex min-h-screen font-body" style={{ backgroundColor: colors.bgPrimary }}>
      <SidebarWis
        onNavigateToApp={onNavigateToApp || (() => {})}
        onNavigateToMyProcess={onNavigateToMyProcess || (() => {})}
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
      />

      <main
        className={`flex-1 flex flex-col transition-all duration-300 pt-16 lg:pt-0 ${
          isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'
        }`}
      >
        <div className="flex-1 px-6 py-8">
          <div className="max-w-6xl mx-auto">
            <button
              onClick={() => {
                window.history.pushState({}, '', '/profile#admin');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors mb-6 hover:opacity-80"
              style={{
                backgroundColor: colors.bgSecondary,
                color: colors.textPrimary
              }}
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm font-medium">Voltar ao Painel</span>
            </button>

            <div className="mb-8">
              <div className="flex flex-col items-center">
                <div className="p-3 rounded-lg mb-4" style={{ backgroundColor: colors.bgSecondary }}>
                  <Cpu className="w-8 h-8" style={{ color: colors.successIcon }} />
                </div>
                <div className="text-center">
                  <h1 className="text-3xl font-title font-bold" style={{ color: colors.textPrimary }}>
                    Modelos LLM
                  </h1>
                  <p className="text-sm mt-1" style={{ color: colors.textSecondary }}>
                    Gerenciamento de Modelos com Fallback Automático
                  </p>
                </div>
              </div>
            </div>

            {successMessage && (
              <div
                className="mb-6 p-4 rounded-xl flex items-start space-x-3"
                style={{
                  backgroundColor: theme === 'dark' ? '#1F2229' : '#F3F4F6',
                  borderLeft: `4px solid ${colors.successBorder}`,
                }}
              >
                <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: colors.successIcon }} />
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                    {successMessage}
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div
                className="mb-6 p-4 rounded-xl flex items-start space-x-3"
                style={{
                  backgroundColor: theme === 'dark' ? '#1F2229' : '#F3F4F6',
                  borderLeft: '4px solid #EF4444',
                }}
              >
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#EF4444' }} />
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                    {error}
                  </p>
                </div>
              </div>
            )}

            {loading ? (
              <div className="rounded-xl shadow-lg p-8" style={{ backgroundColor: colors.bgSecondary }}>
                <div className="flex items-center justify-center space-x-3">
                  <div
                    className="animate-spin rounded-full h-8 w-8 border-b-2"
                    style={{ borderColor: colors.successIcon }}
                  ></div>
                  <p style={{ color: colors.textPrimary }}>Carregando modelos...</p>
                </div>
              </div>
            ) : (
              <>
                <div className="rounded-xl shadow-lg p-4 sm:p-6 lg:p-8 mb-6" style={{ backgroundColor: colors.bgSecondary }}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h2 className="text-xl sm:text-2xl font-bold mb-2" style={{ color: colors.textPrimary }}>
                        {editingModel ? 'Editar Modelo' : 'Cadastrar Novo Modelo'}
                      </h2>
                      <p className="text-sm" style={{ color: colors.textSecondary }}>
                        {editingModel
                          ? 'Atualize as configurações do modelo LLM'
                          : 'Adicione configurações de modelos LLM de múltiplos provedores'
                        }
                      </p>
                    </div>
                    {!showCreateForm && !editingModel && (
                      <button
                        onClick={handleCreateClick}
                        className="flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 hover:opacity-80"
                        style={{ backgroundColor: colors.successIcon, color: '#FFFFFF' }}
                      >
                        <Plus className="w-4 h-4" />
                        <span className="hidden sm:inline">Adicionar</span>
                      </button>
                    )}
                  </div>

                  {(showCreateForm || editingModel) && (
                    <div className="space-y-4 mt-6">
                      <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: colors.textPrimary }}>
                          LLM *
                        </label>
                        <select
                          value={llmProvider}
                          onChange={(e) => setLlmProvider(e.target.value)}
                          className="w-full px-4 py-3 rounded-lg border focus:ring-2 focus:ring-opacity-50 transition-colors"
                          style={{
                            backgroundColor: colors.bgPrimary,
                            borderColor: theme === 'dark' ? '#374151' : '#D1D5DB',
                            color: colors.textPrimary,
                          }}
                        >
                          {LLM_PROVIDERS.map((provider) => (
                            <option key={provider.value} value={provider.value}>
                              {provider.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: colors.textPrimary }}>
                          Nome de exibição *
                        </label>
                        <input
                          type="text"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder="Ex: Gemini 2.0 Flash - Principal"
                          className="w-full px-4 py-3 rounded-lg border focus:ring-2 focus:ring-opacity-50 transition-colors"
                          style={{
                            backgroundColor: colors.bgPrimary,
                            borderColor: theme === 'dark' ? '#374151' : '#D1D5DB',
                            color: colors.textPrimary,
                          }}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: colors.textPrimary }}>
                          System Model *
                        </label>
                        <input
                          type="text"
                          value={systemModel}
                          onChange={(e) => setSystemModel(e.target.value)}
                          placeholder="Ex: gemini-2.0-flash-exp"
                          className="w-full px-4 py-3 rounded-lg border focus:ring-2 focus:ring-opacity-50 transition-colors"
                          style={{
                            backgroundColor: colors.bgPrimary,
                            borderColor: theme === 'dark' ? '#374151' : '#D1D5DB',
                            color: colors.textPrimary,
                          }}
                        />
                        <p className="text-xs mt-1" style={{ color: colors.textSecondary }}>
                          Nome exato do modelo para ser usado na aplicação
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-2" style={{ color: colors.textPrimary }}>
                            Temperatura
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="2"
                            value={temperature}
                            onChange={(e) => setTemperature(e.target.value)}
                            placeholder="0.7"
                            className="w-full px-4 py-3 rounded-lg border focus:ring-2 focus:ring-opacity-50 transition-colors"
                            style={{
                              backgroundColor: colors.bgPrimary,
                              borderColor: theme === 'dark' ? '#374151' : '#D1D5DB',
                              color: colors.textPrimary,
                            }}
                          />
                          <p className="text-xs mt-1" style={{ color: colors.textSecondary }}>
                            Vazio usa padrão (0.7)
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-2" style={{ color: colors.textPrimary }}>
                            Prioridade *
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={priority}
                            onChange={(e) => setPriority(e.target.value)}
                            placeholder="1"
                            className="w-full px-4 py-3 rounded-lg border focus:ring-2 focus:ring-opacity-50 transition-colors"
                            style={{
                              backgroundColor: colors.bgPrimary,
                              borderColor: theme === 'dark' ? '#374151' : '#D1D5DB',
                              color: colors.textPrimary,
                            }}
                          />
                          <p className="text-xs mt-1" style={{ color: colors.textSecondary }}>
                            1 = maior prioridade
                          </p>
                        </div>
                      </div>

                      <div className="flex space-x-3 pt-4">
                        <button
                          onClick={handleCancelCreate}
                          className="flex-1 px-4 py-3 rounded-lg font-medium transition-all duration-200 hover:opacity-80 flex items-center justify-center space-x-2"
                          style={{
                            backgroundColor: theme === 'dark' ? '#374151' : '#E5E7EB',
                            color: colors.textPrimary,
                          }}
                        >
                          <X className="w-4 h-4" />
                          <span>Cancelar</span>
                        </button>
                        <button
                          onClick={handleSaveNewModel}
                          disabled={creating}
                          className="flex-1 px-4 py-3 rounded-lg font-medium transition-all duration-200 hover:opacity-80 flex items-center justify-center space-x-2"
                          style={{ backgroundColor: colors.successIcon, color: '#FFFFFF' }}
                        >
                          <Save className="w-4 h-4" />
                          <span>Salvar Modelo</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-xl shadow-lg p-4 sm:p-6 lg:p-8" style={{ backgroundColor: colors.bgSecondary }}>
                  <h2 className="text-xl font-bold mb-4" style={{ color: colors.textPrimary }}>
                    Modelos Cadastrados ({models.length})
                  </h2>

                  <div className="space-y-3">
                    {models.map((model) => (
                      <div
                        key={model.id}
                        className="p-4 rounded-lg border"
                        style={{
                          backgroundColor: colors.bgPrimary,
                          borderColor: model.is_active
                            ? colors.successBorder
                            : theme === 'dark'
                            ? '#374151'
                            : '#D1D5DB',
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <span
                                className="px-2 py-1 rounded text-xs font-medium"
                                style={{
                                  backgroundColor:
                                    theme === 'dark' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.1)',
                                  color: colors.successIcon,
                                }}
                              >
                                Prioridade {model.priority}
                              </span>
                              <span
                                className="px-2 py-1 rounded text-xs font-medium"
                                style={{
                                  backgroundColor: theme === 'dark' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)',
                                  color: '#3B82F6',
                                }}
                              >
                                {model.llm_provider || 'Google'}
                              </span>
                            </div>
                            <h3 className="font-semibold text-lg mb-1" style={{ color: colors.textPrimary }}>
                              {model.display_name || model.name}
                            </h3>
                            <p className="text-sm mb-2" style={{ color: colors.textSecondary }}>
                              <span className="font-medium">Modelo:</span> {model.system_model || model.model_id}
                            </p>
                            <div className="flex flex-wrap gap-3 text-xs" style={{ color: colors.textSecondary }}>
                              <span>
                                Prioridade: {model.priority}
                              </span>
                              <span>
                                Temperatura: {model.temperature !== null ? model.temperature : '0.7 (padrão)'}
                              </span>
                              <span>Criado em {formatDateTime(model.created_at)}</span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2 ml-4">
                            <button
                              onClick={() => handleMovePriorityUp(model)}
                              className="p-2 rounded-lg transition-all duration-200 hover:opacity-80"
                              style={{ backgroundColor: colors.bgSecondary }}
                              title="Aumentar prioridade (menor número = maior prioridade)"
                            >
                              <ChevronUp className="w-4 h-4" style={{ color: colors.textPrimary }} />
                            </button>
                            <button
                              onClick={() => handleMovePriorityDown(model)}
                              className="p-2 rounded-lg transition-all duration-200 hover:opacity-80"
                              style={{ backgroundColor: colors.bgSecondary }}
                              title="Diminuir prioridade (maior número = menor prioridade)"
                            >
                              <ChevronDown className="w-4 h-4" style={{ color: colors.textPrimary }} />
                            </button>
                            <button
                              onClick={() => handleEditClick(model)}
                              className="p-2 rounded-lg transition-all duration-200 hover:opacity-80"
                              style={{ backgroundColor: colors.bgSecondary }}
                              title="Editar"
                            >
                              <Edit2 className="w-4 h-4" style={{ color: '#3B82F6' }} />
                            </button>
                            <button
                              onClick={() => handleToggleActive(model)}
                              className="p-2 rounded-lg transition-all duration-200 hover:opacity-80"
                              style={{ backgroundColor: colors.bgSecondary }}
                              title={model.is_active ? 'Desativar' : 'Ativar'}
                            >
                              {model.is_active ? (
                                <ToggleRight className="w-5 h-5" style={{ color: colors.successIcon }} />
                              ) : (
                                <ToggleLeft className="w-5 h-5" style={{ color: colors.textSecondary }} />
                              )}
                            </button>
                            <button
                              onClick={() => handleDeleteModel(model)}
                              className="p-2 rounded-lg transition-all duration-200 hover:opacity-80"
                              style={{ backgroundColor: colors.bgSecondary }}
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" style={{ color: '#EF4444' }} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
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

      {showConfirmCreate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="rounded-xl shadow-2xl max-w-md w-full p-6" style={{ backgroundColor: colors.bgSecondary }}>
            <h3 className="text-xl font-bold mb-4" style={{ color: colors.textPrimary }}>
              Confirmar Cadastro
            </h3>
            <p className="text-sm mb-6" style={{ color: colors.textSecondary }}>
              Deseja cadastrar o modelo <span className="font-semibold">{displayName}</span>?
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowConfirmCreate(false)}
                disabled={creating}
                className="flex-1 px-4 py-2 rounded-lg font-medium transition-all duration-200 hover:opacity-80"
                style={{
                  backgroundColor: theme === 'dark' ? '#374151' : '#E5E7EB',
                  color: colors.textPrimary,
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmCreate}
                disabled={creating}
                className="flex-1 px-4 py-2 rounded-lg font-medium transition-all duration-200 hover:opacity-80 flex items-center justify-center space-x-2"
                style={{ backgroundColor: colors.successIcon, color: '#FFFFFF' }}
              >
                {creating ? (
                  <>
                    <div
                      className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"
                    ></div>
                    <span>Salvando...</span>
                  </>
                ) : (
                  <span>Confirmar</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfirmEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="rounded-xl shadow-2xl max-w-md w-full p-6" style={{ backgroundColor: colors.bgSecondary }}>
            <h3 className="text-xl font-bold mb-4" style={{ color: colors.textPrimary }}>
              Confirmar Edição
            </h3>
            <p className="text-sm mb-6" style={{ color: colors.textSecondary }}>
              Deseja atualizar o modelo <span className="font-semibold">{displayName}</span>?
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowConfirmEdit(false)}
                disabled={creating}
                className="flex-1 px-4 py-2 rounded-lg font-medium transition-all duration-200 hover:opacity-80"
                style={{
                  backgroundColor: theme === 'dark' ? '#374151' : '#E5E7EB',
                  color: colors.textPrimary,
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmEdit}
                disabled={creating}
                className="flex-1 px-4 py-2 rounded-lg font-medium transition-all duration-200 hover:opacity-80 flex items-center justify-center space-x-2"
                style={{ backgroundColor: '#3B82F6', color: '#FFFFFF' }}
              >
                {creating ? (
                  <>
                    <div
                      className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"
                    ></div>
                    <span>Atualizando...</span>
                  </>
                ) : (
                  <span>Confirmar</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {isSearchOpen && (
        <IntelligentSearch
          isOpen={isSearchOpen}
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
