import { supabase } from '../lib/supabase';
import {
  UNLOCK_CONFIG,
  UNLOCK_ACTION_TYPES,
  SimulationResult,
  AuditBeforeAfterState
} from '../config/unlockConfig';
import { ProcessDiagnosticService } from './ProcessDiagnosticService';
import { ProcessUnlockAuditService } from './ProcessUnlockAuditService';

const RATE_LIMIT_KEY = 'process_unlock_rate_limit';
const COOLDOWN_KEY = 'process_unlock_last_action';

interface RateLimitState {
  count: number;
  resetAt: number;
}

interface UnlockResult {
  success: boolean;
  message: string;
  auditId?: string;
  error?: string;
}

export class ProcessUnlockService {
  static getRateLimitState(): RateLimitState {
    const stored = localStorage.getItem(RATE_LIMIT_KEY);
    if (stored) {
      const state = JSON.parse(stored) as RateLimitState;
      if (Date.now() > state.resetAt) {
        const newState = { count: 0, resetAt: Date.now() + 3600000 };
        localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(newState));
        return newState;
      }
      return state;
    }
    const newState = { count: 0, resetAt: Date.now() + 3600000 };
    localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(newState));
    return newState;
  }

  static incrementRateLimit(): void {
    const state = this.getRateLimitState();
    state.count += 1;
    localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(state));
  }

  static canPerformUnlock(): { allowed: boolean; remaining: number; resetIn: number } {
    const state = this.getRateLimitState();
    return {
      allowed: state.count < UNLOCK_CONFIG.RATE_LIMIT_MAX,
      remaining: UNLOCK_CONFIG.RATE_LIMIT_MAX - state.count,
      resetIn: Math.max(0, Math.ceil((state.resetAt - Date.now()) / 1000))
    };
  }

  static getCooldownRemaining(): number {
    const lastAction = localStorage.getItem(COOLDOWN_KEY);
    if (!lastAction) return 0;
    const elapsed = Date.now() - parseInt(lastAction, 10);
    const remaining = UNLOCK_CONFIG.COOLDOWN_SECONDS * 1000 - elapsed;
    return Math.max(0, Math.ceil(remaining / 1000));
  }

  static setCooldown(): void {
    localStorage.setItem(COOLDOWN_KEY, Date.now().toString());
  }

  static async simulateUnlock(processoId: string): Promise<SimulationResult> {
    const eligibility = await ProcessDiagnosticService.validateUnlockEligibility(processoId);
    const beforeState = await ProcessUnlockAuditService.captureBeforeState(processoId);

    const warnings: string[] = [];
    const affectedTables: string[] = [];
    const sqlStatements: string[] = [];

    const stuckPrompt = beforeState.analysisResults.find(ar => ar.status === 'processing');
    if (stuckPrompt) {
      affectedTables.push('analysis_results');
      sqlStatements.push(
        `UPDATE analysis_results SET status = 'pending', processing_at = NULL WHERE processo_id = '${processoId}' AND status = 'processing';`
      );
    }

    if (beforeState.processingQueue) {
      affectedTables.push('processing_queue');
      sqlStatements.push(
        `UPDATE processing_queue SET lock_acquired_at = NULL, worker_id = NULL, lock_expires_at = NULL WHERE processo_id = '${processoId}';`
      );
    }

    if (beforeState.processo.processing_lock) {
      affectedTables.push('processos');
      sqlStatements.push(
        `UPDATE processos SET processing_lock = false, processing_worker_id = NULL, processing_lock_expires_at = NULL WHERE id = '${processoId}';`
      );
    }

    const simulatedAfterState: AuditBeforeAfterState = {
      processo: {
        ...beforeState.processo,
        processing_lock: false,
        processing_worker_id: null,
        processing_lock_expires_at: null
      },
      analysisResults: beforeState.analysisResults.map(ar => ({
        ...ar,
        status: ar.status === 'processing' ? 'pending' : ar.status,
        processing_at: ar.status === 'processing' ? null : ar.processing_at
      })),
      processingQueue: beforeState.processingQueue ? {
        ...beforeState.processingQueue,
        lock_acquired_at: null,
        lock_expires_at: null,
        worker_id: null
      } : null
    };

    if (!eligibility.checks.pagesUnderLimit) {
      warnings.push('Processo tem mais de 1000 paginas - nao elegivel para destravamento automatico');
    }
    if (!eligibility.checks.stuckLongEnough) {
      warnings.push('Processo nao esta travado ha tempo suficiente');
    }
    if (!eligibility.checks.noRecentHeartbeat) {
      warnings.push('Atividade recente detectada - processo pode estar sendo processado');
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: processInfo } = await supabase
        .from('processos')
        .select('file_name, total_pages')
        .eq('id', processoId)
        .maybeSingle();

      const stuckPromptInfo = beforeState.analysisResults.find(ar => ar.status === 'processing');

      await ProcessUnlockAuditService.createAuditRecord({
        processoId,
        processoNumero: processInfo?.file_name || 'unknown',
        userId: user.id,
        userEmail: user.email || 'unknown',
        actionType: UNLOCK_ACTION_TYPES.SIMULATION,
        unlockReason: 'Simulacao de destravamento',
        beforeState,
        afterState: simulatedAfterState,
        durationMinutesStuck: stuckPromptInfo?.processing_at
          ? Math.floor((Date.now() - new Date(stuckPromptInfo.processing_at).getTime()) / 60000)
          : 0,
        stuckAtPromptOrder: stuckPromptInfo?.prompt_order || 0,
        stuckAtPromptTitle: stuckPromptInfo?.prompt_title || 'unknown',
        totalPages: processInfo?.total_pages || 0,
        simulationMode: true,
        affectedTables,
        success: true,
        metadata: { sqlStatements, warnings }
      });
    }

    return {
      wouldSucceed: eligibility.eligible,
      eligibility,
      affectedTables,
      sqlStatements,
      beforeState,
      simulatedAfterState,
      warnings
    };
  }

  static async unlockProcess(
    processoId: string,
    userId: string,
    userEmail: string,
    reason: string
  ): Promise<UnlockResult> {
    const rateLimit = this.canPerformUnlock();
    if (!rateLimit.allowed) {
      return {
        success: false,
        message: `Rate limit atingido. Tente novamente em ${Math.ceil(rateLimit.resetIn / 60)} minutos.`
      };
    }

    const cooldown = this.getCooldownRemaining();
    if (cooldown > 0) {
      return {
        success: false,
        message: `Aguarde ${cooldown} segundos antes de tentar novamente.`
      };
    }

    const eligibility = await ProcessDiagnosticService.validateUnlockEligibility(processoId);
    if (!eligibility.eligible) {
      return {
        success: false,
        message: `Processo nao elegivel: ${eligibility.reasons.join(', ')}`
      };
    }

    const beforeState = await ProcessUnlockAuditService.captureBeforeState(processoId);
    const stuckPrompt = beforeState.analysisResults.find(ar => ar.status === 'processing');

    const { data: processInfo } = await supabase
      .from('processos')
      .select('file_name, total_pages')
      .eq('id', processoId)
      .maybeSingle();

    const affectedTables: string[] = [];

    try {
      const { error: analysisError } = await supabase
        .from('analysis_results')
        .update({
          status: 'pending',
          processing_at: null
        })
        .eq('processo_id', processoId)
        .eq('status', 'processing');

      if (analysisError) throw new Error(`Falha ao resetar analysis_results: ${analysisError.message}`);
      affectedTables.push('analysis_results');

      const { error: queueError } = await supabase
        .from('processing_queue')
        .update({
          lock_acquired_at: null,
          worker_id: null,
          lock_expires_at: null,
          status: 'pending'
        })
        .eq('processo_id', processoId)
        .in('status', ['processing', 'locked']);

      if (queueError) throw new Error(`Falha ao liberar processing_queue: ${queueError.message}`);
      affectedTables.push('processing_queue');

      const { error: processoError } = await supabase
        .from('processos')
        .update({
          processing_lock: false,
          processing_worker_id: null,
          processing_lock_expires_at: null
        })
        .eq('id', processoId);

      if (processoError) throw new Error(`Falha ao liberar lock do processo: ${processoError.message}`);
      affectedTables.push('processos');

      const afterState = await ProcessUnlockAuditService.captureAfterState(processoId);

      const auditId = await ProcessUnlockAuditService.createAuditRecord({
        processoId,
        processoNumero: processInfo?.file_name || 'unknown',
        userId,
        userEmail,
        actionType: UNLOCK_ACTION_TYPES.UNLOCK,
        unlockReason: reason,
        beforeState,
        afterState,
        durationMinutesStuck: stuckPrompt?.processing_at
          ? Math.floor((Date.now() - new Date(stuckPrompt.processing_at).getTime()) / 60000)
          : 0,
        stuckAtPromptOrder: stuckPrompt?.prompt_order || 0,
        stuckAtPromptTitle: stuckPrompt?.prompt_title || 'unknown',
        totalPages: processInfo?.total_pages || 0,
        simulationMode: false,
        affectedTables,
        success: true
      });

      this.incrementRateLimit();
      this.setCooldown();

      await supabase.rpc('mark_stuck_process_resolved', { p_processo_id: processoId });

      return {
        success: true,
        message: 'Processo destravado com sucesso',
        auditId: auditId || undefined
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';

      const afterState = await ProcessUnlockAuditService.captureAfterState(processoId);

      await ProcessUnlockAuditService.createAuditRecord({
        processoId,
        processoNumero: processInfo?.file_name || 'unknown',
        userId,
        userEmail,
        actionType: UNLOCK_ACTION_TYPES.UNLOCK,
        unlockReason: reason,
        beforeState,
        afterState,
        durationMinutesStuck: stuckPrompt?.processing_at
          ? Math.floor((Date.now() - new Date(stuckPrompt.processing_at).getTime()) / 60000)
          : 0,
        stuckAtPromptOrder: stuckPrompt?.prompt_order || 0,
        stuckAtPromptTitle: stuckPrompt?.prompt_title || 'unknown',
        totalPages: processInfo?.total_pages || 0,
        simulationMode: false,
        affectedTables,
        success: false,
        errorMessage
      });

      return {
        success: false,
        message: 'Falha ao destravar processo',
        error: errorMessage
      };
    }
  }

  static async unlockMultipleProcesses(
    processoIds: string[],
    userId: string,
    userEmail: string,
    reason: string
  ): Promise<{ success: string[]; failed: Array<{ id: string; error: string }> }> {
    const success: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];

    for (const processoId of processoIds) {
      const result = await this.unlockProcess(processoId, userId, userEmail, reason);
      if (result.success) {
        success.push(processoId);
      } else {
        failed.push({ id: processoId, error: result.message });
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return { success, failed };
  }
}
