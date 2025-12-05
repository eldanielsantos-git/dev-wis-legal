import { supabase } from '../lib/supabase';

export type TierName = 'SMALL' | 'MEDIUM' | 'LARGE' | 'VERY_LARGE' | 'MASSIVE';

export interface TierConfig {
  tier_name: TierName;
  min_pages: number;
  max_pages: number | null;
  chunk_size_pages: number;
  max_parallel_chunks: number;
  timeout_minutes: number;
  consolidation_timeout_minutes: number;
  max_retries: number;
  requires_checkpointing: boolean;
  subdivision_enabled: boolean;
  priority: number;
}

export interface FeatureFlag {
  flag_name: string;
  enabled: boolean;
  enabled_for_users: string[] | null;
  description: string | null;
}

export class TierSystemService {
  private static cachedConfigs: TierConfig[] | null = null;
  private static cachedFlags: Map<string, FeatureFlag> | null = null;
  private static lastCacheTime: number = 0;
  private static CACHE_TTL = 60000;

  static detectTier(totalPages: number): TierName {
    if (totalPages <= 1000) return 'SMALL';
    if (totalPages <= 2000) return 'MEDIUM';
    if (totalPages <= 5000) return 'LARGE';
    if (totalPages <= 10000) return 'VERY_LARGE';
    return 'MASSIVE';
  }

  static async getTierConfigs(): Promise<TierConfig[]> {
    const now = Date.now();
    if (this.cachedConfigs && (now - this.lastCacheTime) < this.CACHE_TTL) {
      return this.cachedConfigs;
    }

    const { data, error } = await supabase
      .from('processing_tier_config')
      .select('*')
      .order('priority', { ascending: false });

    if (error) throw error;

    this.cachedConfigs = data || [];
    this.lastCacheTime = now;
    return this.cachedConfigs;
  }

  static async getTierConfigForPages(totalPages: number): Promise<TierConfig | null> {
    const configs = await this.getTierConfigs();
    const tierName = this.detectTier(totalPages);
    return configs.find(c => c.tier_name === tierName) || null;
  }

  static async getFeatureFlags(): Promise<Map<string, FeatureFlag>> {
    const now = Date.now();
    if (this.cachedFlags && (now - this.lastCacheTime) < this.CACHE_TTL) {
      return this.cachedFlags;
    }

    const { data, error } = await supabase
      .from('feature_flags')
      .select('*');

    if (error) throw error;

    const flagsMap = new Map<string, FeatureFlag>();
    data?.forEach(flag => {
      flagsMap.set(flag.flag_name, flag);
    });

    this.cachedFlags = flagsMap;
    this.lastCacheTime = now;
    return flagsMap;
  }

  static async isTierSystemEnabled(userId?: string): Promise<boolean> {
    const flags = await this.getFeatureFlags();
    const masterFlag = flags.get('tier_system_enabled');

    if (!masterFlag) return false;

    if (masterFlag.enabled) return true;

    if (userId && masterFlag.enabled_for_users && masterFlag.enabled_for_users.includes(userId)) {
      return true;
    }

    return false;
  }

  static async isTierEnabled(tierName: TierName, userId?: string): Promise<boolean> {
    const masterEnabled = await this.isTierSystemEnabled(userId);
    if (!masterEnabled) return false;

    const flags = await this.getFeatureFlags();
    const tierFlag = flags.get(`tier_system_${tierName.toLowerCase()}`);

    if (!tierFlag) return false;

    if (tierFlag.enabled) return true;

    if (userId && tierFlag.enabled_for_users && tierFlag.enabled_for_users.includes(userId)) {
      return true;
    }

    return false;
  }

  static getTierColor(tierName: TierName): string {
    switch (tierName) {
      case 'SMALL': return '#10B981';
      case 'MEDIUM': return '#3B82F6';
      case 'LARGE': return '#F59E0B';
      case 'VERY_LARGE': return '#EF4444';
      case 'MASSIVE': return '#8B5CF6';
      default: return '#6B7280';
    }
  }

  static getTierIcon(tierName: TierName): string {
    switch (tierName) {
      case 'SMALL': return '📄';
      case 'MEDIUM': return '📚';
      case 'LARGE': return '📦';
      case 'VERY_LARGE': return '🗃️';
      case 'MASSIVE': return '🏢';
      default: return '📋';
    }
  }

  static getTierLabel(tierName: TierName): string {
    switch (tierName) {
      case 'SMALL': return 'Pequeno';
      case 'MEDIUM': return 'Médio';
      case 'LARGE': return 'Grande';
      case 'VERY_LARGE': return 'Muito Grande';
      case 'MASSIVE': return 'Massivo';
      default: return 'Desconhecido';
    }
  }

  static async shouldUseTierAwareFlow(totalPages: number, userId?: string): Promise<boolean> {
    const tierName = this.detectTier(totalPages);

    if (tierName === 'SMALL') {
      return false;
    }

    return await this.isTierEnabled(tierName, userId);
  }

  static clearCache(): void {
    this.cachedConfigs = null;
    this.cachedFlags = null;
    this.lastCacheTime = 0;
  }

  static formatEstimatedTime(totalPages: number): string {
    const tierName = this.detectTier(totalPages);

    const estimates = {
      'SMALL': 5,
      'MEDIUM': 10,
      'LARGE': 20,
      'VERY_LARGE': 30,
      'MASSIVE': 45,
    };

    const minutes = estimates[tierName];

    if (minutes < 60) {
      return `~${minutes} min`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `~${hours}h ${remainingMinutes}min` : `~${hours}h`;
  }

  static getTierStats(tierName: TierName): {
    maxParallelWorkers: number;
    timeoutMinutes: number;
    hasCheckpoints: boolean;
    hasHierarchy: boolean;
  } {
    switch (tierName) {
      case 'SMALL':
        return {
          maxParallelWorkers: 1,
          timeoutMinutes: 15,
          hasCheckpoints: false,
          hasHierarchy: false,
        };
      case 'MEDIUM':
        return {
          maxParallelWorkers: 2,
          timeoutMinutes: 20,
          hasCheckpoints: false,
          hasHierarchy: false,
        };
      case 'LARGE':
        return {
          maxParallelWorkers: 3,
          timeoutMinutes: 25,
          hasCheckpoints: true,
          hasHierarchy: true,
        };
      case 'VERY_LARGE':
        return {
          maxParallelWorkers: 4,
          timeoutMinutes: 30,
          hasCheckpoints: true,
          hasHierarchy: true,
        };
      case 'MASSIVE':
        return {
          maxParallelWorkers: 5,
          timeoutMinutes: 35,
          hasCheckpoints: true,
          hasHierarchy: true,
        };
      default:
        return {
          maxParallelWorkers: 1,
          timeoutMinutes: 15,
          hasCheckpoints: false,
          hasHierarchy: false,
        };
    }
  }
}
