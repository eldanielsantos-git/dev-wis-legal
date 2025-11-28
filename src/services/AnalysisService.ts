import { supabase } from '../lib/supabase';
import type { AnalysisPrompt, AnalysisResult, Processo } from '../lib/supabase';

export class AnalysisService {
  static async getAllPrompts(): Promise<AnalysisPrompt[]> {
    const { data, error } = await supabase
      .from('analysis_prompts')
      .select('*')
      .order('execution_order', { ascending: true });

    if (error) {
      console.error('Erro ao buscar prompts:', error);
      throw new Error('Não foi possível carregar os prompts de análise');
    }

    return data || [];
  }

  static async getActivePrompts(): Promise<AnalysisPrompt[]> {
    const { data, error } = await supabase
      .from('analysis_prompts')
      .select('*')
      .eq('is_active', true)
      .order('execution_order', { ascending: true });

    if (error) {
      console.error('Erro ao buscar prompts ativos:', error);
      throw new Error('Não foi possível carregar os prompts ativos');
    }

    return data || [];
  }

  static async getPromptById(id: string): Promise<AnalysisPrompt | null> {
    const { data, error } = await supabase
      .from('analysis_prompts')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Erro ao buscar prompt:', error);
      return null;
    }

    return data;
  }

  static async updatePrompt(
    id: string,
    updates: Partial<AnalysisPrompt>
  ): Promise<boolean> {
    const { error } = await supabase
      .from('analysis_prompts')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error('Erro ao atualizar prompt:', error);
      return false;
    }

    return true;
  }

  static async startAnalysis(processoId: string): Promise<void> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const response = await fetch(`${supabaseUrl}/functions/v1/start-analysis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({ processo_id: processoId }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Erro ao iniciar análise');
    }
  }

  static async getAnalysisResults(processoId: string): Promise<AnalysisResult[]> {
    const { data, error } = await supabase
      .from('analysis_results')
      .select('*')
      .eq('processo_id', processoId)
      .order('execution_order', { ascending: true });

    if (error) {
      console.error('Erro ao buscar resultados:', error);
      throw new Error('Não foi possível carregar os resultados da análise');
    }

    return data || [];
  }

  static async getAnalysisProgress(processoId: string): Promise<{
    currentPrompt: number;
    totalPrompts: number;
    status: string;
  }> {
    const { data, error } = await supabase
      .from('processos')
      .select('status, current_prompt_number, total_prompts')
      .eq('id', processoId)
      .single();

    if (error) {
      console.error('Erro ao buscar progresso:', error);
      throw new Error('Não foi possível carregar o progresso da análise');
    }

    return {
      currentPrompt: data.current_prompt_number || 0,
      totalPrompts: data.total_prompts || 9,
      status: data.status,
    };
  }

  static subscribeToAnalysisProgress(
    processoId: string,
    callback: (progress: {
      currentPrompt: number;
      totalPrompts: number;
      status: string;
    }) => void
  ) {
    const channel = supabase
      .channel(`processo_${processoId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'processos',
          filter: `id=eq.${processoId}`,
        },
        (payload) => {
          const processo = payload.new as Processo;
          callback({
            currentPrompt: processo.current_prompt_number || 0,
            totalPrompts: processo.total_prompts || 9,
            status: processo.status,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  static subscribeToAnalysisResults(
    processoId: string,
    callback: (result: AnalysisResult) => void
  ) {
    const channel = supabase
      .channel(`results_${processoId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'analysis_results',
          filter: `processo_id=eq.${processoId}`,
        },
        (payload) => {
          const result = payload.new as AnalysisResult;
          callback(result);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
}
