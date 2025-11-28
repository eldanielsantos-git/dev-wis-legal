import { supabase } from '../lib/supabase';

export interface AnalysisPrompt {
  id: string;
  title: string;
  prompt_content: string;
  system_prompt?: string | null;
  execution_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export class AnalysisPromptsService {
  static async getAllPrompts(): Promise<AnalysisPrompt[]> {
    const { data, error } = await supabase
      .from('analysis_prompts')
      .select('*')
      .order('execution_order', { ascending: true });

    if (error) {
      throw new Error(`Erro ao carregar prompts: ${error.message}`);
    }

    return data || [];
  }

  static async createPrompt(
    title: string,
    promptContent: string,
    executionOrder: number,
    systemPrompt?: string
  ): Promise<AnalysisPrompt> {
    const { data, error } = await supabase
      .from('analysis_prompts')
      .insert({
        title,
        prompt_content: promptContent,
        system_prompt: systemPrompt || null,
        execution_order: executionOrder,
        is_active: false,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao criar prompt: ${error.message}`);
    }

    return data;
  }

  static async updatePrompt(
    promptId: string,
    title: string,
    promptContent: string,
    executionOrder: number,
    systemPrompt?: string
  ): Promise<void> {
    const { error } = await supabase
      .from('analysis_prompts')
      .update({
        title,
        prompt_content: promptContent,
        system_prompt: systemPrompt || null,
        execution_order: executionOrder,
        updated_at: new Date().toISOString(),
      })
      .eq('id', promptId);

    if (error) {
      throw new Error(`Erro ao atualizar prompt: ${error.message}`);
    }
  }

  static async deletePrompt(promptId: string): Promise<void> {
    const { error } = await supabase
      .from('analysis_prompts')
      .delete()
      .eq('id', promptId);

    if (error) {
      throw new Error(`Erro ao excluir prompt: ${error.message}`);
    }
  }

  static async togglePromptStatus(
    promptId: string,
    isActive: boolean
  ): Promise<void> {
    const { error } = await supabase
      .from('analysis_prompts')
      .update({
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq('id', promptId);

    if (error) {
      throw new Error(`Erro ao alterar status do prompt: ${error.message}`);
    }
  }
}
