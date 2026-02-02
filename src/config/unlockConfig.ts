export const UNLOCK_CONFIG = {
  MAX_PAGES_FOR_UNLOCK: 1000,
  STUCK_THRESHOLD_MINUTES: 15,
  HEARTBEAT_TIMEOUT_MINUTES: 5,
  RATE_LIMIT_MAX: 10,
  COOLDOWN_SECONDS: 30,
  NOTIFICATION_THROTTLE_MINUTES: 60,
  POLLING_INTERVAL_MS: 30000,
  TOTAL_PROMPTS: 9,
} as const;

export const UNLOCK_ACTION_TYPES = {
  SIMULATION: 'simulation',
  UNLOCK: 'unlock',
  AUTO_NOTIFICATION: 'auto_notification',
} as const;

export const STUCK_STATUS_THRESHOLDS = {
  HEALTHY: 15,
  WARNING: 30,
  CRITICAL: 60,
} as const;

export type UnlockActionType = typeof UNLOCK_ACTION_TYPES[keyof typeof UNLOCK_ACTION_TYPES];

export interface StuckProcessInfo {
  processoId: string;
  processoNumero: string;
  userId: string;
  userEmail: string;
  totalPages: number;
  stuckAtPromptOrder: number;
  stuckAtPromptTitle: string;
  minutesStuck: number;
  lastActivity: string;
  currentModelName: string | null;
  workerId: string | null;
  isEligibleForUnlock: boolean;
}

export interface PromptStatus {
  promptOrder: number;
  promptTitle: string;
  status: 'completed' | 'processing' | 'pending' | 'failed';
  processingAt: string | null;
  completedAt: string | null;
  minutesInCurrentState: number;
  attemptCount: number;
  lastError: string | null;
}

export interface ProcessLockStatus {
  processoLock: boolean;
  processoLockExpiresAt: string | null;
  processoWorkerId: string | null;
  queueLockAcquiredAt: string | null;
  queueLockExpiresAt: string | null;
  queueWorkerId: string | null;
  hasExpiredLocks: boolean;
}

export interface UnlockEligibility {
  eligible: boolean;
  reasons: string[];
  checks: {
    pagesUnderLimit: boolean;
    stuckLongEnough: boolean;
    noRecentHeartbeat: boolean;
    notCompleted: boolean;
    notFailed: boolean;
  };
}

export interface AuditBeforeAfterState {
  processo: {
    id: string;
    status: string;
    processing_lock: boolean;
    processing_worker_id: string | null;
    processing_lock_expires_at: string | null;
  };
  analysisResults: Array<{
    prompt_order: number;
    prompt_title: string;
    status: string;
    processing_at: string | null;
    completed_at: string | null;
  }>;
  processingQueue: {
    lock_acquired_at: string | null;
    lock_expires_at: string | null;
    worker_id: string | null;
    last_heartbeat: string | null;
  } | null;
}

export interface SimulationResult {
  wouldSucceed: boolean;
  eligibility: UnlockEligibility;
  affectedTables: string[];
  sqlStatements: string[];
  beforeState: AuditBeforeAfterState;
  simulatedAfterState: AuditBeforeAfterState;
  warnings: string[];
}
