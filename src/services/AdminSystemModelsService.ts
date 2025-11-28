import { supabase } from '../lib/supabase';
import type { AdminSystemModel } from '../lib/supabase';

export class AdminSystemModelsService {
  static async getActiveModel(): Promise<AdminSystemModel | null> {
    const models = await this.getActiveModelsOrderedByPriority();
    return models.length > 0 ? models[0] : null;
  }

  static async getActiveModelsOrderedByPriority(): Promise<AdminSystemModel[]> {
    const { data, error } = await supabase
      .from('admin_system_models')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: true });

    if (error) {
      console.error('Error fetching active models:', error);
      throw new Error(`Failed to fetch active models: ${error.message}`);
    }

    return data || [];
  }

  static async getAllModels(): Promise<AdminSystemModel[]> {
    const { data, error } = await supabase
      .from('admin_system_models')
      .select('*')
      .order('priority', { ascending: true });

    if (error) {
      console.error('Error fetching models:', error);
      throw new Error(`Failed to fetch models: ${error.message}`);
    }

    return data || [];
  }

  static async createModel(params: {
    llm_provider: string;
    display_name: string;
    system_model: string;
    temperature?: number | null;
    priority?: number | null;
  }): Promise<AdminSystemModel> {
    if (!params.llm_provider.trim() || !params.display_name.trim() || !params.system_model.trim()) {
      throw new Error('LLM provider, display name, and system model are required');
    }

    let finalPriority = params.priority;
    if (!finalPriority) {
      const models = await this.getAllModels();
      finalPriority = models.length > 0 ? Math.max(...models.map(m => m.priority)) + 1 : 1;
    }

    const { data, error } = await supabase
      .from('admin_system_models')
      .insert({
        llm_provider: params.llm_provider.trim(),
        display_name: params.display_name.trim(),
        system_model: params.system_model.trim(),
        name: params.display_name.trim(),
        model_id: params.system_model.trim(),
        temperature: params.temperature,
        priority: finalPriority,
        is_active: true,
        project_id: '',
        location: '',
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error('This model configuration already exists');
      }
      console.error('Error creating model:', error);
      throw new Error(`Failed to create model: ${error.message}`);
    }

    if (!data) {
      throw new Error('Failed to create model: No data returned');
    }

    return data;
  }

  static async updateModel(modelId: string, params: {
    llm_provider: string;
    display_name: string;
    system_model: string;
    temperature?: number | null;
    priority?: number | null;
  }): Promise<AdminSystemModel> {
    if (!params.llm_provider.trim() || !params.display_name.trim() || !params.system_model.trim()) {
      throw new Error('LLM provider, display name, and system model are required');
    }

    const { data, error } = await supabase
      .from('admin_system_models')
      .update({
        llm_provider: params.llm_provider.trim(),
        display_name: params.display_name.trim(),
        system_model: params.system_model.trim(),
        name: params.display_name.trim(),
        model_id: params.system_model.trim(),
        temperature: params.temperature,
        priority: params.priority,
      })
      .eq('id', modelId)
      .select()
      .single();

    if (error) {
      console.error('Error updating model:', error);
      throw new Error(`Failed to update model: ${error.message}`);
    }

    if (!data) {
      throw new Error('Failed to update model: No data returned');
    }

    return data;
  }

  static async updateModelStatus(modelId: string, isActive: boolean): Promise<void> {
    const { error } = await supabase
      .from('admin_system_models')
      .update({ is_active: isActive })
      .eq('id', modelId);

    if (error) {
      console.error('Error updating model status:', error);
      throw new Error(`Failed to update model status: ${error.message}`);
    }
  }

  static async updateModelPriority(modelId: string, newPriority: number): Promise<void> {
    if (newPriority < 1) {
      throw new Error('Priority must be at least 1');
    }

    const allModels = await this.getAllModels();
    const targetModel = allModels.find(m => m.id === modelId);

    if (!targetModel) {
      throw new Error('Model not found');
    }

    const oldPriority = targetModel.priority;

    if (oldPriority === newPriority) {
      return;
    }

    const maxPriority = Math.max(...allModels.map(m => m.priority));
    const tempPriority = maxPriority + 1000;

    await supabase
      .from('admin_system_models')
      .update({ priority: tempPriority })
      .eq('id', modelId);

    const updates: Array<{ id: string; priority: number }> = [];

    if (newPriority < oldPriority) {
      allModels.forEach(model => {
        if (model.id === modelId) {
          updates.push({ id: model.id, priority: newPriority });
        } else if (model.priority >= newPriority && model.priority < oldPriority) {
          updates.push({ id: model.id, priority: model.priority + 1 });
        }
      });
    } else {
      allModels.forEach(model => {
        if (model.id === modelId) {
          updates.push({ id: model.id, priority: newPriority });
        } else if (model.priority > oldPriority && model.priority <= newPriority) {
          updates.push({ id: model.id, priority: model.priority - 1 });
        }
      });
    }

    for (const update of updates) {
      const { error } = await supabase
        .from('admin_system_models')
        .update({ priority: update.priority })
        .eq('id', update.id);

      if (error) {
        console.error('Error updating priority:', error);
        throw new Error(`Failed to update priority: ${error.message}`);
      }
    }
  }

  static async deleteModel(modelId: string): Promise<void> {
    const { error } = await supabase
      .from('admin_system_models')
      .delete()
      .eq('id', modelId);

    if (error) {
      console.error('Error deleting model:', error);
      throw new Error(`Failed to delete model: ${error.message}`);
    }
  }
}
