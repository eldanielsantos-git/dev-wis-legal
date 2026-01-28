import { supabase } from '../lib/supabase';

export interface ProcessHistoryRecord {
  id: string;
  process_id: string;
  user_id: string;
  user_first_name: string | null;
  user_last_name: string | null;
  user_email: string | null;
  file_name: string;
  total_pages: number;
  llm_model_name: string | null;
  llm_tokens_used: number;
  processed_at: string;
  created_at: string;
}

export interface ProcessHistoryFilters {
  startDate?: string;
  endDate?: string;
}

export class ProcessHistoryService {
  static async getHistory(
    limit: number = 100,
    offset: number = 0,
    filters?: ProcessHistoryFilters
  ): Promise<ProcessHistoryRecord[]> {
    let query = supabase
      .from('process_history')
      .select('*')
      .order('processed_at', { ascending: false });

    if (filters?.startDate) {
      query = query.gte('processed_at', filters.startDate);
    }

    if (filters?.endDate) {
      const endDateWithTime = `${filters.endDate}T23:59:59.999Z`;
      query = query.lte('processed_at', endDateWithTime);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;

    if (error) {
      throw new Error(`Erro ao buscar historico: ${error.message}`);
    }

    return data || [];
  }

  static async getTotalCount(filters?: ProcessHistoryFilters): Promise<number> {
    let query = supabase
      .from('process_history')
      .select('id', { count: 'exact', head: true });

    if (filters?.startDate) {
      query = query.gte('processed_at', filters.startDate);
    }

    if (filters?.endDate) {
      const endDateWithTime = `${filters.endDate}T23:59:59.999Z`;
      query = query.lte('processed_at', endDateWithTime);
    }

    const { count, error } = await query;

    if (error) {
      throw new Error(`Erro ao contar registros: ${error.message}`);
    }

    return count || 0;
  }

  static async getAllHistory(filters?: ProcessHistoryFilters): Promise<ProcessHistoryRecord[]> {
    let query = supabase
      .from('process_history')
      .select('*')
      .order('processed_at', { ascending: false });

    if (filters?.startDate) {
      query = query.gte('processed_at', filters.startDate);
    }

    if (filters?.endDate) {
      const endDateWithTime = `${filters.endDate}T23:59:59.999Z`;
      query = query.lte('processed_at', endDateWithTime);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Erro ao buscar todo historico: ${error.message}`);
    }

    return data || [];
  }
}
