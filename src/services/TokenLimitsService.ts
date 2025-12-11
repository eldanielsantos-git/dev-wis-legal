import { supabase } from '../lib/supabase';

export interface TokenLimitConfig {
  id: string;
  context_key: string;
  context_name: string;
  context_description: string;
  max_output_tokens: number;
  default_value: number;
  min_allowed: number;
  max_allowed: number;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface TokenLimitAudit {
  id: string;
  token_limit_id: string;
  context_key: string;
  old_value: number | null;
  new_value: number | null;
  changed_by: string | null;
  changed_at: string;
  change_reason: string | null;
}

const tokenLimitsCache = new Map<string, { value: number; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000;

export class TokenLimitsService {
  static async getAllTokenLimits(): Promise<TokenLimitConfig[]> {
    const { data, error } = await supabase
      .from('token_limits_config')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching token limits:', error);
      throw error;
    }

    return data || [];
  }

  static async getTokenLimitByContext(contextKey: string): Promise<TokenLimitConfig | null> {
    const { data, error } = await supabase
      .from('token_limits_config')
      .select('*')
      .eq('context_key', contextKey)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error(`Error fetching token limit for context ${contextKey}:`, error);
      throw error;
    }

    return data;
  }

  static async getTokenLimitWithFallback(
    contextKey: string,
    fallbackValue: number
  ): Promise<number> {
    const cached = tokenLimitsCache.get(contextKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.value;
    }

    try {
      const config = await this.getTokenLimitByContext(contextKey);

      if (config && config.is_active) {
        tokenLimitsCache.set(contextKey, {
          value: config.max_output_tokens,
          timestamp: Date.now()
        });
        return config.max_output_tokens;
      }
    } catch (error) {
      console.warn(
        `Failed to fetch token limit for ${contextKey}, using fallback:`,
        error
      );
    }

    return fallbackValue;
  }

  static async updateTokenLimit(
    id: string,
    maxOutputTokens: number,
    reason?: string
  ): Promise<TokenLimitConfig> {
    const { data, error } = await supabase
      .from('token_limits_config')
      .update({ max_output_tokens: maxOutputTokens })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating token limit:', error);
      throw error;
    }

    if (data) {
      tokenLimitsCache.delete(data.context_key);
    }

    return data;
  }

  static async toggleTokenLimitStatus(
    id: string,
    isActive: boolean
  ): Promise<TokenLimitConfig> {
    const { data, error } = await supabase
      .from('token_limits_config')
      .update({ is_active: isActive })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error toggling token limit status:', error);
      throw error;
    }

    if (data) {
      tokenLimitsCache.delete(data.context_key);
    }

    return data;
  }

  static async getAuditLog(tokenLimitId?: string): Promise<TokenLimitAudit[]> {
    let query = supabase
      .from('token_limits_audit')
      .select('*')
      .order('changed_at', { ascending: false });

    if (tokenLimitId) {
      query = query.eq('token_limit_id', tokenLimitId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching audit log:', error);
      throw error;
    }

    return data || [];
  }

  static clearCache(contextKey?: string): void {
    if (contextKey) {
      tokenLimitsCache.delete(contextKey);
    } else {
      tokenLimitsCache.clear();
    }
  }

  static validateTokenValue(value: number, minAllowed: number, maxAllowed: number): {
    isValid: boolean;
    error?: string;
  } {
    if (value < minAllowed) {
      return {
        isValid: false,
        error: `O valor deve ser no mínimo ${minAllowed} tokens`
      };
    }

    if (value > maxAllowed) {
      return {
        isValid: false,
        error: `O valor deve ser no máximo ${maxAllowed} tokens`
      };
    }

    return { isValid: true };
  }

  static getContextIcon(contextKey: string): string {
    const iconMap: Record<string, string> = {
      analysis_small_files: '📄',
      analysis_complex_files: '📚',
      analysis_consolidation: '🔗',
      chat_intro: '👋',
      chat_standard: '💬',
      chat_complex_files: '📖',
      chat_audio: '🎤'
    };

    return iconMap[contextKey] || '⚙️';
  }

  static getContextCategory(contextKey: string): 'analysis' | 'chat' {
    if (contextKey.startsWith('analysis_')) {
      return 'analysis';
    }
    return 'chat';
  }
}
