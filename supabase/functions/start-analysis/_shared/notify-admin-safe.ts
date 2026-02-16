export interface NotifyAdminParams {
  type: string;
  title: string;
  message: string;
  severity?: 'critical' | 'high' | 'medium' | 'low' | 'success' | 'info';
  metadata?: Record<string, unknown>;
  userId?: string;
  processoId?: string;
}

export async function notifyAdminSafe(params: NotifyAdminParams): Promise<{ success: boolean; error?: string }> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const notificationsEnabled = Deno.env.get('ADMIN_NOTIFICATIONS_ENABLED');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.warn('[notify-admin-safe] Missing Supabase credentials, skipping notification');
      return { success: false, error: 'Missing credentials' };
    }

    if (notificationsEnabled === 'false') {
      console.log('[notify-admin-safe] Notifications disabled by flag, skipping');
      return { success: true };
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

    console.log('[notify-admin-safe] Sending notification to:', url);
    console.log('[notify-admin-safe] Payload:', JSON.stringify(payload, null, 2));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[notify-admin-safe] Notification request failed:', response.status, errorText);
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }

    const result = await response.json();
    console.log('[notify-admin-safe] Notification sent successfully:', result);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[notify-admin-safe] Critical error:', errorMessage);
    return { success: false, error: errorMessage };
  }
}
