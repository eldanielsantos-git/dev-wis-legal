import { supabase } from '../lib/supabase';
import {
  UNLOCK_CONFIG,
  StuckProcessInfo,
  PromptStatus,
  ProcessLockStatus,
  UnlockEligibility
} from '../config/unlockConfig';

export class ProcessDiagnosticService {
  static async getStuckProcesses(): Promise<StuckProcessInfo[]> {
    const thresholdTime = new Date(
      Date.now() - UNLOCK_CONFIG.STUCK_THRESHOLD_MINUTES * 60 * 1000
    ).toISOString();

    const { data, error } = await supabase.rpc('get_stuck_processes_for_review', {
      threshold_time: thresholdTime,
      max_pages: UNLOCK_CONFIG.MAX_PAGES_FOR_UNLOCK
    });

    if (error) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('processos')
        .select(`
          id,
          file_name,
          total_pages,
          status,
          user_id,
          current_llm_model_name,
          processing_worker_id,
          analysis_started_at,
          user_profiles!inner(email)
        `)
        .eq('status', 'analyzing')
        .lt('total_pages', UNLOCK_CONFIG.MAX_PAGES_FOR_UNLOCK)
        .not('total_pages', 'is', null);

      if (fallbackError) {
        console.error('Error fetching stuck processes:', fallbackError);
        return [];
      }

      const stuckProcesses: StuckProcessInfo[] = [];

      for (const processo of fallbackData || []) {
        const { data: stuckPrompt } = await supabase
          .from('analysis_results')
          .select('execution_order, prompt_title, processing_at, current_model_name, attempt_count')
          .eq('processo_id', processo.id)
          .eq('status', 'processing')
          .lt('processing_at', thresholdTime)
          .order('execution_order', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (stuckPrompt) {
          const minutesStuck = stuckPrompt.processing_at
            ? Math.floor((Date.now() - new Date(stuckPrompt.processing_at).getTime()) / 60000)
            : 0;

          const userProfile = processo.user_profiles as unknown as { email: string };

          stuckProcesses.push({
            processoId: processo.id,
            processoNumero: processo.file_name,
            userId: processo.user_id,
            userEmail: userProfile?.email || 'unknown',
            totalPages: processo.total_pages || 0,
            stuckAtPromptOrder: stuckPrompt.execution_order,
            stuckAtPromptTitle: stuckPrompt.prompt_title,
            minutesStuck,
            lastActivity: stuckPrompt.processing_at || '',
            currentModelName: stuckPrompt.current_model_name,
            workerId: processo.processing_worker_id,
            isEligibleForUnlock: (processo.total_pages || 0) < UNLOCK_CONFIG.MAX_PAGES_FOR_UNLOCK
          });
        }
      }

      return stuckProcesses;
    }

    return (data || []).map((item: Record<string, unknown>) => ({
      processoId: item.processo_id as string,
      processoNumero: item.processo_numero as string,
      userId: item.user_id as string,
      userEmail: item.user_email as string,
      totalPages: item.total_pages as number,
      stuckAtPromptOrder: item.stuck_at_prompt_order as number,
      stuckAtPromptTitle: item.stuck_at_prompt_title as string,
      minutesStuck: item.minutes_stuck as number,
      lastActivity: item.last_activity as string,
      currentModelName: item.current_model_name as string | null,
      workerId: item.worker_id as string | null,
      isEligibleForUnlock: (item.total_pages as number) < UNLOCK_CONFIG.MAX_PAGES_FOR_UNLOCK
    }));
  }

  static async getStuckPromptDetails(processoId: string): Promise<PromptStatus[]> {
    const { data, error } = await supabase
      .from('analysis_results')
      .select('execution_order, prompt_title, status, processing_at, completed_at, attempt_count, error_message')
      .eq('processo_id', processoId)
      .order('execution_order', { ascending: true });

    if (error) {
      console.error('Error fetching prompt details:', error);
      return [];
    }

    return (data || []).map(item => {
      let minutesInCurrentState = 0;
      if (item.status === 'processing' && item.processing_at) {
        minutesInCurrentState = Math.floor(
          (Date.now() - new Date(item.processing_at).getTime()) / 60000
        );
      } else if (item.status === 'completed' && item.completed_at && item.processing_at) {
        minutesInCurrentState = Math.floor(
          (new Date(item.completed_at).getTime() - new Date(item.processing_at).getTime()) / 60000
        );
      }

      return {
        promptOrder: item.execution_order,
        promptTitle: item.prompt_title,
        status: item.status as 'completed' | 'processing' | 'pending' | 'failed',
        processingAt: item.processing_at,
        completedAt: item.completed_at,
        minutesInCurrentState,
        attemptCount: item.attempt_count || 0,
        lastError: item.error_message
      };
    });
  }

  static async getProcessLockStatus(processoId: string): Promise<ProcessLockStatus | null> {
    const { data: processo, error: processoError } = await supabase
      .from('processos')
      .select('processing_lock, processing_lock_expires_at, processing_worker_id')
      .eq('id', processoId)
      .maybeSingle();

    if (processoError || !processo) {
      console.error('Error fetching process lock status:', processoError);
      return null;
    }

    const { data: queueItem } = await supabase
      .from('processing_queue')
      .select('lock_acquired_at, lock_expires_at, worker_id, last_heartbeat')
      .eq('processo_id', processoId)
      .eq('status', 'processing')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const now = new Date();
    const processoLockExpired = processo.processing_lock_expires_at
      ? new Date(processo.processing_lock_expires_at) < now
      : false;
    const queueLockExpired = queueItem?.lock_expires_at
      ? new Date(queueItem.lock_expires_at) < now
      : false;

    return {
      processoLock: processo.processing_lock || false,
      processoLockExpiresAt: processo.processing_lock_expires_at,
      processoWorkerId: processo.processing_worker_id,
      queueLockAcquiredAt: queueItem?.lock_acquired_at || null,
      queueLockExpiresAt: queueItem?.lock_expires_at || null,
      queueWorkerId: queueItem?.worker_id || null,
      hasExpiredLocks: (processo.processing_lock && processoLockExpired) ||
                       (queueItem?.lock_acquired_at && queueLockExpired)
    };
  }

  static async validateUnlockEligibility(processoId: string): Promise<UnlockEligibility> {
    const reasons: string[] = [];
    const checks = {
      pagesUnderLimit: false,
      stuckLongEnough: false,
      noRecentHeartbeat: false,
      notCompleted: false,
      notFailed: false
    };

    const { data: processo, error } = await supabase
      .from('processos')
      .select('total_pages, status')
      .eq('id', processoId)
      .maybeSingle();

    if (error || !processo) {
      return {
        eligible: false,
        reasons: ['Processo nao encontrado'],
        checks
      };
    }

    if (processo.status === 'completed') {
      reasons.push('Processo ja foi concluido');
    } else {
      checks.notCompleted = true;
    }

    if (processo.status === 'failed') {
      reasons.push('Processo ja falhou');
    } else {
      checks.notFailed = true;
    }

    if (!processo.total_pages || processo.total_pages >= UNLOCK_CONFIG.MAX_PAGES_FOR_UNLOCK) {
      reasons.push(`Processo tem ${processo.total_pages || 0} paginas (limite: ${UNLOCK_CONFIG.MAX_PAGES_FOR_UNLOCK})`);
    } else {
      checks.pagesUnderLimit = true;
    }

    const thresholdTime = new Date(
      Date.now() - UNLOCK_CONFIG.STUCK_THRESHOLD_MINUTES * 60 * 1000
    ).toISOString();

    const { data: stuckPrompt } = await supabase
      .from('analysis_results')
      .select('processing_at')
      .eq('processo_id', processoId)
      .eq('status', 'processing')
      .lt('processing_at', thresholdTime)
      .limit(1)
      .maybeSingle();

    if (!stuckPrompt) {
      reasons.push(`Nenhum prompt travado por mais de ${UNLOCK_CONFIG.STUCK_THRESHOLD_MINUTES} minutos`);
    } else {
      checks.stuckLongEnough = true;
    }

    const heartbeatThreshold = new Date(
      Date.now() - UNLOCK_CONFIG.HEARTBEAT_TIMEOUT_MINUTES * 60 * 1000
    ).toISOString();

    const { data: recentActivity } = await supabase
      .from('processing_queue')
      .select('last_heartbeat')
      .eq('processo_id', processoId)
      .gt('last_heartbeat', heartbeatThreshold)
      .limit(1)
      .maybeSingle();

    if (recentActivity) {
      reasons.push(`Atividade recente detectada nos ultimos ${UNLOCK_CONFIG.HEARTBEAT_TIMEOUT_MINUTES} minutos`);
    } else {
      checks.noRecentHeartbeat = true;
    }

    const eligible = Object.values(checks).every(Boolean) && reasons.length === 0;

    return {
      eligible,
      reasons: reasons.length > 0 ? reasons : ['Processo elegivel para destravamento'],
      checks
    };
  }

  static async hasRecentHeartbeat(processoId: string): Promise<{ hasRecentActivity: boolean; lastActivity: string | null }> {
    const heartbeatThreshold = new Date(
      Date.now() - UNLOCK_CONFIG.HEARTBEAT_TIMEOUT_MINUTES * 60 * 1000
    ).toISOString();

    const { data: queueActivity } = await supabase
      .from('processing_queue')
      .select('last_heartbeat')
      .eq('processo_id', processoId)
      .order('last_heartbeat', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: analysisActivity } = await supabase
      .from('analysis_results')
      .select('processing_at')
      .eq('processo_id', processoId)
      .eq('status', 'processing')
      .order('processing_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastQueueHeartbeat = queueActivity?.last_heartbeat ? new Date(queueActivity.last_heartbeat) : null;
    const lastAnalysisActivity = analysisActivity?.processing_at ? new Date(analysisActivity.processing_at) : null;

    let lastActivity: Date | null = null;
    if (lastQueueHeartbeat && lastAnalysisActivity) {
      lastActivity = lastQueueHeartbeat > lastAnalysisActivity ? lastQueueHeartbeat : lastAnalysisActivity;
    } else {
      lastActivity = lastQueueHeartbeat || lastAnalysisActivity;
    }

    const threshold = new Date(heartbeatThreshold);
    const hasRecentActivity = lastActivity ? lastActivity > threshold : false;

    return {
      hasRecentActivity,
      lastActivity: lastActivity?.toISOString() || null
    };
  }

  static async getProcessBasicInfo(processoId: string): Promise<{
    id: string;
    fileName: string;
    totalPages: number;
    status: string;
    userId: string;
    userEmail: string;
  } | null> {
    const { data, error } = await supabase
      .from('processos')
      .select(`
        id,
        file_name,
        total_pages,
        status,
        user_id,
        user_profiles!inner(email)
      `)
      .eq('id', processoId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    const userProfile = data.user_profiles as unknown as { email: string };

    return {
      id: data.id,
      fileName: data.file_name,
      totalPages: data.total_pages || 0,
      status: data.status,
      userId: data.user_id,
      userEmail: userProfile?.email || 'unknown'
    };
  }

  static async getStuckProcessesCount(): Promise<number> {
    const thresholdTime = new Date(
      Date.now() - UNLOCK_CONFIG.STUCK_THRESHOLD_MINUTES * 60 * 1000
    ).toISOString();

    const { count, error } = await supabase
      .from('analysis_results')
      .select('processo_id', { count: 'exact', head: true })
      .eq('status', 'processing')
      .lt('processing_at', thresholdTime);

    if (error) {
      console.error('Error counting stuck processes:', error);
      return 0;
    }

    return count || 0;
  }
}
