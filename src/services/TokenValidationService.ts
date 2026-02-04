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

      // Buscar do user_token_balance que considera plan_tokens + extra_tokens
      const { data: balanceData, error: balanceError } = await supabase
        .from('user_token_balance')
        .select('plan_tokens, extra_tokens, tokens_used, total_available_tokens, available_plan_tokens, available_extra_tokens')
        .eq('user_id', userId)
        .maybeSingle();

      if (balanceError) {
        throw balanceError;
      }

      // Se não tem dados na view, significa que não tem tokens disponíveis
      if (!balanceData) {
        return {
          hasSubscription: false,
          hasSufficientTokens: false,
          tokensRemaining: 0,
          tokensTotal: 0,
          tokensUsed: 0,
          tokensRequired,
          pagesRemaining: 0,
          message: 'Você não tem tokens disponíveis. Adquira tokens ou assine um plano para começar.',
        };
      }

      const planTokens = balanceData.plan_tokens || 0;
      const extraTokens = balanceData.extra_tokens || 0;
      const tokensTotal = planTokens + extraTokens;
      const tokensUsed = balanceData.tokens_used || 0;
      const tokensRemaining = balanceData.total_available_tokens || 0;
      const hasSufficientTokens = tokensRemaining >= tokensRequired;
      const pagesRemaining = this.calculatePagesFromTokens(tokensRemaining);

      // Verificar se tem assinatura ativa (para informação, não bloqueia)
      const { data: customerData } = await supabase
        .from('stripe_customers')
        .select('customer_id')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .maybeSingle();

      let hasSubscription = false;
      let planName = 'Tokens Avulsos';

      if (customerData) {
        const { data: subscriptionData } = await supabase
          .from('stripe_subscriptions')
          .select('price_id, status, current_period_end')
          .eq('customer_id', customerData.customer_id)
          .is('deleted_at', null)
          .maybeSingle();

        if (subscriptionData) {
          const isActiveStatus = ['active', 'trialing'].includes(subscriptionData.status);
          const isCanceledButValid = subscriptionData.status === 'canceled' &&
            subscriptionData.current_period_end &&
            new Date(subscriptionData.current_period_end * 1000) > new Date();

          if (isActiveStatus || isCanceledButValid) {
            hasSubscription = true;
            planName = PLAN_NAMES[subscriptionData.price_id] || 'Plano Ativo';
          }
        }
      }

      let message = '';
      if (hasSufficientTokens) {
        message = `Tokens suficientes disponíveis. Você poderá processar este documento de ${pageCount} páginas.`;
      } else {
        const pagesCanProcess = this.calculatePagesFromTokens(tokensRemaining);
        message = `Tokens insuficientes. Você tem ${this.formatTokenCount(tokensRemaining)} tokens (${pagesCanProcess} páginas), mas precisa de ${this.formatTokenCount(tokensRequired)} tokens (${pageCount} páginas).`;
      }

      return {
        hasSubscription,
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
      // Buscar do user_token_balance que considera plan_tokens + extra_tokens
      const { data: balanceData, error: balanceError } = await supabase
        .from('user_token_balance')
        .select('plan_tokens, extra_tokens, tokens_used, total_available_tokens, available_plan_tokens, available_extra_tokens')
        .eq('user_id', userId)
        .maybeSingle();

      if (balanceError) {
      }

      if (balanceData) {
        const planTokens = balanceData.plan_tokens || 0;
        const extraTokens = balanceData.extra_tokens || 0;
        const tokensTotal = planTokens + extraTokens;
        const tokensUsed = balanceData.tokens_used || 0;
        const tokensRemaining = balanceData.total_available_tokens || 0;
        const pagesRemaining = this.calculatePagesFromTokens(tokensRemaining);

        // Tentar identificar o plano a partir da assinatura
        const { data: customerData } = await supabase
          .from('stripe_customers')
          .select('customer_id')
          .eq('user_id', userId)
          .is('deleted_at', null)
          .maybeSingle();

        let planName = 'Tokens Disponíveis';

        if (customerData) {
          const { data: subscriptionData } = await supabase
            .from('stripe_subscriptions')
            .select('price_id, status')
            .eq('customer_id', customerData.customer_id)
            .is('deleted_at', null)
            .maybeSingle();

          if (subscriptionData && subscriptionData.price_id) {
            planName = PLAN_NAMES[subscriptionData.price_id] || 'Plano Ativo';
          }
        }

        return {
          tokensTotal,
          tokensUsed,
          tokensRemaining,
          pagesRemaining,
          planName,
        };
      }

      // Fallback: buscar da assinatura Stripe (comportamento antigo)
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

      // IMPORTANTE: Não bloquear baseado em status da assinatura!
      // Usuários podem ter tokens extras (comprados ou transferidos) mesmo sem assinatura ativa.
      // O que importa é se eles têm tokens disponíveis (tokens_total - tokens_used > 0).
      const tokensTotal = subscriptionData.tokens_total || 0;
      const tokensUsed = subscriptionData.tokens_used || 0;
      const tokensRemaining = Math.max(tokensTotal - tokensUsed, 0);
      const pagesRemaining = this.calculatePagesFromTokens(tokensRemaining);

      // Determinar o nome do plano baseado no status
      let planName = 'Tokens Disponíveis';
      const isActiveStatus = ['active', 'trialing'].includes(subscriptionData.status);
      const isCanceledButValid = subscriptionData.status === 'canceled' &&
        subscriptionData.current_period_end &&
        new Date(subscriptionData.current_period_end * 1000) > new Date();

      if (isActiveStatus || isCanceledButValid) {
        planName = PLAN_NAMES[subscriptionData.price_id] || 'Plano Ativo';
      }

      return {
        tokensTotal,
        tokensUsed,
        tokensRemaining,
        pagesRemaining,
        planName,
      };
    } catch (error) {
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
