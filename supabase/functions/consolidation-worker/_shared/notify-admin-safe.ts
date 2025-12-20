export async function notifyAdminSafe(payload: any) {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.log('⏭️ Notificação admin ignorada: env vars ausentes');
      return;
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/send-admin-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      console.log('✅ Notificação admin enviada');
    } else {
      console.warn('⚠️ Falha ao enviar notificação admin:', response.status);
    }
  } catch (error) {
    console.warn('⚠️ Erro ao notificar admin (não-crítico):', error);
  }
}