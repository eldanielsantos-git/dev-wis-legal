import { supabase } from '../lib/supabase';

export interface ChatIntroPrompt {
  id: string;
  prompt_text: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export class ChatIntroPromptsService {
  static async getAllPrompts(): Promise<ChatIntroPrompt[]> {
    const { data, error } = await supabase
      .from('chat_intro_prompts')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      throw new Error(`Erro ao carregar prompts de chat: ${error.message}`);
    }

    return data || [];
  }

  static async getActivePrompts(): Promise<ChatIntroPrompt[]> {
    const { data, error } = await supabase
      .from('chat_intro_prompts')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      throw new Error(`Erro ao carregar prompts ativos: ${error.message}`);
    }

    return data || [];
  }

  static async createPrompt(
    promptText: string,
    displayOrder: number
  ): Promise<ChatIntroPrompt> {
    const { data, error } = await supabase
      .from('chat_intro_prompts')
      .insert({
        prompt_text: promptText,
        display_order: displayOrder,
        is_active: true,
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
    promptText: string,
    displayOrder: number
  ): Promise<void> {
    const { error } = await supabase
      .from('chat_intro_prompts')
      .update({
        prompt_text: promptText,
        display_order: displayOrder,
        updated_at: new Date().toISOString(),
      })
      .eq('id', promptId);

    if (error) {
      throw new Error(`Erro ao atualizar prompt: ${error.message}`);
    }
  }

  static async deletePrompt(promptId: string): Promise<void> {
    const { error } = await supabase
      .from('chat_intro_prompts')
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
      .from('chat_intro_prompts')
      .update({
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq('id', promptId);

    if (error) {
      throw new Error(`Erro ao alterar status do prompt: ${error.message}`);
    }
  }

  static subscribeToChanges(
    callback: (payload: any) => void
  ) {
    return supabase
      .channel('chat_intro_prompts_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_intro_prompts'
        },
        callback
      )
      .subscribe();
  }
}
