import { supabase } from '../lib/supabase';
import { getBrazilDate, getBrazilDateString } from '../utils/dateHelpers';

export interface ProcessDeadline {
  id: string;
  processo_id: string;
  user_id: string;
  deadline_date: string;
  deadline_time?: string;
  subject: string;
  category?: string;
  party_type: 'accusation' | 'defendant' | 'both';
  source_type: 'auto' | 'manual';
  analysis_result_id?: string;
  status: 'pending' | 'completed' | 'expired';
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateDeadlineInput {
  processo_id: string;
  deadline_date: string;
  deadline_time?: string;
  subject: string;
  category?: string;
  party_type?: 'accusation' | 'defendant' | 'both';
  source_type?: 'auto' | 'manual';
  analysis_result_id?: string;
  notes?: string;
}

export interface UpdateDeadlineInput {
  deadline_date?: string;
  deadline_time?: string;
  subject?: string;
  category?: string;
  party_type?: 'accusation' | 'defendant' | 'both';
  status?: 'pending' | 'completed' | 'expired';
  notes?: string;
}

export interface DeadlineFilters {
  startDate?: string;
  endDate?: string;
  status?: 'pending' | 'completed' | 'expired';
  category?: string;
  processoId?: string;
}

class ProcessDeadlinesService {
  async getDeadlines(filters?: DeadlineFilters): Promise<ProcessDeadline[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    let query = supabase
      .from('process_deadlines')
      .select('*')
      .eq('user_id', user.id)
      .order('deadline_date', { ascending: true });

    if (filters?.startDate) {
      query = query.gte('deadline_date', filters.startDate);
    }

    if (filters?.endDate) {
      query = query.lte('deadline_date', filters.endDate);
    }

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.category) {
      query = query.eq('category', filters.category);
    }

    if (filters?.processoId) {
      query = query.eq('processo_id', filters.processoId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  async getDeadlinesByMonth(year: number, month: number): Promise<ProcessDeadline[]> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    return this.getDeadlines({
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    });
  }

  async getUpcomingDeadlines(days: number = 7): Promise<ProcessDeadline[]> {
    const today = getBrazilDate();
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + days);

    const year = futureDate.getFullYear();
    const month = String(futureDate.getMonth() + 1).padStart(2, '0');
    const day = String(futureDate.getDate()).padStart(2, '0');
    const futureDateStr = `${year}-${month}-${day}`;

    return this.getDeadlines({
      startDate: getBrazilDateString(),
      endDate: futureDateStr,
      status: 'pending'
    });
  }

  async getDeadlinesByProcesso(processoId: string): Promise<ProcessDeadline[]> {
    return this.getDeadlines({ processoId });
  }

  async createDeadline(input: CreateDeadlineInput): Promise<ProcessDeadline> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    const { data, error } = await supabase
      .from('process_deadlines')
      .insert({
        ...input,
        user_id: user.id,
        party_type: input.party_type || 'both',
        source_type: input.source_type || 'manual',
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateDeadline(id: string, updates: UpdateDeadlineInput): Promise<ProcessDeadline> {
    const { data, error } = await supabase
      .from('process_deadlines')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteDeadline(id: string): Promise<void> {
    const { error } = await supabase
      .from('process_deadlines')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async markAsCompleted(id: string): Promise<ProcessDeadline> {
    return this.updateDeadline(id, { status: 'completed' });
  }

  async markAsPending(id: string): Promise<ProcessDeadline> {
    return this.updateDeadline(id, { status: 'pending' });
  }

  async updateExpiredDeadlines(): Promise<void> {
    const { error } = await supabase.rpc('update_expired_deadlines');
    if (error) throw error;
  }

  async getDeadlineStats(): Promise<{
    pending: number;
    completed: number;
    expired: number;
    today: number;
    thisWeek: number;
  }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    const today = getBrazilDateString();
    const weekFromNow = getBrazilDate();
    weekFromNow.setDate(weekFromNow.getDate() + 7);

    const year = weekFromNow.getFullYear();
    const month = String(weekFromNow.getMonth() + 1).padStart(2, '0');
    const day = String(weekFromNow.getDate()).padStart(2, '0');
    const weekEnd = `${year}-${month}-${day}`;

    const [allDeadlines, todayDeadlines, weekDeadlines] = await Promise.all([
      this.getDeadlines(),
      this.getDeadlines({ startDate: today, endDate: today }),
      this.getDeadlines({ startDate: today, endDate: weekEnd, status: 'pending' })
    ]);

    const todayPendingAndExpired = todayDeadlines.filter(
      d => d.status === 'pending' || d.status === 'expired'
    ).length;

    return {
      pending: allDeadlines.filter(d => d.status === 'pending').length,
      completed: allDeadlines.filter(d => d.status === 'completed').length,
      expired: allDeadlines.filter(d => d.status === 'expired').length,
      today: todayPendingAndExpired,
      thisWeek: weekDeadlines.length
    };
  }
}

export const processDeadlinesService = new ProcessDeadlinesService();
