import { supabase } from '../lib/supabase';
import { AuditBeforeAfterState, UnlockActionType } from '../config/unlockConfig';

interface AuditRecordParams {
  processoId: string;
  processoNumero: string;
  userId: string;
  userEmail: string;
  actionType: UnlockActionType;
  unlockReason: string;
  beforeState: AuditBeforeAfterState;
  afterState: AuditBeforeAfterState;
  durationMinutesStuck: number;
  stuckAtPromptOrder: number;
  stuckAtPromptTitle: string;
  totalPages: number;
  simulationMode: boolean;
  affectedTables: string[];
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditRecord {
  id: string;
  processoId: string;
  processoNumero: string;
  userId: string;
  userEmail: string;
  actionType: string;
  unlockReason: string;
  affectedTables: string[];
  beforeState: AuditBeforeAfterState;
  afterState: AuditBeforeAfterState;
  durationMinutesStuck: number;
  stuckAtPromptOrder: number;
  stuckAtPromptTitle: string;
  totalPages: number;
  simulationMode: boolean;
  success: boolean;
  errorMessage: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  completedAt: string | null;
}

export class ProcessUnlockAuditService {
  static async captureBeforeState(processoId: string): Promise<AuditBeforeAfterState> {
    const { data: processo } = await supabase
      .from('processos')
      .select('id, status, processing_lock, processing_worker_id, processing_lock_expires_at')
      .eq('id', processoId)
      .maybeSingle();

    const { data: analysisResults } = await supabase
      .from('analysis_results')
      .select('execution_order, prompt_title, status, processing_at, completed_at')
      .eq('processo_id', processoId)
      .order('execution_order', { ascending: true });

    const { data: queueItem } = await supabase
      .from('processing_queue')
      .select('lock_acquired_at, lock_expires_at, worker_id, last_heartbeat')
      .eq('processo_id', processoId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      processo: processo ? {
        id: processo.id,
        status: processo.status,
        processing_lock: processo.processing_lock || false,
        processing_worker_id: processo.processing_worker_id,
        processing_lock_expires_at: processo.processing_lock_expires_at
      } : {
        id: processoId,
        status: 'unknown',
        processing_lock: false,
        processing_worker_id: null,
        processing_lock_expires_at: null
      },
      analysisResults: (analysisResults || []).map(ar => ({
        prompt_order: ar.execution_order,
        prompt_title: ar.prompt_title,
        status: ar.status,
        processing_at: ar.processing_at,
        completed_at: ar.completed_at
      })),
      processingQueue: queueItem ? {
        lock_acquired_at: queueItem.lock_acquired_at,
        lock_expires_at: queueItem.lock_expires_at,
        worker_id: queueItem.worker_id,
        last_heartbeat: queueItem.last_heartbeat
      } : null
    };
  }

  static async captureAfterState(processoId: string): Promise<AuditBeforeAfterState> {
    return this.captureBeforeState(processoId);
  }

  static async createAuditRecord(params: AuditRecordParams): Promise<string | null> {
    const { data, error } = await supabase
      .from('process_unlock_audit')
      .insert({
        processo_id: params.processoId,
        processo_numero: params.processoNumero,
        user_id: params.userId,
        user_email: params.userEmail,
        action_type: params.actionType,
        unlock_reason: params.unlockReason,
        affected_tables: params.affectedTables,
        before_state: params.beforeState,
        after_state: params.afterState,
        duration_minutes_stuck: params.durationMinutesStuck,
        stuck_at_prompt_order: params.stuckAtPromptOrder,
        stuck_at_prompt_title: params.stuckAtPromptTitle,
        total_pages: params.totalPages,
        simulation_mode: params.simulationMode,
        success: params.success,
        error_message: params.errorMessage,
        metadata: params.metadata || {},
        completed_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating audit record:', error);
      return null;
    }

    return data.id;
  }

  static async getAuditHistory(processoId: string): Promise<AuditRecord[]> {
    const { data, error } = await supabase
      .from('process_unlock_audit')
      .select('*')
      .eq('processo_id', processoId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching audit history:', error);
      return [];
    }

    return (data || []).map(this.mapAuditRecord);
  }

  static async getRecentUnlocks(limit: number = 20): Promise<AuditRecord[]> {
    const { data, error } = await supabase
      .from('process_unlock_audit')
      .select('*')
      .eq('action_type', 'unlock')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching recent unlocks:', error);
      return [];
    }

    return (data || []).map(this.mapAuditRecord);
  }

  static async getAllAuditRecords(filters?: {
    startDate?: string;
    endDate?: string;
    actionType?: string;
    userId?: string;
    success?: boolean;
  }): Promise<AuditRecord[]> {
    let query = supabase
      .from('process_unlock_audit')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.startDate) {
      query = query.gte('created_at', filters.startDate);
    }
    if (filters?.endDate) {
      query = query.lte('created_at', filters.endDate);
    }
    if (filters?.actionType) {
      query = query.eq('action_type', filters.actionType);
    }
    if (filters?.userId) {
      query = query.eq('user_id', filters.userId);
    }
    if (filters?.success !== undefined) {
      query = query.eq('success', filters.success);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching audit records:', error);
      return [];
    }

    return (data || []).map(this.mapAuditRecord);
  }

  private static mapAuditRecord(record: Record<string, unknown>): AuditRecord {
    return {
      id: record.id as string,
      processoId: record.processo_id as string,
      processoNumero: record.processo_numero as string,
      userId: record.user_id as string,
      userEmail: record.user_email as string,
      actionType: record.action_type as string,
      unlockReason: record.unlock_reason as string,
      affectedTables: record.affected_tables as string[],
      beforeState: record.before_state as AuditBeforeAfterState,
      afterState: record.after_state as AuditBeforeAfterState,
      durationMinutesStuck: record.duration_minutes_stuck as number,
      stuckAtPromptOrder: record.stuck_at_prompt_order as number,
      stuckAtPromptTitle: record.stuck_at_prompt_title as string,
      totalPages: record.total_pages as number,
      simulationMode: record.simulation_mode as boolean,
      success: record.success as boolean,
      errorMessage: record.error_message as string | null,
      metadata: record.metadata as Record<string, unknown>,
      createdAt: record.created_at as string,
      completedAt: record.completed_at as string | null
    };
  }
}
