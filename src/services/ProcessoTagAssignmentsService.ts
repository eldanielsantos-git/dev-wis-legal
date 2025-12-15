import { supabase } from '../lib/supabase';
import type { Processo, ProcessoTag } from '../lib/supabase';

class ProcessoTagAssignmentsServiceClass {
  async assignTagsToProcesso(processoId: string, tagIds: string[]): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Usuário não autenticado');
    }

    const { data: processo, error: processoError } = await supabase
      .from('processos')
      .select('user_id')
      .eq('id', processoId)
      .single();

    if (processoError) {
      throw new Error('Processo não encontrado');
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    const isAdmin = profile?.is_admin || false;
    const isOwner = processo.user_id === user.id;

    const { data: workspaceShare } = await supabase
      .from('workspace_shares')
      .select('permission_level, invitation_status')
      .eq('processo_id', processoId)
      .eq('shared_with_user_id', user.id)
      .eq('invitation_status', 'accepted')
      .maybeSingle();

    const isEditor = workspaceShare?.permission_level === 'editor';

    if (!isOwner && !isAdmin && !isEditor) {
      throw new Error('Você não tem permissão para adicionar tags a este processo');
    }

    const assignments = tagIds.map(tagId => ({
      processo_id: processoId,
      tag_id: tagId,
      assigned_by: user.id
    }));

    const { error } = await supabase
      .from('processo_tag_assignments')
      .upsert(assignments, { onConflict: 'processo_id,tag_id' });

    if (error) {
      throw new Error(`Erro ao atribuir tags: ${error.message}`);
    }
  }

  async removeTagFromProcesso(processoId: string, tagId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Usuário não autenticado');
    }

    const { data: processo, error: processoError } = await supabase
      .from('processos')
      .select('user_id')
      .eq('id', processoId)
      .single();

    if (processoError) {
      throw new Error('Processo não encontrado');
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    const isAdmin = profile?.is_admin || false;
    const isOwner = processo.user_id === user.id;

    const { data: workspaceShare } = await supabase
      .from('workspace_shares')
      .select('permission_level, invitation_status')
      .eq('processo_id', processoId)
      .eq('shared_with_user_id', user.id)
      .eq('invitation_status', 'accepted')
      .maybeSingle();

    const isEditor = workspaceShare?.permission_level === 'editor';

    if (!isOwner && !isAdmin && !isEditor) {
      throw new Error('Você não tem permissão para remover tags deste processo');
    }

    const { error } = await supabase
      .from('processo_tag_assignments')
      .delete()
      .eq('processo_id', processoId)
      .eq('tag_id', tagId);

    if (error) {
      throw new Error(`Erro ao remover tag: ${error.message}`);
    }
  }

  async removeAllTagsFromProcesso(processoId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Usuário não autenticado');
    }

    const { data: processo, error: processoError } = await supabase
      .from('processos')
      .select('user_id')
      .eq('id', processoId)
      .single();

    if (processoError) {
      throw new Error('Processo não encontrado');
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    const isAdmin = profile?.is_admin || false;
    const isOwner = processo.user_id === user.id;

    const { data: workspaceShare } = await supabase
      .from('workspace_shares')
      .select('permission_level, invitation_status')
      .eq('processo_id', processoId)
      .eq('shared_with_user_id', user.id)
      .eq('invitation_status', 'accepted')
      .maybeSingle();

    const isEditor = workspaceShare?.permission_level === 'editor';

    if (!isOwner && !isAdmin && !isEditor) {
      throw new Error('Você não tem permissão para remover tags deste processo');
    }

    const { error } = await supabase
      .from('processo_tag_assignments')
      .delete()
      .eq('processo_id', processoId);

    if (error) {
      throw new Error(`Erro ao remover tags: ${error.message}`);
    }
  }

  async replaceProcessoTags(processoId: string, tagIds: string[]): Promise<void> {
    await this.removeAllTagsFromProcesso(processoId);

    if (tagIds.length > 0) {
      await this.assignTagsToProcesso(processoId, tagIds);
    }
  }

  async getProcessosByTagIds(
    tagIds: string[],
    userId?: string,
    matchAll = false
  ): Promise<Processo[]> {
    if (tagIds.length === 0) {
      return [];
    }

    let query = supabase
      .from('processos')
      .select(`
        *,
        user_profiles!processos_user_id_fkey (
          first_name,
          last_name,
          email
        )
      `);

    if (userId) {
      query = query.eq('user_id', userId);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        query = query.eq('user_id', user.id);
      }
    }

    const { data: allProcessos, error } = await query;

    if (error) {
      throw new Error(`Erro ao buscar processos: ${error.message}`);
    }

    if (!allProcessos || allProcessos.length === 0) {
      return [];
    }

    const processoIds = allProcessos.map(p => p.id);

    const { data: assignments, error: assignmentsError } = await supabase
      .from('processo_tag_assignments')
      .select('processo_id, tag_id')
      .in('processo_id', processoIds)
      .in('tag_id', tagIds);

    if (assignmentsError) {
      throw new Error(`Erro ao buscar atribuições: ${assignmentsError.message}`);
    }

    const processoTagMap = new Map<string, Set<string>>();
    (assignments || []).forEach(assignment => {
      if (!processoTagMap.has(assignment.processo_id)) {
        processoTagMap.set(assignment.processo_id, new Set());
      }
      processoTagMap.get(assignment.processo_id)!.add(assignment.tag_id);
    });

    const filteredProcessos = allProcessos.filter(processo => {
      const processoTags = processoTagMap.get(processo.id);
      if (!processoTags) return false;

      if (matchAll) {
        return tagIds.every(tagId => processoTags.has(tagId));
      } else {
        return tagIds.some(tagId => processoTags.has(tagId));
      }
    });

    for (const processo of filteredProcessos) {
      const { data: tags } = await supabase
        .from('processo_tag_assignments')
        .select(`
          processo_tags (*)
        `)
        .eq('processo_id', processo.id);

      processo.tags = (tags || [])
        .map(t => t.processo_tags)
        .filter(tag => tag !== null) as ProcessoTag[];
    }

    filteredProcessos.sort((a, b) => {
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

    return filteredProcessos;
  }

  async getProcessosCountByTag(tagId: string): Promise<number> {
    const { count, error } = await supabase
      .from('processo_tag_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('tag_id', tagId);

    if (error) {
      throw new Error(`Erro ao contar processos: ${error.message}`);
    }

    return count || 0;
  }

  async getTagsByProcessoId(processoId: string): Promise<ProcessoTag[]> {
    const { data, error } = await supabase
      .from('processo_tag_assignments')
      .select(`
        processo_tags (*)
      `)
      .eq('processo_id', processoId)
      .order('assigned_at', { ascending: false });

    if (error) {
      throw new Error(`Erro ao buscar tags: ${error.message}`);
    }

    return (data || [])
      .map(item => item.processo_tags)
      .filter(tag => tag !== null) as ProcessoTag[];
  }
}

export const ProcessoTagAssignmentsService = new ProcessoTagAssignmentsServiceClass();
