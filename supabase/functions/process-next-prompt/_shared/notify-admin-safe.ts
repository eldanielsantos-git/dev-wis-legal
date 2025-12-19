export interface NotifyAdminParams {
  type: string;
  title: string;
  message: string;
  severity?: 'critical' | 'high' | 'medium' | 'low' | 'success';
  metadata?: Record<string, unknown>;
  userId?: string;
  processoId?: string;
}

export function notifyAdminSafe(params: NotifyAdminParams): void {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
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

    const url = `${supabaseUrl}/functions/v1/send-admin-notification`;

    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify(payload),
    })
      .then(response => {
        if (!response.ok) {
          console.warn('[notify-admin-safe] Notification request failed:', response.status);
        }
      })
      .catch(error => {
        console.warn('[notify-admin-safe] Notification error (ignored):', error.message);
      });
  } catch (error) {
    try {
      console.warn('[notify-admin-safe] Critical error (ignored):', error instanceof Error ? error.message : 'Unknown');
    } catch {
      // Ignore even logging errors
    }
  }
}