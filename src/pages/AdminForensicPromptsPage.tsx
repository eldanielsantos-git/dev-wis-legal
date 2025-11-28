import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Check, X, Copy, FileText, AlertCircle, Loader, ChevronDown, ChevronUp, Trash2, Power, PowerOff, Scale, MessageSquare, ArrowUp, ArrowDown, ArrowLeft, Maximize2, Minimize2 } from 'lucide-react';
import { SidebarWis } from '../components/SidebarWis';
import { FooterWis } from '../components/FooterWis';
import { IntelligentSearch } from '../components/IntelligentSearch';
import { AnalysisPromptsService, type AnalysisPrompt } from '../services/AnalysisPromptsService';
import { ChatIntroPromptsService, type ChatIntroPrompt } from '../services/ChatIntroPromptsService';
import { ChatSystemPromptsService, type ChatSystemPrompt, type PromptType } from '../services/ChatSystemPromptsService';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';

interface AdminForensicPromptsPageProps {
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

type TabType = 'analysis' | 'chat_intro' | 'chat_system';

export function AdminForensicPromptsPage({ onNavigateToApp, onNavigateToMyProcess, onNavigateToChat, onNavigateToWorkspace, onNavigateToAdmin, onNavigateToProfile, onNavigateToTerms, onNavigateToPrivacy, onNavigateToCookies }: AdminForensicPromptsPageProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('analysis');

  const [analysisPrompts, setAnalysisPrompts] = useState<AnalysisPrompt[]>([]);
  const [chatIntroPrompts, setChatIntroPrompts] = useState<ChatIntroPrompt[]>([]);
  const [chatSystemPrompts, setChatSystemPrompts] = useState<ChatSystemPrompt[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [analysisFormData, setAnalysisFormData] = useState({
    execution_order: 1,
    title: '',
    prompt_content: '',
    system_prompt: ''
  });

  const [chatIntroFormData, setChatIntroFormData] = useState({
    display_order: 1,
    prompt_text: ''
  });

  const [chatSystemFormData, setChatSystemFormData] = useState({
    prompt_type: 'small_file' as PromptType,
    system_prompt: '',
    description: '',
    priority: 1
  });

  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [fullscreenTextarea, setFullscreenTextarea] = useState<{ id: string; value: string; label: string } | null>(null);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (activeTab === 'analysis') {
        const data = await AnalysisPromptsService.getAllPrompts();
        setAnalysisPrompts(data);
      } else if (activeTab === 'chat_intro') {
        const data = await ChatIntroPromptsService.getAllPrompts();
        setChatIntroPrompts(data);
      } else if (activeTab === 'chat_system') {
        const data = await ChatSystemPromptsService.getAllPrompts();
        setChatSystemPrompts(data);
      }
    } catch (err: any) {
      console.error('Erro ao carregar prompts:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAnalysis = async () => {
    if (!analysisFormData.title.trim()) {
      setError('O título do prompt é obrigatório');
      return;
    }
    if (!analysisFormData.prompt_content.trim()) {
      setError('O conteúdo do prompt é obrigatório');
      return;
    }
    if (analysisFormData.execution_order < 1 || analysisFormData.execution_order > 9) {
      setError('O número do prompt deve estar entre 1 e 9');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await AnalysisPromptsService.createPrompt(
        analysisFormData.title,
        analysisFormData.prompt_content,
        analysisFormData.execution_order,
        analysisFormData.system_prompt
      );
      await loadData();
      setIsCreating(false);
      setAnalysisFormData({ execution_order: 1, title: '', prompt_content: '', system_prompt: '' });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateAnalysis = async (promptId: string) => {
    if (!analysisFormData.title.trim()) {
      setError('O título do prompt é obrigatório');
      return;
    }
    if (!analysisFormData.prompt_content.trim()) {
      setError('O conteúdo do prompt é obrigatório');
      return;
    }
    if (analysisFormData.execution_order < 1 || analysisFormData.execution_order > 9) {
      setError('O número do prompt deve estar entre 1 e 9');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await AnalysisPromptsService.updatePrompt(
        promptId,
        analysisFormData.title,
        analysisFormData.prompt_content,
        analysisFormData.execution_order,
        analysisFormData.system_prompt
      );
      await loadData();
      setEditingId(null);
      setAnalysisFormData({ execution_order: 1, title: '', prompt_content: '', system_prompt: '' });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateChatIntro = async () => {
    if (!chatIntroFormData.prompt_text.trim()) {
      setError('O texto do prompt é obrigatório');
      return;
    }
    if (chatIntroFormData.display_order < 1) {
      setError('A ordem de exibição deve ser maior que zero');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await ChatIntroPromptsService.createPrompt(
        chatIntroFormData.prompt_text,
        chatIntroFormData.display_order
      );
      await loadData();
      setIsCreating(false);
      setChatIntroFormData({ display_order: 1, prompt_text: '' });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateChatIntro = async (promptId: string) => {
    if (!chatIntroFormData.prompt_text.trim()) {
      setError('O texto do prompt é obrigatório');
      return;
    }
    if (chatIntroFormData.display_order < 1) {
      setError('A ordem de exibição deve ser maior que zero');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await ChatIntroPromptsService.updatePrompt(
        promptId,
        chatIntroFormData.prompt_text,
        chatIntroFormData.display_order
      );
      await loadData();
      setEditingId(null);
      setChatIntroFormData({ display_order: 1, prompt_text: '' });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleStartEditAnalysis = (prompt: AnalysisPrompt) => {
    setEditingId(prompt.id);
    setAnalysisFormData({
      execution_order: prompt.execution_order,
      title: prompt.title,
      prompt_content: prompt.prompt_content,
      system_prompt: prompt.system_prompt || ''
    });
    setIsCreating(false);
  };

  const handleStartEditChatIntro = (prompt: ChatIntroPrompt) => {
    setEditingId(prompt.id);
    setChatIntroFormData({
      display_order: prompt.display_order,
      prompt_text: prompt.prompt_text
    });
    setIsCreating(false);
  };

  const handleDuplicateAnalysis = (prompt: AnalysisPrompt) => {
    setIsCreating(true);
    setAnalysisFormData({
      execution_order: prompt.execution_order,
      title: prompt.title + ' (Cópia)',
      prompt_content: prompt.prompt_content,
      system_prompt: prompt.system_prompt || ''
    });
    setEditingId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setIsCreating(false);
    setAnalysisFormData({ execution_order: 1, title: '', prompt_content: '', system_prompt: '' });
    setChatIntroFormData({ display_order: 1, prompt_text: '' });
  };

  const handleDeleteAnalysis = async (promptId: string) => {
    if (!confirm('Tem certeza que deseja excluir este prompt? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      setDeletingId(promptId);
      setError(null);
      await AnalysisPromptsService.deletePrompt(promptId);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteChatIntro = async (promptId: string) => {
    if (!confirm('Tem certeza que deseja excluir este prompt? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      setDeletingId(promptId);
      setError(null);
      await ChatIntroPromptsService.deletePrompt(promptId);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleStatusAnalysis = async (promptId: string, currentStatus: boolean) => {
    try {
      setTogglingId(promptId);
      setError(null);
      await AnalysisPromptsService.togglePromptStatus(promptId, !currentStatus);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setTogglingId(null);
    }
  };

  const handleToggleStatusChatIntro = async (promptId: string, currentStatus: boolean) => {
    try {
      setTogglingId(promptId);
      setError(null);
      await ChatIntroPromptsService.togglePromptStatus(promptId, !currentStatus);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setTogglingId(null);
    }
  };

  const handleMovePromptUp = async (prompt: ChatIntroPrompt) => {
    const currentIndex = chatIntroPrompts.findIndex(p => p.id === prompt.id);
    if (currentIndex <= 0) return;

    const previousPrompt = chatIntroPrompts[currentIndex - 1];

    try {
      setError(null);
      await ChatIntroPromptsService.updatePrompt(
        prompt.id,
        prompt.prompt_text,
        previousPrompt.display_order
      );
      await ChatIntroPromptsService.updatePrompt(
        previousPrompt.id,
        previousPrompt.prompt_text,
        prompt.display_order
      );
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleMovePromptDown = async (prompt: ChatIntroPrompt) => {
    const currentIndex = chatIntroPrompts.findIndex(p => p.id === prompt.id);
    if (currentIndex >= chatIntroPrompts.length - 1) return;

    const nextPrompt = chatIntroPrompts[currentIndex + 1];

    try {
      setError(null);
      await ChatIntroPromptsService.updatePrompt(
        prompt.id,
        prompt.prompt_text,
        nextPrompt.display_order
      );
      await ChatIntroPromptsService.updatePrompt(
        nextPrompt.id,
        nextPrompt.prompt_text,
        prompt.display_order
      );
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreateChatSystem = async () => {
    if (!chatSystemFormData.system_prompt.trim()) {
      setError('O conteúdo do system prompt é obrigatório');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await ChatSystemPromptsService.createPrompt({
        prompt_type: chatSystemFormData.prompt_type,
        system_prompt: chatSystemFormData.system_prompt,
        description: chatSystemFormData.description || undefined,
        priority: chatSystemFormData.priority,
        is_active: true
      });
      await loadData();
      setIsCreating(false);
      setChatSystemFormData({ prompt_type: 'small_file', system_prompt: '', description: '', priority: 1 });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateChatSystem = async (promptId: string) => {
    if (!chatSystemFormData.system_prompt.trim()) {
      setError('O conteúdo do system prompt é obrigatório');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await ChatSystemPromptsService.updatePrompt(promptId, {
        prompt_type: chatSystemFormData.prompt_type,
        system_prompt: chatSystemFormData.system_prompt,
        description: chatSystemFormData.description || undefined,
        priority: chatSystemFormData.priority
      });
      await loadData();
      setEditingId(null);
      setChatSystemFormData({ prompt_type: 'small_file', system_prompt: '', description: '', priority: 1 });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteChatSystem = async (promptId: string) => {
    if (!confirm('Tem certeza que deseja excluir este prompt? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      setDeletingId(promptId);
      setError(null);
      await ChatSystemPromptsService.deletePrompt(promptId);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleChatSystemStatus = async (promptId: string, currentStatus: boolean) => {
    try {
      setTogglingId(promptId);
      setError(null);
      await ChatSystemPromptsService.toggleStatus(promptId, !currentStatus);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setTogglingId(null);
    }
  };

  const handleDuplicateChatSystem = async (promptId: string) => {
    try {
      setError(null);
      await ChatSystemPromptsService.duplicatePrompt(promptId);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const openFullscreenTextarea = (id: string, value: string, label: string) => {
    setFullscreenTextarea({ id, value, label });
  };

  const closeFullscreenTextarea = () => {
    setFullscreenTextarea(null);
  };

  const saveFullscreenTextarea = (value: string) => {
    if (!fullscreenTextarea) return;

    if (fullscreenTextarea.id === 'system_prompt') {
      setAnalysisFormData({ ...analysisFormData, system_prompt: value });
    } else if (fullscreenTextarea.id === 'prompt_content') {
      setAnalysisFormData({ ...analysisFormData, prompt_content: value });
    } else if (fullscreenTextarea.id === 'chat_intro_text') {
      setChatIntroFormData({ ...chatIntroFormData, prompt_text: value });
    } else if (fullscreenTextarea.id === 'chat_system_prompt') {
      setChatSystemFormData({ ...chatSystemFormData, system_prompt: value });
    }

    closeFullscreenTextarea();
  };

  if (loading) {
    return (
      <div className="min-h-screen font-body flex items-center justify-center" style={{ backgroundColor: colors.bgPrimary }}>
        <Loader className="w-8 h-8 animate-spin" style={{ color: '#8B5CF6' }} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen font-body overflow-x-hidden" style={{ backgroundColor: colors.bgPrimary }}>
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
      />

      <main className={`flex-1 flex flex-col transition-all duration-300 pt-16 lg:pt-0 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'} overflow-x-hidden`}>
        <div className="flex-1 px-4 sm:px-6 py-6 sm:py-8 w-full max-w-full">
          <div className="max-w-6xl mx-auto w-full">
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

            <div className="flex flex-col items-center mb-6 sm:mb-8">
              <div className="p-2.5 sm:p-3 rounded-lg mb-3 sm:mb-4" style={{ backgroundColor: colors.bgSecondary }}>
                <Scale className="w-6 h-6 sm:w-8 sm:h-8" style={{ color: '#8B5CF6' }} />
              </div>
              <div className="text-center">
                <h1 className="text-2xl sm:text-3xl font-title font-bold" style={{ color: colors.textPrimary }}>
                  Prompts de Análise
                </h1>
                <p className="text-xs sm:text-sm mt-1 px-4" style={{ color: colors.textSecondary }}>
                  Gerencie os prompts utilizados para análise jurídica completa
                </p>
              </div>
            </div>

            {/* Tabs */}
            <div className="mb-6 flex justify-center">
              <div className="inline-flex rounded-lg p-1" style={{ backgroundColor: colors.bgSecondary }}>
                <button
                  onClick={() => {
                    setActiveTab('analysis');
                    setIsCreating(false);
                    setEditingId(null);
                  }}
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg transition-all text-sm font-medium"
                  style={{
                    backgroundColor: activeTab === 'analysis' ? colors.bgPrimary : 'transparent',
                    color: activeTab === 'analysis' ? colors.textPrimary : colors.textSecondary
                  }}
                >
                  <Scale className="w-4 h-4" />
                  <span>Prompts de Análise</span>
                </button>
                <button
                  onClick={() => {
                    setActiveTab('chat_intro');
                    setIsCreating(false);
                    setEditingId(null);
                  }}
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg transition-all text-sm font-medium"
                  style={{
                    backgroundColor: activeTab === 'chat_intro' ? colors.bgPrimary : 'transparent',
                    color: activeTab === 'chat_intro' ? colors.textPrimary : colors.textSecondary
                  }}
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Prompts Chat Intro</span>
                </button>
                <button
                  onClick={() => {
                    setActiveTab('chat_system');
                    setIsCreating(false);
                    setEditingId(null);
                  }}
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg transition-all text-sm font-medium"
                  style={{
                    backgroundColor: activeTab === 'chat_system' ? colors.bgPrimary : 'transparent',
                    color: activeTab === 'chat_system' ? colors.textPrimary : colors.textSecondary
                  }}
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Prompts Chat</span>
                </button>
              </div>
            </div>

            {error && (
              <div className="mb-4 sm:mb-6 rounded-xl p-3 sm:p-4 flex items-start space-x-2 sm:space-x-3" style={{ backgroundColor: colors.bgSecondary, borderLeft: '4px solid #EF4444' }}>
                <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 mt-0.5" style={{ color: '#EF4444' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium break-words" style={{ color: colors.textPrimary }}>{error}</p>
                </div>
              </div>
            )}

            {/* Analysis Prompts Tab */}
            {activeTab === 'analysis' && (
              <>
                {!isCreating && !editingId && (
                  <div className="mb-4 sm:mb-6">
                    <button
                      onClick={() => setIsCreating(true)}
                      className="flex items-center space-x-2 px-3 sm:px-4 py-2 text-sm sm:text-base font-semibold rounded-lg transition-all"
                      style={{ backgroundColor: '#8B5CF6', color: '#FFFFFF' }}
                    >
                      <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span>Criar Novo Prompt</span>
                    </button>
                  </div>
                )}

                {(isCreating || editingId) && (
                  <div className="mb-4 sm:mb-6 rounded-xl shadow-lg p-4 sm:p-6 overflow-hidden w-full max-w-full" style={{ backgroundColor: colors.bgSecondary }}>
                    <h2 className="text-base sm:text-lg font-bold mb-3 sm:mb-4 break-words" style={{ color: colors.textPrimary }}>
                      {isCreating ? 'Criar Novo Prompt' : 'Editar Prompt'}
                    </h2>

                    <div className="space-y-3 sm:space-y-4 w-full max-w-full">
                      <div className="w-full max-w-full">
                        <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2" style={{ color: colors.textPrimary }}>
                          Número do Prompt (1-9)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="9"
                          value={analysisFormData.execution_order}
                          onChange={(e) => setAnalysisFormData({ ...analysisFormData, execution_order: parseInt(e.target.value) || 1 })}
                          className="w-full max-w-full px-2.5 sm:px-3 py-2 rounded-lg focus:outline-none focus:ring-2 text-sm sm:text-base box-border"
                          style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary, border: `1px solid ${colors.border}` }}
                          placeholder="1"
                        />
                      </div>

                      <div className="w-full max-w-full">
                        <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2" style={{ color: colors.textPrimary }}>
                          Título do Prompt
                        </label>
                        <input
                          type="text"
                          value={analysisFormData.title}
                          onChange={(e) => setAnalysisFormData({ ...analysisFormData, title: e.target.value })}
                          className="w-full max-w-full px-2.5 sm:px-3 py-2 rounded-lg focus:outline-none focus:ring-2 text-sm sm:text-base box-border"
                          style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary, border: `1px solid ${colors.border}` }}
                          placeholder="Ex: Visão Geral do Processo"
                        />
                      </div>

                      <div className="w-full max-w-full">
                        <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2" style={{ color: colors.textPrimary }}>
                          System Prompt (Opcional)
                        </label>
                        <div className="relative w-full max-w-full">
                          <textarea
                            value={analysisFormData.system_prompt}
                            onChange={(e) => setAnalysisFormData({ ...analysisFormData, system_prompt: e.target.value })}
                            rows={6}
                            className="w-full max-w-full px-2.5 sm:px-3 py-2 pr-10 rounded-lg focus:outline-none focus:ring-2 font-mono text-xs sm:text-sm resize-none box-border"
                            style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary, border: `1px solid ${colors.border}`, wordBreak: 'break-word' }}
                            placeholder="Instruções fundamentais do sistema (ex: Você é um especialista jurídico...)"
                          />
                          <button
                            type="button"
                            onClick={() => openFullscreenTextarea('system_prompt', analysisFormData.system_prompt, 'System Prompt (Opcional)')}
                            className="absolute top-2 right-2 p-1.5 rounded-lg transition-colors hover:opacity-70"
                            style={{ color: colors.textSecondary }}
                            title="Expandir em tela cheia"
                          >
                            <Maximize2 className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-xs mt-1 break-words" style={{ color: colors.textSecondary }}>
                          {analysisFormData.system_prompt.length} caracteres • Define o papel e comportamento da IA
                        </p>
                      </div>

                      <div className="w-full max-w-full">
                        <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2" style={{ color: colors.textPrimary }}>
                          Conteúdo do Prompt
                        </label>
                        <div className="relative w-full max-w-full">
                          <textarea
                            value={analysisFormData.prompt_content}
                            onChange={(e) => setAnalysisFormData({ ...analysisFormData, prompt_content: e.target.value })}
                            rows={15}
                            className="w-full max-w-full px-2.5 sm:px-3 py-2 pr-10 rounded-lg focus:outline-none focus:ring-2 font-mono text-xs sm:text-sm resize-none box-border"
                            style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary, border: `1px solid ${colors.border}`, wordBreak: 'break-word' }}
                            placeholder="Cole o conteúdo completo do prompt aqui..."
                          />
                          <button
                            type="button"
                            onClick={() => openFullscreenTextarea('prompt_content', analysisFormData.prompt_content, 'Conteúdo do Prompt')}
                            className="absolute top-2 right-2 p-1.5 rounded-lg transition-colors hover:opacity-70"
                            style={{ color: colors.textSecondary }}
                            title="Expandir em tela cheia"
                          >
                            <Maximize2 className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-xs mt-1 break-words" style={{ color: colors.textSecondary }}>
                          {analysisFormData.prompt_content.length} caracteres
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                        <button
                          onClick={() => isCreating ? handleCreateAnalysis() : handleUpdateAnalysis(editingId!)}
                          disabled={saving}
                          className="flex items-center justify-center space-x-2 px-3 sm:px-4 py-2 text-sm sm:text-base font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ backgroundColor: '#8B5CF6', color: '#FFFFFF' }}
                        >
                          {saving ? (
                            <>
                              <Loader className="w-4 h-4 animate-spin" />
                              <span>Salvando...</span>
                            </>
                          ) : (
                            <>
                              <Check className="w-4 h-4" />
                              <span>{isCreating ? 'Criar' : 'Salvar'}</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="flex items-center justify-center space-x-2 px-3 sm:px-4 py-2 text-sm sm:text-base font-semibold rounded-lg transition-colors"
                          style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary, border: `1px solid ${colors.border}` }}
                        >
                          <X className="w-4 h-4" />
                          <span>Cancelar</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-3 sm:space-y-4 w-full max-w-full">
                  {analysisPrompts.map((prompt) => (
                    <div
                      key={prompt.id}
                      className="rounded-xl shadow-lg overflow-hidden w-full max-w-full box-border"
                      style={{
                        backgroundColor: colors.bgSecondary,
                        border: prompt.is_active ? '2px solid #8B5CF6' : `2px solid ${colors.border}`
                      }}
                    >
                      <div className="p-4 sm:p-6 w-full max-w-full overflow-hidden">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-3 gap-3 w-full max-w-full">
                          <div className="flex-1 min-w-0 max-w-full">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <span className="text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap" style={{ backgroundColor: '#8B5CF6', color: '#FFFFFF' }}>
                                Prompt {prompt.execution_order}
                              </span>
                              <h3 className="text-base sm:text-lg font-bold break-words" style={{ color: colors.textPrimary }}>
                                {prompt.title}
                              </h3>
                              {prompt.is_active && (
                                <span className="text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap" style={{ backgroundColor: '#10B981', color: '#FFFFFF' }}>
                                  ATIVO
                                </span>
                              )}
                            </div>
                            <p className="text-xs sm:text-sm break-words" style={{ color: colors.textSecondary }}>
                              Criado em {new Date(prompt.created_at).toLocaleDateString('pt-BR')} às{' '}
                              {new Date(prompt.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>

                          <div className="flex items-center flex-wrap gap-2 flex-shrink-0">
                            <button
                              onClick={() => handleToggleStatusAnalysis(prompt.id, prompt.is_active)}
                              disabled={togglingId === prompt.id}
                              className="p-1.5 sm:p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              style={{ color: prompt.is_active ? colors.successIcon : '#808080' }}
                              title={prompt.is_active ? 'Desativar prompt' : 'Ativar prompt'}
                            >
                              {togglingId === prompt.id ? (
                                <Loader className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                              ) : prompt.is_active ? (
                                <Power className="w-4 h-4 sm:w-5 sm:h-5" />
                              ) : (
                                <PowerOff className="w-4 h-4 sm:w-5 sm:h-5" />
                              )}
                            </button>
                            <button
                              onClick={() => handleStartEditAnalysis(prompt)}
                              className="p-1.5 sm:p-2 rounded-lg transition-colors"
                              style={{ color: '#3B82F6' }}
                              title="Editar prompt"
                            >
                              <Pencil className="w-4 h-4 sm:w-5 sm:h-5" />
                            </button>
                            <button
                              onClick={() => handleDuplicateAnalysis(prompt)}
                              className="p-1.5 sm:p-2 rounded-lg transition-colors"
                              style={{ color: '#808080' }}
                              title="Duplicar prompt"
                            >
                              <Copy className="w-4 h-4 sm:w-5 sm:h-5" />
                            </button>
                            <button
                              onClick={() => handleDeleteAnalysis(prompt.id)}
                              disabled={deletingId === prompt.id || prompt.is_active}
                              className="p-1.5 sm:p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              style={{ color: '#C8C8C8' }}
                              onMouseEnter={(e) => {
                                if (!e.currentTarget.disabled) {
                                  e.currentTarget.style.color = '#A0A0A0';
                                  e.currentTarget.style.backgroundColor = 'rgba(200, 200, 200, 0.1)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = '#C8C8C8';
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                              title={prompt.is_active ? 'Desative antes de excluir' : 'Excluir prompt'}
                            >
                              {deletingId === prompt.id ? (
                                <Loader className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                              )}
                            </button>
                            <button
                              onClick={() => setExpandedId(expandedId === prompt.id ? null : prompt.id)}
                              className="p-1.5 sm:p-2 rounded-lg transition-colors"
                              style={{ color: '#808080' }}
                              title={expandedId === prompt.id ? 'Recolher' : 'Expandir'}
                            >
                              {expandedId === prompt.id ? (
                                <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5" />
                              ) : (
                                <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5" />
                              )}
                            </button>
                          </div>
                        </div>

                        {expandedId === prompt.id && (
                          <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 w-full max-w-full overflow-hidden" style={{ borderTop: `1px solid ${colors.border}` }}>
                            {prompt.system_prompt && (
                              <div className="mb-4">
                                <h4 className="text-xs sm:text-sm font-semibold mb-2 break-words" style={{ color: colors.textPrimary }}>System Prompt:</h4>
                                <div className="rounded-lg p-3 sm:p-4 max-h-60 overflow-y-auto overflow-x-hidden w-full max-w-full box-border" style={{ backgroundColor: colors.bgPrimary, border: `1px solid ${colors.border}` }}>
                                  <pre className="text-xs whitespace-pre-wrap font-mono break-words w-full max-w-full overflow-x-hidden" style={{ color: colors.textPrimary, wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                                    {prompt.system_prompt}
                                  </pre>
                                </div>
                                <p className="text-xs mt-2 break-words" style={{ color: colors.textSecondary }}>
                                  {prompt.system_prompt.length} caracteres • Enviado como system_instruction
                                </p>
                              </div>
                            )}
                            <h4 className="text-xs sm:text-sm font-semibold mb-2 break-words" style={{ color: colors.textPrimary }}>Conteúdo do Prompt:</h4>
                            <div className="rounded-lg p-3 sm:p-4 max-h-80 sm:max-h-96 overflow-y-auto overflow-x-hidden w-full max-w-full box-border" style={{ backgroundColor: colors.bgPrimary }}>
                              <pre className="text-xs whitespace-pre-wrap font-mono break-words w-full max-w-full overflow-x-hidden" style={{ color: colors.textPrimary, wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                                {prompt.prompt_content}
                              </pre>
                            </div>
                            <p className="text-xs mt-2 break-words" style={{ color: colors.textSecondary }}>
                              {prompt.prompt_content.length} caracteres
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {analysisPrompts.length === 0 && (
                    <div className="rounded-xl shadow-lg p-8 sm:p-12 text-center" style={{ backgroundColor: colors.bgSecondary }}>
                      <FileText className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4" style={{ color: colors.textSecondary }} />
                      <h3 className="text-base sm:text-lg font-semibold mb-2" style={{ color: colors.textPrimary }}>Nenhum prompt cadastrado</h3>
                      <p className="text-xs sm:text-sm" style={{ color: colors.textSecondary }}>
                        Crie seu primeiro prompt de análise clicando no botão acima.
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Chat Intro Prompts Tab */}
            {activeTab === 'chat_intro' && (
              <>
                {!isCreating && !editingId && (
                  <div className="mb-4 sm:mb-6">
                    <button
                      onClick={() => setIsCreating(true)}
                      className="flex items-center space-x-2 px-3 sm:px-4 py-2 text-sm sm:text-base font-semibold rounded-lg transition-all"
                      style={{ backgroundColor: '#8B5CF6', color: '#FFFFFF' }}
                    >
                      <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span>Criar Novo Prompt</span>
                    </button>
                  </div>
                )}

                {(isCreating || editingId) && (
                  <div className="mb-4 sm:mb-6 rounded-xl shadow-lg p-4 sm:p-6 overflow-hidden w-full max-w-full" style={{ backgroundColor: colors.bgSecondary }}>
                    <h2 className="text-base sm:text-lg font-bold mb-3 sm:mb-4 break-words" style={{ color: colors.textPrimary }}>
                      {isCreating ? 'Criar Novo Prompt de Chat' : 'Editar Prompt de Chat'}
                    </h2>

                    <div className="space-y-3 sm:space-y-4 w-full max-w-full">
                      <div className="w-full max-w-full">
                        <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2" style={{ color: colors.textPrimary }}>
                          Ordem de Exibição
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={chatIntroFormData.display_order}
                          onChange={(e) => setChatIntroFormData({ ...chatIntroFormData, display_order: parseInt(e.target.value) || 1 })}
                          className="w-full max-w-full px-2.5 sm:px-3 py-2 rounded-lg focus:outline-none focus:ring-2 text-sm sm:text-base box-border"
                          style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary, border: `1px solid ${colors.border}` }}
                          placeholder="1"
                        />
                      </div>

                      <div className="w-full max-w-full">
                        <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2" style={{ color: colors.textPrimary }}>
                          Texto do Prompt
                        </label>
                        <div className="relative w-full max-w-full">
                          <textarea
                            value={chatIntroFormData.prompt_text}
                            onChange={(e) => setChatIntroFormData({ ...chatIntroFormData, prompt_text: e.target.value })}
                            rows={4}
                            className="w-full max-w-full px-2.5 sm:px-3 py-2 pr-10 rounded-lg focus:outline-none focus:ring-2 text-xs sm:text-sm resize-none box-border"
                            style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary, border: `1px solid ${colors.border}`, wordBreak: 'break-word' }}
                            placeholder="Ex: Qual é o objeto principal desta ação?"
                          />
                          <button
                            type="button"
                            onClick={() => openFullscreenTextarea('chat_intro_text', chatIntroFormData.prompt_text, 'Texto do Prompt')}
                            className="absolute top-2 right-2 p-1.5 rounded-lg transition-colors hover:opacity-70"
                            style={{ color: colors.textSecondary }}
                            title="Expandir em tela cheia"
                          >
                            <Maximize2 className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-xs mt-1 break-words" style={{ color: colors.textSecondary }}>
                          {chatIntroFormData.prompt_text.length} caracteres
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                        <button
                          onClick={() => isCreating ? handleCreateChatIntro() : handleUpdateChatIntro(editingId!)}
                          disabled={saving}
                          className="flex items-center justify-center space-x-2 px-3 sm:px-4 py-2 text-sm sm:text-base font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ backgroundColor: '#8B5CF6', color: '#FFFFFF' }}
                        >
                          {saving ? (
                            <>
                              <Loader className="w-4 h-4 animate-spin" />
                              <span>Salvando...</span>
                            </>
                          ) : (
                            <>
                              <Check className="w-4 h-4" />
                              <span>{isCreating ? 'Criar' : 'Salvar'}</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="flex items-center justify-center space-x-2 px-3 sm:px-4 py-2 text-sm sm:text-base font-semibold rounded-lg transition-colors"
                          style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary, border: `1px solid ${colors.border}` }}
                        >
                          <X className="w-4 h-4" />
                          <span>Cancelar</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-3 sm:space-y-4 w-full max-w-full">
                  {chatIntroPrompts.map((prompt) => (
                    <div
                      key={prompt.id}
                      className="rounded-xl shadow-lg overflow-hidden w-full max-w-full box-border cursor-pointer hover:shadow-2xl transition-shadow"
                      style={{
                        backgroundColor: colors.bgSecondary,
                        border: prompt.is_active ? '2px solid #8B5CF6' : `2px solid ${colors.border}`
                      }}
                      onClick={() => setExpandedId(expandedId === prompt.id ? null : prompt.id)}
                    >
                      <div className="p-4 sm:p-6 w-full max-w-full overflow-hidden">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 w-full max-w-full">
                          <div className="flex-1 min-w-0 max-w-full">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <span className="text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap" style={{ backgroundColor: '#8B5CF6', color: '#FFFFFF' }}>
                                Ordem {prompt.display_order}
                              </span>
                              {prompt.is_active && (
                                <span className="text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap" style={{ backgroundColor: '#10B981', color: '#FFFFFF' }}>
                                  ATIVO
                                </span>
                              )}
                            </div>
                            <p className="text-sm sm:text-base break-words" style={{ color: colors.textPrimary }}>
                              {prompt.prompt_text}
                            </p>
                          </div>

                          <div className="flex items-center flex-wrap gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleMovePromptUp(prompt)}
                              disabled={chatIntroPrompts.findIndex(p => p.id === prompt.id) === 0}
                              className="p-1.5 sm:p-2 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                              style={{ color: '#8B5CF6' }}
                              title="Mover para cima"
                            >
                              <ArrowUp className="w-4 h-4 sm:w-5 sm:h-5" />
                            </button>
                            <button
                              onClick={() => handleMovePromptDown(prompt)}
                              disabled={chatIntroPrompts.findIndex(p => p.id === prompt.id) === chatIntroPrompts.length - 1}
                              className="p-1.5 sm:p-2 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                              style={{ color: '#8B5CF6' }}
                              title="Mover para baixo"
                            >
                              <ArrowDown className="w-4 h-4 sm:w-5 sm:h-5" />
                            </button>
                            <div className="h-4 w-px" style={{ backgroundColor: colors.border }}></div>
                            <button
                              onClick={() => handleToggleStatusChatIntro(prompt.id, prompt.is_active)}
                              disabled={togglingId === prompt.id}
                              className="p-1.5 sm:p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              style={{ color: prompt.is_active ? colors.successIcon : '#808080' }}
                              title={prompt.is_active ? 'Desativar prompt' : 'Ativar prompt'}
                            >
                              {togglingId === prompt.id ? (
                                <Loader className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                              ) : prompt.is_active ? (
                                <Power className="w-4 h-4 sm:w-5 sm:h-5" />
                              ) : (
                                <PowerOff className="w-4 h-4 sm:w-5 sm:h-5" />
                              )}
                            </button>
                            <button
                              onClick={() => handleStartEditChatIntro(prompt)}
                              className="p-1.5 sm:p-2 rounded-lg transition-colors"
                              style={{ color: '#3B82F6' }}
                              title="Editar prompt"
                            >
                              <Pencil className="w-4 h-4 sm:w-5 sm:h-5" />
                            </button>
                            <button
                              onClick={() => handleDeleteChatIntro(prompt.id)}
                              disabled={deletingId === prompt.id || prompt.is_active}
                              className="p-1.5 sm:p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              style={{ color: '#C8C8C8' }}
                              onMouseEnter={(e) => {
                                if (!e.currentTarget.disabled) {
                                  e.currentTarget.style.color = '#A0A0A0';
                                  e.currentTarget.style.backgroundColor = 'rgba(200, 200, 200, 0.1)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = '#C8C8C8';
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                              title={prompt.is_active ? 'Desative antes de excluir' : 'Excluir prompt'}
                            >
                              {deletingId === prompt.id ? (
                                <Loader className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                              )}
                            </button>
                          </div>
                        </div>

                        {expandedId === prompt.id && (
                          <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 w-full max-w-full overflow-hidden" style={{ borderTop: `1px solid ${colors.border}` }}>
                            <p className="text-xs sm:text-sm break-words" style={{ color: colors.textSecondary }}>
                              Criado em {new Date(prompt.created_at).toLocaleDateString('pt-BR')} às{' '}
                              {new Date(prompt.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {chatIntroPrompts.length === 0 && (
                    <div className="rounded-xl shadow-lg p-8 sm:p-12 text-center" style={{ backgroundColor: colors.bgSecondary }}>
                      <MessageSquare className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4" style={{ color: colors.textSecondary }} />
                      <h3 className="text-base sm:text-lg font-semibold mb-2" style={{ color: colors.textPrimary }}>Nenhum prompt de chat cadastrado</h3>
                      <p className="text-xs sm:text-sm" style={{ color: colors.textSecondary }}>
                        Crie seu primeiro prompt de introdução clicando no botão acima.
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Chat System Prompts Tab */}
            {activeTab === 'chat_system' && (
              <>
                {!isCreating && !editingId && (
                  <div className="mb-4 sm:mb-6">
                    <button
                      onClick={() => setIsCreating(true)}
                      className="flex items-center space-x-2 px-3 sm:px-4 py-2 text-sm sm:text-base font-semibold rounded-lg transition-all"
                      style={{ backgroundColor: '#8B5CF6', color: '#FFFFFF' }}
                    >
                      <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span>Criar Novo Prompt</span>
                    </button>
                  </div>
                )}

                {isCreating && (
                  <div className="mb-6 rounded-xl shadow-lg p-4 sm:p-6" style={{ backgroundColor: colors.bgSecondary }}>
                    <h3 className="text-base sm:text-lg font-semibold mb-4" style={{ color: colors.textPrimary }}>Novo Prompt de Chat</h3>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs sm:text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
                          Tipo de Prompt
                        </label>
                        <select
                          value={chatSystemFormData.prompt_type}
                          onChange={(e) => setChatSystemFormData({ ...chatSystemFormData, prompt_type: e.target.value as PromptType })}
                          className="w-full px-3 py-2 text-sm rounded-lg border transition-colors"
                          style={{
                            backgroundColor: colors.bgPrimary,
                            borderColor: colors.bgSecondary,
                            color: colors.textPrimary
                          }}
                        >
                          <option value="small_file">Chat Padrão (menos de 1000 páginas)</option>
                          <option value="large_file_analysis">Arquivos Grandes (mais de 3000 páginas)</option>
                          <option value="large_file_chunks">Arquivos Extra Grandes (1000-3000 páginas)</option>
                        </select>
                        <p className="text-xs mt-1" style={{ color: colors.textSecondary }}>
                          {ChatSystemPromptsService.getPromptTypeDescription(chatSystemFormData.prompt_type)}
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs sm:text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
                          Descrição (opcional)
                        </label>
                        <input
                          type="text"
                          value={chatSystemFormData.description}
                          onChange={(e) => setChatSystemFormData({ ...chatSystemFormData, description: e.target.value })}
                          placeholder="Breve descrição do propósito deste prompt"
                          className="w-full px-3 py-2 text-sm rounded-lg border transition-colors"
                          style={{
                            backgroundColor: colors.bgPrimary,
                            borderColor: colors.bgSecondary,
                            color: colors.textPrimary
                          }}
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-xs sm:text-sm font-medium" style={{ color: colors.textSecondary }}>
                            System Prompt
                          </label>
                          <button
                            onClick={() => openFullscreenTextarea('chat_system_prompt', chatSystemFormData.system_prompt, 'System Prompt')}
                            className="flex items-center space-x-1 px-2 py-1 text-xs rounded transition-colors"
                            style={{ backgroundColor: colors.bgPrimary, color: colors.textSecondary }}
                          >
                            <Maximize2 className="w-3 h-3" />
                            <span>Fullscreen</span>
                          </button>
                        </div>
                        <textarea
                          value={chatSystemFormData.system_prompt}
                          onChange={(e) => setChatSystemFormData({ ...chatSystemFormData, system_prompt: e.target.value })}
                          rows={12}
                          placeholder="Digite o conteúdo do system prompt..."
                          className="w-full px-3 py-2 text-sm rounded-lg border transition-colors font-mono resize-y"
                          style={{
                            backgroundColor: colors.bgPrimary,
                            borderColor: colors.bgSecondary,
                            color: colors.textPrimary
                          }}
                        />
                        <p className="text-xs mt-1" style={{ color: colors.textSecondary }}>
                          Variáveis disponíveis: {'{processo_name}'}, {'{total_pages}'}, {'{chunks_count}'}
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs sm:text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
                          Prioridade
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={chatSystemFormData.priority}
                          onChange={(e) => setChatSystemFormData({ ...chatSystemFormData, priority: parseInt(e.target.value) || 1 })}
                          className="w-full px-3 py-2 text-sm rounded-lg border transition-colors"
                          style={{
                            backgroundColor: colors.bgPrimary,
                            borderColor: colors.bgSecondary,
                            color: colors.textPrimary
                          }}
                        />
                        <p className="text-xs mt-1" style={{ color: colors.textSecondary }}>
                          Menor número = maior prioridade
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3 mt-6">
                      <button
                        onClick={handleCreateChatSystem}
                        disabled={saving}
                        className="flex items-center space-x-2 px-4 py-2 rounded-lg transition-all disabled:opacity-50"
                        style={{ backgroundColor: '#10B981', color: '#FFFFFF' }}
                      >
                        {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        <span>{saving ? 'Salvando...' : 'Salvar'}</span>
                      </button>
                      <button
                        onClick={() => {
                          setIsCreating(false);
                          setChatSystemFormData({ prompt_type: 'small_file', system_prompt: '', description: '', priority: 1 });
                        }}
                        className="flex items-center space-x-2 px-4 py-2 rounded-lg transition-all"
                        style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary }}
                      >
                        <X className="w-4 h-4" />
                        <span>Cancelar</span>
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  {chatSystemPrompts.map((prompt) => (
                    <div
                      key={prompt.id}
                      className="rounded-xl shadow-lg overflow-hidden transition-all"
                      style={{ backgroundColor: colors.bgSecondary }}
                    >
                      <div className="p-4 sm:p-6">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                          <div className="flex-1 min-w-0">
                            {editingId === prompt.id ? (
                              <select
                                value={chatSystemFormData.prompt_type}
                                onChange={(e) => setChatSystemFormData({ ...chatSystemFormData, prompt_type: e.target.value as PromptType })}
                                className="w-full px-3 py-2 text-sm rounded-lg border"
                                style={{
                                  backgroundColor: colors.bgPrimary,
                                  borderColor: colors.bgSecondary,
                                  color: colors.textPrimary
                                }}
                              >
                                <option value="small_file">Chat Padrão</option>
                                <option value="large_file_analysis">Arquivos Grandes</option>
                                <option value="large_file_chunks">Arquivos Extra Grandes</option>
                              </select>
                            ) : (
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className="px-3 py-1 rounded-full text-xs font-medium"
                                  style={{
                                    backgroundColor: prompt.prompt_type === 'small_file' ? '#10B98120' :
                                                   prompt.prompt_type === 'large_file_chunks' ? '#3B82F620' : '#8B5CF620',
                                    color: prompt.prompt_type === 'small_file' ? '#10B981' :
                                          prompt.prompt_type === 'large_file_chunks' ? '#3B82F6' : '#8B5CF6'
                                  }}
                                >
                                  {ChatSystemPromptsService.getPromptTypeLabel(prompt.prompt_type)}
                                </span>
                                {prompt.is_active && (
                                  <span className="px-2 py-1 rounded text-xs font-medium" style={{ backgroundColor: '#10B98120', color: '#10B981' }}>
                                    ATIVO
                                  </span>
                                )}
                              </div>
                            )}
                            {prompt.description && !editingId && (
                              <p className="text-xs sm:text-sm mt-2" style={{ color: colors.textSecondary }}>
                                {prompt.description}
                              </p>
                            )}
                          </div>

                          {!editingId && (
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button
                                onClick={() => {
                                  setExpandedId(expandedId === prompt.id ? null : prompt.id);
                                }}
                                className="p-2 rounded-lg transition-all"
                                style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary }}
                              >
                                {expandedId === prompt.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </button>
                              <button
                                onClick={() => {
                                  setEditingId(prompt.id);
                                  setChatSystemFormData({
                                    prompt_type: prompt.prompt_type,
                                    system_prompt: prompt.system_prompt,
                                    description: prompt.description || '',
                                    priority: prompt.priority
                                  });
                                }}
                                className="p-2 rounded-lg transition-all"
                                style={{ backgroundColor: colors.bgPrimary, color: '#3B82F6' }}
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDuplicateChatSystem(prompt.id)}
                                className="p-2 rounded-lg transition-all"
                                style={{ backgroundColor: colors.bgPrimary, color: '#8B5CF6' }}
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleToggleChatSystemStatus(prompt.id, prompt.is_active)}
                                disabled={togglingId === prompt.id}
                                className="p-2 rounded-lg transition-all disabled:opacity-50"
                                style={{ backgroundColor: colors.bgPrimary, color: prompt.is_active ? '#10B981' : '#6B7280' }}
                              >
                                {togglingId === prompt.id ? (
                                  <Loader className="w-4 h-4 animate-spin" />
                                ) : prompt.is_active ? (
                                  <Power className="w-4 h-4" />
                                ) : (
                                  <PowerOff className="w-4 h-4" />
                                )}
                              </button>
                              <button
                                onClick={() => handleDeleteChatSystem(prompt.id)}
                                disabled={deletingId === prompt.id}
                                className="p-2 rounded-lg transition-all disabled:opacity-50"
                                style={{ backgroundColor: colors.bgPrimary, color: '#EF4444' }}
                              >
                                {deletingId === prompt.id ? (
                                  <Loader className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          )}
                        </div>

                        {editingId === prompt.id && (
                          <div className="space-y-4 mt-4">
                            <div>
                              <label className="block text-xs sm:text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
                                Descrição
                              </label>
                              <input
                                type="text"
                                value={chatSystemFormData.description}
                                onChange={(e) => setChatSystemFormData({ ...chatSystemFormData, description: e.target.value })}
                                className="w-full px-3 py-2 text-sm rounded-lg border"
                                style={{
                                  backgroundColor: colors.bgPrimary,
                                  borderColor: colors.bgSecondary,
                                  color: colors.textPrimary
                                }}
                              />
                            </div>

                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <label className="block text-xs sm:text-sm font-medium" style={{ color: colors.textSecondary }}>
                                  System Prompt
                                </label>
                                <button
                                  onClick={() => openFullscreenTextarea('chat_system_prompt', chatSystemFormData.system_prompt, 'System Prompt')}
                                  className="flex items-center space-x-1 px-2 py-1 text-xs rounded transition-colors"
                                  style={{ backgroundColor: colors.bgPrimary, color: colors.textSecondary }}
                                >
                                  <Maximize2 className="w-3 h-3" />
                                  <span>Fullscreen</span>
                                </button>
                              </div>
                              <textarea
                                value={chatSystemFormData.system_prompt}
                                onChange={(e) => setChatSystemFormData({ ...chatSystemFormData, system_prompt: e.target.value })}
                                rows={12}
                                className="w-full px-3 py-2 text-sm rounded-lg border font-mono resize-y"
                                style={{
                                  backgroundColor: colors.bgPrimary,
                                  borderColor: colors.bgSecondary,
                                  color: colors.textPrimary
                                }}
                              />
                            </div>

                            <div>
                              <label className="block text-xs sm:text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
                                Prioridade
                              </label>
                              <input
                                type="number"
                                min="1"
                                value={chatSystemFormData.priority}
                                onChange={(e) => setChatSystemFormData({ ...chatSystemFormData, priority: parseInt(e.target.value) || 1 })}
                                className="w-full px-3 py-2 text-sm rounded-lg border"
                                style={{
                                  backgroundColor: colors.bgPrimary,
                                  borderColor: colors.bgSecondary,
                                  color: colors.textPrimary
                                }}
                              />
                            </div>

                            <div className="flex gap-3 pt-2">
                              <button
                                onClick={() => handleUpdateChatSystem(prompt.id)}
                                disabled={saving}
                                className="flex items-center space-x-2 px-4 py-2 rounded-lg transition-all disabled:opacity-50"
                                style={{ backgroundColor: '#10B981', color: '#FFFFFF' }}
                              >
                                {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                <span>{saving ? 'Salvando...' : 'Salvar'}</span>
                              </button>
                              <button
                                onClick={() => {
                                  setEditingId(null);
                                  setChatSystemFormData({ prompt_type: 'small_file', system_prompt: '', description: '', priority: 1 });
                                }}
                                className="flex items-center space-x-2 px-4 py-2 rounded-lg transition-all"
                                style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary }}
                              >
                                <X className="w-4 h-4" />
                                <span>Cancelar</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {expandedId === prompt.id && !editingId && (
                          <div className="mt-4 pt-4 border-t" style={{ borderColor: colors.bgPrimary }}>
                            <h4 className="text-sm font-medium mb-2" style={{ color: colors.textPrimary }}>System Prompt:</h4>
                            <pre className="text-xs p-3 rounded-lg overflow-x-auto whitespace-pre-wrap font-mono" style={{ backgroundColor: colors.bgPrimary, color: colors.textSecondary }}>
                              {prompt.system_prompt}
                            </pre>
                            <p className="text-xs mt-3" style={{ color: colors.textSecondary }}>
                              Prioridade: {prompt.priority} | Criado em: {new Date(prompt.created_at).toLocaleDateString('pt-BR')} às{' '}
                              {new Date(prompt.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {chatSystemPrompts.length === 0 && (
                    <div className="rounded-xl shadow-lg p-8 sm:p-12 text-center" style={{ backgroundColor: colors.bgSecondary }}>
                      <MessageSquare className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4" style={{ color: colors.textSecondary }} />
                      <h3 className="text-base sm:text-lg font-semibold mb-2" style={{ color: colors.textPrimary }}>Nenhum prompt de chat cadastrado</h3>
                      <p className="text-xs sm:text-sm" style={{ color: colors.textSecondary }}>
                        Crie seu primeiro prompt de sistema clicando no botão acima.
                      </p>
                    </div>
                  )}
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
      {isSearchOpen && (
        <IntelligentSearch
          onClose={() => setIsSearchOpen(false)}
          onSelectProcess={(processoId) => {
            window.history.pushState({}, '', `/lawsuits-detail/${processoId}`);
            window.dispatchEvent(new PopStateEvent('popstate'));
          }}
        />
      )}

      {fullscreenTextarea && (
        <FullscreenTextareaModal
          label={fullscreenTextarea.label}
          value={fullscreenTextarea.value}
          onSave={saveFullscreenTextarea}
          onClose={closeFullscreenTextarea}
          colors={colors}
        />
      )}
    </div>
  );
}

interface FullscreenTextareaModalProps {
  label: string;
  value: string;
  onSave: (value: string) => void;
  onClose: () => void;
  colors: ReturnType<typeof getThemeColors>;
}

function FullscreenTextareaModal({ label, value, onSave, onClose, colors }: FullscreenTextareaModalProps) {
  const [editedValue, setEditedValue] = React.useState(value);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-0"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}
      onClick={onClose}
    >
      <div
        className="w-full h-full flex flex-col"
        style={{ backgroundColor: colors.bgPrimary }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: colors.border }}
        >
          <h2 className="text-xl font-bold" style={{ color: colors.textPrimary }}>
            {label}
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-sm" style={{ color: colors.textSecondary }}>
              {editedValue.length} caracteres
            </span>
            <button
              onClick={() => onSave(editedValue)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors"
              style={{ backgroundColor: '#8B5CF6', color: '#FFFFFF' }}
            >
              <Check className="w-4 h-4" />
              Salvar
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg transition-colors hover:opacity-70"
              style={{ color: colors.textSecondary }}
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 p-6 overflow-hidden">
          <textarea
            value={editedValue}
            onChange={(e) => setEditedValue(e.target.value)}
            className="w-full h-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2 font-mono text-sm resize-none"
            style={{
              backgroundColor: colors.bgSecondary,
              color: colors.textPrimary,
              border: `1px solid ${colors.border}`
            }}
            placeholder="Digite o conteúdo aqui..."
            autoFocus
          />
        </div>
      </div>
    </div>
  );
}
