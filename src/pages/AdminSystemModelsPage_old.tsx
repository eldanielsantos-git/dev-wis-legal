import React, { useState, useEffect } from 'react';
import { Cpu, Plus, Save, X, Clock, CheckCircle, AlertCircle, AlertTriangle, Trash2, ChevronUp, ChevronDown, ToggleLeft, ToggleRight } from 'lucide-react';
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
  onNavigateToAdmin?: () => void;
  onNavigateToProfile?: () => void;
  onNavigateToTerms?: () => void;
  onNavigateToPrivacy?: () => void;
  onNavigateToCookies?: () => void;
}

export function AdminSystemModelsPage({ onBack, onNavigateToApp, onNavigateToMyProcess, onNavigateToAdmin, onNavigateToProfile, onNavigateToTerms, onNavigateToPrivacy, onNavigateToCookies }: AdminSystemModelsPageProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [models, setModels] = useState<AdminSystemModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newProjectId, setNewProjectId] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newModelId, setNewModelId] = useState('');
  const [creating, setCreating] = useState(false);

  const [showConfirmCreate, setShowConfirmCreate] = useState(false);
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
    setShowConfirmCreate(false);
    setNewName('');
    setNewProjectId('');
    setNewLocation('');
    setNewModelId('');
    setError(null);
  };

  const handleSaveNewModel = () => {
    if (!newName.trim() || !newProjectId.trim() || !newLocation.trim() || !newModelId.trim()) {
      setError('Todos os campos são obrigatórios');
      return;
    }
    setShowConfirmCreate(true);
  };

  const handleConfirmCreate = async () => {
    try {
      setCreating(true);
      setError(null);
      await AdminSystemModelsService.createModel(newName, newProjectId, newLocation, newModelId);
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
    if (model.priority === 1) return;
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
    if (model.priority === models.length) return;
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
    if (!confirm(`Tem certeza que deseja excluir o modelo ${model.name}?`)) {
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
      minute: '2-digit'
    }).format(date);
  };

  return (
    <div className="flex min-h-screen font-body" style={{ backgroundColor: colors.bgPrimary }}>
      <SidebarWis
        onNavigateToApp={onNavigateToApp || (() => {})}
        onNavigateToMyProcess={onNavigateToMyProcess || (() => {})}
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
      />

      <main className={`flex-1 flex flex-col transition-all duration-300 pt-16 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
        <div className="flex-1 px-6 py-8">
          <div className="max-w-6xl mx-auto">
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
          <div className="mb-6 p-4 rounded-xl flex items-start space-x-3" style={{ backgroundColor: theme === 'dark' ? '#1F2229' : '#F3F4F6', borderLeft: `4px solid ${colors.successBorder}` }}>
            <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: colors.successIcon }} />
            <div className="flex-1">
              <p className="text-sm font-medium" style={{ color: colors.textPrimary }}>{successMessage}</p>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 rounded-xl flex items-start space-x-3" style={{ backgroundColor: theme === 'dark' ? '#1F2229' : '#F3F4F6', borderLeft: '4px solid #EF4444' }}>
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#EF4444' }} />
            <div className="flex-1">
              <p className="text-sm font-medium" style={{ color: colors.textPrimary }}>{error}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="rounded-xl shadow-lg p-8" style={{ backgroundColor: colors.bgSecondary }}>
            <div className="flex items-center justify-center space-x-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: colors.successIcon }}></div>
              <p style={{ color: colors.textPrimary }}>Carregando modelos...</p>
            </div>
          </div>
        ) : (
          <>
            <div className="rounded-xl shadow-lg p-4 sm:p-6 lg:p-8 mb-6" style={{ backgroundColor: colors.bgSecondary }}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h2 className="text-xl sm:text-2xl font-bold mb-2" style={{ color: colors.textPrimary }}>
                    Cadastrar Novo Modelo
                  </h2>
                  <p className="text-sm" style={{ color: colors.textSecondary }}>
                    Adicione configurações de modelos LLM do Google Vertex AI
                  </p>
                </div>
                {!showCreateForm && (
                  <button
                    onClick={handleCreateClick}
                    className="flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-lg transition-all"
                    style={{ backgroundColor: colors.successIcon, color: '#FFFFFF' }}
                  >
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">Novo Modelo</span>
                  </button>
                )}
              </div>

              {showCreateForm && (
                <div className="mt-6 space-y-4">
                  <div className="rounded-lg p-4 flex items-start space-x-3" style={{ backgroundColor: theme === 'dark' ? '#1F2229' : '#F3F4F6', borderLeft: '4px solid #F59E0B' }}>
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#F59E0B' }} />
                    <div className="flex-1">
                      <p className="text-sm font-medium" style={{ color: colors.textPrimary }}>Atenção</p>
                      <p className="text-sm mt-1" style={{ color: colors.textSecondary }}>
                        O modelo precisa ser o identificador exato (ex: gemini-2.0-flash-exp, gemini-2.5-pro, gemini-1.5-pro) e estar ativo no Google Cloud Console.
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: colors.textPrimary }}>
                      Nome do Modelo
                    </label>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Ex: Gemini 2.0 Flash - Principal"
                      className="w-full px-4 py-2 rounded-lg"
                      style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary, border: `1px solid ${colors.border}` }}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: colors.textPrimary }}>
                      Google Project ID
                    </label>
                    <input
                      type="text"
                      value={newProjectId}
                      onChange={(e) => setNewProjectId(e.target.value)}
                      placeholder="Ex: arpj-473315"
                      className="w-full px-4 py-2 rounded-lg"
                      style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary, border: `1px solid ${colors.border}` }}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: colors.textPrimary }}>
                      System Location
                    </label>
                    <input
                      type="text"
                      value={newLocation}
                      onChange={(e) => setNewLocation(e.target.value)}
                      placeholder="Ex: us-central1"
                      className="w-full px-4 py-2 rounded-lg"
                      style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary, border: `1px solid ${colors.border}` }}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: colors.textPrimary }}>
                      System Model
                    </label>
                    <input
                      type="text"
                      value={newModelId}
                      onChange={(e) => setNewModelId(e.target.value)}
                      placeholder="Ex: gemini-2.0-flash-exp"
                      className="w-full px-4 py-2 rounded-lg"
                      style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary, border: `1px solid ${colors.border}` }}
                    />
                  </div>

                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={handleCancelCreate}
                      disabled={creating}
                      className="flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                      style={{ backgroundColor: colors.bgPrimary, color: colors.textSecondary, border: `1px solid ${colors.border}` }}
                    >
                      <X className="w-4 h-4" />
                      <span>Cancelar</span>
                    </button>
                    <button
                      onClick={handleSaveNewModel}
                      disabled={creating || !newName.trim() || !newProjectId.trim() || !newLocation.trim() || !newModelId.trim()}
                      className="flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-lg transition-all disabled:opacity-50"
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
              <h2 className="text-xl sm:text-2xl font-bold mb-4" style={{ color: colors.textPrimary }}>
                Modelos LLM (Ordem de Prioridade)
              </h2>
              <p className="text-sm mb-6" style={{ color: colors.textSecondary }}>
                Os modelos são usados na ordem de prioridade. Em caso de falha, o sistema tenta automaticamente o próximo modelo.
              </p>

              <div className="space-y-3">
                {models.length === 0 ? (
                  <p className="text-center py-8" style={{ color: colors.textSecondary }}>Nenhum modelo cadastrado</p>
                ) : (
                  models.map((model, index) => (
                    <div
                      key={model.id}
                      className="flex items-center justify-between p-4 rounded-lg transition-all"
                      style={{
                        backgroundColor: colors.bgPrimary,
                        border: `2px solid ${model.priority === 1 ? colors.successBorder : colors.border}`,
                        opacity: model.is_active ? 1 : 0.6
                      }}
                    >
                      <div className="flex items-center space-x-4 flex-1">
                        <div className="flex flex-col items-center justify-center w-12">
                          <span className="text-2xl font-bold" style={{ color: model.priority === 1 ? colors.successText : colors.textSecondary }}>
                            {model.priority}
                          </span>
                          <span className="text-xs" style={{ color: colors.textSecondary }}>
                            {model.priority === 1 ? 'Principal' : `Backup ${model.priority - 1}`}
                          </span>
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <span className="text-base font-semibold" style={{ color: colors.textPrimary }}>
                              {model.name}
                            </span>
                            {model.priority === 1 && (
                              <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: '#10B981', color: '#FFFFFF' }}>
                                <CheckCircle className="w-3 h-3" />
                                <span>Prioridade Máxima</span>
                              </span>
                            )}
                            {model.is_active ? (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: '#10B981', color: '#FFFFFF' }}>
                                <span>Ativo</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: '#6B7280', color: '#FFFFFF' }}>
                                <span>Inativo</span>
                              </span>
                            )}
                          </div>
                          <div className="text-sm space-y-1" style={{ color: colors.textSecondary }}>
                            <p>Modelo: {model.model_id}</p>
                            <p>Project ID: {model.project_id} | Location: {model.location}</p>
                          </div>
                          <div className="flex items-center space-x-1 text-xs mt-2" style={{ color: colors.textSecondary }}>
                            <Clock className="w-3 h-3" />
                            <span>Cadastrado em {formatDateTime(model.created_at)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 ml-4">
                        <div className="flex flex-col space-y-1">
                          <button
                            onClick={() => handleMovePriorityUp(model)}
                            disabled={model.priority === 1}
                            className="p-1 rounded transition-colors disabled:opacity-30"
                            style={{ color: colors.textSecondary }}
                            title="Aumentar prioridade"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleMovePriorityDown(model)}
                            disabled={model.priority === models.length}
                            className="p-1 rounded transition-colors disabled:opacity-30"
                            style={{ color: colors.textSecondary }}
                            title="Diminuir prioridade"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                        </div>

                        <button
                          onClick={() => handleToggleActive(model)}
                          className="p-2 rounded-lg transition-colors"
                          style={{ color: model.is_active ? '#10B981' : '#6B7280' }}
                          title={model.is_active ? 'Desativar modelo' : 'Ativar modelo'}
                        >
                          {model.is_active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                        </button>

                        <button
                          onClick={() => handleDeleteModel(model)}
                          className="p-2 rounded-lg transition-colors"
                          style={{ color: '#C8C8C8' }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = '#A0A0A0';
                            e.currentTarget.style.backgroundColor = 'rgba(200, 200, 200, 0.1)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = '#C8C8C8';
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                          title="Excluir modelo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
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
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="rounded-xl shadow-xl max-w-md w-full p-6" style={{ backgroundColor: colors.bgSecondary }}>
            <div className="flex items-start space-x-3 mb-4">
              <AlertTriangle className="w-6 h-6 flex-shrink-0 mt-0.5" style={{ color: '#F59E0B' }} />
              <div className="flex-1">
                <h3 className="text-lg font-bold mb-2" style={{ color: colors.textPrimary }}>Confirmar Cadastro</h3>
                <p className="text-sm mb-4" style={{ color: colors.textSecondary }}>
                  Esta ação pode afetar todo o sistema. Você tem certeza de que os dados estão corretos?
                </p>
                <div className="rounded-lg p-3 space-y-1 text-sm" style={{ backgroundColor: theme === 'dark' ? '#1F2229' : '#F3F4F6' }}>
                  <p style={{ color: colors.textPrimary }}><span className="font-medium">Nome:</span> {newName}</p>
                  <p style={{ color: colors.textPrimary }}><span className="font-medium">Project ID:</span> {newProjectId}</p>
                  <p style={{ color: colors.textPrimary }}><span className="font-medium">Location:</span> {newLocation}</p>
                  <p style={{ color: colors.textPrimary }}><span className="font-medium">Model:</span> {newModelId}</p>
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={handleCancelCreate}
                disabled={creating}
                className="px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                style={{ backgroundColor: colors.bgPrimary, color: colors.textSecondary, border: `1px solid ${colors.border}` }}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmCreate}
                disabled={creating}
                className="px-4 py-2 text-sm font-medium rounded-lg transition-all disabled:opacity-50"
                style={{ backgroundColor: '#10B981', color: '#FFFFFF' }}
              >
                {creating ? 'Salvando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

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
