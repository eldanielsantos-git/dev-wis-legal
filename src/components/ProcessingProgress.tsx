import React, { useEffect, useState } from 'react';
import { Loader, CheckCircle, Clock } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';

interface ProcessingProgressProps {
  processoId: string;
  currentStatus: string;
  onStatusChange?: (status: string) => void;
}

export const ProcessingProgress: React.FC<ProcessingProgressProps> = ({
  processoId,
  currentStatus,
  onStatusChange
}) => {
  const { theme } = useTheme();
  const [progressData, setProgressData] = useState<any>(null);
  const [heartbeatActive, setHeartbeatActive] = useState(false);

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const { data } = await supabase
          .from('processos')
          .select(`
            status,
            finalization_progress_percent,
            finalization_lock_heartbeat,
            processing_velocity_pages_per_second,
            estimated_completion_time,
            progress_info,
            background_mode,
            current_llm_model_name
          `)
          .eq('id', processoId)
          .single();

        if (data) {
          setProgressData(data);

          if (data.finalization_lock_heartbeat) {
            const heartbeatAge = Date.now() - new Date(data.finalization_lock_heartbeat).getTime();
            setHeartbeatActive(heartbeatAge < 30000);
          }

          if (data.status !== currentStatus && onStatusChange) {
            onStatusChange(data.status);
          }
        }
      } catch (error) {
        console.error('Erro ao buscar progresso:', error);
      }
    };

    fetchProgress();
    const interval = setInterval(fetchProgress, 3000);

    return () => clearInterval(interval);
  }, [processoId, currentStatus, onStatusChange]);

  const getProgressPercentage = () => {
    return progressData?.finalization_progress_percent || 0;
  };

  const getStatusLabel = () => {
    switch (currentStatus) {
      case 'transcribing':
        return 'Transcrevendo documento';
      case 'processing_batch':
        return 'Processando em lote';
      case 'finalizing':
        return 'Finalizando transcrição';
      case 'processing_forensic':
        return 'Análise forense em andamento';
      case 'completed':
        return 'Concluído';
      default:
        return 'Processando';
    }
  };

  const formatETA = (etaString: string | null) => {
    if (!etaString) return null;

    try {
      const eta = new Date(etaString);
      const now = new Date();
      const diffMs = eta.getTime() - now.getTime();

      if (diffMs < 0) return 'Em breve';

      const diffMinutes = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMinutes / 60);

      if (diffHours > 0) {
        return `~${diffHours}h ${diffMinutes % 60}m`;
      } else if (diffMinutes > 0) {
        return `~${diffMinutes}m`;
      } else {
        return 'Menos de 1 minuto';
      }
    } catch (e) {
      return null;
    }
  };

  const progressPercent = getProgressPercentage();
  const velocity = progressData?.processing_velocity_pages_per_second || 0;
  const eta = formatETA(progressData?.estimated_completion_time);
  const isBackgroundMode = progressData?.background_mode;

  return (
    <div
      className="rounded-lg p-4 space-y-3"
      style={{
        backgroundColor: theme === 'dark' ? '#1F2229' : '#F9FAFB',
        border: `1px solid ${theme === 'dark' ? '#374151' : '#E5E7EB'}`,
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {currentStatus === 'completed' ? (
            <CheckCircle className="w-5 h-5 text-green-500" />
          ) : (
            <Loader className="w-5 h-5 animate-spin text-blue-500" />
          )}
          <div>
            <h4
              className="text-sm font-semibold"
              style={{ color: theme === 'dark' ? '#E5E7EB' : '#111827' }}
            >
              {getStatusLabel()}
            </h4>
            {isBackgroundMode && currentStatus !== 'completed' && (
              <p
                className="text-xs mt-0.5"
                style={{ color: theme === 'dark' ? '#9CA3AF' : '#6B7280' }}
              >
                Processamento em background
              </p>
            )}
          </div>
        </div>
        {heartbeatActive && currentStatus !== 'completed' && (
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span
              className="text-xs font-medium"
              style={{ color: theme === 'dark' ? '#10B981' : '#059669' }}
            >
              Ativo
            </span>
          </div>
        )}
      </div>

      {currentStatus !== 'completed' && (
        <>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span style={{ color: theme === 'dark' ? '#9CA3AF' : '#6B7280' }}>
                Progresso
              </span>
              <span
                className="font-semibold"
                style={{ color: theme === 'dark' ? '#E5E7EB' : '#111827' }}
              >
                {progressPercent}%
              </span>
            </div>
            <div
              className="w-full h-2 rounded-full overflow-hidden"
              style={{ backgroundColor: theme === 'dark' ? '#374151' : '#E5E7EB' }}
            >
              <div
                className="h-full transition-all duration-500 ease-out rounded-full"
                style={{
                  width: `${progressPercent}%`,
                  backgroundColor: '#3B82F6',
                }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              {velocity > 0 && (
                <div className="flex items-center space-x-1">
                  <Clock className="w-3 h-3" style={{ color: theme === 'dark' ? '#9CA3AF' : '#6B7280' }} />
                  <span style={{ color: theme === 'dark' ? '#9CA3AF' : '#6B7280' }}>
                    {velocity.toFixed(1)} pág/s
                  </span>
                </div>
              )}
              {eta && (
                <span style={{ color: theme === 'dark' ? '#9CA3AF' : '#6B7280' }}>
                  Tempo estimado: {eta}
                </span>
              )}
            </div>
            {progressData?.current_llm_model_name && (
              <div className="flex items-center space-x-1 text-xs">
                <span style={{ color: theme === 'dark' ? '#9CA3AF' : '#6B7280' }}>
                  Modelo:
                </span>
                <span
                  className="font-medium"
                  style={{ color: theme === 'dark' ? '#60A5FA' : '#2563EB' }}
                >
                  {progressData.current_llm_model_name}
                </span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
