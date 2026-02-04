import { supabase } from '../lib/supabase';

export interface AdminChatModel {
  id: string;
  model_name: string;
  system_model: string;
  provider: string;
  is_active: boolean;
  priority: number;
  description: string | null;
  max_context_length: number;
  supports_system_instruction: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateChatModelData {
  model_name: string;
  system_model: string;
  provider: string;
  is_active?: boolean;
  priority?: number;
  description?: string;
  max_context_length?: number;
  supports_system_instruction?: boolean;
}

export interface UpdateChatModelData extends Partial<CreateChatModelData> {
  id: string;
}

export class AdminChatModelsService {
  static async getAllModels(): Promise<AdminChatModel[]> {
    const { data, error } = await supabase
      .from('admin_chat_models')
      .select('*')
      .order('priority', { ascending: true });

    if (error) {
      throw new Error(error.message || 'Erro ao buscar modelos de chat');
    }

    return data || [];
  }

  static async createModel(modelData: CreateChatModelData): Promise<AdminChatModel> {
    const { data, error } = await supabase
      .from('admin_chat_models')
      .insert([modelData])
      .select()
      .single();

    if (error) {
      throw new Error(error.message || 'Erro ao criar modelo de chat');
    }

    return data;
  }

  static async updateModel(modelData: UpdateChatModelData): Promise<AdminChatModel> {
    const { id, ...updates } = modelData;

    const { data, error } = await supabase
      .from('admin_chat_models')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message || 'Erro ao atualizar modelo de chat');
    }

    return data;
  }

  static async deleteModel(id: string): Promise<void> {
    const { error } = await supabase
      .from('admin_chat_models')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(error.message || 'Erro ao excluir modelo de chat');
    }
  }

  static async toggleActive(id: string, isActive: boolean): Promise<AdminChatModel> {
    return this.updateModel({ id, is_active: isActive });
  }

  static async updatePriority(id: string, priority: number): Promise<AdminChatModel> {
    return this.updateModel({ id, priority });
  }

  static async reorderModels(modelId: string, direction: 'up' | 'down'): Promise<void> {
    const models = await this.getAllModels();
    const currentIndex = models.findIndex(m => m.id === modelId);

    if (currentIndex === -1) {
      throw new Error('Modelo não encontrado');
    }

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= models.length) {
      return;
    }

    const currentModel = models[currentIndex];
    const targetModel = models[targetIndex];

    await Promise.all([
      this.updatePriority(currentModel.id, targetModel.priority),
      this.updatePriority(targetModel.id, currentModel.priority),
    ]);
  }
}
