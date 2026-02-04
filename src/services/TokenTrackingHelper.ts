import { supabase } from '../lib/supabase';

export class TokenTrackingHelper {
  static async logTokenUsage(
    userId: string,
    processoId: string | null,
    operationType: string,
    tokensUsed: number,
    modelName: string | null = null,
    metadata: Record<string, unknown> = {}
  ): Promise<void> {
    try {
      const { error } = await supabase.rpc('log_token_usage', {
        p_user_id: userId,
        p_processo_id: processoId,
        p_operation_type: operationType,
        p_tokens_used: tokensUsed,
        p_model_name: modelName,
        p_metadata: metadata
      });

      if (error) {
        // Silent error handling
      }
    } catch (error) {
      // Silent error handling
    }
  }

  static async checkAndLogTokens(
    userId: string,
    processoId: string | null,
    operationType: string,
    tokensUsed: number,
    modelName: string | null = null,
    metadata: Record<string, unknown> = {}
  ): Promise<boolean> {
    const hasTokens = await this.checkTokenAvailability(userId, tokensUsed);

    if (!hasTokens) {
      return false;
    }

    await this.logTokenUsage(userId, processoId, operationType, tokensUsed, modelName, metadata);
    return true;
  }

  static async checkTokenAvailability(userId: string, tokensNeeded: number): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('check_token_availability', {
        p_user_id: userId,
        p_tokens_needed: tokensNeeded
      });

      if (error) {
        return true;
      }

      return data === true;
    } catch (error) {
      return true;
    }
  }

  static estimateTokensForPages(pageCount: number): number {
    const avgTokensPerPage = 1500;
    return Math.ceil(pageCount * avgTokensPerPage);
  }

  static estimateTokensForForensicAnalysis(pageCount: number): number {
    const avgTokensPerPageForensic = 3000;
    return Math.ceil(pageCount * avgTokensPerPageForensic);
  }
}
