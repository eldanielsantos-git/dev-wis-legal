export async function notifyAdminSafe(data: any) {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.warn('⚠️ Admin notification skipped: missing env vars');
      return;
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/send-admin-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      console.warn('⚠️ Admin notification failed:', await response.text());
    }
  } catch (error) {
    console.warn('⚠️ Admin notification error:', error);
  }
}