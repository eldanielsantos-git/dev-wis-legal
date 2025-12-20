import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { SidebarWis } from '../components/SidebarWis';
import { FooterWis } from '../components/FooterWis';
import { IntelligentSearch } from '../components/IntelligentSearch';
import { ProcessContentSearch } from '../components/ProcessContentSearch';
import { ProcessosService } from '../services/ProcessosService';
import { AnalysisResultsService, type AnalysisResult } from '../services/AnalysisResultsService';
import { FileText, Calendar, Clock, Brain, Loader, AlertCircle, Pencil, Check, X, ChevronDown, ChevronUp, MessageSquare, List, ChevronLeft, Share2, Users, Lock, Edit3, Trash2, Tag } from 'lucide-react';
import type { Processo } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';
import { AnalysisProgress } from '../components/AnalysisProgress';
import { ComplexProcessingProgress } from '../components/ComplexProcessingProgress';
import { AnalysisStagesProgress } from '../components/AnalysisStagesProgress';
import { AnalysisCard } from '../components/AnalysisCard';
import { AnalysisViewSelector } from '../components/analysis-views/AnalysisViewSelector';
import { calculateCardAvailability, getAvailableCards } from '../utils/analysisAvailability';
import { ShareProcessModal } from '../components/ShareProcessModal';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';
import { WorkspaceService, WorkspaceShare } from '../services/WorkspaceService';
import { useAuth } from '../contexts/AuthContext';
import { ProcessoTagsService } from '../services/ProcessoTagsService';
import { ProcessoTagAssignmentsService } from '../services/ProcessoTagAssignmentsService';
import { ProcessoTagsList } from '../components/tags/ProcessoTagsList';
import { ProcessoTagsPopup } from '../components/tags/ProcessoTagsPopup';
import { ReadOnlyPermissionModal } from '../components/ReadOnlyPermissionModal';
import type { ProcessoTag } from '../lib/supabase';

interface MyProcessDetailPageProps {
  processoId: string;
  onNavigateToApp: () => void;
  onNavigateToMyProcess: () => void;
  onNavigateToChat?: (processoId?: string) => void;
  onNavigateToWorkspace?: () => void;
  onNavigateToAdmin?: () => void;
  onNavigateToProfile?: () => void;
  onNavigateToTerms?: () => void;
  onNavigateToPrivacy?: () => void;
  onNavigateToCookies?: () => void;
}

class SilentErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🚨 Silent Error Boundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || null;
    }

    return this.props.children;
  }
}

function MyProcessDetailPageInner({
  processoId,
  onNavigateToApp,
  onNavigateToMyProcess,
  onNavigateToChat, onNavigateToWorkspace,
  onNavigateToAdmin,
  onNavigateToProfile,
  onNavigateToTerms,
  onNavigateToPrivacy,
  onNavigateToCookies
}: MyProcessDetailPageProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [processo, setProcesso] = useState<Processo | null>(null);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  const [showFullAnalysis, setShowFullAnalysis] = useState(true);
  const selectedContentRef = React.useRef<HTMLDivElement>(null);
  const pollIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shares, setShares] = useState<WorkspaceShare[]>([]);
  const [canShare, setCanShare] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [showSharesSection, setShowSharesSection] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [processoTags, setProcessoTags] = useState<ProcessoTag[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(true);
  const [isTagsPopupOpen, setIsTagsPopupOpen] = useState(false);
  const [canEditTags, setCanEditTags] = useState(false);
  const [showReadOnlyModal, setShowReadOnlyModal] = useState(false);
  const [userPermissionLevel, setUserPermissionLevel] = useState<'owner' | 'editor' | 'read_only' | null>(null);
  const { user, isAdmin } = useAuth();
  const isLoadingResultsRef = React.useRef(false);
  const processoChannelRef = React.useRef<(() => void) | null>(null);
  const resultsChannelRef = React.useRef<(() => void) | null>(null);
  const isFullyCompletedRef = React.useRef(false);
  const processoRef = React.useRef<Processo | null>(null);
  const analysisResultsRef = React.useRef<AnalysisResult[]>([]);

  const shouldStopPolling = (currentProcesso: Processo | null, currentResults: AnalysisResult[]): boolean => {
    if (!currentProcesso) {
      console.log('⚠️ shouldStopPolling: processo is null');
      return false;
    }

    const processoFinished = ['completed', 'error'].includes(currentProcesso.status);
    const hasResults = currentResults.length > 0;
    const allResultsFinished = currentResults.every(r => r.status === 'completed' || r.status === 'failed');

    console.log('🔍 shouldStopPolling check:', {
      processoStatus: currentProcesso.status,
      processoFinished,
      hasResults,
      resultsCount: currentResults.length,
      allResultsFinished,
      shouldStop: processoFinished && hasResults && allResultsFinished
    });

    return processoFinished && hasResults && allResultsFinished;
  };

  const cleanupSubscriptionsAndPolling = () => {
    console.log('Check last subscriptions e polling');

    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    if (processoChannelRef.current) {
      processoChannelRef.current();
      processoChannelRef.current = null;
    }

    if (resultsChannelRef.current) {
      resultsChannelRef.current();
      resultsChannelRef.current = null;
    }

    isFullyCompletedRef.current = true;
  };

  useEffect(() => {
    loadProcesso();
    loadAnalysisResults();
    loadShares();
    checkCanShare();
    loadProcessoTags();
    checkEditPermission();

    const setupRealtimeAndPolling = async () => {
      await new Promise(resolve => setTimeout(resolve, 500));

      if (isFullyCompletedRef.current) {
        console.log('✅ Processo já finalizado, não configurando polling/subscriptions');
        return;
      }

      processoChannelRef.current = ProcessosService.subscribeToProcessoChanges(
        processoId,
        (updatedProcesso) => {
          if (isFullyCompletedRef.current) {
            console.log('⏭️ Realtime ignorado - processo já finalizado');
            return;
          }

          console.log('🔄 Realtime: Processo updated:', {
            id: updatedProcesso.id,
            status: updatedProcesso.status,
            currentPrompt: updatedProcesso.current_prompt_number,
            totalPrompts: updatedProcesso.total_prompts
          });

          const wasAnalyzing = processoRef.current?.status === 'analyzing';
          const isNowCompleted = updatedProcesso.status === 'completed';

          setProcesso(updatedProcesso);
          processoRef.current = updatedProcesso;

          if (wasAnalyzing && isNowCompleted) {
            console.log('✅ Processo concluído - carregando resultados finais');
            setTimeout(() => {
              loadAnalysisResults();
            }, 1000);
          }

          // Verificar se deve parar após update
          if (shouldStopPolling(updatedProcesso, analysisResultsRef.current)) {
            console.log('✅ Processo completo detectado via Realtime - parando tudo');
            cleanupSubscriptionsAndPolling();
          }
        }
      );

      resultsChannelRef.current = AnalysisResultsService.subscribeToResultsChanges(
        processoId,
        () => {
          if (isFullyCompletedRef.current) {
            console.log('⏭️ Realtime results ignorado - processo completo');
            return;
          }

          console.log('🔄 Realtime: Analysis results updated - recarregando...');
          loadAnalysisResults();
        }
      );

      pollIntervalRef.current = setInterval(() => {
        if (isFullyCompletedRef.current) {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          return;
        }

        console.log('🔄 Polling tick - atualizando dados...');
        refreshProcesso();
        loadAnalysisResults();
        loadShares();
      }, 1000);
    };

    setupRealtimeAndPolling();

    return () => {
      console.log('🛡️ Limpando subscriptions e polling no unmount');
      cleanupSubscriptionsAndPolling();
    };
  }, [processoId]);

  const loadProcesso = async (retryCount = 0) => {
    try {
      setLoading(true);

      const data = await ProcessosService.getProcessoById(processoId);

      if (!data) {
        const { supabase } = await import('../lib/supabase');
        const { data: fallbackData } = await supabase
          .from('processos')
          .select('*')
          .eq('id', processoId)
          .single();

        if (fallbackData) {
          const processoData = fallbackData as any;
          setProcesso(processoData);
          processoRef.current = processoData;
        }
        return;
      }

      setProcesso(data);
      processoRef.current = data;

      // Verificar se processo já está completo na carga inicial
      if (['completed', 'error'].includes(data.status)) {
        console.log('ℹ️ Processo já está em status final:', data.status);

        // Verificar se deve parar o polling imediatamente
        if (shouldStopPolling(data, analysisResultsRef.current)) {
          console.log('✅ Processo já completo na carga - não iniciará polling/subscriptions');
          isFullyCompletedRef.current = true;
        }
      }
    } catch (err: any) {
      console.error('Erro ao carregar processo:', err);

      if (err?.message?.includes('Failed to fetch') && retryCount < 3) {
        console.log(`Tentando novamente... (${retryCount + 1}/3)`);
        setTimeout(() => loadProcesso(retryCount + 1), 1000 * (retryCount + 1));
        return;
      }

      try {
        const { supabase } = await import('../lib/supabase');
        const { data: fallbackData } = await supabase
          .from('processos')
          .select('*')
          .eq('id', processoId)
          .single();

        if (fallbackData) {
          const processoData = fallbackData as any;
          setProcesso(processoData);
          processoRef.current = processoData;
        }
      } catch (fallbackErr) {
        console.error('Erro no fallback:', fallbackErr);
      }
    } finally {
      if (retryCount === 0) {
        setLoading(false);
      }
    }
  };

  const refreshProcesso = async () => {
    if (isFullyCompletedRef.current) return;

    try {
      const data = await ProcessosService.getProcessoById(processoId);
      if (data) {
        setProcesso(data);
        processoRef.current = data;

        // Verificar se deve parar polling após refresh
        if (shouldStopPolling(data, analysisResultsRef.current)) {
          console.log('✅ Processo completo detectado no refresh - parando polling');
          cleanupSubscriptionsAndPolling();
        }
      }
    } catch (err) {
      console.error('Erro ao atualizar processo:', err);
    }
  };

  const loadAnalysisResults = async () => {
    if (isFullyCompletedRef.current) {
      console.log('⏭️ Skipping loadAnalysisResults - processo completo');
      return;
    }

    // Não bloquear se já está carregando - apenas skip silenciosamente para evitar chamadas duplicadas
    if (isLoadingResultsRef.current) {
      return;
    }

    try {
      isLoadingResultsRef.current = true;
      console.log('📄 Carregando resultados de análise para processo:', processoId);
      const results = await AnalysisResultsService.getResultsByProcessoId(processoId);

      console.log('✅ Resultados carregados:', {
        total: results.length,
        byStatus: results.reduce((acc, r) => {
          acc[r.status] = (acc[r.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        details: results.map(r => ({
          order: r.execution_order,
          title: r.prompt_title,
          status: r.status,
          hasContent: !!r.result_content,
          contentLength: r.result_content?.length || 0
        }))
      });

      // Força atualização do estado sempre que houver mudanças
      const hasChanged = JSON.stringify(results.map(r => ({ id: r.id, status: r.status }))) !==
                        JSON.stringify(analysisResultsRef.current.map(r => ({ id: r.id, status: r.status })));

      if (hasChanged) {
        console.log('🔄 Detectadas mudanças nos resultados - atualizando estado');
      }

      setAnalysisResults(results);
      analysisResultsRef.current = results;

      // Usa o ref para pegar o processo mais atualizado
      if (shouldStopPolling(processoRef.current, results)) {
        console.log('✅ Processo completamente finalizado - parando polling e subscriptions');
        cleanupSubscriptionsAndPolling();
      }
    } catch (err) {
      console.error('❌ Erro ao carregar resultados:', err);
    } finally {
      isLoadingResultsRef.current = false;
    }
  };

  const loadShares = async () => {
    try {
      const processShares = await WorkspaceService.getProcessShares(processoId);
      setShares(processShares);
    } catch (error) {
      console.error('Error loading shares:', error);
    }
  };

  const checkCanShare = async () => {
    try {
      const result = await WorkspaceService.canShare(processoId);
      setCanShare(result.canShare);
      if (!result.canShare) {
        setShareError(result.reason);
      }
    } catch (error) {
      console.error('Error checking if can share:', error);
      setCanShare(false);
    }
  };

  const loadProcessoTags = async () => {
    setIsLoadingTags(true);
    try {
      const tags = await ProcessoTagAssignmentsService.getTagsByProcessoId(processoId);
      setProcessoTags(tags);
    } catch (error) {
      console.error('Erro ao carregar tags:', error);
    } finally {
      setIsLoadingTags(false);
    }
  };

  const checkEditPermission = async () => {
    if (!processo || !user) {
      setCanEditTags(false);
      setUserPermissionLevel(null);
      return;
    }

    const isOwner = processo.user_id === user.id;

    if (isOwner || isAdmin) {
      console.log('🔑 Permissão de edição de tags concedida (dono ou admin)');
      setCanEditTags(true);
      setUserPermissionLevel('owner');
      return;
    }

    try {
      const workspaceShares = await WorkspaceService.getProcessShares(processoId);
      const userShare = workspaceShares.find(
        share =>
          share.shared_with_user_id === user.id &&
          share.invitation_status === 'accepted'
      );

      const isEditor = userShare?.permission_level === 'editor';
      const isReadOnly = userShare?.permission_level === 'read_only';

      console.log('🔑 Verificando permissão de edição de tags:', {
        processoUserId: processo.user_id,
        currentUserId: user.id,
        isOwner,
        isAdmin,
        isEditor,
        isReadOnly,
        hasPermission: isOwner || isAdmin || isEditor
      });

      if (isEditor) {
        setCanEditTags(true);
        setUserPermissionLevel('editor');
      } else if (isReadOnly) {
        setCanEditTags(false);
        setUserPermissionLevel('read_only');
      } else {
        setCanEditTags(false);
        setUserPermissionLevel(null);
      }
    } catch (error) {
      console.error('Erro ao verificar permissões de workspace:', error);
      setCanEditTags(false);
      setUserPermissionLevel(null);
    }
  };

  // Verificar permissões quando processo ou user mudarem
  useEffect(() => {
    checkEditPermission();
  }, [processo, user, isAdmin, processoId]);

  const handleShareClick = () => {
    if (canShare) {
      setIsShareModalOpen(true);
    }
  };

  const handleShareSuccess = () => {
    loadShares();
    checkCanShare();
  };

  const handleRemoveShare = async (shareId: string) => {
    if (!confirm('Tem certeza que deseja remover este compartilhamento?')) {
      return;
    }

    try {
      await WorkspaceService.removeShare(shareId);
      loadShares();
    } catch (error) {
      console.error('Error removing share:', error);
      alert('Erro ao remover compartilhamento');
    }
  };

  const handleUpdatePermission = async (shareId: string, newPermission: 'read_only' | 'editor') => {
    try {
      await WorkspaceService.updateSharePermission(shareId, newPermission);
      loadShares();
    } catch (error) {
      console.error('Error updating permission:', error);
      alert('Erro ao atualizar permissão');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleEditName = () => {
    if (!processo) return;
    setEditedName(processo.file_name);
    setIsEditingName(true);
  };

  const handleSaveName = async () => {
    if (!processo || !editedName.trim()) {
      setIsEditingName(false);
      return;
    }

    try {
      setIsSavingName(true);
      await ProcessosService.updateProcessoName(processo.id, editedName);
      setProcesso({ ...processo, file_name: editedName });
      setIsEditingName(false);
    } catch (err) {
      console.error('Erro ao atualizar nome:', err);
      setError('Erro ao atualizar nome do processo');
    } finally {
      setIsSavingName(false);
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!processo) return;

    try {
      setIsDeleting(true);
      await ProcessosService.deleteProcesso(processo.id);
      setShowDeleteModal(false);
      onNavigateToMyProcess();
    } catch (err) {
      console.error('Erro ao excluir processo:', err);
      alert('Erro ao excluir processo. Tente novamente.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSelectResult = (resultId: string) => {
    const availabilityMap = calculateCardAvailability(analysisResults);
    const cardAvailability = availabilityMap.get(resultId);

    if (cardAvailability?.isAvailable) {
      const isDeselecting = selectedResultId === resultId;
      setSelectedResultId(isDeselecting ? null : resultId);
      setShowFullAnalysis(false);

      // Scroll para o conteúdo expandido no mobile
      if (!isDeselecting) {
        setTimeout(() => {
          if (selectedContentRef.current) {
            const isMobile = window.innerWidth < 768;
            if (isMobile) {
              selectedContentRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
              });
            }
          }
        }, 100);
      }
    }
  };

  const handleToggleFullAnalysis = () => {
    setShowFullAnalysis(!showFullAnalysis);
    setSelectedResultId(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen font-body flex items-center justify-center" style={{ backgroundColor: colors.bgPrimary }}>
        <Loader className="w-8 h-8 animate-spin" style={{ color: colors.textSecondary }} />
      </div>
    );
  }

  if (!processo) {
    return null;
  }

  const totalPrompts = analysisResults.length > 0 ? analysisResults.length : (processo.total_prompts || 9);
  const completedPrompts = analysisResults.filter(r => r.status === 'completed').length;
  const processingPrompt = analysisResults.find(r => r.status === 'running' || r.status === 'processing');

  // Se há um prompt sendo processado, currentPrompt = execution_order desse prompt
  // Caso contrário, currentPrompt = número de prompts concluídos
  const currentPrompt = processingPrompt
    ? processingPrompt.execution_order
    : completedPrompts;

  // Buscar o modelo atual em uso
  const llmModelName = processo.current_llm_model_name || null;
  const isModelSwitching = processo.llm_model_switching || false;

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

      <main className={`flex-1 flex flex-col transition-all duration-300 pt-16 lg:pt-0 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'} overflow-x-hidden h-screen`}>
        {/* Header Section - Fixo */}
        <section
          className="sticky top-0 z-30 px-0 sm:px-6 pt-2 sm:pt-6 pb-2 shadow-sm"
          style={{
            backgroundColor: colors.bgPrimary,
            position: 'sticky'
          }}
        >
          <div className="max-w-6xl mx-auto w-full space-y-2">
            {/* Nome do Processo e Chat */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0 sm:space-x-3 items-center">
              <div className="flex items-center space-x-2 flex-1 min-w-0 w-full sm:w-auto">
                <div className="p-1.5 sm:p-2 rounded-lg" style={{ backgroundColor: theme === 'dark' ? '#141312' : colors.bgSecondary }}>
                  <FileText className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: '#1C9BF1' }} />
                </div>
                <div className="flex-1 min-w-0">
                  {isEditingName ? (
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !isSavingName) {
                            handleSaveName();
                          } else if (e.key === 'Escape') {
                            setIsEditingName(false);
                            setEditedName(processo.file_name);
                          }
                        }}
                        className="flex-1 px-3 py-1 rounded-lg text-base outline-none"
                        style={{ backgroundColor: colors.bgSecondary, color: colors.textPrimary }}
                        autoFocus
                      />
                      <button
                        onClick={handleSaveName}
                        disabled={isSavingName}
                        className="p-1.5 rounded-lg hover:bg-green-100"
                        style={{ color: '#10B981' }}
                      >
                        {isSavingName ? <Loader className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => {
                          setIsEditingName(false);
                          setEditedName(processo.file_name);
                        }}
                        className="p-1.5 rounded-lg hover:bg-red-100"
                        style={{ color: '#EF4444' }}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <h1
                        className="text-sm sm:text-base cursor-pointer hover:opacity-70 transition-opacity"
                        style={{ color: colors.textPrimary }}
                        onClick={handleEditName}
                        title="Crie um nome para seu processo"
                      >
                        {processo.file_name}
                      </h1>
                      <button
                        onClick={handleEditName}
                        className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                        style={{ color: '#1C9BF1' }}
                        title="Crie um nome para seu processo"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleShareClick}
                  disabled={!canShare}
                  className="flex items-center space-x-1.5 px-3 py-2.5 rounded-lg transition-all duration-200 hover:opacity-80 whitespace-nowrap w-fit disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: theme === 'dark' ? '#141312' : colors.bgSecondary }}
                  title={canShare ? 'Compartilhe com outros usuários' : shareError || 'Aguarde a análise ser concluída para compartilhar'}
                >
                  <Share2 className="w-5 h-5" style={{ color: canShare ? '#10B981' : colors.textSecondary }} />
                  <span className="text-sm font-normal hidden sm:inline" style={{ color: theme === 'dark' ? '#FAFAFA' : '#0F0E0D' }}>Compartilhar</span>
                </button>

                <button
                  onClick={() => onNavigateToChat?.(processoId)}
                  className="flex items-center space-x-1.5 px-3 py-2.5 rounded-lg transition-all duration-200 hover:opacity-80 whitespace-nowrap w-fit"
                  style={{ backgroundColor: theme === 'dark' ? '#141312' : colors.bgSecondary }}
                >
                  <MessageSquare className="w-5 h-5" style={{ color: '#1C9BF1' }} />
                  <span className="text-sm font-normal" style={{ color: theme === 'dark' ? '#FAFAFA' : '#0F0E0D' }}>Chat com o processo</span>
                </button>

                <button
                  onClick={handleDeleteClick}
                  className="flex items-center space-x-1.5 px-3 py-2.5 rounded-lg transition-all duration-200 hover:opacity-80 whitespace-nowrap w-fit"
                  style={{ backgroundColor: theme === 'dark' ? '#141312' : colors.bgSecondary }}
                  title="Excluir processo"
                >
                  <Trash2 className="w-5 h-5" style={{ color: '#EF4444' }} />
                  <span className="text-sm font-normal hidden sm:inline" style={{ color: theme === 'dark' ? '#FAFAFA' : '#0F0E0D' }}>Excluir</span>
                </button>
              </div>
            </div>

            {/* Seção de Tags do Processo */}
            {!isLoadingTags && (
              <div className="mb-6 px-4 py-3 rounded-lg" style={{ backgroundColor: colors.bgSecondary }}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium flex items-center gap-2" style={{ color: colors.textSecondary }}>
                    <Tag size={16} />
                    Tags do Processo
                  </h3>
                  {canEditTags && (
                    <button
                      onClick={() => setIsTagsPopupOpen(true)}
                      className="text-xs px-2 py-1 rounded hover:opacity-80 transition-opacity"
                      style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary }}
                    >
                      Gerenciar Tags
                    </button>
                  )}
                  {!canEditTags && userPermissionLevel === 'read_only' && (
                    <button
                      onClick={() => setShowReadOnlyModal(true)}
                      className="text-xs px-2 py-1 rounded hover:opacity-80 transition-opacity flex items-center gap-1"
                      style={{ backgroundColor: colors.bgSecondary, color: colors.textSecondary }}
                    >
                      <Lock size={12} />
                      Gerenciar Tags
                    </button>
                  )}
                </div>

                {processoTags.length > 0 ? (
                  <ProcessoTagsList
                    processoId={processoId}
                    tags={processoTags}
                    maxVisible={5}
                    editable={canEditTags}
                    isReadOnly={userPermissionLevel === 'read_only'}
                    onTagsChange={loadProcessoTags}
                  />
                ) : (
                  <div className="text-xs italic" style={{ color: colors.textSecondary }}>
                    Nenhuma tag atribuída a este processo
                  </div>
                )}
              </div>
            )}

            <ProcessoTagsPopup
              isOpen={isTagsPopupOpen}
              onClose={() => {
                setIsTagsPopupOpen(false);
                loadProcessoTags();
              }}
              tags={processoTags}
              processoId={canEditTags ? processoId : undefined}
              onTagsUpdated={loadProcessoTags}
            />

            <ReadOnlyPermissionModal
              isOpen={showReadOnlyModal}
              onClose={() => setShowReadOnlyModal(false)}
            />

            {/* Título Áreas de Análise */}
            {(analysisResults.length > 0 || totalPrompts > 0) && (
              <h2 className="text-sm font-light text-center" style={{ color: colors.textPrimary }}>
                Áreas de Análise
              </h2>
            )}

            {/* Cards de Navegação */}
            {(analysisResults.length > 0 || totalPrompts > 0) && (
              <div className="flex justify-center gap-1.5 sm:gap-4 overflow-x-auto px-0 pb-0">
                <button
                  onClick={handleToggleFullAnalysis}
                  title="Visualizar todas as análises"
                  className="flex items-center justify-center rounded-lg transition-opacity duration-200 hover:opacity-70 flex-shrink-0 w-8 h-8 sm:w-12 sm:h-12"
                  style={{
                    backgroundColor: theme === 'dark' ? '#141312' : colors.bgSecondary,
                    border: 'none',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <List className="w-3.5 h-3.5 sm:w-6 sm:h-6" style={{ color: '#6366F1' }} />
                </button>

                {analysisResults
                  .sort((a, b) => a.execution_order - b.execution_order)
                  .map((result) => {
                    const availabilityMap = calculateCardAvailability(analysisResults);
                    const cardAvailability = availabilityMap.get(result.id);

                    return (
                      <AnalysisCard
                        key={`${result.id}-${result.status}-${result.completed_at || 'pending'}`}
                        number={result.execution_order}
                        title={result.prompt_title}
                        status={result.status}
                        isSelected={selectedResultId === result.id}
                        onClick={() => handleSelectResult(result.id)}
                        executionTimeMs={result.execution_time_ms || undefined}
                        isAvailable={cardAvailability?.isAvailable}
                      />
                    );
                  })}
              </div>
            )}
          </div>
        </section>

        {/* Conteúdo Rolável */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-6 pt-1 pb-6 sm:pt-1 sm:pb-8 w-full">
          <div className="max-w-5xl mx-auto w-full">
            {/* Progress Card */}
            {processo.status !== 'completed' && (
              <div className="space-y-4 mb-6">
                {processo.is_chunked ? (
                  <ComplexProcessingProgress
                    processoId={processoId}
                    onStatusChange={(newStatus) => {
                      // Não atualiza se já está concluído
                      if (isFullyCompletedRef.current) {
                        console.log('⏭️ onStatusChange ignorado - processo já finalizado');
                        return;
                      }

                      if (processo.status !== newStatus) {
                        console.log('🔄 Status mudou, recarregando processo:', {
                          old: processo.status,
                          new: newStatus
                        });
                        loadProcesso();
                      }
                    }}
                    onStageClick={handleSelectResult}
                    selectedResultId={selectedResultId}
                    showCompletedCards={true}
                    isAdmin={isAdmin}
                  />
                ) : (
                  <AnalysisProgress
                    currentPrompt={currentPrompt}
                    totalPrompts={totalPrompts}
                    status={processo.status as any}
                    llmModelName={llmModelName}
                    isModelSwitching={isModelSwitching}
                    isAdmin={isAdmin}
                  />
                )}

                <AnalysisStagesProgress processoId={processoId} />
              </div>
            )}

            {/* Analysis Results */}
            {(analysisResults.length > 0 || totalPrompts > 0) && (
              <div className="space-y-6">
                {/* Search Bar */}
                {analysisResults.length > 0 && (
                  <div className="mb-6">
                    <ProcessContentSearch
                      analysisResults={analysisResults}
                      onResultClick={(resultId) => {
                        setSelectedResultId(resultId);
                        setShowFullAnalysis(false);
                        setTimeout(() => {
                          if (selectedContentRef.current) {
                            selectedContentRef.current.scrollIntoView({
                              behavior: 'smooth',
                              block: 'start'
                            });
                          }
                        }, 100);
                      }}
                    />
                  </div>
                )}

                {showFullAnalysis && (
                  <div className="space-y-4 sm:space-y-8 mt-6">
                    {getAvailableCards(analysisResults).map((result) => (
                        <div
                          key={result.id}
                          className="rounded-lg px-3 sm:px-[18px] py-3 sm:py-[18px] pt-3 sm:pt-4"
                          style={{ backgroundColor: theme === 'dark' ? '#141312' : colors.bgSecondary }}
                        >
                          <SilentErrorBoundary>
                            <AnalysisViewSelector title={result.prompt_title} content={result.result_content || ''} />
                          </SilentErrorBoundary>
                          <div className="mt-4 text-xs" style={{ color: colors.textSecondary }}>
                            Gerado em: {formatDate(result.created_at)}
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                {selectedResultId && !showFullAnalysis && (
                  <div
                    ref={selectedContentRef}
                    className="rounded-lg px-3 sm:px-[18px] py-3 sm:py-[18px] pt-3 sm:pt-4 mt-6"
                    style={{ backgroundColor: theme === 'dark' ? '#141312' : colors.bgSecondary }}
                  >
                    {(() => {
                      const selectedResult = analysisResults.find(r => r.id === selectedResultId);
                      if (!selectedResult) return null;

                      const availabilityMap = calculateCardAvailability(analysisResults);
                      const cardAvailability = availabilityMap.get(selectedResultId);

                      if (!cardAvailability?.isAvailable) {
                        return (
                          <div className="text-center py-8">
                            <AlertCircle className="w-12 h-12 mx-auto mb-4" style={{ color: '#F59E0B' }} />
                            <p className="text-lg font-semibold mb-2" style={{ color: colors.textPrimary }}>
                              Análise bloqueada
                            </p>
                            <p className="text-sm" style={{ color: colors.textSecondary }}>
                              Complete a análise anterior para visualizar este conteúdo
                            </p>
                          </div>
                        );
                      }

                      console.log('🔍 Renderizando resultado selecionado:', {
                        id: selectedResult.id,
                        title: selectedResult.prompt_title,
                        hasContent: !!selectedResult.result_content,
                        contentLength: selectedResult.result_content?.length || 0,
                        status: selectedResult.status,
                        completedAt: selectedResult.completed_at,
                      });

                      const hasEmptyContent = selectedResult.status === 'completed' && (!selectedResult.result_content || selectedResult.result_content.trim().length === 0);

                      if (hasEmptyContent) {
                        console.error('⚠️ CONTEÚDO VAZIO DETECTADO:', {
                          id: selectedResult.id,
                          title: selectedResult.prompt_title,
                          status: selectedResult.status,
                          completedAt: selectedResult.completed_at,
                        });
                      }

                      return (
                        <div>
                          {selectedResult.result_content ? (
                            <SilentErrorBoundary>
                              <AnalysisViewSelector title={selectedResult.prompt_title} content={selectedResult.result_content} />
                            </SilentErrorBoundary>
                          ) : selectedResult.status === 'completed' ? (
                            <div className="text-center py-8">
                              <div className="mb-3">
                                <svg className="w-12 h-12 mx-auto" style={{ color: colors.textSecondary }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                              </div>
                              <p className="text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
                                Conteúdo não disponível
                              </p>
                              <p className="text-xs" style={{ color: colors.textSecondary }}>
                                Houve um problema ao processar este item. Por favor, reprocesse o arquivo.
                              </p>
                            </div>
                          ) : (
                            <div className="text-center py-8">
                              <p className="text-sm" style={{ color: colors.textSecondary }}>
                                Conteúdo em processamento...
                              </p>
                            </div>
                          )}
                          <div className="mt-4 text-xs" style={{ color: colors.textSecondary }}>
                            Gerado em: {formatDate(selectedResult.created_at)}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* Empty State */}
            {processo.status === 'completed' && analysisResults.length === 0 && (
              <div className="text-center py-12 rounded-lg" style={{ backgroundColor: colors.bgSecondary }}>
                <Brain className="w-12 h-12 mx-auto mb-4" style={{ color: colors.textSecondary }} />
                <p className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
                  Nenhum resultado de análise encontrado
                </p>
              </div>
            )}

            {/* Seção de Compartilhamentos */}
            {user?.id === processo.user_id && shares.length > 0 && (
              <div className="mt-8">
                <button
                  onClick={() => setShowSharesSection(!showSharesSection)}
                  className="w-full flex items-center justify-between p-4 rounded-lg transition-colors hover:opacity-80"
                  style={{ backgroundColor: colors.bgSecondary }}
                >
                  <div className="flex items-center space-x-3">
                    <Users className="w-5 h-5" style={{ color: colors.textPrimary }} />
                    <span className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
                      Compartilhamentos
                    </span>
                    <span
                      className="px-2 py-1 rounded-full text-xs font-medium"
                      style={{ backgroundColor: colors.bgTertiary, color: colors.textSecondary }}
                    >
                      {shares.length}
                    </span>
                  </div>
                  {showSharesSection ? (
                    <ChevronUp className="w-5 h-5" style={{ color: colors.textSecondary }} />
                  ) : (
                    <ChevronDown className="w-5 h-5" style={{ color: colors.textSecondary }} />
                  )}
                </button>

                {showSharesSection && (
                  <div className="mt-4 space-y-3">
                    {shares.map((share) => (
                      <div
                        key={share.id}
                        className="p-4 rounded-lg border"
                        style={{ backgroundColor: colors.bgSecondary, borderColor: colors.border }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <p className="font-medium" style={{ color: colors.textPrimary }}>
                                {share.shared_with_name}
                              </p>
                              <span
                                className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-medium"
                                style={{
                                  backgroundColor: share.permission_level === 'read_only' ? 'rgba(251, 191, 36, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                                  color: share.permission_level === 'read_only' ? '#f59e0b' : '#3b82f6'
                                }}
                              >
                                {share.permission_level === 'read_only' ? (
                                  <>
                                    <Lock className="w-3 h-3" />
                                    <span>Somente Leitura</span>
                                  </>
                                ) : (
                                  <>
                                    <Edit3 className="w-3 h-3" />
                                    <span>Editor</span>
                                  </>
                                )}
                              </span>
                            </div>
                            <p className="text-sm" style={{ color: colors.textSecondary }}>
                              {share.shared_with_email}
                            </p>
                            <p className="text-xs mt-1" style={{ color: colors.textTertiary }}>
                              Compartilhado em {new Date(share.created_at).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2 ml-4">
                            <select
                              value={share.permission_level}
                              onChange={(e) => handleUpdatePermission(share.id, e.target.value as 'read_only' | 'editor')}
                              className="px-3 py-1.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              style={{
                                backgroundColor: colors.bgPrimary,
                                borderColor: colors.border,
                                color: colors.textPrimary
                              }}
                            >
                              <option value="read_only">Somente Leitura</option>
                              <option value="editor">Editor</option>
                            </select>
                            <button
                              onClick={() => handleRemoveShare(share.id)}
                              className="p-2 rounded-lg hover:bg-red-100 transition-colors"
                              style={{ color: '#EF4444' }}
                              title="Remover acesso"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      <ShareProcessModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        processoId={processoId}
        processoName={processo?.file_name || 'Processo sem nome'}
        onShareSuccess={handleShareSuccess}
      />

      <ConfirmDeleteModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleConfirmDelete}
        processoName={processo?.file_name || 'este processo'}
        isDeleting={isDeleting}
      />

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

export function MyProcessDetailPage(props: MyProcessDetailPageProps) {
  return (
    <SilentErrorBoundary>
      <MyProcessDetailPageInner {...props} />
    </SilentErrorBoundary>
  );
}
