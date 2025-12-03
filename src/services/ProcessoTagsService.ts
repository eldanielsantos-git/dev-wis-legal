import { supabase } from '../lib/supabase';
import type { ProcessoTag, CreateTagInput, UpdateTagInput, TagStatistics } from '../lib/supabase';
import { generateTagSlug, isValidHexColor } from '../utils/tagColors';

class ProcessoTagsServiceClass {
  private tagsCache: { tags: ProcessoTag[]; timestamp: number } | null = null;
  private readonly CACHE_DURATION = 5 * 60 * 1000;

  private async ensureIsAdmin(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Não autenticado');
    }

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (error) {
      throw new Error('Erro ao verificar permissões');
    }

    if (!profile?.is_admin) {
      throw new Error('Permissão negada: apenas administradores podem realizar esta ação');
    }
  }

  async getAllTags(forceRefresh = false): Promise<ProcessoTag[]> {
    if (!forceRefresh && this.tagsCache && Date.now() - this.tagsCache.timestamp < this.CACHE_DURATION) {
      return this.tagsCache.tags;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Usuário não autenticado');
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    const isAdmin = profile?.is_admin || false;

    let query = supabase
      .from('processo_tags')
      .select('*')
      .order('display_order', { ascending: true })
      .order('name', { ascending: true });

    if (!isAdmin) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Erro ao buscar tags: ${error.message}`);
    }

    const tags = data || [];

    this.tagsCache = {
      tags,
      timestamp: Date.now()
    };

    return tags;
  }

  async getTagById(tagId: string): Promise<ProcessoTag> {
    const { data, error } = await supabase
      .from('processo_tags')
      .select('*')
      .eq('id', tagId)
      .single();

    if (error) {
      throw new Error(`Erro ao buscar tag: ${error.message}`);
    }

    if (!data) {
      throw new Error('Tag não encontrada');
    }

    return data;
  }

  async getTagsByProcessoId(processoId: string): Promise<ProcessoTag[]> {
    const { data, error } = await supabase
      .from('processo_tag_assignments')
      .select(`
        tag_id,
        assigned_at,
        processo_tags (*)
      `)
      .eq('processo_id', processoId)
      .order('assigned_at', { ascending: false });

    if (error) {
      throw new Error(`Erro ao buscar tags do processo: ${error.message}`);
    }

    if (!data) {
      return [];
    }

    return data
      .map(item => item.processo_tags)
      .filter(tag => tag !== null) as ProcessoTag[];
  }

  async searchTags(query: string): Promise<ProcessoTag[]> {
    const { data, error } = await supabase
      .from('processo_tags')
      .select('*')
      .eq('is_active', true)
      .ilike('name', `%${query}%`)
      .order('usage_count', { ascending: false })
      .limit(10);

    if (error) {
      throw new Error(`Erro ao buscar tags: ${error.message}`);
    }

    return data || [];
  }

  async createTag(input: CreateTagInput): Promise<ProcessoTag> {
    await this.ensureIsAdmin();

    if (!input.name || input.name.trim().length === 0) {
      throw new Error('Nome da tag é obrigatório');
    }

    if (!input.color || !isValidHexColor(input.color)) {
      throw new Error('Cor inválida. Use formato hexadecimal (#RRGGBB)');
    }

    const slug = input.slug || generateTagSlug(input.name);

    const { data: existingByName } = await supabase
      .from('processo_tags')
      .select('id')
      .eq('name', input.name)
      .single();

    if (existingByName) {
      throw new Error('Já existe uma tag com este nome');
    }

    const { data: existingBySlug } = await supabase
      .from('processo_tags')
      .select('id')
      .eq('slug', slug)
      .single();

    if (existingBySlug) {
      throw new Error('Já existe uma tag com este slug');
    }

    const { data: user } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('processo_tags')
      .insert({
        name: input.name.trim(),
        slug,
        color: input.color,
        description: input.description?.trim() || null,
        is_active: input.is_active ?? true,
        display_order: input.display_order ?? 0,
        created_by: user.user?.id || null
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao criar tag: ${error.message}`);
    }

    this.tagsCache = null;

    return data;
  }

  async updateTag(tagId: string, input: UpdateTagInput): Promise<ProcessoTag> {
    await this.ensureIsAdmin();

    if (input.name && input.name.trim().length === 0) {
      throw new Error('Nome da tag não pode ser vazio');
    }

    if (input.color && !isValidHexColor(input.color)) {
      throw new Error('Cor inválida. Use formato hexadecimal (#RRGGBB)');
    }

    const updateData: any = {};

    if (input.name !== undefined) {
      updateData.name = input.name.trim();

      const { data: existing } = await supabase
        .from('processo_tags')
        .select('id')
        .eq('name', updateData.name)
        .neq('id', tagId)
        .single();

      if (existing) {
        throw new Error('Já existe uma tag com este nome');
      }
    }

    if (input.slug !== undefined) {
      updateData.slug = input.slug;

      const { data: existing } = await supabase
        .from('processo_tags')
        .select('id')
        .eq('slug', updateData.slug)
        .neq('id', tagId)
        .single();

      if (existing) {
        throw new Error('Já existe uma tag com este slug');
      }
    }

    if (input.color !== undefined) updateData.color = input.color;
    if (input.description !== undefined) updateData.description = input.description?.trim() || null;
    if (input.is_active !== undefined) updateData.is_active = input.is_active;
    if (input.display_order !== undefined) updateData.display_order = input.display_order;

    const { data, error } = await supabase
      .from('processo_tags')
      .update(updateData)
      .eq('id', tagId)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao atualizar tag: ${error.message}`);
    }

    this.tagsCache = null;

    return data;
  }

  async deleteTag(tagId: string, forceDelete = false): Promise<void> {
    await this.ensureIsAdmin();

    const tag = await this.getTagById(tagId);

    if (tag.usage_count > 0 && !forceDelete) {
      await this.updateTag(tagId, { is_active: false });
      this.tagsCache = null;
      return;
    }

    const { error } = await supabase
      .from('processo_tags')
      .delete()
      .eq('id', tagId);

    if (error) {
      throw new Error(`Erro ao deletar tag: ${error.message}`);
    }

    this.tagsCache = null;
  }

  async reorderTags(tagIds: string[]): Promise<void> {
    await this.ensureIsAdmin();

    const updates = tagIds.map((tagId, index) => ({
      id: tagId,
      display_order: index
    }));

    for (const update of updates) {
      const { error } = await supabase
        .from('processo_tags')
        .update({ display_order: update.display_order })
        .eq('id', update.id);

      if (error) {
        throw new Error(`Erro ao reordenar tags: ${error.message}`);
      }
    }

    this.tagsCache = null;
  }

  async getTagsStatistics(): Promise<TagStatistics[]> {
    await this.ensureIsAdmin();

    const { data: tags, error: tagsError } = await supabase
      .from('processo_tags')
      .select('*')
      .order('usage_count', { ascending: false });

    if (tagsError) {
      throw new Error(`Erro ao buscar estatísticas: ${tagsError.message}`);
    }

    const statistics: TagStatistics[] = await Promise.all(
      (tags || []).map(async (tag) => {
        const { data: lastAssignment } = await supabase
          .from('processo_tag_assignments')
          .select('assigned_at, processo_id')
          .eq('tag_id', tag.id)
          .order('assigned_at', { ascending: false })
          .limit(1)
          .single();

        return {
          tag_id: tag.id,
          tag_name: tag.name,
          tag_color: tag.color,
          usage_count: tag.usage_count,
          last_used_at: lastAssignment?.assigned_at || null,
          most_recent_processo: lastAssignment?.processo_id || null
        };
      })
    );

    return statistics;
  }

  clearCache(): void {
    this.tagsCache = null;
  }
}

export const ProcessoTagsService = new ProcessoTagsServiceClass();
