import React, { useEffect, useState } from 'react';
import {
  FileText,
  Users,
  Calendar,
  Scale,
  Lightbulb,
  AlertTriangle,
  DollarSign,
  Lock,
  Target,
  CheckCircle2,
  Loader,
  Clock,
  XCircle
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';

interface AnalysisStagesProgressProps {
  processoId: string;
  className?: string;
}

interface StageData {
  id: string;
  execution_order: number;
  prompt_title: string;
  status: 'pending' | 'processing' | 'running' | 'completed' | 'failed' | 'error';
  processing_at: string | null;
  completed_at: string | null;
  error_message: string | null;
}

const STAGE_ICONS: Record<number, React.ComponentType<any>> = {
  1: FileText,
  2: Target,
  3: Calendar,
  4: Scale,
  5: Lightbulb,
  6: AlertTriangle,
  7: DollarSign,
  8: Lock,
  9: Target,
};

export const AnalysisStagesProgress: React.FC<AnalysisStagesProgressProps> = ({
  processoId,
  className = ''
}) => {
  const { theme } = useTheme();
  const [stages, setStages] = useState<StageData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    const fetchStages = async () => {
      try {
        const { data, error } = await supabase
          .from('analysis_results')
          .select('id, execution_order, prompt_title, status, processing_at, completed_at, error_message')
          .eq('processo_id', processoId)
          .order('execution_order', { ascending: true });

        if (error) throw error;

        if (data) {
          setStages(data);
        }

        setLoading(false);
      } catch (error) {
        setLoading(false);
      }
    };

    fetchStages();

    intervalId = setInterval(fetchStages, 1000);

    // Realtime subscription para atualizações instantâneas
    const channel = supabase
      .channel(`analysis_stages_${processoId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'analysis_results',
          filter: `processo_id=eq.${processoId}`,
        },
        () => {
          fetchStages();
        }
      )
      .subscribe();

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
      supabase.removeChannel(channel);
    };
  }, [processoId]);

  const getStageStatus = (stage: StageData) => {
    if (stage.status === 'completed') {
      return {
        icon: CheckCircle2,
        color: '#10B981',
        bgColor: 'rgba(16, 185, 129, 0.1)',
        label: 'Concluído'
      };
    }

    if (stage.status === 'running' || stage.status === 'processing') {
      return {
        icon: Loader,
        color: '#3B82F6',
        bgColor: 'rgba(59, 130, 246, 0.1)',
        label: 'Processando',
        animate: true
      };
    }

    if (stage.status === 'failed' || stage.status === 'error') {
      return {
        icon: XCircle,
        color: '#EF4444',
        bgColor: 'rgba(239, 68, 68, 0.1)',
        label: 'Erro'
      };
    }

    return {
      icon: Clock,
      color: theme === 'dark' ? '#9CA3AF' : '#6B7280',
      bgColor: theme === 'dark' ? 'rgba(156, 163, 175, 0.1)' : 'rgba(107, 114, 128, 0.1)',
      label: 'Pendente'
    };
  };

  const getProgressPercentage = () => {
    if (stages.length === 0) return 0;
    const completed = stages.filter(s => s.status === 'completed').length;
    return Math.round((completed / stages.length) * 100);
  };

  if (loading) {
    return (
      <div
        className={`rounded-lg p-5 flex items-center justify-center ${className}`}
        style={{
          backgroundColor: theme === 'dark' ? '#1F2229' : '#F9FAFB',
          border: `1px solid ${theme === 'dark' ? '#374151' : '#E5E7EB'}`,
        }}
      >
        <Loader className="w-5 h-5 animate-spin" style={{ color: '#3B82F6' }} />
        <span className="ml-3 text-sm" style={{ color: theme === 'dark' ? '#9CA3AF' : '#6B7280' }}>
          Carregando etapas...
        </span>
      </div>
    );
  }

  if (stages.length === 0) {
    return null;
  }

  const progressPercentage = getProgressPercentage();

  return (
    <div
      className={`rounded-lg p-5 space-y-4 ${className}`}
      style={{
        backgroundColor: theme === 'dark' ? '#1F2229' : '#F9FAFB',
        border: `1px solid ${theme === 'dark' ? '#374151' : '#E5E7EB'}`,
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <h5
          className="text-sm font-semibold"
          style={{ color: theme === 'dark' ? '#E5E7EB' : '#111827' }}
        >
          Etapas de Análise
        </h5>
        <span
          className="text-xs font-medium px-2.5 py-1 rounded-full"
          style={{
            backgroundColor: theme === 'dark' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.1)',
            color: '#3B82F6'
          }}
        >
          {progressPercentage}%
        </span>
      </div>

      <div className="space-y-2">
        {stages.map((stage) => {
          const StageIcon = STAGE_ICONS[stage.execution_order] || FileText;
          const statusInfo = getStageStatus(stage);
          const StatusIcon = statusInfo.icon;

          return (
            <div
              key={stage.id}
              className="rounded-lg p-3 transition-all duration-200"
              style={{
                backgroundColor: theme === 'dark' ? '#111827' : '#FFFFFF',
                border: `1px solid ${theme === 'dark' ? '#374151' : '#E5E7EB'}`,
              }}
            >
              <div className="flex items-center space-x-3">
                <div
                  className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{
                    backgroundColor: statusInfo.bgColor,
                  }}
                >
                  <StatusIcon
                    className={`w-4 h-4 ${statusInfo.animate ? 'animate-spin' : ''}`}
                    style={{ color: statusInfo.color }}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded"
                        style={{
                          backgroundColor: theme === 'dark' ? '#374151' : '#F3F4F6',
                          color: theme === 'dark' ? '#9CA3AF' : '#6B7280'
                        }}
                      >
                        {stage.execution_order}
                      </span>
                      <h6
                        className="text-sm font-medium"
                        style={{
                          color: stage.status === 'completed'
                            ? statusInfo.color
                            : theme === 'dark' ? '#E5E7EB' : '#111827',
                        }}
                      >
                        {stage.prompt_title}
                      </h6>
                    </div>
                    <span
                      className="text-xs font-medium ml-2 flex-shrink-0"
                      style={{ color: statusInfo.color }}
                    >
                      {statusInfo.label}
                    </span>
                  </div>

                  {stage.error_message && (
                    <p
                      className="text-xs mt-1"
                      style={{ color: '#EF4444' }}
                    >
                      {stage.error_message}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
