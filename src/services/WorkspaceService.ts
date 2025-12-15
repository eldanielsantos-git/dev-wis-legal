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
    file_name: string;
    file_size: number;
    nome_processo: string;
    status: string;
    created_at: string;
    transcricao?: any;
    tokens_consumed?: number;
    total_prompts?: number;
    current_prompt_number?: number;
    current_llm_model_name?: string;
    last_error_type?: string;
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

      // Verificar se o usuário é dono do processo
      const { data: processo } = await supabase
        .from('processos')
        .select('user_id')
        .eq('id', request.processoId)
        .maybeSingle();

      if (!processo || processo.user_id !== user.id) {
        return {
          success: false,
          error: 'Você não tem permissão para compartilhar este processo'
        };
      }

      // Check if invited user already has an account
      const { data: invitedUser } = await supabase
        .from('user_profiles')
        .select('id, email')
        .eq('email', request.email.toLowerCase())
        .maybeSingle();

      // Check if share already exists for this processo and email
      const { data: existingShare } = await supabase
        .from('workspace_shares')
        .select('id, permission_level')
        .eq('processo_id', request.processoId)
        .eq('shared_with_email', request.email.toLowerCase())
        .maybeSingle();

      let share;
      let error;

      if (existingShare) {
        // Update existing share permission if different
        if (existingShare.permission_level !== request.permissionLevel) {
          const result = await supabase
            .from('workspace_shares')
            .update({
              permission_level: request.permissionLevel,
              shared_with_user_id: invitedUser?.id || existingShare.shared_with_user_id,
              shared_with_name: request.name,
              invitation_status: invitedUser ? 'accepted' : 'pending',
              updated_at: new Date().toISOString()
            })
            .eq('id', existingShare.id)
            .select()
            .single();

          share = result.data;
          error = result.error;
        } else {
          // Permission is the same, just return existing share
          const result = await supabase
            .from('workspace_shares')
            .select()
            .eq('id', existingShare.id)
            .single();

          share = result.data;
          error = result.error;
        }
      } else {
        // Create new share
        const result = await supabase
          .from('workspace_shares')
          .insert({
            processo_id: request.processoId,
            owner_user_id: user.id,
            shared_with_user_id: invitedUser?.id || null,
            shared_with_email: request.email.toLowerCase(),
            shared_with_name: request.name,
            permission_level: request.permissionLevel,
            invitation_status: invitedUser ? 'accepted' : 'pending'
          })
          .select()
          .single();

        share = result.data;
        error = result.error;
      }

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

      console.log('📧 Calling send-workspace-invite edge function...');
      console.log('📧 URL:', `${supabaseUrl}/functions/v1/send-workspace-invite`);
      console.log('📧 Payload:', {
        shareId: share.id,
        processoId: request.processoId,
        invitedEmail: request.email,
        invitedName: request.name,
        permissionLevel: request.permissionLevel,
        userExists: !!invitedUser
      });

      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/send-workspace-invite`, {
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

        console.log('📧 Response status:', response.status);

        const responseData = await response.json();
        console.log('📧 Response data:', responseData);

        if (!response.ok) {
          console.error('❌ Edge function returned error:', responseData);
        } else {
          console.log('✅ Email invitation sent successfully');
        }
      } catch (emailError) {
        console.error('❌ Error calling edge function:', emailError);
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

      const { data: shares, error } = await supabase
        .from('workspace_shares')
        .select('*')
        .or(`shared_with_user_id.eq.${user.id},shared_with_email.eq.${user.email}`)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching shared processes:', error);
        return [];
      }

      if (!shares || shares.length === 0) {
        return [];
      }

      // Fetch processo details separately
      const processoIds = shares.map(s => s.processo_id);
      const { data: processos } = await supabase
        .from('processos')
        .select('id, file_name, file_size, status, created_at, transcricao, tokens_consumed, total_prompts, current_prompt_number, current_llm_model_name, last_error_type')
        .in('id', processoIds);

      // Fetch owner details separately
      const ownerIds = [...new Set(shares.map(s => s.owner_user_id))];
      const { data: owners } = await supabase
        .from('user_profiles')
        .select('id, first_name, last_name, email')
        .in('id', ownerIds);

      // Combine data
      return shares.map(share => ({
        ...share,
        processo: processos?.find(p => p.id === share.processo_id),
        owner: owners?.find(o => o.id === share.owner_user_id)
      }));
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

      const { data: shares, error } = await supabase
        .from('workspace_shares')
        .select('*')
        .eq('owner_user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching my shares:', error);
        return [];
      }

      if (!shares || shares.length === 0) {
        return [];
      }

      // Fetch processo details separately
      const processoIds = shares.map(s => s.processo_id);
      const { data: processos } = await supabase
        .from('processos')
        .select('id, file_name, file_size, status, created_at, transcricao, tokens_consumed, total_prompts, current_prompt_number, current_llm_model_name, last_error_type')
        .in('id', processoIds);

      // Combine data
      return shares.map(share => ({
        ...share,
        processo: processos?.find(p => p.id === share.processo_id)
      }));
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
  static async subscribeToShares(callback: () => void) {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return undefined;
      }

      const subscription = supabase
        .channel(`workspace-shares-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'workspace_shares',
            filter: `shared_with_user_id=eq.${user.id}`
          },
          callback
        )
        .subscribe();

      return () => {
        supabase.removeChannel(subscription);
      };
    } catch (error) {
      console.error('Error subscribing to shares:', error);
      return undefined;
    }
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
