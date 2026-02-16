import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { FileUpload } from '../components/FileUpload';
import { SidebarWis } from '../components/SidebarWis';
import { FooterWis } from '../components/FooterWis';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';
import { IntelligentSearch } from '../components/IntelligentSearch';
import { UpgradeModal } from '../components/UpgradeModal';
import { InterruptedUploadsModal } from '../components/InterruptedUploadsModal';
import { ProcessoCard } from '../components/ProcessoCard';
import { ProcessoListItem } from '../components/ProcessoListItem';
import { StatusCard } from '../components/StatusCard';
// TODO: Reimplementar
// import ForensicBackgroundProgress from '../components/ForensicBackgroundProgress';
import { ErrorModal } from '../components/ErrorModal';
import { ToastContainer } from '../components/ToastContainer';
import { useToast } from '../hooks/useToast';
import { ProcessosService } from '../services/ProcessosService';
import { TokenValidationService } from '../services/TokenValidationService';
import { WorkspaceService } from '../services/WorkspaceService';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useTokenBalance } from '../contexts/TokenBalanceContext';
import { getThemeColors } from '../utils/themeUtils';
import { logger } from '../utils/logger';
import { useEffectOnce } from '../hooks/useEffectOnce';
import { FileText, CheckCircle, Loader, LayoutGrid, List, Users } from 'lucide-react';
import type { Processo } from '../lib/supabase';
import { supabase } from '../lib/supabase';

interface AppHomePageProps {
  onNavigateToDetail: (processoId: string) => void;
  onNavigateToAdmin: () => void;
  onNavigateToMyProcess?: () => void;
  onNavigateToChat?: () => void;
  onNavigateToWorkspace?: () => void;
  onNavigateToProfile?: () => void;
  onNavigateToTerms?: () => void;
  onNavigateToPrivacy?: () => void;
  onNavigateToCookies?: () => void;
  onNavigateToApp?: () => void;
  onNavigateToTokens?: () => void;
  onNavigateToSchedule?: () => void;
}

export function AppHomePage({ onNavigateToDetail, onNavigateToAdmin, onNavigateToMyProcess, onNavigateToChat, onNavigateToWorkspace, onNavigateToProfile, onNavigateToTerms, onNavigateToPrivacy, onNavigateToCookies, onNavigateToApp, onNavigateToTokens, onNavigateToSchedule }: AppHomePageProps) {
  logger.log('AppHomePage', 'Renderizando componente');
  const { user, isAdmin } = useAuth();
  const { theme } = useTheme();
  const { refreshBalance } = useTokenBalance();
  const colors = useMemo(() => getThemeColors(theme), [theme]);
  logger.log('AppHomePage', 'User:', user?.id);
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; processoId: string; fileName: string }>({ isOpen: false, processoId: '', fileName: '' });
  const [uploadingProcessoId, setUploadingProcessoId] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);
  const [lastProcessedId, setLastProcessedId] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [upgradeModal, setUpgradeModal] = useState<{
    isOpen: boolean;
    tokensRequired: number;
    tokensAvailable: number;
    pagesRequired: number;
    pagesAvailable: number;
    planName?: string;
    reason: 'insufficient_tokens' | 'no_subscription';
  }>({ isOpen: false, tokensRequired: 0, tokensAvailable: 0, pagesRequired: 0, pagesAvailable: 0, reason: 'no_subscription' });
  const [refreshKey, setRefreshKey] = useState(0);
  const [syncingSubscription, setSyncingSubscription] = useState(true);
  const hasSyncedSubscription = useRef(false);
  const hasLoadedProcessos = useRef(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [errorModal, setErrorModal] = useState<{ isOpen: boolean; title: string; message: string }>({ isOpen: false, title: '', message: '' });
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [viewAllProcesses, setViewAllProcesses] = useState(false);
  const { toasts, removeToast, success: showSuccess, error: showError, warning: showWarning, info: showInfo } = useToast();
  const [sharedProcessCount, setSharedProcessCount] = useState<number>(0);
  const [sharedProcessIds, setSharedProcessIds] = useState<Set<string>>(new Set());
  const [shareCountByProcesso, setShareCountByProcesso] = useState<Map<string, number>>(new Map());
  const [interruptedUploads, setInterruptedUploads] = useState<Array<{ id: string; file_name: string; uploaded: number; total: number }>>([]);
  const [showInterruptedModal, setShowInterruptedModal] = useState(false);

  useEffectOnce(() => {
    const syncAndLoadData = async () => {
      if (hasSyncedSubscription.current) {
        setSyncingSubscription(false);
        return;
      }

      try {
        const urlParams = new URLSearchParams(window.location.search);
        const fromStripe = urlParams.get('from_stripe');
        const sessionId = urlParams.get('session_id');

        if (fromStripe === 'success' && sessionId) {
          const newUrl = window.location.pathname;
          window.history.replaceState({}, document.title, newUrl);
        }

        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
          const syncResponse = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-stripe-subscription`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              },
            }
          );

          await new Promise(resolve => setTimeout(resolve, 500));
          hasSyncedSubscription.current = true;

          await refreshBalance();
        }
      } catch (err) {
        // Silently handle sync errors
      } finally {
        setSyncingSubscription(false);
      }
    };

    syncAndLoadData().catch(err => {
      setSyncingSubscription(false);
    });
    if (!hasLoadedProcessos.current) {
      loadProcessos();
      hasLoadedProcessos.current = true;
    }
    detectProcessosEmAndamento();
    loadSharedProcessCount();
    checkInterruptedUploads();

  });

  useEffect(() => {
    if (!user?.id) return;

    let unsubscribe: (() => void) | null = null;

    const setupSubscription = async () => {
      try {
        unsubscribe = await ProcessosService.subscribeToProcessos(user.id, (updatedProcessos) => {
          setProcessos(updatedProcessos);

          if (uploadingProcessoId) {
            const processo = updatedProcessos.find(p => p.id === uploadingProcessoId);
            if (processo) {
              setProcessingStatus(processo.status);

              if (processo.status === 'completed' && processingStatus !== 'completed') {
                const audio = new Audio('https://rslpleprodloodfsaext.supabase.co/storage/v1/object/public/assets/sons/beep.ogg');
                audio.play().catch(err => logger.error('AppHomePage', 'Erro ao tocar beep:', err));
                setLastProcessedId(processo.id);
              }
            }
          }
        });
      } catch (err) {
        logger.error('AppHomePage', 'Erro ao subscrever aos processos:', err);
      }
    };

    setupSubscription();

    return () => {
      try {
        if (unsubscribe) unsubscribe();
      } catch (err) {
        logger.error('AppHomePage', 'Erro ao cancelar subscrição:', err);
      }
    };
  }, [user?.id, uploadingProcessoId, processingStatus]);

  useEffect(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    const hasProcessingProcessos = processos.some(p =>
      p.status === 'analyzing' || p.status === 'created' || p.status === 'uploading'
    );

    if (hasProcessingProcessos) {
      logger.log('AppHomePage', 'Starting polling for processes in progress');
      pollingIntervalRef.current = setInterval(() => {
        logger.log('AppHomePage', 'Polling: atualizando processos em andamento');
        loadProcessos();
      }, 5000);
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [processos]);

  const loadProcessos = useCallback(async (forceViewAll?: boolean) => {
    try {
      const shouldViewAll = forceViewAll !== undefined ? forceViewAll : viewAllProcesses;
      const data = await ProcessosService.getProcessos(shouldViewAll);
      setProcessos(data);
    } catch (err: any) {
      setErrorModal({
        isOpen: true,
        title: 'Erro ao carregar processos',
        message: err instanceof Error ? err.message : 'Não foi possível carregar os processos. Por favor, recarregue a página.'
      });
    }
  }, [viewAllProcesses]);

  const detectProcessosEmAndamento = useCallback(async () => {
    try {
      if (!user) return;

      logger.log('AppHomePage', 'Detectando processos em andamento...');
      const { data: processosEmAndamento } = await supabase
        .from('processos')
        .select('id, file_name, status')
        .eq('user_id', user.id)
        .in('status', ['created', 'analyzing'])
        .order('created_at', { ascending: false });

      if (processosEmAndamento && processosEmAndamento.length > 0) {
        logger.log('AppHomePage', `${processosEmAndamento.length} processo(s) em andamento detectado(s)`);
      }
    } catch (err) {
      logger.error('AppHomePage', 'Erro ao detectar processos em andamento:', err);
    }
  }, [user]);

  const loadSharedProcessCount = useCallback(async () => {
    try {
      if (!user) return;
      const counts = await WorkspaceService.countShares();
      setSharedProcessCount(counts.sharedWithMe + counts.myShares);

      // Load full share details for badge indicators
      const shares = await WorkspaceService.getMyShares();
      const ids = new Set(shares.map(share => share.processo_id));
      setSharedProcessIds(ids);

      // Count shares per processo
      const countMap = new Map<string, number>();
      shares.forEach(share => {
        const currentCount = countMap.get(share.processo_id) || 0;
        countMap.set(share.processo_id, currentCount + 1);
      });
      setShareCountByProcesso(countMap);
    } catch (err) {
      logger.error('AppHomePage', 'Erro ao carregar contagem de processos compartilhados:', err);
    }
  }, [user]);

  const checkInterruptedUploads = useCallback(async () => {
    try {
      const interrupted = await ProcessosService.checkForInterruptedUploads();
      if (interrupted.length > 0) {
        for (const process of interrupted) {
          try {

            showInfo(`Retomando upload: ${process.file_name}`);

            await ProcessosService.resumeInterruptedUpload(process.id);

            showSuccess(`Upload retomado: ${process.file_name}`);
            loadProcessos();
          } catch (error) {
            logger.error('AppHomePage', 'Erro ao retomar upload:', error);
            showError(`Falha ao retomar: ${process.file_name}. Tente reenviar o arquivo.`);
          }
        }
      }
    } catch (err) {
      logger.error('AppHomePage', 'Erro ao verificar uploads interrompidos:', err);
    }
  }, [loadProcessos, showInfo, showSuccess, showError]);

  const handleDeleteInterruptedUpload = async (processoId: string) => {
    try {
      const result = await ProcessosService.deleteProcesso(processoId);
      if (result.success) {
        setInterruptedUploads(prev => prev.filter(u => u.id !== processoId));
        if (interruptedUploads.length <= 1) {
          setShowInterruptedModal(false);
        }
        showSuccess('Upload interrompido excluído com sucesso');
        loadProcessos();
      } else {
        showError(result.error || 'Erro ao excluir upload');
      }
    } catch (error) {
      logger.error('AppHomePage', 'Erro ao excluir upload interrompido:', error);
      showError('Erro ao excluir upload');
    }
  };

  const handleReloadApp = useCallback(async () => {
    logger.log('AppHomePage', 'Recarregando app via botão +');
    setLoading(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      await loadProcessos();
      logger.log('AppHomePage', 'Reload concluído com sucesso');
    } catch (err) {
      logger.error('AppHomePage', 'Erro ao recarregar:', err);
    } finally {
      setLoading(false);
    }
  }, [loadProcessos]);

  const handleFileSelect = async (files: File[]) => {
    if (files.length === 0) return;

    if (!user) {
      setError('Usuário não autenticado');
      return;
    }

    if (syncingSubscription) {
      setError('Aguarde a verificação da assinatura...');
      return;
    }

    setLoading(true);
    setError(null);

    for (const file of files) {
      try {
        if (file.type !== 'application/pdf') throw new Error('Apenas PDF');

        const pageCount = await ProcessosService.countPdfPages(file);

        const tokenCheck = await TokenValidationService.checkTokensBeforeUpload(user.id, pageCount);

        // Apenas verificar se tem tokens suficientes, independente de ter assinatura
        if (!tokenCheck.hasSufficientTokens) {
          setLoading(false);
          setUpgradeModal({
            isOpen: true,
            tokensRequired: tokenCheck.tokensRequired,
            tokensAvailable: tokenCheck.tokensRemaining,
            pagesRequired: pageCount,
            pagesAvailable: tokenCheck.pagesRemaining,
            planName: tokenCheck.planName,
            reason: 'insufficient_tokens',
          });
          return;
        }

        setProcessingStatus('uploading');

        let processoId: string;

        if (pageCount >= 1000) {
          processoId = await ProcessosService.uploadAndStartComplexProcessing(
            file,
            pageCount,
            (id) => {
              setUploadingProcessoId(id);
              setLastProcessedId(id);
              loadProcessos();
            }
          );
        } else {
          processoId = await ProcessosService.uploadAndStartProcessing(
            file,
            (id) => {
              setUploadingProcessoId(id);
              setLastProcessedId(id);
              loadProcessos();
            }
          );
        }

        setProcessingStatus('analyzing');

        if (processoId) {
          showSuccess('Upload concluído! Redirecionando...');
          setTimeout(() => {
            onNavigateToDetail(processoId);
          }, 1000);
        }
      } catch (err: any) {
        setLoading(false);
        setProcessingStatus(null);
        setUploadingProcessoId(null);
        setErrorModal({
          isOpen: true,
          title: 'Erro ao processar arquivo',
          message: err.message || 'Ocorreu um erro ao fazer upload do arquivo. Por favor, tente novamente.'
        });
        break;
      }
    }
    setLoading(false);
    await loadProcessos();
  };

  const handleViewProcess = () => {
    if (lastProcessedId) {
      window.history.pushState({}, '', `/lawsuits-detail/${lastProcessedId}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  const handleDeleteProcesso = useCallback((processo: Processo) => {
    setDeleteModal({
      isOpen: true,
      processoId: processo.id,
      fileName: processo.file_name
    });
  }, []);

  const handleViewDetails = useCallback((processo: Processo) => {
    window.history.pushState({}, '', `/lawsuits-detail/${processo.id}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    try {
      const result = await ProcessosService.deleteProcesso(deleteModal.processoId);
      if (result.success) {
        setProcessos(prev => prev.filter(p => p.id !== deleteModal.processoId));
        setDeleteModal({ isOpen: false, processoId: '', fileName: '' });
        showSuccess('Processo excluído com sucesso');
      } else {
        setDeleteModal({ isOpen: false, processoId: '', fileName: '' });
        setErrorModal({
          isOpen: true,
          title: 'Erro ao excluir processo',
          message: result.error || 'Não foi possível excluir o processo. Por favor, tente novamente.'
        });
      }
    } catch (err: any) {
      setDeleteModal({ isOpen: false, processoId: '', fileName: '' });
      setErrorModal({
        isOpen: true,
        title: 'Erro ao excluir processo',
        message: err.message || 'Não foi possível excluir o processo. Por favor, tente novamente.'
      });
    }
  }, [deleteModal.processoId, showSuccess]);

  const handleCancelDelete = useCallback(() => {
    setDeleteModal({ isOpen: false, processoId: '', fileName: '' });
  }, []);

  const stats = useMemo(() => {
    const totalPrompts = 9;
    const totalProcessos = processos.length;
    const processosCompletos = processos.filter(p => {
      const isStatusCompleted = p.status === 'completed';
      const isAnalysisComplete = p.status === 'analyzing' && (p.current_prompt_number || 0) >= totalPrompts;
      return isStatusCompleted || isAnalysisComplete;
    }).length;
    const processosProcessando = processos.filter(p => {
      const isAnalyzing = p.status === 'analyzing' && (p.current_prompt_number || 0) < totalPrompts;
      const isCreated = p.status === 'created';
      return isAnalyzing || isCreated;
    }).length;
    const recentProcessos = processos.slice(0, 12);

    logger.log('AppHomePage', 'Estatísticas:', {
      total: totalProcessos,
      completos: processosCompletos,
      processando: processosProcessando
    });

    return {
      totalProcessos,
      processosCompletos,
      processosProcessando,
      recentProcessos
    };
  }, [processos]);

  const { totalProcessos, processosCompletos, processosProcessando, recentProcessos } = stats;

  return (
    <div className="flex min-h-screen font-body" style={{ backgroundColor: colors.bgPrimary }}>
      <SidebarWis
        onNavigateToApp={handleReloadApp}
        onNavigateToMyProcess={() => {
          if (onNavigateToMyProcess) {
            onNavigateToMyProcess();
          }
        }}
        onNavigateToChat={onNavigateToChat}
        onNavigateToWorkspace={onNavigateToWorkspace}
        onNavigateToSchedule={onNavigateToSchedule}
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
        activePage="home"
      />
      <div className={`${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'} pt-16 lg:pt-0 flex-1 flex flex-col transition-[margin-left] duration-300 ease-in-out`}>
        <main className="flex-1 p-4 sm:p-6 lg:p-8 w-full max-w-7xl mx-auto">
          <section className="mb-8 sm:mb-10 lg:mb-12 text-center">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-title font-normal mb-3 sm:mb-4 flex items-center justify-center gap-3" style={{ color: colors.textPrimary }}>
              Wis Legal
              <span
                className="text-[10px] sm:text-xs px-1.5 py-[1px] sm:py-0.5 rounded font-body font-medium leading-none"
                style={{
                  backgroundColor: theme === 'dark' ? 'rgba(156, 163, 175, 0.15)' : 'rgba(107, 114, 128, 0.1)',
                  color: theme === 'dark' ? 'rgba(156, 163, 175, 0.8)' : 'rgba(107, 114, 128, 0.7)',
                  border: `1px solid ${theme === 'dark' ? 'rgba(156, 163, 175, 0.2)' : 'rgba(107, 114, 128, 0.15)'}`
                }}
              >
                Beta
              </span>
            </h1>
            <p className="text-base sm:text-lg font-body" style={{ color: colors.textSecondary }}>Plataforma para análise de processos</p>
          </section>
          <section className="mb-8 sm:mb-10 lg:mb-12 rounded-lg p-6 sm:p-8 mx-auto max-w-3xl" style={{ backgroundColor: theme === 'dark' ? '#141312' : colors.bgSecondary }}>
            <h2 className="text-xl sm:text-2xl font-title font-bold mb-4 text-center" style={{ color: colors.textPrimary }}>Upload do Processo</h2>

            {syncingSubscription ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader className="w-8 h-8 animate-spin mb-4" style={{ color: colors.textPrimary }} />
                <p className="text-sm" style={{ color: colors.textSecondary }}>
                  Verificando sua assinatura...
                </p>
              </div>
            ) : (
              <FileUpload
                key={refreshKey}
                onFileSelect={handleFileSelect}
                loading={loading}
                processingStatus={processingStatus || undefined}
                onViewProcess={processingStatus === 'completed' ? handleViewProcess : undefined}
                onNavigateToSubscription={() => {
                  window.history.pushState({}, '', '/signature');
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }}
                onNavigateToTokens={onNavigateToTokens}
              />
            )}
          </section>
          <section className="mb-8 sm:mb-10 lg:mb-12">
            <h2 className="text-xl sm:text-2xl font-title font-bold mb-4 sm:mb-6 text-center" style={{ color: colors.textPrimary }}>Status</h2>
            <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-4 justify-items-center max-w-7xl mx-auto">
              <StatusCard
                title="Processos Registrados"
                value={totalProcessos}
                icon={FileText}
                iconColor="text-blue-500"
                iconBg="bg-blue-100 dark:bg-blue-900/30"
                description="Total de processos"
                onClick={() => onNavigateToMyProcess?.()}
              />
              <StatusCard
                title="Processos Analisados"
                value={processosCompletos}
                icon={CheckCircle}
                iconColor="text-green-500"
                iconBg="bg-green-100 dark:bg-green-900/30"
                description="Processos completos"
                onClick={() => onNavigateToMyProcess?.()}
              />
              <StatusCard
                title="Processos em Análise"
                value={processosProcessando}
                icon={Loader}
                iconColor="text-yellow-500"
                iconBg="bg-yellow-100 dark:bg-yellow-900/30"
                description={processosProcessando > 0 ? 'Sendo analisados' : 'Você não tem arquivos em análise'}
                onClick={() => onNavigateToMyProcess?.()}
              />
              <StatusCard
                title="Meu Workspace"
                value={sharedProcessCount}
                icon={Users}
                iconColor="text-purple-500"
                iconBg="bg-purple-100 dark:bg-purple-900/30"
                description={sharedProcessCount > 0 ? 'Acessar processos compartilhados' : 'Você ainda não compartilhou nenhum processo'}
                onClick={() => onNavigateToWorkspace?.()}
              />
            </div>
          </section>

{/* TODO: Reimplementar seção de análises forenses em background */}

          <section className="mb-8 sm:mb-10 lg:mb-12">
            <div className="flex items-center justify-center mb-4 sm:mb-6 gap-4">
              <h2 className="text-xl sm:text-2xl font-title font-bold text-center" style={{ color: colors.textPrimary }}>
                {viewAllProcesses ? 'Todos os Processos' : 'Análises Recentes'}
              </h2>
              <button
                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                className="hidden lg:block p-2 rounded-lg transition-all duration-200 hover:scale-110"
                style={{ backgroundColor: theme === 'dark' ? '#141312' : colors.bgSecondary }}
                title={viewMode === 'grid' ? 'Visualização em lista' : 'Visualização em cards'}
              >
                {viewMode === 'grid' ? (
                  <List className="w-5 h-5" style={{ color: colors.textPrimary }} />
                ) : (
                  <LayoutGrid className="w-5 h-5" style={{ color: colors.textPrimary }} />
                )}
              </button>
              {isAdmin && (
                <button
                  onClick={() => {
                    const newValue = !viewAllProcesses;
                    setViewAllProcesses(newValue);
                    loadProcessos(newValue);
                  }}
                  className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-all duration-200 hover:scale-105"
                  style={{
                    backgroundColor: viewAllProcesses ? '#8B5CF6' : (theme === 'dark' ? '#141312' : colors.bgSecondary),
                    color: viewAllProcesses ? '#FFFFFF' : colors.textPrimary
                  }}
                  title={viewAllProcesses ? 'Ver apenas meus processos' : 'Ver todos os processos'}
                >
                  <Users className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="text-xs sm:text-sm font-medium">{viewAllProcesses ? 'Meus' : 'Todos'}</span>
                </button>
              )}
            </div>
            {recentProcessos.length === 0 ? (
              <div className="rounded-lg p-12 text-center" style={{ backgroundColor: colors.bgSecondary }}><FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" strokeWidth={1} /><h3 className="text-lg font-semibold mb-2" style={{ color: colors.textPrimary }}>Você ainda não tem nenhum processo em análise</h3><p style={{ color: colors.textSecondary }}>Faça upload do seu primeiro processo e descubra uma forma mais ágil e inteligente de trabalhar</p></div>
            ) : (
              <>
                <div className={viewMode === 'grid' ? 'flex flex-wrap justify-center gap-6' : 'space-y-4'}>
                  {recentProcessos.map(processo => {
                    const isOwner = user?.id === processo.user_id;
                    const canDelete = isAdmin || isOwner;
                    const commonProps = {
                      key: processo.id,
                      processo,
                      onViewDetails: handleViewDetails,
                      onDelete: canDelete ? handleDeleteProcesso : undefined,
                      isAdmin,
                      isShared: sharedProcessIds.has(processo.id),
                      shareCount: shareCountByProcesso.get(processo.id) || 0,
                      userInfo: processo.user_profile ? {
                        name: `${processo.user_profile.first_name} ${processo.user_profile.last_name}`.trim(),
                        email: processo.user_profile.email,
                        created_at: processo.user_profile.created_at
                      } : undefined
                    };

                    return viewMode === 'grid' ? (
                      <ProcessoCard {...commonProps} />
                    ) : (
                      <ProcessoListItem {...commonProps} />
                    );
                  })}
                </div>

                <div className="flex justify-center mt-8">
                  <button
                    onClick={() => {
                      if (onNavigateToMyProcess) {
                        onNavigateToMyProcess();
                      }
                    }}
                    className="px-6 py-3 rounded-lg font-semibold text-white transition-all duration-200 hover:scale-105 hover:shadow-lg"
                    style={{ backgroundColor: '#141312' }}
                  >
                    Ver todos os processos
                  </button>
                </div>
              </>
            )}
          </section>
        </main>
        <FooterWis
          onNavigateToTerms={onNavigateToTerms}
          onNavigateToPrivacy={onNavigateToPrivacy}
          onNavigateToCookies={onNavigateToCookies}
        />
      </div>
      <ConfirmDeleteModal
        isOpen={deleteModal.isOpen}
        fileName={deleteModal.fileName}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
      <UpgradeModal
        isOpen={upgradeModal.isOpen}
        onClose={() => setUpgradeModal({ ...upgradeModal, isOpen: false })}
        tokensRequired={upgradeModal.tokensRequired}
        tokensAvailable={upgradeModal.tokensAvailable}
        pagesRequired={upgradeModal.pagesRequired}
        pagesAvailable={upgradeModal.pagesAvailable}
        planName={upgradeModal.planName}
        reason={upgradeModal.reason}
        onNavigateToTokens={onNavigateToTokens}
      />
      <IntelligentSearch
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectProcess={(processoId) => {
          window.history.pushState({}, '', `/lawsuits-detail/${processoId}`);
          window.dispatchEvent(new PopStateEvent('popstate'));
        }}
      />
      <ErrorModal
        isOpen={errorModal.isOpen}
        title={errorModal.title}
        message={errorModal.message}
        onClose={() => setErrorModal({ isOpen: false, title: '', message: '' })}
      />
      <InterruptedUploadsModal
        isOpen={showInterruptedModal}
        onClose={() => setShowInterruptedModal(false)}
        uploads={interruptedUploads}
        onDelete={handleDeleteInterruptedUpload}
      />
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />
    </div>
  );
}