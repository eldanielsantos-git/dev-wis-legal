import { supabase } from '../lib/supabase';

export interface AnalysisResult {
  id: string;
  processo_id: string;
  prompt_id: string;
  prompt_title: string;
  execution_order: number;
  result_content: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  execution_time_ms?: number;
  created_at: string;
  current_model_id?: string | null;
  current_model_name?: string | null;
  tokens_used?: number;
  completed_at?: string | null;
  prompt_content?: string;
}

export class AnalysisResultsService {
  static async getResultsByProcessoId(processoId: string): Promise<AnalysisResult[]> {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      await supabase.auth.refreshSession();
    }

    const { data, error } = await supabase
      .from('analysis_results')
      .select('*')
      .eq('processo_id', processoId)
      .order('execution_order', { ascending: true });

    if (error) {
      throw new Error(`Erro ao carregar resultados: ${error.message}`);
    }

    const mappedResults = (data || []).map(item => ({
      id: item.id,
      processo_id: item.processo_id,
      prompt_id: item.prompt_id,
      prompt_title: item.prompt_title || 'Sem título',
      execution_order: item.execution_order || 0,
      result_content: item.result_content,
      status: item.status || 'pending',
      execution_time_ms: item.execution_time_ms,
      created_at: item.created_at,
      current_model_id: item.current_model_id,
      current_model_name: item.current_model_name,
      tokens_used: item.tokens_used,
      completed_at: item.completed_at,
      prompt_content: item.prompt_content,
    }));

    return mappedResults;
  }

  static subscribeToResultsChanges(
    processoId: string,
    callback: () => void
  ): () => void {
    const channel = supabase
      .channel(`analysis-results-${processoId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'analysis_results',
          filter: `processo_id=eq.${processoId}`,
        },
        (payload) => {
          callback();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
}
