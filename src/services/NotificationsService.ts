import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';

export interface Notification {
  id: string;
  user_id: string;
  processo_id: string | null;
  type: 'success' | 'error';
  message: string;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
  processo?: {
    file_name: string;
  };
}

export class NotificationsService {
  static async getNotifications(): Promise<Notification[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Erro ao buscar notificações: ${error.message}`);
    return data || [];
  }

  static async getUnreadCount(): Promise<{ success: number; error: number; total: number }> {
    const { data, error } = await supabase
      .from('notifications')
      .select('type')
      .eq('is_read', false);

    if (error) throw new Error(`Erro ao contar notificações não lidas: ${error.message}`);

    const success = data?.filter(n => n.type === 'success').length || 0;
    const errorCount = data?.filter(n => n.type === 'error').length || 0;
    const total = data?.length || 0;

    return { success, error: errorCount, total };
  }

  static async markAsRead(notificationId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('id', notificationId);

    if (error) throw new Error(`Erro ao marcar notificação como lida: ${error.message}`);
  }

  static async markAllAsRead(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    const { error } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .eq('is_read', false);

    if (error) throw new Error(`Erro ao marcar todas como lidas: ${error.message}`);
  }

  static async createNotification(notification: {
    type: 'success' | 'error';
    message: string;
    processo_id?: string | null;
  }): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: user.id,
        type: notification.type,
        message: notification.message,
        processo_id: notification.processo_id || null,
        is_read: false,
      });

    if (error) throw new Error(`Erro ao criar notificação: ${error.message}`);
  }

  static async deleteNotification(notificationId: string): Promise<void> {
    logger.log('NotificationsService', 'Deletando notificação:', notificationId);

    const { data, error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)
      .select();

    logger.log('NotificationsService', 'Resultado do delete:', { data, error, deletedCount: data?.length });

    if (error) {
      logger.error('NotificationsService', 'Erro ao deletar:', error);
      throw new Error(`Erro ao deletar notificação: ${error.message}`);
    }

    if (!data || data.length === 0) {
      logger.warn('NotificationsService', 'Nenhuma notificação foi deletada. Pode ser problema de permissão RLS.');
    }

    logger.log('NotificationsService', 'Notificação deletada com sucesso');
  }

  static async deleteAllNotifications(): Promise<void> {
    logger.log('NotificationsService', 'Deletando todas as notificações');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      logger.error('NotificationsService', 'Usuário não autenticado');
      throw new Error('Usuário não autenticado');
    }

    logger.log('NotificationsService', 'User ID:', user.id);

    const { data, error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', user.id)
      .select();

    logger.log('NotificationsService', 'Resultado do delete all:', { data, error, deletedCount: data?.length });

    if (error) {
      logger.error('NotificationsService', 'Erro ao deletar todas:', error);
      throw new Error(`Erro ao deletar todas as notificações: ${error.message}`);
    }

    if (!data || data.length === 0) {
      logger.warn('NotificationsService', 'Nenhuma notificação foi deletada. Pode ser problema de permissão RLS.');
    }

    logger.log('NotificationsService', 'Todas as notificações deletadas com sucesso. Total:', data?.length);
  }

  static subscribeToNotifications(callback: (notifications: Notification[]) => void) {
    return supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        async () => {
          const notifications = await this.getNotifications();
          callback(notifications);
        }
      )
      .subscribe();
  }
}
