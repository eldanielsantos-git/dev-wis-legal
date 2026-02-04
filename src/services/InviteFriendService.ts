import { supabase } from '../lib/supabase';

interface InviteResponse {
  success: boolean;
  error?: string;
  invite?: {
    id: string;
    invitedName: string;
    invitedEmail: string;
    createdAt: string;
  };
}

interface InviteFriend {
  id: string;
  invited_name: string;
  invited_email: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export class InviteFriendService {
  static async sendInvite(invitedName: string, invitedEmail: string): Promise<InviteResponse> {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        return {
          success: false,
          error: 'Você precisa estar autenticado para enviar convites'
        };
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const apiUrl = `${supabaseUrl}/functions/v1/send-friend-invite`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invitedName,
          invitedEmail
        })
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Erro ao enviar convite'
        };
      }

      return {
        success: true,
        invite: data.invite
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao enviar convite'
      };
    }
  }

  static async getMyInvites(): Promise<InviteFriend[]> {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Você precisa estar autenticado');
      }

      const { data, error } = await supabase
        .from('invite_friend')
        .select('*')
        .eq('inviter_user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      throw error;
    }
  }

  static async countMyInvites(): Promise<{ total: number; pending: number; accepted: number }> {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        return { total: 0, pending: 0, accepted: 0 };
      }

      const { data, error } = await supabase
        .from('invite_friend')
        .select('status')
        .eq('inviter_user_id', session.user.id);

      if (error) {
        return { total: 0, pending: 0, accepted: 0 };
      }

      const total = data?.length || 0;
      const pending = data?.filter(i => i.status === 'pending').length || 0;
      const accepted = data?.filter(i => i.status === 'accepted').length || 0;

      return { total, pending, accepted };
    } catch (error) {
      return { total: 0, pending: 0, accepted: 0 };
    }
  }
}
