import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { NotificationsService } from '../services/NotificationsService';
import { TokenValidationService } from '../services/TokenValidationService';

interface TokenBalance {
  tokensTotal: number;
  tokensUsed: number;
  tokensRemaining: number;
  pagesRemaining: number;
  planName: string;
  loading: boolean;
  lastUpdated: Date;
}

interface TokenBalanceContextType {
  balance: TokenBalance;
  refreshBalance: () => Promise<void>;
  isRefreshing: boolean;
}

const TokenBalanceContext = createContext<TokenBalanceContextType | undefined>(undefined);

export function TokenBalanceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const previousTokensUsedRef = useRef<number>(0);
  const [balance, setBalance] = useState<TokenBalance>({
    tokensTotal: 0,
    tokensUsed: 0,
    tokensRemaining: 0,
    pagesRemaining: 0,
    planName: 'Carregando...',
    loading: true,
    lastUpdated: new Date(),
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchBalance = useCallback(async () => {
    if (!user) {
      setBalance({
        tokensTotal: 0,
        tokensUsed: 0,
        tokensRemaining: 0,
        pagesRemaining: 0,
        planName: 'Sem usuário',
        loading: false,
        lastUpdated: new Date(),
      });
      return;
    }

    try {
      console.log('[TokenBalance] Fetching balance for user:', user.id);
      const data = await TokenValidationService.getTokenBalance(user.id);
      console.log('[TokenBalance] Balance fetched:', {
        tokensTotal: data.tokensTotal,
        tokensUsed: data.tokensUsed,
        tokensRemaining: data.tokensRemaining,
      });

      const newBalance = {
        tokensTotal: data.tokensTotal,
        tokensUsed: data.tokensUsed,
        tokensRemaining: data.tokensRemaining,
        pagesRemaining: data.pagesRemaining,
        planName: data.planName,
        loading: false,
        lastUpdated: new Date(),
      };

      if (previousTokensUsedRef.current > 0 && data.tokensUsed > previousTokensUsedRef.current) {
        const tokensDebited = data.tokensUsed - previousTokensUsedRef.current;
        const pagesProcessed = Math.ceil(tokensDebited / 5500);

        try {
          await NotificationsService.createNotification({
            type: 'success',
            message: `Análise concluída! ${TokenValidationService.formatTokenCount(tokensDebited)} tokens debitados (${pagesProcessed} páginas processadas)`,
          });
        } catch (notifError) {
          console.error('Error creating notification:', notifError);
        }
      }

      previousTokensUsedRef.current = data.tokensUsed;
      setBalance(newBalance);
    } catch (error) {
      console.error('Error fetching token balance:', error);
      setBalance(prev => ({ ...prev, loading: false }));
    }
  }, [user]);

  const refreshBalance = useCallback(async () => {
    setIsRefreshing(true);
    await fetchBalance();
    setIsRefreshing(false);
  }, [fetchBalance]);

  useEffect(() => {
    if (!user) return;

    fetchBalance();

    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setupRealtimeSubscription = async () => {
      try {
        const { data: customer } = await supabase
          .from('stripe_customers')
          .select('customer_id')
          .eq('user_id', user.id)
          .is('deleted_at', null)
          .maybeSingle();

        if (!customer?.customer_id) return;

        console.log(`[TokenBalance] Setting up realtime for user ${user.id}, customer ${customer.customer_id}`);

        channel = supabase
          .channel(`token-balance-${user.id}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'stripe_subscriptions',
              filter: `customer_id=eq.${customer.customer_id}`,
            },
            (payload) => {
              console.log('🔄 [TokenBalance] Subscription updated:', payload);
              fetchBalance();
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'token_usage_history',
              filter: `user_id=eq.${user.id}`,
            },
            (payload) => {
              console.log('🪙 [TokenBalance] Token usage detected (history):', payload);
              fetchBalance();
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'token_usage_logs',
              filter: `user_id=eq.${user.id}`,
            },
            (payload) => {
              console.log('🪙 [TokenBalance] Token usage detected (logs):', payload);
              fetchBalance();
            }
          )
          .subscribe((status) => {
            console.log(`[TokenBalance] Realtime subscription status: ${status}`);
          });
      } catch (error) {
        console.error('Error setting up realtime subscription:', error);
      }
    };

    setupRealtimeSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [user, fetchBalance]);

  return (
    <TokenBalanceContext.Provider value={{ balance, refreshBalance, isRefreshing }}>
      {children}
    </TokenBalanceContext.Provider>
  );
}

export function useTokenBalance() {
  const context = useContext(TokenBalanceContext);
  if (context === undefined) {
    throw new Error('useTokenBalance must be used within a TokenBalanceProvider');
  }
  return context;
}
