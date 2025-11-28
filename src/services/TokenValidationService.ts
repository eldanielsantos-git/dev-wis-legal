import { supabase } from '../lib/supabase';

export interface TokenCheckResult {
  hasSubscription: boolean;
  hasSufficientTokens: boolean;
  tokensRemaining: number;
  tokensTotal: number;
  tokensUsed: number;
  tokensRequired: number;
  pagesRemaining: number;
  message: string;
  planName?: string;
}

const TOKENS_PER_PAGE = 5500;

const PLAN_NAMES: { [key: string]: string } = {
  'price_1SG3zEJrr43cGTt4oUj89h9u': 'Essencial',
  'price_1SG40ZJrr43cGTt4SGCX0JUZ': 'Premium',
  'price_1SG41xJrr43cGTt4MQwqdEiv': 'Pro',
  'price_1SG43JJrr43cGTt4URQn0TxZ': 'Elite',
};

export class TokenValidationService {
  static calculateTokensFromPages(pageCount: number): number {
    return pageCount * TOKENS_PER_PAGE;
  }

  static calculatePagesFromTokens(tokens: number): number {
    return Math.floor(tokens / TOKENS_PER_PAGE);
  }

  static async checkTokensBeforeUpload(
    userId: string,
    pageCount: number
  ): Promise<TokenCheckResult> {
    try {
      const tokensRequired = this.calculateTokensFromPages(pageCount);

      const { data: customerData, error: customerError } = await supabase
        .from('stripe_customers')
        .select('customer_id')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .maybeSingle();

      if (customerError) {
        console.error('Error fetching customer:', customerError);
        throw customerError;
      }

      if (!customerData) {
        return {
          hasSubscription: false,
          hasSufficientTokens: false,
          tokensRemaining: 0,
          tokensTotal: 0,
          tokensUsed: 0,
          tokensRequired,
          pagesRemaining: 0,
          message: 'Nenhuma assinatura ativa encontrada. Assine um plano para começar.',
        };
      }

      const { data: subscriptionData, error: subscriptionError } = await supabase
        .from('stripe_subscriptions')
        .select('tokens_total, tokens_used, price_id, status, current_period_end')
        .eq('customer_id', customerData.customer_id)
        .is('deleted_at', null)
        .maybeSingle();

      if (subscriptionError) {
        console.error('Error fetching subscription:', subscriptionError);
        throw subscriptionError;
      }

      if (!subscriptionData) {
        return {
          hasSubscription: false,
          hasSufficientTokens: false,
          tokensRemaining: 0,
          tokensTotal: 0,
          tokensUsed: 0,
          tokensRequired,
          pagesRemaining: 0,
          message: 'Nenhuma assinatura encontrada. Assine um plano para processar documentos.',
        };
      }

      const isActiveStatus = ['active', 'trialing'].includes(subscriptionData.status);
      const isCanceledButValid = subscriptionData.status === 'canceled' &&
        subscriptionData.current_period_end &&
        new Date(subscriptionData.current_period_end * 1000) > new Date();

      if (!isActiveStatus && !isCanceledButValid) {
        return {
          hasSubscription: false,
          hasSufficientTokens: false,
          tokensRemaining: 0,
          tokensTotal: 0,
          tokensUsed: 0,
          tokensRequired,
          pagesRemaining: 0,
          message: 'Nenhuma assinatura ativa. Assine um plano para processar documentos.',
        };
      }

      const tokensTotal = subscriptionData.tokens_total || 0;
      const tokensUsed = subscriptionData.tokens_used || 0;
      const tokensRemaining = Math.max(tokensTotal - tokensUsed, 0);
      const hasSufficientTokens = tokensRemaining >= tokensRequired;
      const pagesRemaining = this.calculatePagesFromTokens(tokensRemaining);
      const planName = PLAN_NAMES[subscriptionData.price_id] || 'Plano Ativo';

      let message = '';
      if (hasSufficientTokens) {
        message = `Tokens suficientes disponíveis. Você poderá processar este documento de ${pageCount} páginas.`;
      } else {
        const pagesCanProcess = this.calculatePagesFromTokens(tokensRemaining);
        message = `Tokens insuficientes. Você tem ${this.formatTokenCount(tokensRemaining)} tokens (${pagesCanProcess} páginas), mas precisa de ${this.formatTokenCount(tokensRequired)} tokens (${pageCount} páginas).`;
      }

      return {
        hasSubscription: true,
        hasSufficientTokens,
        tokensRemaining,
        tokensTotal,
        tokensUsed,
        tokensRequired,
        pagesRemaining,
        message,
        planName,
      };
    } catch (error) {
      console.error('Error checking tokens:', error);
      throw new Error('Erro ao verificar tokens disponíveis');
    }
  }

  static async getTokenBalance(userId: string): Promise<{
    tokensTotal: number;
    tokensUsed: number;
    tokensRemaining: number;
    pagesRemaining: number;
    planName: string;
  }> {
    try {
      const { data: customerData, error: customerError } = await supabase
        .from('stripe_customers')
        .select('customer_id')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .maybeSingle();

      if (customerError || !customerData) {
        return {
          tokensTotal: 0,
          tokensUsed: 0,
          tokensRemaining: 0,
          pagesRemaining: 0,
          planName: 'Nenhum plano',
        };
      }

      const { data: subscriptionData, error: subscriptionError } = await supabase
        .from('stripe_subscriptions')
        .select('tokens_total, tokens_used, price_id, status, current_period_end')
        .eq('customer_id', customerData.customer_id)
        .is('deleted_at', null)
        .maybeSingle();

      if (subscriptionError || !subscriptionData) {
        return {
          tokensTotal: 0,
          tokensUsed: 0,
          tokensRemaining: 0,
          pagesRemaining: 0,
          planName: 'Nenhum plano',
        };
      }

      const isActiveStatus = ['active', 'trialing'].includes(subscriptionData.status);
      const isCanceledButValid = subscriptionData.status === 'canceled' &&
        subscriptionData.current_period_end &&
        new Date(subscriptionData.current_period_end * 1000) > new Date();

      if (!isActiveStatus && !isCanceledButValid) {
        return {
          tokensTotal: 0,
          tokensUsed: 0,
          tokensRemaining: 0,
          pagesRemaining: 0,
          planName: 'Nenhum plano',
        };
      }

      const tokensTotal = subscriptionData.tokens_total || 0;
      const tokensUsed = subscriptionData.tokens_used || 0;
      const tokensRemaining = Math.max(tokensTotal - tokensUsed, 0);
      const pagesRemaining = this.calculatePagesFromTokens(tokensRemaining);
      const planName = PLAN_NAMES[subscriptionData.price_id] || 'Plano Ativo';

      return {
        tokensTotal,
        tokensUsed,
        tokensRemaining,
        pagesRemaining,
        planName,
      };
    } catch (error) {
      console.error('Error getting token balance:', error);
      throw new Error('Erro ao obter saldo de tokens');
    }
  }

  static formatTokenCount(tokens: number): string {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`;
    } else if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}K`;
    }
    return tokens.toString();
  }

  static formatNumber(num: number): string {
    return num.toLocaleString('pt-BR');
  }
}
