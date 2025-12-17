export type NotificationSeverity = 'critical' | 'high' | 'medium' | 'low' | 'success';

interface SlackMessage {
  webhookUrl: string;
  severity: NotificationSeverity;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

interface SlackResponse {
  success: boolean;
  messageId?: string;
  response?: unknown;
  error?: string;
}

const severityColors: Record<NotificationSeverity, string> = {
  critical: '#DC2626',  // red-600
  high: '#EA580C',     // orange-600
  medium: '#F59E0B',   // amber-500
  low: '#3B82F6',      // blue-500
  success: '#10B981',  // green-500
};

const severityEmojis: Record<NotificationSeverity, string> = {
  critical: '��',
  high: '⚠️',
  medium: '⚡',
  low: 'ℹ️',
  success: '✅',
};

export async function sendToSlack(message: SlackMessage): Promise<SlackResponse> {
  try {
    const { webhookUrl, severity, title, message: text, metadata } = message;

    const color = severityColors[severity];
    const emoji = severityEmojis[severity];

    const payload = {
      attachments: [
        {
          color,
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: `${emoji} ${title}`,
                emoji: true,
              },
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text,
              },
            },
            ...(metadata && Object.keys(metadata).length > 0
              ? [
                  {
                    type: 'section',
                    fields: Object.entries(metadata).map(([key, value]) => ({
                      type: 'mrkdwn',
                      text: `*${key}:*\n${JSON.stringify(value)}`,
                    })),
                  },
                ]
              : []),
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: `Severity: *${severity}* | ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
                },
              ],
            },
          ],
        },
      ],
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Slack API error: ${response.status} - ${errorText}`,
      };
    }

    return {
      success: true,
      response: await response.text(),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error sending to Slack',
    };
  }
}