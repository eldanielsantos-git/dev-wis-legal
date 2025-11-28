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
      console.error('Erro ao buscar resultados de análise:', error);
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

    console.log('📊 Analysis Results fetched:', {
      processoId,
      total: mappedResults.length,
      statuses: mappedResults.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      results: mappedResults.map(r => ({
        order: r.execution_order,
        title: r.prompt_title,
        status: r.status,
        hasContent: !!r.result_content,
        contentLength: r.result_content?.length || 0,
        model: r.current_model_name,
      }))
    });

    return mappedResults;
  }

  static subscribeToResultsChanges(
    processoId: string,
    callback: () => void
  ): () => void {
    console.log('📡 Inscrevendo para updates em analysis_results:', processoId);

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
          console.log('🔔 Realtime event recebido em analysis_results:', {
            event: payload.eventType,
            table: 'analysis_results',
            old: payload.old,
            new: payload.new
          });

          if (payload.new) {
            const result = payload.new as any;
            console.log('📝 Resultado atualizado:', {
              id: result.id,
              order: result.execution_order,
              title: result.prompt_title,
              status: result.status,
              hasContent: !!result.result_content,
              contentLength: result.result_content?.length || 0
            });
          }

          callback();
        }
      )
      .subscribe((status) => {
        console.log('📡 Status da subscrição analysis_results:', status);
      });

    return () => {
      console.log('🛡️ Removendo canal analysis_results:', processoId);
      supabase.removeChannel(channel);
    };
  }
}
