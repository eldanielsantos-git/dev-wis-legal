import { supabase } from '../lib/supabase';

export interface WorkspaceShare {
  id: string;
  processo_id: string;
  owner_user_id: string;
  shared_with_user_id: string | null;
  shared_with_email: string;
  shared_with_name: string;
  permission_level: 'read_only' | 'editor';
  invitation_status: 'pending' | 'accepted';
  created_at: string;
  updated_at: string;
  processo?: {
    id: string;
    numero_processo: string;
    nome_processo: string;
    status: string;
    created_at: string;
  };
  owner?: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

export interface ShareProcessRequest {
  processoId: string;
  email: string;
  name: string;
  permissionLevel: 'read_only' | 'editor';
}

export interface ShareProcessResponse {
  success: boolean;
  error?: string;
  share?: WorkspaceShare;
}

export class WorkspaceService {
  /**
   * Check if a process can be shared (must be completed)
   */
  static async canShare(processoId: string): Promise<{ canShare: boolean; reason?: string }> {
    try {
      const { data: processo, error } = await supabase
        .from('processos')
        .select('status, user_id')
        .eq('id', processoId)
        .single();

      if (error) {
        return { canShare: false, reason: 'Processo não encontrado' };
      }

      const { data: { user } } = await supabase.auth.getUser();

      if (!user || processo.user_id !== user.id) {
        return { canShare: false, reason: 'Você não tem permissão para compartilhar este processo' };
      }

      if (processo.status !== 'completed') {
        return { canShare: false, reason: 'Aguarde a análise ser concluída para compartilhar' };
      }

      return { canShare: true };
    } catch (error) {
      console.error('Error checking if process can be shared:', error);
      return { canShare: false, reason: 'Erro ao verificar processo' };
    }
  }

  /**
   * Share a process with another user
   */
  static async shareProcess(request: ShareProcessRequest): Promise<ShareProcessResponse> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return {
          success: false,
          error: 'Você precisa estar autenticado para compartilhar processos'
        };
      }

      // Check if user is trying to share with themselves
      if (request.email.toLowerCase() === user.email?.toLowerCase()) {
        return {
          success: false,
          error: 'Você não pode compartilhar um processo consigo mesmo'
        };
      }

      // Check if process can be shared
      const canShareResult = await this.canShare(request.processoId);
      if (!canShareResult.canShare) {
        return {
          success: false,
          error: canShareResult.reason
        };
      }

      // Check if already shared with this email
      const { data: existingShare } = await supabase
        .from('workspace_shares')
        .select('id')
        .eq('processo_id', request.processoId)
        .eq('shared_with_email', request.email.toLowerCase())
        .maybeSingle();

      if (existingShare) {
        return {
          success: false,
          error: 'Este processo já foi compartilhado com este usuário'
        };
      }

      // Check if invited user already has an account
      const { data: invitedUser } = await supabase
        .from('user_profiles')
        .select('user_id, email')
        .eq('email', request.email.toLowerCase())
        .maybeSingle();

      // Create the share
      const { data: share, error } = await supabase
        .from('workspace_shares')
        .insert({
          processo_id: request.processoId,
          owner_user_id: user.id,
          shared_with_user_id: invitedUser?.user_id || null,
          shared_with_email: request.email.toLowerCase(),
          shared_with_name: request.name,
          permission_level: request.permissionLevel,
          invitation_status: invitedUser ? 'accepted' : 'pending'
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating share:', error);
        return {
          success: false,
          error: 'Erro ao compartilhar processo'
        };
      }

      // Send invitation email via Edge Function
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const { data: { session } } = await supabase.auth.getSession();

      try {
        await fetch(`${supabaseUrl}/functions/v1/send-workspace-invite`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            shareId: share.id,
            processoId: request.processoId,
            invitedEmail: request.email,
            invitedName: request.name,
            permissionLevel: request.permissionLevel,
            userExists: !!invitedUser
          })
        });
      } catch (emailError) {
        console.error('Error sending invitation email:', emailError);
      }

      return {
        success: true,
        share
      };
    } catch (error) {
      console.error('Error in shareProcess:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao compartilhar processo'
      };
    }
  }

  /**
   * Get all processes shared with the current user
   */
  static async getSharedWithMe(): Promise<WorkspaceShare[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return [];
      }

      const { data, error } = await supabase
        .from('workspace_shares')
        .select(`
          *,
          processo:processos!workspace_shares_processo_id_fkey(
            id,
            numero_processo,
            nome_processo,
            status,
            created_at
          ),
          owner:user_profiles!workspace_shares_owner_user_id_fkey(
            first_name,
            last_name,
            email
          )
        `)
        .or(`shared_with_user_id.eq.${user.id},shared_with_email.eq.${user.email}`)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching shared processes:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getSharedWithMe:', error);
      return [];
    }
  }

  /**
   * Get all shares for a specific process
   */
  static async getProcessShares(processoId: string): Promise<WorkspaceShare[]> {
    try {
      const { data, error } = await supabase
        .from('workspace_shares')
        .select('*')
        .eq('processo_id', processoId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching process shares:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getProcessShares:', error);
      return [];
    }
  }

  /**
   * Get shares created by the current user
   */
  static async getMyShares(): Promise<WorkspaceShare[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return [];
      }

      const { data, error } = await supabase
        .from('workspace_shares')
        .select(`
          *,
          processo:processos!workspace_shares_processo_id_fkey(
            id,
            numero_processo,
            nome_processo,
            status,
            created_at
          )
        `)
        .eq('owner_user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching my shares:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getMyShares:', error);
      return [];
    }
  }

  /**
   * Update share permission level
   */
  static async updateSharePermission(
    shareId: string,
    permissionLevel: 'read_only' | 'editor'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('workspace_shares')
        .update({ permission_level: permissionLevel })
        .eq('id', shareId);

      if (error) {
        console.error('Error updating share permission:', error);
        return {
          success: false,
          error: 'Erro ao atualizar permissão'
        };
      }

      return { success: true };
    } catch (error) {
      console.error('Error in updateSharePermission:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao atualizar permissão'
      };
    }
  }

  /**
   * Remove a share
   */
  static async removeShare(shareId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('workspace_shares')
        .delete()
        .eq('id', shareId);

      if (error) {
        console.error('Error removing share:', error);
        return {
          success: false,
          error: 'Erro ao remover compartilhamento'
        };
      }

      return { success: true };
    } catch (error) {
      console.error('Error in removeShare:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao remover compartilhamento'
      };
    }
  }

  /**
   * Check if user has access to a process
   */
  static async hasAccess(
    processoId: string
  ): Promise<{ hasAccess: boolean; permission?: 'owner' | 'read_only' | 'editor' }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return { hasAccess: false };
      }

      // Check if user is the owner
      const { data: processo } = await supabase
        .from('processos')
        .select('user_id')
        .eq('id', processoId)
        .maybeSingle();

      if (processo?.user_id === user.id) {
        return { hasAccess: true, permission: 'owner' };
      }

      // Check if process is shared with user
      const { data: share } = await supabase
        .from('workspace_shares')
        .select('permission_level')
        .eq('processo_id', processoId)
        .or(`shared_with_user_id.eq.${user.id},shared_with_email.eq.${user.email}`)
        .maybeSingle();

      if (share) {
        return { hasAccess: true, permission: share.permission_level };
      }

      return { hasAccess: false };
    } catch (error) {
      console.error('Error checking access:', error);
      return { hasAccess: false };
    }
  }

  /**
   * Check if user can delete a process
   */
  static async canDelete(processoId: string): Promise<boolean> {
    const accessResult = await this.hasAccess(processoId);
    return accessResult.permission === 'owner' || accessResult.permission === 'editor';
  }

  /**
   * Subscribe to changes in workspace shares for the current user
   */
  static subscribeToShares(callback: () => void) {
    const { data: { user } } = supabase.auth.getUser();

    user.then((userData) => {
      if (!userData.user) return;

      const subscription = supabase
        .channel(`workspace-shares-${userData.user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'workspace_shares',
            filter: `shared_with_user_id=eq.${userData.user.id}`
          },
          callback
        )
        .subscribe();

      return () => {
        supabase.removeChannel(subscription);
      };
    });
  }

  /**
   * Count shares for current user
   */
  static async countShares(): Promise<{ sharedWithMe: number; myShares: number }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return { sharedWithMe: 0, myShares: 0 };
      }

      const [sharedWithMeResult, mySharesResult] = await Promise.all([
        supabase
          .from('workspace_shares')
          .select('id', { count: 'exact', head: true })
          .or(`shared_with_user_id.eq.${user.id},shared_with_email.eq.${user.email}`),
        supabase
          .from('workspace_shares')
          .select('id', { count: 'exact', head: true })
          .eq('owner_user_id', user.id)
      ]);

      return {
        sharedWithMe: sharedWithMeResult.count || 0,
        myShares: mySharesResult.count || 0
      };
    } catch (error) {
      console.error('Error counting shares:', error);
      return { sharedWithMe: 0, myShares: 0 };
    }
  }
}
