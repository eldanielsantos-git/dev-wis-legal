import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestBody {
  email: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const body: RequestBody = await req.json();
    const { email } = body;

    if (!email) {
      return new Response(
        JSON.stringify({
          error: "Email é obrigatório"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const { createClient } = await import("jsr:@supabase/supabase-js@2");
    const supabase = createClient(supabaseUrl!, supabaseKey!);

    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, first_name, last_name, email')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (profileError || !profileData) {
      console.log('[ResetPassword] Usuário não encontrado:', email);
      return new Response(
        JSON.stringify({
          success: true,
          message: "Se o email existir em nossa base, você receberá instruções para resetar sua senha"
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const resetToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        password_reset_token: resetToken,
        password_reset_expires_at: expiresAt.toISOString()
      })
      .eq('id', profileData.id);

    if (updateError) {
      console.error('[ResetPassword] Erro ao salvar token:', updateError);
      throw new Error('Erro ao gerar token de reset');
    }

    // Pega a URL base do Origin header da requisição
    const origin = req.headers.get('origin') || req.headers.get('referer');
    let baseUrl = 'https://app.wislegal.io';
    
    if (origin) {
      try {
        const url = new URL(origin);
        baseUrl = `${url.protocol}//${url.host}`;
      } catch (e) {
        console.log('[ResetPassword] Erro ao parsear origin, usando fallback:', e);
      }
    }
    
    console.log('[ResetPassword] Using base URL:', baseUrl);
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY não configurada");
    }

    const templateId = "aa4008f0-7e91-451e-82ad-5b711f23eab3";

    const resendPayload = {
      to: [email],
      template: {
        id: templateId,
        variables: {
          first_name: profileData.first_name,
          reset_url: resetUrl
        }
      }
    };

    console.log('[ResetPassword] Sending email with template ID:', templateId);
    console.log('[ResetPassword] Template variables:', { first_name: profileData.first_name, reset_url: resetUrl });

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify(resendPayload),
    });

    if (!resendResponse.ok) {
      const errorData = await resendResponse.json();
      console.error('[Resend] Erro ao enviar email:', errorData);
      throw new Error('Erro ao enviar email via Resend');
    }

    const { error: logError } = await supabase
      .from('email_logs')
      .insert({
        user_id: profileData.id,
        type: 'password_reset',
        email: email,
        status: 'sent',
        sent_at: new Date().toISOString()
      });

    if (logError) {
      console.error('[EmailLog] Erro ao registrar log:', logError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Email de redefinição de senha enviado com sucesso"
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: any) {
    console.error('[SendResetPasswordEmail] Erro:', error);
    return new Response(
      JSON.stringify({
        error: error.message || "Erro ao enviar email de redefinição"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});