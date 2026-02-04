import { supabase } from '../lib/supabase';

export interface SlackNotificationConfig {
  id: string;
  webhook_url: string;
  channel_name: string;
  is_active: boolean;
  notification_types: string[];
  created_at: string;
  updated_at: string;
}

export interface CreateSlackConfigInput {
  webhook_url: string;
  channel_name: string;
  notification_types: string[];
}

export interface UpdateSlackConfigInput {
  webhook_url?: string;
  channel_name?: string;
  is_active?: boolean;
  notification_types?: string[];
}

export interface SendNotificationInput {
  type: string;
  data: Record<string, unknown>;
}

export const NOTIFICATION_TYPES = [
  { value: 'user_signup', label: 'Novo Usuário Cadastrado' },
  { value: 'subscription_created', label: 'Nova Assinatura' },
  { value: 'subscription_cancelled', label: 'Assinatura Cancelada' },
  { value: 'subscription_upgraded', label: 'Upgrade de Assinatura' },
  { value: 'subscription_downgraded', label: 'Downgrade de Assinatura' },
  { value: 'token_purchase', label: 'Compra de Tokens' },
  { value: 'analysis_completed', label: 'Análise Concluída' },
  { value: 'analysis_failed', label: 'Análise Falhou' },
] as const;

class SlackNotificationService {
  async getAllConfigs(): Promise<SlackNotificationConfig[]> {
    const { data, error } = await supabase
      .from('slack_notifications')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error('Erro ao buscar configurações do Slack');
    }

    return data || [];
  }

  async getConfigById(id: string): Promise<SlackNotificationConfig | null> {
    const { data, error } = await supabase
      .from('slack_notifications')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error('Erro ao buscar configuração do Slack');
    }

    return data;
  }

  async createConfig(input: CreateSlackConfigInput): Promise<SlackNotificationConfig> {
    const { data, error } = await supabase
      .from('slack_notifications')
      .insert({
        webhook_url: input.webhook_url,
        channel_name: input.channel_name,
        notification_types: input.notification_types,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      throw new Error('Erro ao criar configuração do Slack');
    }

    return data;
  }

  async updateConfig(id: string, input: UpdateSlackConfigInput): Promise<SlackNotificationConfig> {
    const { data, error } = await supabase
      .from('slack_notifications')
      .update(input)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error('Erro ao atualizar configuração do Slack');
    }

    return data;
  }

  async deleteConfig(id: string): Promise<void> {
    const { error } = await supabase
      .from('slack_notifications')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error('Erro ao deletar configuração do Slack');
    }
  }

  async toggleActive(id: string, isActive: boolean): Promise<SlackNotificationConfig> {
    return this.updateConfig(id, { is_active: isActive });
  }

  async sendNotification(input: SendNotificationInput): Promise<void> {
    // DEPRECATED: This method is no longer used.
    // Notifications are now sent automatically through send-admin-notification edge function
    // when configured in admin_notification_config table.
    throw new Error('Este método está obsoleto. Use o sistema de notificações administrativas.');
  }

  async testWebhook(webhookUrl: string): Promise<boolean> {
    try {
      const testMessage = {
        text: '🔔 Teste de Webhook - WiseAnalytics',
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '🔔 Mensagem de Teste',
              emoji: true,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: 'Esta é uma mensagem de teste do WiseAnalytics.\nSe você está vendo isso, o webhook está funcionando corretamente!',
            },
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `Enviado em: ${new Date().toLocaleString('pt-BR')}`,
              },
            ],
          },
        ],
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testMessage),
      });

      return response.ok;
    } catch (error) {
      return false;
    }
  }

  getNotificationTypeLabel(type: string): string {
    const notificationType = NOTIFICATION_TYPES.find(nt => nt.value === type);
    return notificationType ? notificationType.label : type;
  }
}

export const slackNotificationService = new SlackNotificationService();
