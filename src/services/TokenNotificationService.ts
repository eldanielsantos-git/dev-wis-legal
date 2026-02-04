import { supabase } from '../lib/supabase';

export interface TokenLimitNotification {
  id: string;
  user_id: string;
  notification_type: '75_percent' | '90_percent' | '100_percent';
  tokens_total: number;
  tokens_used: number;
  percentage_used: number;
  email_sent: boolean;
  email_sent_at: string | null;
  created_at: string;
}

export interface TokenNotificationStats {
  total_notifications: number;
  sent_successfully: number;
  failed: number;
  by_type: {
    '75_percent': number;
    '90_percent': number;
    '100_percent': number;
  };
}

class TokenNotificationService {
  async triggerTokenLimitNotification(userId: string): Promise<{ success: boolean; message: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('send-tokens-limit', {
        body: { user_id: userId },
      });

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      throw error;
    }
  }

  async getUserNotifications(userId: string): Promise<TokenLimitNotification[]> {
    try {
      const { data, error } = await supabase
        .from('token_limit_notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      throw error;
    }
  }

  async getAllNotifications(limit: number = 50): Promise<TokenLimitNotification[]> {
    try {
      const { data, error } = await supabase
        .from('token_limit_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      throw error;
    }
  }

  async getNotificationStats(): Promise<TokenNotificationStats> {
    try {
      const { data, error } = await supabase
        .from('token_limit_notifications')
        .select('notification_type, email_sent');

      if (error) {
        throw error;
      }

      if (!data) {
        return {
          total_notifications: 0,
          sent_successfully: 0,
          failed: 0,
          by_type: {
            '75_percent': 0,
            '90_percent': 0,
            '100_percent': 0,
          },
        };
      }

      const stats: TokenNotificationStats = {
        total_notifications: data.length,
        sent_successfully: data.filter((n) => n.email_sent).length,
        failed: data.filter((n) => !n.email_sent).length,
        by_type: {
          '75_percent': data.filter((n) => n.notification_type === '75_percent').length,
          '90_percent': data.filter((n) => n.notification_type === '90_percent').length,
          '100_percent': data.filter((n) => n.notification_type === '100_percent').length,
        },
      };

      return stats;
    } catch (error) {
      throw error;
    }
  }

  async getPendingNotifications(): Promise<TokenLimitNotification[]> {
    try {
      const { data, error } = await supabase
        .from('token_limit_notifications')
        .select('*')
        .eq('email_sent', false)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      throw error;
    }
  }

  async retryFailedNotification(notificationId: string): Promise<{ success: boolean; message: string }> {
    try {
      const { data: notification, error: fetchError } = await supabase
        .from('token_limit_notifications')
        .select('user_id')
        .eq('id', notificationId)
        .maybeSingle();

      if (fetchError || !notification) {
        throw new Error('Notification not found');
      }

      return await this.triggerTokenLimitNotification(notification.user_id);
    } catch (error) {
      throw error;
    }
  }

  getNotificationTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      '75_percent': '75% - Alerta Preventivo',
      '90_percent': '90% - Alerta Urgente',
      '100_percent': '100% - Alerta Crítico',
    };
    return labels[type] || type;
  }

  getNotificationTypeColor(type: string): string {
    const colors: Record<string, string> = {
      '75_percent': 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
      '90_percent': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      '100_percent': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  }
}

export const tokenNotificationService = new TokenNotificationService();
