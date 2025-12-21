export interface NotifyAdminParams {
  type: string;
  title: string;
  message: string;
  severity?: 'critical' | 'high' | 'medium' | 'low' | 'success';
  metadata?: Record<string, unknown>;
  userId?: string;
  processoId?: string;
}

export async function notifyAdminSafe(params: NotifyAdminParams): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const notificationsEnabled = Deno.env.get('ADMIN_NOTIFICATIONS_ENABLED');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.warn('[notify-admin-safe] Missing Supabase credentials, skipping notification');
      return;
    }

    if (notificationsEnabled === 'false') {
      console.log('[notify-admin-safe] Notifications disabled by flag, skipping');
      return;
    }

    const payload = {
      type_slug: params.type,
      title: params.title,
      message: params.message,
      severity: params.severity,
      metadata: params.metadata || {},
      user_id: params.userId,
      processo_id: params.processoId,
    };

    const response = await fetch(`${supabaseUrl}/functions/v1/send-admin-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      console.log('[notify-admin-safe] ✅ Notificação admin enviada');
    } else {
      const errorText = await response.text();
      console.warn(`[notify-admin-safe] ⚠️ Falha ao enviar notificação admin: ${response.status} - ${errorText}`);
    }
  } catch (error) {
    console.warn('[notify-admin-safe] ⚠️ Erro ao notificar admin (não-crítico):', error instanceof Error ? error.message : 'Unknown');
  }
}
