import { supabase } from '../lib/supabase';

export interface TokenUsageLog {
  id: string;
  user_id: string;
  processo_id: string | null;
  operation_type: string;
  tokens_used: number;
  model_name: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface UserTokenQuota {
  user_id: string;
  monthly_quota: number;
  tokens_used_this_month: number;
  quota_reset_date: string;
  created_at: string;
  updated_at: string;
}

export interface TokenUsageSummary {
  total_tokens_used: number;
  tokens_this_month: number;
  monthly_quota: number;
  quota_remaining: number;
  quota_reset_date: string;
  usage_by_operation: Record<string, { tokens: number; count: number }>;
}

class TokenService {
  async getUserTokenUsageSummary(userId: string): Promise<TokenUsageSummary | null> {
    try {
      const { data: customerData, error: customerError } = await supabase
        .from('stripe_customers')
        .select('customer_id')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .maybeSingle();

      if (customerError) throw customerError;

      if (!customerData) {
        return {
          total_tokens_used: 0,
          tokens_this_month: 0,
          monthly_quota: 0,
          quota_remaining: 0,
          quota_reset_date: new Date(
            new Date().getFullYear(),
            new Date().getMonth() + 1,
            1
          ).toISOString(),
          usage_by_operation: {}
        };
      }

      const { data: subscription, error: subError } = await supabase
        .from('stripe_subscriptions')
        .select('tokens_total, tokens_used, current_period_end')
        .eq('customer_id', customerData.customer_id)
        .is('deleted_at', null)
        .maybeSingle();

      if (subError) throw subError;

      if (!subscription) {
        return {
          total_tokens_used: 0,
          tokens_this_month: 0,
          monthly_quota: 0,
          quota_remaining: 0,
          quota_reset_date: new Date(
            new Date().getFullYear(),
            new Date().getMonth() + 1,
            1
          ).toISOString(),
          usage_by_operation: {}
        };
      }

      const tokensTotal = Number(subscription.tokens_total) || 0;
      const tokensUsed = Number(subscription.tokens_used) || 0;
      const tokensRemaining = Math.max(tokensTotal - tokensUsed, 0);

      const resetDate = subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : new Date(
            new Date().getFullYear(),
            new Date().getMonth() + 1,
            1
          ).toISOString();

      const { data: logsData, error: logsError } = await supabase
        .from('token_usage_logs')
        .select('operation_type, tokens_used')
        .eq('user_id', userId);

      let usageByOperation: Record<string, { tokens: number; count: number }> = {};

      if (!logsError && logsData) {
        usageByOperation = logsData.reduce((acc, log) => {
          const op = log.operation_type || 'unknown';
          if (!acc[op]) {
            acc[op] = { tokens: 0, count: 0 };
          }
          acc[op].tokens += log.tokens_used;
          acc[op].count += 1;
          return acc;
        }, {} as Record<string, { tokens: number; count: number }>);
      }

      return {
        total_tokens_used: tokensUsed,
        tokens_this_month: tokensUsed,
        monthly_quota: tokensTotal,
        quota_remaining: tokensRemaining,
        quota_reset_date: resetDate,
        usage_by_operation: usageByOperation
      };
    } catch (error) {
      return null;
    }
  }

  async getUserTokenQuota(userId: string): Promise<UserTokenQuota | null> {
    try {
      const { data, error } = await supabase
        .from('user_token_quotas')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      return null;
    }
  }

  async getTokenUsageLogs(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<TokenUsageLog[]> {
    try {
      const { data, error } = await supabase
        .from('token_usage_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return data || [];
    } catch (error) {
      return [];
    }
  }

  async getAllUsersTokenQuotas(): Promise<
    Array<UserTokenQuota & { email: string; first_name: string; last_name: string }>
  > {
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, email, first_name, last_name')
        .order('email', { ascending: true });

      if (profilesError) throw profilesError;

      const { data: customers, error: customersError } = await supabase
        .from('stripe_customers')
        .select('user_id, customer_id')
        .is('deleted_at', null);

      if (customersError) throw customersError;

      const { data: subscriptions, error: subscriptionsError } = await supabase
        .from('stripe_subscriptions')
        .select('customer_id, tokens_total, tokens_used, current_period_end, status')
        .is('deleted_at', null)
        .eq('status', 'active');

      if (subscriptionsError) throw subscriptionsError;

      const customersMap = new Map(
        (customers || []).map((customer: any) => [customer.user_id, customer.customer_id])
      );

      const subscriptionsMap = new Map(
        (subscriptions || []).map((sub: any) => [sub.customer_id, sub])
      );

      return (profiles || []).map((profile: any) => {
        const customerId = customersMap.get(profile.id);
        const subscription = customerId ? subscriptionsMap.get(customerId) : null;

        const tokensTotal = subscription ? Number(subscription.tokens_total) || 0 : 0;
        const tokensUsed = subscription ? Number(subscription.tokens_used) || 0 : 0;

        return {
          user_id: profile.id,
          monthly_quota: tokensTotal,
          tokens_used_this_month: tokensUsed,
          quota_reset_date: subscription?.current_period_end
            ? new Date(subscription.current_period_end * 1000).toISOString()
            : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          email: profile.email || '',
          first_name: profile.first_name || '',
          last_name: profile.last_name || ''
        };
      });
    } catch (error) {
      return [];
    }
  }

  async updateUserQuota(userId: string, newQuota: number): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_token_quotas')
        .upsert({
          user_id: userId,
          monthly_quota: newQuota,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      return true;
    } catch (error) {
      return false;
    }
  }

  async checkTokenAvailability(userId: string, tokensNeeded: number): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('check_token_availability', {
        p_user_id: userId,
        p_tokens_needed: tokensNeeded
      });

      if (error) throw error;
      return data === true;
    } catch (error) {
      return false;
    }
  }

  async getProcessoTokenUsage(processoId: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('token_usage_logs')
        .select('tokens_used')
        .eq('processo_id', processoId);

      if (error) throw error;

      const totalTokens = (data || []).reduce((sum, log) => sum + log.tokens_used, 0);
      return totalTokens;
    } catch (error) {
      return 0;
    }
  }

  formatTokenCount(tokens: number): string {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`;
    } else if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}K`;
    }
    return tokens.toString();
  }

  getUsagePercentage(used: number, quota: number): number {
    if (quota === 0) return 0;
    return Math.min((used / quota) * 100, 100);
  }

  getUsageColor(percentage: number): string {
    if (percentage >= 90) return 'text-red-600';
    if (percentage >= 75) return 'text-yellow-600';
    return 'text-green-600';
  }

  getUsageBarColor(percentage: number): string {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-yellow-500';
    return 'bg-blue-500';
  }
}

export const tokenService = new TokenService();
