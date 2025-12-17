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
  { value: 'user_signup', label: 'Novo Usuário Cadastrado', icon: '🎉' },
  { value: 'subscription_created', label: 'Nova Assinatura', icon: '💳' },
  { value: 'subscription_cancelled', label: 'Assinatura Cancelada', icon: '❌' },
  { value: 'subscription_upgraded', label: 'Upgrade de Assinatura', icon: '⬆️' },
  { value: 'subscription_downgraded', label: 'Downgrade de Assinatura', icon: '⬇️' },
  { value: 'token_purchase', label: 'Compra de Tokens', icon: '🪙' },
  { value: 'analysis_completed', label: 'Análise Concluída', icon: '✅' },
  { value: 'analysis_failed', label: 'Análise Falhou', icon: '⚠️' },
] as const;

class SlackNotificationService {
  async getAllConfigs(): Promise<SlackNotificationConfig[]> {
    const { data, error } = await supabase
      .from('slack_notifications')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching Slack configurations:', error);
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
      console.error('Error fetching Slack configuration:', error);
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
      console.error('Error creating Slack configuration:', error);
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
      console.error('Error updating Slack configuration:', error);
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
      console.error('Error deleting Slack configuration:', error);
      throw new Error('Erro ao deletar configuração do Slack');
    }
  }

  async toggleActive(id: string, isActive: boolean): Promise<SlackNotificationConfig> {
    return this.updateConfig(id, { is_active: isActive });
  }

  async sendNotification(input: SendNotificationInput): Promise<void> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Configuração do Supabase não encontrada');
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;

    if (!accessToken) {
      throw new Error('Usuário não autenticado');
    }

    const apiUrl = `${supabaseUrl}/functions/v1/send-slack-notification`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey,
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Error sending Slack notification:', errorData);
      throw new Error(errorData.error || 'Erro ao enviar notificação para o Slack');
    }

    const result = await response.json();
    console.log('Slack notification sent:', result);
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
      console.error('Error testing webhook:', error);
      return false;
    }
  }

  getNotificationTypeLabel(type: string): string {
    const notificationType = NOTIFICATION_TYPES.find(nt => nt.value === type);
    return notificationType ? notificationType.label : type;
  }

  getNotificationTypeIcon(type: string): string {
    const notificationType = NOTIFICATION_TYPES.find(nt => nt.value === type);
    return notificationType ? notificationType.icon : '📢';
  }
}

export const slackNotificationService = new SlackNotificationService();
