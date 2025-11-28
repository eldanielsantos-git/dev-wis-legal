import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Processo } from '../lib/supabase';

interface UseProcessProgressPollingOptions {
  processoId: string;
  status: string;
  onUpdate: (processo: Processo) => void;
  enabled?: boolean;
}

export const useProcessProgressPolling = ({
  processoId,
  status,
  onUpdate,
  enabled = true
}: UseProcessProgressPollingOptions) => {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateRef = useRef<string>('');
  const attemptCountRef = useRef<number>(0);
  const idleCountRef = useRef<number>(0);
  const [currentInterval, setCurrentInterval] = useState<number>(3000);

  useEffect(() => {
    if (!enabled || !processoId) {
      return;
    }

    const isProcessing = ['queuing', 'processing_batch', 'finalizing', 'processing_forensic'].includes(status);

    if (!isProcessing) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      attemptCountRef.current = 0;
      idleCountRef.current = 0;
      return;
    }

    const getPollingInterval = (attemptCount: number, idleCount: number): number => {
      if (idleCount > 24) {
        return 0;
      }

      if (idleCount > 12) {
        return 30000;
      }

      if (idleCount > 6) {
        return 20000;
      }

      switch (status) {
        case 'queuing':
          return Math.min(2000 + (attemptCount * 500), 10000);
        case 'processing_batch':
          return Math.min(3000 + (attemptCount * 1000), 20000);
        case 'finalizing':
          return Math.min(3000 + (attemptCount * 500), 15000);
        case 'processing_forensic':
          return Math.min(4000 + (attemptCount * 1000), 20000);
        default:
          return Math.min(5000 + (attemptCount * 1000), 30000);
      }
    };

    const fetchProgress = async () => {
      try {
        const { data, error } = await supabase
          .from('processos')
          .select(`
            id,
            status,
            progress_info,
            finalization_progress_percent,
            finalization_state,
            forensic_analysis_status,
            processing_velocity_pages_per_second,
            estimated_completion_time,
            updated_at,
            current_llm_model_id,
            current_llm_model_name,
            llm_model_switching,
            llm_switch_reason,
            llm_models_attempted,
            current_prompt_number,
            total_prompts
          `)
          .eq('id', processoId)
          .single();

        if (error) {
          console.error('Error fetching progress:', error);
          attemptCountRef.current++;
          return;
        }

        if (data && data.updated_at !== lastUpdateRef.current) {
          lastUpdateRef.current = data.updated_at;
          onUpdate(data as Processo);
          attemptCountRef.current = 0;
          idleCountRef.current = 0;
        } else {
          idleCountRef.current++;
        }

        const newInterval = getPollingInterval(attemptCountRef.current, idleCountRef.current);

        if (newInterval === 0) {
          console.log('[Polling] Processo idle for 2+ minutes, stopping polling');
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          return;
        }

        if (newInterval !== currentInterval) {
          setCurrentInterval(newInterval);

          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }

          intervalRef.current = setInterval(fetchProgress, newInterval);
        }
      } catch (error) {
        console.error('Error in polling:', error);
        attemptCountRef.current++;
      }
    };

    fetchProgress();

    const initialInterval = getPollingInterval(0, 0);
    setCurrentInterval(initialInterval);
    intervalRef.current = setInterval(fetchProgress, initialInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [processoId, status, enabled, onUpdate, currentInterval]);

  return {
    stopPolling: () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      attemptCountRef.current = 0;
      idleCountRef.current = 0;
    },
    currentInterval
  };
};
