import { supabase } from '../lib/supabase';

export interface NotificationType {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: 'success' | 'error' | 'warning' | 'info' | 'system' | 'integration' | 'infrastructure';
  default_severity: 'critical' | 'high' | 'medium' | 'low' | 'success';
  icon: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotificationConfig {
  id: string;
  notification_type_id: string;
  is_enabled: boolean;
  notify_slack: boolean;
  updated_by: string | null;
  updated_at: string;
}

export interface NotificationTypeWithConfig extends NotificationType {
  config: NotificationConfig | null;
}

export interface AdminNotification {
  id: string;
  notification_type_id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'success';
  title: string;
  message: string;
  metadata: Record<string, unknown>;
  sent_to_slack: boolean;
  slack_message_id: string | null;
  slack_response: unknown;
  error_message: string | null;
  created_at: string;
  user_id: string | null;
  processo_id: string | null;
  notification_type?: NotificationType;
}

export interface NotificationStats {
  total_today: number;
  total_last_24h: number;
  by_severity: Record<string, number>;
  by_category: Record<string, number>;
  sent_to_slack: number;
  failed_slack: number;
}

export interface FetchNotificationsParams {
  limit?: number;
  offset?: number;
  category?: string;
  severity?: string;
  sent_to_slack?: boolean;
  start_date?: string;
  end_date?: string;
  search?: string;
}

class AdminNotificationsService {
  async fetchNotificationTypes(): Promise<{ success: boolean; data?: NotificationTypeWithConfig[]; error?: string }> {
    try {
      const { data: types, error: typesError } = await supabase
        .from('admin_notification_types')
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (typesError) throw typesError;
      if (!types) return { success: false, error: 'No types found' };

      const { data: configs, error: configsError } = await supabase
        .from('admin_notification_config')
        .select('*');

      if (configsError) throw configsError;

      const typesWithConfig: NotificationTypeWithConfig[] = types.map(type => ({
        ...type,
        config: configs?.find(c => c.notification_type_id === type.id) || null,
      }));

      return { success: true, data: typesWithConfig };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async fetchNotifications(params: FetchNotificationsParams = {}): Promise<{ success: boolean; data?: AdminNotification[]; count?: number; error?: string }> {
    try {
      const {
        limit = 50,
        offset = 0,
        category,
        severity,
        sent_to_slack,
        start_date,
        end_date,
        search,
      } = params;

      let query = supabase
        .from('admin_notifications')
        .select(`
          *,
          notification_type:admin_notification_types(*)
        `, { count: 'exact' })
        .order('created_at', { ascending: false });

      if (severity) {
        query = query.eq('severity', severity);
      }

      if (sent_to_slack !== undefined) {
        query = query.eq('sent_to_slack', sent_to_slack);
      }

      if (start_date) {
        query = query.gte('created_at', start_date);
      }

      if (end_date) {
        query = query.lte('created_at', end_date);
      }

      if (search) {
        query = query.or(`title.ilike.%${search}%,message.ilike.%${search}%`);
      }

      if (category) {
        const { data: typeIds } = await supabase
          .from('admin_notification_types')
          .select('id')
          .eq('category', category);

        if (typeIds && typeIds.length > 0) {
          query = query.in('notification_type_id', typeIds.map(t => t.id));
        }
      }

      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) throw error;

      return { success: true, data: data || [], count: count || 0 };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async fetchNotificationStats(): Promise<{ success: boolean; data?: NotificationStats; error?: string }> {
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

      const { count: totalToday } = await supabase
        .from('admin_notifications')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today);

      const { count: totalLast24h } = await supabase
        .from('admin_notifications')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', last24h);

      const { data: allNotifications } = await supabase
        .from('admin_notifications')
        .select(`
          severity,
          sent_to_slack,
          error_message,
          notification_type:admin_notification_types(category)
        `)
        .gte('created_at', last24h);

      const bySeverity: Record<string, number> = {};
      const byCategory: Record<string, number> = {};
      let sentToSlack = 0;
      let failedSlack = 0;

      allNotifications?.forEach(notification => {
        bySeverity[notification.severity] = (bySeverity[notification.severity] || 0) + 1;

        if (notification.notification_type) {
          const category = (notification.notification_type as any).category;
          byCategory[category] = (byCategory[category] || 0) + 1;
        }

        if (notification.sent_to_slack) {
          sentToSlack++;
        }

        if (!notification.sent_to_slack && notification.error_message) {
          failedSlack++;
        }
      });

      return {
        success: true,
        data: {
          total_today: totalToday || 0,
          total_last_24h: totalLast24h || 0,
          by_severity: bySeverity,
          by_category: byCategory,
          sent_to_slack: sentToSlack,
          failed_slack: failedSlack,
        },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async updateNotificationConfig(
    notificationTypeId: string,
    updates: { is_enabled?: boolean; notify_slack?: boolean }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: existingConfig } = await supabase
        .from('admin_notification_config')
        .select('id')
        .eq('notification_type_id', notificationTypeId)
        .maybeSingle();

      if (existingConfig) {
        const { error } = await supabase
          .from('admin_notification_config')
          .update({
            ...updates,
            updated_at: new Date().toISOString(),
          })
          .eq('notification_type_id', notificationTypeId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('admin_notification_config')
          .insert({
            notification_type_id: notificationTypeId,
            ...updates,
          });

        if (error) throw error;
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async testSlackConnection(webhookUrl: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: 'Teste de conexão do Sistema de Notificações',
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: '✅ Teste de Conexão',
                emoji: true,
              },
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: 'Se você está vendo esta mensagem, a integração com o Slack está funcionando corretamente!',
              },
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: `⏰ ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
                },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`Slack returned status ${response.status}`);
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async sendTestNotification(typeSlug: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return { success: false, error: 'Not authenticated' };
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-admin-notification`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type_slug: typeSlug,
          title: 'Notificação de Teste',
          message: 'Esta é uma notificação de teste enviada manualmente pelo painel administrativo.',
          severity: 'low',
          metadata: {
            test: true,
            sent_by: session.user.email,
            sent_at: new Date().toISOString(),
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Edge function returned status ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || 'Failed to send notification');
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

export const adminNotificationsService = new AdminNotificationsService();
