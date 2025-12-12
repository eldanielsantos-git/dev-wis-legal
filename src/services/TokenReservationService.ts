import { supabase } from '../lib/supabase';

export interface TokenReservation {
  id: string;
  user_id: string;
  processo_id: string | null;
  tokens_reserved: number;
  status: 'active' | 'released' | 'expired' | 'consumed';
  expires_at: string;
  created_at: string;
  released_at: string | null;
  metadata: Record<string, any>;
}

export interface ReserveTokensResult {
  success: boolean;
  reservation_id?: string;
  tokens_reserved?: number;
  available_after?: number;
  expires_at?: string;
  error?: string;
  available?: number;
  required?: number;
  reserved?: number;
}

export interface AvailableTokensInfo {
  balance: number;
  reserved: number;
  available: number;
}

export class TokenReservationService {
  /**
   * Reserva tokens atomicamente para um processo
   */
  static async reserveTokens(
    userId: string,
    processoId: string,
    tokensAmount: number,
    metadata: Record<string, any> = {}
  ): Promise<ReserveTokensResult> {
    try {
      const { data, error } = await supabase.rpc('reserve_tokens_atomic', {
        p_user_id: userId,
        p_processo_id: processoId,
        p_tokens_amount: tokensAmount,
        p_metadata: metadata,
      });

      if (error) {
        console.error('[TokenReservation] Erro ao reservar tokens:', error);
        return {
          success: false,
          error: error.message,
        };
      }

      return data as ReserveTokensResult;
    } catch (error) {
      console.error('[TokenReservation] Exceção ao reservar tokens:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Libera uma reserva (análise cancelada ou falhou)
   */
  static async releaseReservation(reservationId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('release_reservation', {
        p_reservation_id: reservationId,
      });

      if (error) {
        console.error('[TokenReservation] Erro ao liberar reserva:', error);
        return false;
      }

      return data === true;
    } catch (error) {
      console.error('[TokenReservation] Exceção ao liberar reserva:', error);
      return false;
    }
  }

  /**
   * Marca reserva como consumida (débito foi realizado)
   */
  static async consumeReservation(reservationId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('consume_reservation', {
        p_reservation_id: reservationId,
      });

      if (error) {
        console.error('[TokenReservation] Erro ao consumir reserva:', error);
        return false;
      }

      return data === true;
    } catch (error) {
      console.error('[TokenReservation] Exceção ao consumir reserva:', error);
      return false;
    }
  }

  /**
   * Obtém tokens disponíveis considerando reservas ativas
   */
  static async getAvailableTokens(userId: string): Promise<number> {
    try {
      const { data, error } = await supabase.rpc('get_available_tokens', {
        p_user_id: userId,
      });

      if (error) {
        console.error('[TokenReservation] Erro ao obter tokens disponíveis:', error);
        return 0;
      }

      return data || 0;
    } catch (error) {
      console.error('[TokenReservation] Exceção ao obter tokens disponíveis:', error);
      return 0;
    }
  }

  /**
   * Obtém informações detalhadas sobre tokens do usuário
   */
  static async getTokensInfo(userId: string): Promise<AvailableTokensInfo> {
    try {
      // Obter saldo total
      const { data: balanceData, error: balanceError } = await supabase
        .from('user_token_balance')
        .select('total_available_tokens')
        .eq('user_id', userId)
        .maybeSingle();

      if (balanceError) {
        console.error('[TokenReservation] Erro ao obter saldo:', balanceError);
        return { balance: 0, reserved: 0, available: 0 };
      }

      const balance = balanceData?.total_available_tokens || 0;

      // Obter tokens reservados
      const { data: reservations, error: reservationsError } = await supabase
        .from('token_reservations')
        .select('tokens_reserved')
        .eq('user_id', userId)
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString());

      if (reservationsError) {
        console.error('[TokenReservation] Erro ao obter reservas:', reservationsError);
        return { balance, reserved: 0, available: balance };
      }

      const reserved = reservations?.reduce(
        (sum, r) => sum + (r.tokens_reserved || 0),
        0
      ) || 0;

      return {
        balance,
        reserved,
        available: Math.max(balance - reserved, 0),
      };
    } catch (error) {
      console.error('[TokenReservation] Exceção ao obter informações de tokens:', error);
      return { balance: 0, reserved: 0, available: 0 };
    }
  }

  /**
   * Lista reservas ativas do usuário
   */
  static async getActiveReservations(userId: string): Promise<TokenReservation[]> {
    try {
      const { data, error } = await supabase
        .from('token_reservations')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[TokenReservation] Erro ao obter reservas ativas:', error);
        return [];
      }

      return (data || []) as TokenReservation[];
    } catch (error) {
      console.error('[TokenReservation] Exceção ao obter reservas ativas:', error);
      return [];
    }
  }

  /**
   * Obtém reserva ativa para um processo específico
   */
  static async getReservationForProcess(processoId: string): Promise<TokenReservation | null> {
    try {
      const { data, error } = await supabase
        .from('token_reservations')
        .select('*')
        .eq('processo_id', processoId)
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (error) {
        console.error('[TokenReservation] Erro ao obter reserva do processo:', error);
        return null;
      }

      return data as TokenReservation | null;
    } catch (error) {
      console.error('[TokenReservation] Exceção ao obter reserva do processo:', error);
      return null;
    }
  }

  /**
   * Verifica se usuário tem análises em andamento
   */
  static async hasActiveAnalysis(userId: string): Promise<boolean> {
    try {
      const reservations = await this.getActiveReservations(userId);
      return reservations.length > 0;
    } catch (error) {
      console.error('[TokenReservation] Erro ao verificar análises ativas:', error);
      return false;
    }
  }

  /**
   * Obtém detalhes de processos com análises em andamento
   */
  static async getProcessesWithActiveReservations(userId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('token_reservations')
        .select(`
          *,
          processos (
            id,
            numero_processo,
            nome_cliente,
            status
          )
        `)
        .eq('user_id', userId)
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[TokenReservation] Erro ao obter processos com reservas:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[TokenReservation] Exceção ao obter processos com reservas:', error);
      return [];
    }
  }
}
