export type NotificationSeverity = 'critical' | 'high' | 'medium' | 'low' | 'success';

export interface SlackMessage {
  text?: string;
  blocks?: Array<Record<string, unknown>>;
  attachments?: Array<{
    color?: string;
    blocks?: Array<Record<string, unknown>>;
  }>;
}

export interface SendToSlackParams {
  webhookUrl: string;
  severity: NotificationSeverity;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface SlackSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  response?: unknown;
}

const SEVERITY_CONFIG = {
  critical: {
    color: '#DC2626',
    emoji: '',
    label: '[CRÍTICO]',
  },
  high: {
    color: '#F59E0B',
    emoji: '',
    label: '[ALTO]',
  },
  medium: {
    color: '#FBBF24',
    emoji: '',
    label: '[MÉDIO]',
  },
  low: {
    color: '#3B82F6',
    emoji: '',
    label: '[BAIXO]',
  },
  success: {
    color: '#10B981',
    emoji: '',
    label: '[SUCESSO]',
  },
};

export async function sendToSlack(params: SendToSlackParams): Promise<SlackSendResult> {
  const { webhookUrl, severity, title, message, metadata = {} } = params;

  try {
    const config = SEVERITY_CONFIG[severity];
    const slackMessage = formatSlackMessage(config, title, message, metadata);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    let attempt = 0;
    const maxAttempts = 2;
    let lastError: Error | null = null;

    while (attempt < maxAttempts) {
      try {
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(slackMessage),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Slack API error: ${response.status} - ${errorText}`);
        }

        const responseData = await response.text();

        return {
          success: true,
          messageId: responseData,
          response: responseData,
        };
      } catch (error) {
        lastError = error as Error;
        attempt++;

        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    clearTimeout(timeoutId);

    console.error('[slack-client] Failed after retries:', lastError);
    return {
      success: false,
      error: lastError?.message || 'Unknown error',
    };
  } catch (error) {
    console.error('[slack-client] Critical error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

function formatSlackMessage(
  config: { color: string; emoji: string; label: string },
  title: string,
  message: string,
  metadata: Record<string, unknown>
): SlackMessage {
  const cleanMessage = message.replace(/\*\*/g, '*');

  const blocks: Array<Record<string, unknown>> = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: title,
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: cleanMessage,
      },
    },
  ];

  if (Object.keys(metadata).length > 0) {
    const fields = Object.entries(metadata)
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([key, value]) => ({
        type: 'mrkdwn',
        text: `*${formatKey(key)}:*\n${formatValue(value)}`,
      }));

    if (fields.length > 0) {
      blocks.push({
        type: 'section',
        fields: fields.slice(0, 10),
      });
    }
  }

  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `⏰ ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
      },
    ],
  });

  const mobilePreviewText = buildMobilePreview(config, title, message, metadata);

  return {
    text: mobilePreviewText,
    attachments: [
      {
        color: config.color,
        blocks,
      },
    ],
  };
}

function buildMobilePreview(
  config: { emoji: string; label: string },
  title: string,
  message: string,
  metadata: Record<string, unknown>
): string {
  if (message.includes('|')) {
    return `${title} | ${message}`;
  }

  const parts: string[] = [title];

  const userMatch = message.match(/\*Usuário:\*\s*([^\n]+)/);
  if (userMatch) {
    const userName = userMatch[1].replace(/\([^)]*\)/, '').trim();
    parts.push(userName);
  }

  const fileMatch = message.match(/\*Arquivo:\*\s*([^\n]+)/);
  if (fileMatch) {
    parts.push(fileMatch[1].trim());
  }

  if (metadata.error_type) {
    parts.push(String(metadata.error_type));
  }

  return parts.join(' | ');
}

function formatKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'N/A';
  }

  if (typeof value === 'boolean') {
    return value ? 'Sim' : 'Não';
  }

  if (typeof value === 'number') {
    return value.toLocaleString('pt-BR');
  }

  if (typeof value === 'object') {
    return '```' + JSON.stringify(value, null, 2) + '```';
  }

  return String(value);
}
