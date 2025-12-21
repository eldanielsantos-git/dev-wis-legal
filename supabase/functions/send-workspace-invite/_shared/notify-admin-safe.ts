interface NotifyAdminParams {
  type: string;
  title: string;
  message: string;
  severity?: 'critical' | 'high' | 'medium' | 'low' | 'success';
  metadata?: Record<string, any>;
  userId?: string;
  processoId?: string;
}

export async function notifyAdminSafe(params: NotifyAdminParams): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('[notify-admin-safe] Missing Supabase credentials, skipping notification');
      return;
    }

    const payload = {
      type_slug: params.type,
      title: params.title,
      message: params.message,
      severity: params.severity || 'low',
      metadata: params.metadata || {},
      user_id: params.userId || null,
      processo_id: params.processoId || null,
    };

    const response = await fetch(`${supabaseUrl}/functions/v1/send-admin-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[notify-admin-safe] Failed to send notification:', response.status, errorText);
    } else {
      console.log('[notify-admin-safe] Notification sent successfully');
    }
  } catch (error) {
    console.error('[notify-admin-safe] Error sending notification (non-blocking):', error);
  }
}