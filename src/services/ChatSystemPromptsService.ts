import { supabase } from '../lib/supabase';

export type PromptType = 'small_file' | 'large_file_chunks' | 'large_file_analysis';

export interface ChatSystemPrompt {
  id: string;
  prompt_type: PromptType;
  system_prompt: string;
  description: string | null;
  is_active: boolean;
  priority: number;
  max_pages: number | null;
  max_chunks: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateChatSystemPromptData {
  prompt_type: PromptType;
  system_prompt: string;
  description?: string;
  is_active?: boolean;
  priority?: number;
  max_pages?: number;
  max_chunks?: number;
}

export interface UpdateChatSystemPromptData {
  prompt_type?: PromptType;
  system_prompt?: string;
  description?: string;
  is_active?: boolean;
  priority?: number;
  max_pages?: number;
  max_chunks?: number;
}

export class ChatSystemPromptsService {
  static async getAllPrompts(): Promise<ChatSystemPrompt[]> {
    const { data, error } = await supabase
      .from('chat_system_prompts')
      .select('*')
      .order('priority', { ascending: true });

    if (error) {
      console.error('Erro ao buscar prompts do chat:', error);
      throw new Error(`Erro ao buscar prompts do chat: ${error.message}`);
    }

    const prompts = data || [];

    return prompts.sort((a, b) => {
      const orderA = this.getPromptTypeSortOrder(a.prompt_type);
      const orderB = this.getPromptTypeSortOrder(b.prompt_type);

      if (orderA !== orderB) {
        return orderA - orderB;
      }

      return a.priority - b.priority;
    });
  }

  static async getActivePromptByType(promptType: PromptType): Promise<ChatSystemPrompt | null> {
    const { data, error } = await supabase
      .from('chat_system_prompts')
      .select('*')
      .eq('prompt_type', promptType)
      .eq('is_active', true)
      .order('priority', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(`Erro ao buscar prompt ativo do tipo ${promptType}:`, error);
      throw new Error(`Erro ao buscar prompt ativo: ${error.message}`);
    }

    return data;
  }

  static async createPrompt(data: CreateChatSystemPromptData): Promise<ChatSystemPrompt> {
    if (!data.system_prompt || data.system_prompt.trim().length === 0) {
      throw new Error('O conteúdo do system prompt é obrigatório');
    }

    if (data.is_active === true) {
      await this.deactivateOtherPromptsOfType(data.prompt_type);
    }

    const { data: newPrompt, error } = await supabase
      .from('chat_system_prompts')
      .insert({
        prompt_type: data.prompt_type,
        system_prompt: data.system_prompt,
        description: data.description || null,
        is_active: data.is_active ?? true,
        priority: data.priority ?? 1,
        max_pages: data.max_pages || null,
        max_chunks: data.max_chunks || null
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar prompt do chat:', error);
      throw new Error(`Erro ao criar prompt: ${error.message}`);
    }

    return newPrompt;
  }

  static async updatePrompt(
    id: string,
    data: UpdateChatSystemPromptData
  ): Promise<ChatSystemPrompt> {
    if (data.system_prompt !== undefined && data.system_prompt.trim().length === 0) {
      throw new Error('O conteúdo do system prompt não pode estar vazio');
    }

    const { data: currentPrompt, error: fetchError } = await supabase
      .from('chat_system_prompts')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !currentPrompt) {
      throw new Error('Prompt não encontrado');
    }

    if (data.is_active === true) {
      const targetType = data.prompt_type || currentPrompt.prompt_type;
      await this.deactivateOtherPromptsOfType(targetType, id);
    }

    if (data.is_active === false) {
      const targetType = data.prompt_type || currentPrompt.prompt_type;
      const activeCount = await this.countActivePromptsOfType(targetType, id);

      if (activeCount === 0) {
        throw new Error(
          'Não é possível desativar este prompt pois ele é o único ativo deste tipo. ' +
          'Ative outro prompt do mesmo tipo antes de desativar este.'
        );
      }
    }

    const updateData: any = {};
    if (data.prompt_type !== undefined) updateData.prompt_type = data.prompt_type;
    if (data.system_prompt !== undefined) updateData.system_prompt = data.system_prompt;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.is_active !== undefined) updateData.is_active = data.is_active;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.max_pages !== undefined) updateData.max_pages = data.max_pages;
    if (data.max_chunks !== undefined) updateData.max_chunks = data.max_chunks;

    const { data: updatedPrompt, error } = await supabase
      .from('chat_system_prompts')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar prompt do chat:', error);
      throw new Error(`Erro ao atualizar prompt: ${error.message}`);
    }

    return updatedPrompt;
  }

  static async deletePrompt(id: string): Promise<void> {
    const { data: prompt, error: fetchError } = await supabase
      .from('chat_system_prompts')
      .select('prompt_type, is_active')
      .eq('id', id)
      .single();

    if (fetchError || !prompt) {
      throw new Error('Prompt não encontrado');
    }

    if (prompt.is_active) {
      const activeCount = await this.countActivePromptsOfType(prompt.prompt_type, id);

      if (activeCount === 0) {
        throw new Error(
          'Não é possível excluir este prompt pois ele é o único ativo deste tipo. ' +
          'Crie ou ative outro prompt do mesmo tipo antes de excluir este.'
        );
      }
    }

    const { error } = await supabase
      .from('chat_system_prompts')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao excluir prompt do chat:', error);
      throw new Error(`Erro ao excluir prompt: ${error.message}`);
    }
  }

  static async toggleStatus(id: string, isActive: boolean): Promise<ChatSystemPrompt> {
    return this.updatePrompt(id, { is_active: isActive });
  }

  static async duplicatePrompt(id: string): Promise<ChatSystemPrompt> {
    const { data: originalPrompt, error: fetchError } = await supabase
      .from('chat_system_prompts')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !originalPrompt) {
      throw new Error('Prompt não encontrado');
    }

    const { data: newPrompt, error } = await supabase
      .from('chat_system_prompts')
      .insert({
        prompt_type: originalPrompt.prompt_type,
        system_prompt: originalPrompt.system_prompt,
        description: originalPrompt.description
          ? `${originalPrompt.description} (Cópia)`
          : 'Cópia',
        is_active: false,
        priority: originalPrompt.priority + 1,
        max_pages: originalPrompt.max_pages,
        max_chunks: originalPrompt.max_chunks
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao duplicar prompt do chat:', error);
      throw new Error(`Erro ao duplicar prompt: ${error.message}`);
    }

    return newPrompt;
  }

  private static async deactivateOtherPromptsOfType(
    promptType: PromptType,
    excludeId?: string
  ): Promise<void> {
    let query = supabase
      .from('chat_system_prompts')
      .update({ is_active: false })
      .eq('prompt_type', promptType)
      .eq('is_active', true);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { error } = await query;

    if (error) {
      console.error('Erro ao desativar outros prompts:', error);
      throw new Error(`Erro ao desativar outros prompts: ${error.message}`);
    }
  }

  private static async countActivePromptsOfType(
    promptType: PromptType,
    excludeId?: string
  ): Promise<number> {
    let query = supabase
      .from('chat_system_prompts')
      .select('id', { count: 'exact', head: true })
      .eq('prompt_type', promptType)
      .eq('is_active', true);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { count, error } = await query;

    if (error) {
      console.error('Erro ao contar prompts ativos:', error);
      return 0;
    }

    return count || 0;
  }

  static getPromptTypeLabel(type: PromptType): string {
    const labels: Record<PromptType, string> = {
      'small_file': 'Chat Padrão',
      'large_file_chunks': 'Arquivos Extra Grandes',
      'large_file_analysis': 'Arquivos Grandes'
    };
    return labels[type] || type;
  }

  static getPromptTypeDescription(type: PromptType): string {
    const descriptions: Record<PromptType, string> = {
      'small_file': 'Para processos com PDF completo em base64 (< 1000 páginas)',
      'large_file_chunks': 'Para processos extra grandes divididos em chunks (1000-3000 páginas, até 10 partes)',
      'large_file_analysis': 'Para processos grandes usando análises consolidadas (> 3000 páginas, > 10 chunks)'
    };
    return descriptions[type] || '';
  }

  static getPromptTypeSortOrder(type: PromptType): number {
    const order: Record<PromptType, number> = {
      'small_file': 1,
      'large_file_analysis': 2,
      'large_file_chunks': 3
    };
    return order[type] || 999;
  }

  static getPromptTypeBadgeColor(type: PromptType): string {
    const colors: Record<PromptType, string> = {
      'small_file': 'green',
      'large_file_chunks': 'blue',
      'large_file_analysis': 'purple'
    };
    return colors[type] || 'gray';
  }
}
