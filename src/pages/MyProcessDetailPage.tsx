import React, { useState, useEffect } from 'react';
import { SidebarWis } from '../components/SidebarWis';
import { FooterWis } from '../components/FooterWis';
import { IntelligentSearch } from '../components/IntelligentSearch';
import { ProcessosService } from '../services/ProcessosService';
import { AnalysisResultsService, type AnalysisResult } from '../services/AnalysisResultsService';
import { FileText, Calendar, Clock, Brain, Loader, AlertCircle, Pencil, Check, X, ChevronDown, ChevronUp, MessageSquare, List, ChevronLeft } from 'lucide-react';
import type { Processo } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';
import { AnalysisProgress } from '../components/AnalysisProgress';
import { ComplexProcessingProgress } from '../components/ComplexProcessingProgress';
import { AnalysisCard } from '../components/AnalysisCard';
import { AnalysisViewSelector } from '../components/analysis-views/AnalysisViewSelector';
import { calculateCardAvailability, getAvailableCards } from '../utils/analysisAvailability';

interface MyProcessDetailPageProps {
  processoId: string;
  onNavigateToApp: () => void;
  onNavigateToMyProcess: () => void;
  onNavigateToChat?: (processoId?: string) => void;
  onNavigateToAdmin?: () => void;
  onNavigateToProfile?: () => void;
  onNavigateToTerms?: () => void;
  onNavigateToPrivacy?: () => void;
  onNavigateToCookies?: () => void;
}

export function MyProcessDetailPage({
  processoId,
  onNavigateToApp,
  onNavigateToMyProcess,
  onNavigateToChat,
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

  // Removido: useEffect que causava reloads infinitos quando processo?.status mudava

  useEffect(() => {
    loadProcesso();
    loadAnalysisResults();

    const processoChannel = ProcessosService.subscribeToProcessoChanges(
      processoId,
      (updatedProcesso) => {
        console.log('🔄 Realtime: Processo updated:', {
          id: updatedProcesso.id,
          status: updatedProcesso.status,
          currentPrompt: updatedProcesso.current_prompt_number,
          totalPrompts: updatedProcesso.total_prompts
        });
        setProcesso(updatedProcesso);

        // Removido: Reloads escalonados que causavam loop infinito
        // O polling já cuida de atualizar os resultados periodicamente
      }
    );

    const resultsChannel = AnalysisResultsService.subscribeToResultsChanges(
      processoId,
      () => {
        console.log('🔄 Realtime: Analysis results updated - recarregando...');
        loadAnalysisResults();
      }
    );

    // Inicia polling a cada 3 segundos
    pollIntervalRef.current = setInterval(() => {
      loadAnalysisResults();
    }, 3000);

    return () => {
      console.log('🛡️ Limpando subscriptions e polling');
      processoChannel();
      resultsChannel();
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [processoId]);

  const loadProcesso = async (retryCount = 0) => {
    try {
      setLoading(true);
      setError(null);
      const data = await ProcessosService.getProcessoById(processoId);
      if (!data) {
        setError('Processo não encontrado');
        return;
      }
      setProcesso(data);
    } catch (err: any) {
      console.error('Erro ao carregar processo:', err);

      if (err?.message?.includes('Failed to fetch') && retryCount < 3) {
        console.log(`Tentando novamente... (${retryCount + 1}/3)`);
        setTimeout(() => loadProcesso(retryCount + 1), 1000 * (retryCount + 1));
        return;
      }

      setError('Erro ao conectar. Verifique sua conexão e tente novamente.');
    } finally {
      if (retryCount === 0) {
        setLoading(false);
      }
    }
  };

  const loadAnalysisResults = async () => {
    try {
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

      setAnalysisResults(results);

      // Para o polling quando todos os resultados estiverem finalizados
      if (results.length > 0 && results.every(r => r.status === 'completed' || r.status === 'failed')) {
        if (processo?.status === 'completed') {
          console.log('✅ Todos os resultados finalizados - parando polling');
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        }
      }
    } catch (err) {
      console.error('❌ Erro ao carregar resultados:', err);
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

  if (error || (!loading && !processo)) {
    return (
      <div className="min-h-screen font-body flex items-center justify-center p-4" style={{ backgroundColor: colors.bgPrimary }}>
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#DC2626' }}>
            <AlertCircle className="w-8 h-8" style={{ color: '#FFFFFF' }} />
          </div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: colors.textPrimary }}>
            Ops!
          </h2>
          <p className="text-base font-normal mb-6" style={{ color: colors.textSecondary }}>
            Este processo não foi encontrado ou foi removido.
          </p>
          <button
            onClick={onNavigateToMyProcess}
            className="px-6 py-2.5 rounded-lg transition-colors border hover:bg-gray-50"
            style={{
              backgroundColor: '#FFFFFF',
              color: '#0F0E0D',
              borderColor: '#E5E7EB'
            }}
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  const totalPrompts = 9;
  const currentPrompt = processo.current_prompt_number || 0;

  // Buscar o modelo atual em uso
  const llmModelName = processo.current_llm_model_name || null;
  const isModelSwitching = processo.llm_model_switching || false;

  return (
    <div className="flex min-h-screen font-body overflow-x-hidden" style={{ backgroundColor: colors.bgPrimary }}>
      <SidebarWis
        onNavigateToApp={onNavigateToApp}
        onNavigateToMyProcess={onNavigateToMyProcess}
        onNavigateToChat={onNavigateToChat}
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
              <button
                onClick={() => onNavigateToChat?.(processoId)}
                className="flex items-center space-x-1.5 px-3 py-2.5 rounded-lg transition-all duration-200 hover:opacity-80 whitespace-nowrap w-fit mx-auto sm:mx-0"
                style={{ backgroundColor: theme === 'dark' ? '#141312' : colors.bgSecondary }}
              >
                <MessageSquare className="w-5 h-5" style={{ color: '#1C9BF1' }} />
                <span className="text-sm font-normal" style={{ color: theme === 'dark' ? '#FAFAFA' : '#0F0E0D' }}>Chat com o processo</span>
              </button>
            </div>

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
                        key={result.id}
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
              <div className="mb-6">
                {processo.is_chunked ? (
                  <ComplexProcessingProgress
                    processoId={processoId}
                    onStatusChange={(newStatus) => {
                      if (processo.status !== newStatus) {
                        loadProcesso();
                      }
                    }}
                    onStageClick={handleSelectResult}
                    selectedResultId={selectedResultId}
                    showCompletedCards={true}
                  />
                ) : (
                  <AnalysisProgress
                    currentPrompt={currentPrompt}
                    totalPrompts={totalPrompts}
                    status={processo.status as any}
                    llmModelName={llmModelName}
                    isModelSwitching={isModelSwitching}
                  />
                )}
              </div>
            )}

            {/* Analysis Results */}
            {(analysisResults.length > 0 || totalPrompts > 0) && (
              <div className="space-y-6">

                {showFullAnalysis && (
                  <div className="space-y-4 sm:space-y-8 mt-6">
                    {getAvailableCards(analysisResults).map((result) => (
                        <div
                          key={result.id}
                          className="rounded-lg px-3 sm:px-[18px] py-3 sm:py-[18px] pt-3 sm:pt-4"
                          style={{ backgroundColor: theme === 'dark' ? '#141312' : colors.bgSecondary }}
                        >
                          <AnalysisViewSelector title={result.prompt_title} content={result.result_content || ''} />
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
                            <AnalysisViewSelector title={selectedResult.prompt_title} content={selectedResult.result_content} />
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
          </div>
        </div>
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
    </div>
  );
}
