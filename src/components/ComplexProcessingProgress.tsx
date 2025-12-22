import React, { useEffect, useState } from 'react';
import {
  Users,
  FileText,
  ScrollText,
  Scale,
  FileSignature,
  FolderOpen,
  Gavel,
  CheckCircle2,
  Loader,
  Clock,
  Package,
  Activity,
  AlertCircle,
  Lock,
  RefreshCw
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import type { AnalysisResult } from '../lib/supabase';
import { calculateCardAvailability } from '../utils/analysisAvailability';
import TierProgressIndicator from './TierProgressIndicator';
import { TierName } from '../services/TierSystemService';

interface ComplexProcessingProgressProps {
  processoId: string;
  onStatusChange?: (status: string) => void;
  onStageClick?: (resultId: string) => void;
  selectedResultId?: string | null;
  showCompletedCards?: boolean;
  isAdmin?: boolean;
}

interface PromptStage {
  id: string;
  title: string;
  icon: React.ComponentType<any>;
  order: number;
  status: 'pending' | 'processing' | 'completed';
  chunks_completed?: number;
  total_chunks?: number;
  result_id?: string;
  last_updated?: string;
  is_stuck?: boolean;
}

const PROMPT_ICONS: Record<string, React.ComponentType<any>> = {
  'Identificação das Partes': Users,
  'Qualificação Completa': FileText,
  'Dados Processuais': ScrollText,
  'Histórico Processual': Clock,
  'Fundamentação Jurídica': Scale,
  'Pedidos e Causas de Pedir': FileSignature,
  'Provas e Documentos': FolderOpen,
  'Decisões Judiciais': Gavel,
  'Validação Final': CheckCircle2,
};

export const ComplexProcessingProgress: React.FC<ComplexProcessingProgressProps> = ({
  processoId,
  onStatusChange,
  onStageClick,
  selectedResultId,
  showCompletedCards = false,
  isAdmin = false
}) => {
  const { theme } = useTheme();
  const [stages, setStages] = useState<PromptStage[]>([]);
  const [complexStatus, setComplexStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stageProgressHistory, setStageProgressHistory] = useState<Map<string, {progress: number, timestamp: number}>>(new Map());
  const [tierData, setTierData] = useState<{ tier: TierName | null; totalPages: number | null }>({ tier: null, totalPages: null });

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    const isCompletedRef = { current: false };

    const fetchProgress = async () => {
      // Se já está completo, não faz mais nada
      if (isCompletedRef.current) {
        console.log('⏭️ ComplexProcessingProgress: Processo já completo, ignorando fetch');
        return;
      }

      try {
        const { data: processo, error: processoError } = await supabase
          .from('processos')
          .select('status, is_chunked, total_chunks_count, tier_name, transcricao')
          .eq('id', processoId)
          .single();

        if (processoError) throw processoError;

        // Verifica se processo está completo ou em erro
        if (processo?.status === 'completed' || processo?.status === 'error') {
          console.log('✅ ComplexProcessingProgress: Processo finalizado, parando interval', {
            status: processo.status
          });
          isCompletedRef.current = true;
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
        }

        if (processo?.is_chunked) {
          const { data: complexData } = await supabase
            .from('complex_processing_status')
            .select('*')
            .eq('processo_id', processoId)
            .maybeSingle();

          setComplexStatus(complexData);
          setTierData({
            tier: processo.tier_name || null,
            totalPages: processo.transcricao?.totalPages || null,
          });

          console.log('🔍 complexStatus carregado:', {
            hasData: !!complexData,
            metadata: complexData?.metadata,
            current_model: complexData?.metadata?.current_model,
            current_phase: complexData?.current_phase,
          });

          const { data: results } = await supabase
            .from('analysis_results')
            .select('*')
            .eq('processo_id', processoId)
            .order('execution_order', { ascending: true });

          if (results && results.length > 0) {
            const { data: queueStats } = await supabase
              .from('processing_queue')
              .select('prompt_id, status')
              .eq('processo_id', processoId);

            const promptStagesMap = new Map<string, PromptStage>();

            results.forEach((result) => {
              const promptId = result.prompt_id;
              const queueItems = queueStats?.filter(q => q.prompt_id === promptId) || [];
              const completedChunks = queueItems.filter(q => q.status === 'completed').length;
              const processingChunks = queueItems.filter(q => q.status === 'processing').length;
              const totalChunks = queueItems.length;

              let stageStatus: 'pending' | 'processing' | 'completed' = 'pending';
              if (result.status === 'completed') {
                stageStatus = 'completed';
              } else if (result.status === 'running' || processingChunks > 0 || completedChunks > 0) {
                stageStatus = 'processing';
              }

              // Detecção de travamento
              const lastUpdated = result.processing_at || result.updated_at;
              const timeSinceUpdate = lastUpdated ? Date.now() - new Date(lastUpdated).getTime() : 0;
              const STUCK_THRESHOLD = 40 * 60 * 1000; // 40 minutos

              // Verificar se o progresso está estagnado
              const currentProgress = completedChunks;
              const historyKey = promptId;
              const history = stageProgressHistory.get(historyKey);

              let isStuck = false;
              if (stageStatus === 'processing') {
                if (timeSinceUpdate > STUCK_THRESHOLD) {
                  // Se passou mais de 40 minutos desde a última atualização
                  isStuck = true;
                } else if (history && history.progress === currentProgress) {
                  // Se o progresso não mudou há muito tempo
                  const timeSinceProgressChange = Date.now() - history.timestamp;
                  if (timeSinceProgressChange > STUCK_THRESHOLD) {
                    isStuck = true;
                  }
                }
              }

              // Atualizar histórico de progresso
              if (!history || history.progress !== currentProgress) {
                stageProgressHistory.set(historyKey, {
                  progress: currentProgress,
                  timestamp: Date.now()
                });
              }

              promptStagesMap.set(promptId, {
                id: promptId,
                title: result.prompt_title,
                icon: PROMPT_ICONS[result.prompt_title] || FileText,
                order: result.execution_order,
                status: stageStatus,
                chunks_completed: completedChunks,
                total_chunks: totalChunks > 0 ? totalChunks : processo.total_chunks_count,
                result_id: result.id,
                last_updated: lastUpdated,
                is_stuck: isStuck
              });
            });

            const sortedStages = Array.from(promptStagesMap.values()).sort((a, b) => a.order - b.order);
            setStages(sortedStages);

            // Debug logs
            console.log('🔍 ComplexProcessingProgress Debug:', {
              totalStages: sortedStages.length,
              completedStages: sortedStages.filter(s => s.status === 'completed').length,
              processingStages: sortedStages.filter(s => s.status === 'processing').length,
              pendingStages: sortedStages.filter(s => s.status === 'pending').length,
              queueStatsCount: queueStats?.length || 0,
              complexStatusProgress: complexData?.progress_percent
            });
          } else {
            // Se não há results ainda, buscar prompts ativos para criar stages vazios
            const { data: prompts } = await supabase
              .from('analysis_prompts')
              .select('id, title, execution_order')
              .eq('is_active', true)
              .order('execution_order', { ascending: true });

            if (prompts && prompts.length > 0) {
              const emptyStages: PromptStage[] = prompts.map(prompt => ({
                id: prompt.id,
                title: prompt.title,
                icon: PROMPT_ICONS[prompt.title] || FileText,
                order: prompt.execution_order,
                status: 'pending' as const,
                chunks_completed: 0,
                total_chunks: processo.total_chunks_count || 0,
                result_id: undefined
              }));

              setStages(emptyStages);

              console.log('🔍 ComplexProcessingProgress (sem results ainda):', {
                totalPrompts: prompts.length,
                totalChunks: processo.total_chunks_count
              });
            }
          }
        }

        if (processo?.status && onStatusChange) {
          onStatusChange(processo.status);
        }

        setIsLoading(false);
      } catch (error) {
        console.error('Erro ao buscar progresso complexo:', error);
        setIsLoading(false);
      }
    };

    // Primeira execução
    fetchProgress();

    // Só inicia o interval se não estiver completo
    intervalId = setInterval(() => {
      if (!isCompletedRef.current) {
        fetchProgress();
      } else {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      }
    }, 5000);

    return () => {
      console.log('🧹 ComplexProcessingProgress: Limpando interval no unmount');
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [processoId, onStatusChange]);

  const getPhaseLabel = (phase: string) => {
    const phases: Record<string, string> = {
      'initializing': 'Inicializando',
      'queued': 'Na fila',
      'processing': 'Processando',
      'consolidating': 'Consolidando resultados',
      'completed': 'Concluído'
    };
    return phases[phase] || phase;
  };

  const getOverallProgress = () => {
    // Se está na fase de consolidação
    if (complexStatus?.current_phase === 'consolidating') {
      const totalStages = stages.length || 9;
      const completedStages = stages.filter(s => s.status === 'completed').length;

      // Durante consolidação, mostrar 95-99% dependendo do progresso
      // Nunca 100% até que o processo esteja realmente completo
      if (completedStages === totalStages) {
        return 98; // Quase completo, aguardando finalização
      }

      // Calcular progresso proporcional durante consolidação
      const baseProgress = Math.round((completedStages / totalStages) * 95);
      return Math.min(baseProgress, 95);
    }

    // Calcular com base em múltiplas fontes
    if (stages.length === 0) {
      // Se não há stages ainda, usar progresso do complexStatus
      if (complexStatus?.overall_progress_percent) {
        return complexStatus.overall_progress_percent;
      }
      return 0;
    }

    // Calcular progresso detalhado considerando chunks
    let totalWork = 0;
    let completedWork = 0;

    stages.forEach(stage => {
      const chunkCount = stage.total_chunks || 1;
      totalWork += chunkCount;

      if (stage.status === 'completed') {
        completedWork += chunkCount;
      } else if (stage.status === 'processing' && stage.chunks_completed) {
        completedWork += stage.chunks_completed;
      }
    });

    if (totalWork === 0) return 0;

    const calculated = Math.round((completedWork / totalWork) * 100);

    // Usar o maior valor entre calculado e status do banco
    const fromStatus = complexStatus?.overall_progress_percent || 0;
    const finalProgress = Math.max(calculated, fromStatus);

    console.log('📊 Progresso calculado:', {
      stages: stages.length,
      totalWork,
      completedWork,
      calculated,
      fromStatus,
      finalProgress,
      complexStatus
    });

    return finalProgress;
  };

  const getStageProgress = (stage: PromptStage) => {
    if (stage.status === 'completed') return 100;
    if (stage.status === 'pending') return 0;
    if (stage.chunks_completed && stage.total_chunks) {
      return Math.round((stage.chunks_completed / stage.total_chunks) * 100);
    }
    return 0;
  };

  const getCurrentStage = () => {
    return stages.find(s => s.status === 'processing') || stages.find(s => s.status === 'pending');
  };

  if (isLoading) {
    return (
      <div
        className="rounded-lg p-6 flex items-center justify-center"
        style={{
          backgroundColor: theme === 'dark' ? '#1F2229' : '#F9FAFB',
          border: `1px solid ${theme === 'dark' ? '#374151' : '#E5E7EB'}`,
        }}
      >
        <Loader className="w-6 h-6 animate-spin" style={{ color: '#3B82F6' }} />
        <span className="ml-3" style={{ color: theme === 'dark' ? '#9CA3AF' : '#6B7280' }}>
          Carregando progresso...
        </span>
      </div>
    );
  }

  const currentStage = getCurrentStage();
  const overallProgress = getOverallProgress();

  return (
    <div
      className="rounded-lg p-5 space-y-5"
      style={{
        backgroundColor: theme === 'dark' ? '#1F2229' : '#F9FAFB',
        border: `1px solid ${theme === 'dark' ? '#374151' : '#E5E7EB'}`,
      }}
    >
      {/* Header com status geral */}
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          <div
            className="p-2.5 rounded-lg"
            style={{
              backgroundColor: theme === 'dark' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.1)',
            }}
          >
            <Package className="w-6 h-6" style={{ color: '#3B82F6' }} />
          </div>
          <div>
            <h4
              className="text-base font-semibold"
              style={{ color: theme === 'dark' ? '#E5E7EB' : '#111827' }}
            >
              Processamento Complexo
            </h4>
            {complexStatus && (
              <p className="text-sm mt-0.5" style={{ color: theme === 'dark' ? '#9CA3AF' : '#6B7280' }}>
                {getPhaseLabel(complexStatus.current_phase)}
                {complexStatus.total_chunks && ` • ${complexStatus.total_chunks} lotes`}
                {complexStatus.metadata?.current_model && isAdmin && (
                  <span className="ml-1">
                    {' • '}
                    <span className="font-medium" style={{ color: '#3B82F6' }}>
                      {complexStatus.metadata.current_model}
                    </span>
                  </span>
                )}
              </p>
            )}
          </div>
        </div>

        {complexStatus?.current_phase !== 'completed' && (
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-blue-500 animate-pulse" />
            <span
              className="text-xs font-medium"
              style={{ color: theme === 'dark' ? '#3B82F6' : '#2563EB' }}
            >
              Ativo
            </span>
          </div>
        )}
      </div>

      {/* Tier Indicator */}
      {tierData.tier && tierData.totalPages && (
        <TierProgressIndicator
          tierName={tierData.tier}
          totalPages={tierData.totalPages}
          showDetails={isAdmin}
        />
      )}

      {/* Progresso geral */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span style={{ color: theme === 'dark' ? '#9CA3AF' : '#6B7280' }}>
            Progresso Geral
          </span>
          <span
            className="font-semibold tabular-nums"
            style={{ color: theme === 'dark' ? '#E5E7EB' : '#111827' }}
          >
            {overallProgress}%
          </span>
        </div>
        <div
          className="w-full h-3 rounded-full overflow-hidden"
          style={{ backgroundColor: theme === 'dark' ? '#374151' : '#E5E7EB' }}
        >
          <div
            className="h-full transition-all duration-500 ease-out rounded-full"
            style={{
              width: `${overallProgress}%`,
              backgroundColor: '#3B82F6',
            }}
          />
        </div>

        {/* Banner de Consolidação */}
        {complexStatus?.current_phase === 'consolidating' && (
          <div
            className="flex items-center space-x-3 p-3 rounded-lg"
            style={{
              backgroundColor: theme === 'dark' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.1)',
              border: `1px solid ${theme === 'dark' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.2)'}`,
            }}
          >
            <RefreshCw className="w-5 h-5 animate-spin" style={{ color: '#3B82F6' }} />
            <div className="flex-1">
              <p className="text-sm font-medium" style={{ color: theme === 'dark' ? '#E5E7EB' : '#111827' }}>
                Consolidando Resultados
              </p>
              <p className="text-xs mt-0.5" style={{ color: theme === 'dark' ? '#9CA3AF' : '#6B7280' }}>
                Os {complexStatus.total_chunks} lotes foram processados e agora estão sendo consolidados em um resultado unificado. Este processo pode levar alguns minutos.
              </p>
            </div>
          </div>
        )}

        {/* Informação do modelo atual ou busca de novo modelo */}
        {isAdmin && complexStatus?.metadata && complexStatus.current_phase !== 'completed' && complexStatus.current_phase !== 'consolidating' && (
          <>
            {complexStatus.metadata.searching_new_model ? (
              <div
                className="flex items-center justify-between p-2 rounded-lg"
                style={{
                  backgroundColor: theme === 'dark' ? 'rgba(251, 146, 60, 0.1)' : 'rgba(251, 146, 60, 0.05)',
                  border: `1px solid ${theme === 'dark' ? 'rgba(251, 146, 60, 0.2)' : 'rgba(251, 146, 60, 0.15)'}`,
                }}
              >
                <div className="flex items-center space-x-2">
                  <Loader className="w-4 h-4 animate-spin" style={{ color: '#F59E0B' }} />
                  <span className="text-xs font-medium" style={{ color: theme === 'dark' ? '#9CA3AF' : '#6B7280' }}>
                    Buscando um novo modelo de processamento...
                  </span>
                </div>
              </div>
            ) : complexStatus.metadata.current_model ? (
              <div
                className="flex items-center justify-between p-2 rounded-lg"
                style={{
                  backgroundColor: theme === 'dark' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)',
                  border: `1px solid ${theme === 'dark' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.15)'}`,
                }}
              >
                <div className="flex items-center space-x-2">
                  <Activity className="w-4 h-4" style={{ color: '#3B82F6' }} />
                  <span className="text-xs font-medium" style={{ color: theme === 'dark' ? '#9CA3AF' : '#6B7280' }}>
                    Modelo em uso:
                  </span>
                </div>
                <span className="text-xs font-semibold" style={{ color: '#3B82F6' }}>
                  {complexStatus.metadata.current_model}
                </span>
              </div>
            ) : null}
          </>
        )}
      </div>

      {/* Lista de etapas */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <ScrollText className="w-4 h-4" style={{ color: theme === 'dark' ? '#9CA3AF' : '#6B7280' }} />
          <h5
            className="text-sm font-semibold"
            style={{ color: theme === 'dark' ? '#E5E7EB' : '#111827' }}
          >
            Etapas de Análise
          </h5>
        </div>

        <div className="space-y-2">
          {stages.map((stage, index) => {
            const Icon = stage.icon;
            const progress = getStageProgress(stage);
            const isCurrentStage = currentStage?.id === stage.id;

            return (
              <div
                key={stage.id}
                className="rounded-lg p-3 transition-all duration-200"
                style={{
                  backgroundColor: isCurrentStage
                    ? theme === 'dark' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)'
                    : theme === 'dark' ? '#111827' : '#FFFFFF',
                  border: `1px solid ${
                    isCurrentStage
                      ? theme === 'dark' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.2)'
                      : theme === 'dark' ? '#374151' : '#E5E7EB'
                  }`,
                }}
              >
                <div className="flex items-center space-x-3">
                  <div
                    className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{
                      backgroundColor:
                        stage.status === 'completed'
                          ? 'rgba(16, 185, 129, 0.15)'
                          : stage.status === 'processing'
                          ? 'rgba(59, 130, 246, 0.15)'
                          : theme === 'dark' ? '#374151' : '#E5E7EB',
                    }}
                  >
                    {stage.status === 'completed' ? (
                      <CheckCircle2 className="w-4 h-4" style={{ color: '#10B981' }} />
                    ) : stage.status === 'processing' ? (
                      <Loader className="w-4 h-4 animate-spin" style={{ color: '#3B82F6' }} />
                    ) : (
                      <Icon className="w-4 h-4" style={{ color: theme === 'dark' ? '#9CA3AF' : '#6B7280' }} />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h6
                        className="text-sm font-medium truncate"
                        style={{
                          color:
                            stage.status === 'completed'
                              ? '#10B981'
                              : stage.status === 'processing'
                              ? '#3B82F6'
                              : theme === 'dark' ? '#9CA3AF' : '#6B7280',
                        }}
                      >
                        {stage.title}
                      </h6>
                      {stage.status === 'processing' && stage.chunks_completed && stage.total_chunks && (
                        <span
                          className="text-xs font-medium ml-2 flex-shrink-0"
                          style={{ color: theme === 'dark' ? '#9CA3AF' : '#6B7280' }}
                        >
                          Lote {stage.chunks_completed}/{stage.total_chunks}
                        </span>
                      )}
                    </div>

                    {stage.status === 'processing' && (
                      <div
                        className="h-1.5 rounded-full overflow-hidden"
                        style={{ backgroundColor: theme === 'dark' ? '#374151' : '#E5E7EB' }}
                      >
                        <div
                          className="h-full transition-all duration-300 rounded-full"
                          style={{
                            width: `${progress}%`,
                            backgroundColor: '#3B82F6',
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Informações adicionais */}
      {complexStatus && complexStatus.current_phase !== 'completed' && (
        <div
          className="rounded-lg p-3 flex items-start space-x-2"
          style={{
            backgroundColor: theme === 'dark' ? 'rgba(59, 130, 246, 0.05)' : 'rgba(59, 130, 246, 0.03)',
            border: `1px solid ${theme === 'dark' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.15)'}`,
          }}
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#3B82F6' }} />
          <div className="text-xs" style={{ color: theme === 'dark' ? '#9CA3AF' : '#6B7280' }}>
            <p className="font-medium mb-1" style={{ color: theme === 'dark' ? '#E5E7EB' : '#111827' }}>
              Processamento em background
            </p>
            <p>
              O documento está sendo processado em múltiplos lotes para garantir qualidade.
              Você pode acompanhar o progresso em tempo real ou voltar mais tarde.
            </p>
          </div>
        </div>
      )}

      {complexStatus?.current_phase === 'completed' && stages.length > 0 && stages.every(s => s.status === 'completed') && (
        <div
          className="rounded-lg p-3 flex items-center space-x-3"
          style={{
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            border: `1px solid rgba(16, 185, 129, 0.2)`,
          }}
        >
          <CheckCircle2 className="w-5 h-5" style={{ color: '#10B981' }} />
          <span className="text-sm font-medium" style={{ color: '#10B981' }}>
            Análise complexa concluída com sucesso
          </span>
        </div>
      )}

    </div>
  );
};
