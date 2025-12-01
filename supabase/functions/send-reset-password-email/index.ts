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

    // Buscar usuário pelo email
    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, first_name, last_name, email')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (profileError || !profileData) {
      console.log('[ResetPassword] Usuário não encontrado:', email);
      // Por segurança, não revelar se o email existe ou não
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

    // Gerar token de reset (válido por 1 hora)
    const resetToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    // Salvar token no banco
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

    // Buscar URL base da aplicação
    const { data: config } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'app_base_url')
      .single();

    const baseUrl = config?.value || 'https://app.wislegal.io';
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

    // Montar template HTML do email
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Redefinir Senha - Wis Legal</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">

                <!-- Header -->
                <tr>
                  <td style="padding: 40px 40px 20px; text-align: center; background-color: #1a1a1a; border-radius: 8px 8px 0 0;">
                    <img src="https://rslpleprodloodfsaext.supabase.co/storage/v1/object/public/assets/img/logo-color-white.svg"
                         alt="Wis Legal"
                         style="height: 50px; margin-bottom: 10px;">
                    <p style="color: #ffffff; font-size: 18px; margin: 0;">Simple legal analysis</p>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding: 40px;">
                    <h1 style="color: #1a1a1a; font-size: 24px; margin: 0 0 20px;">
                      Olá, ${profileData.first_name}!
                    </h1>

                    <p style="color: #333333; font-size: 16px; line-height: 1.5; margin: 0 0 20px;">
                      Recebemos uma solicitação para redefinir a senha da sua conta no Wis Legal.
                    </p>

                    <p style="color: #333333; font-size: 16px; line-height: 1.5; margin: 0 0 30px;">
                      Clique no botão abaixo para criar uma nova senha:
                    </p>

                    <!-- CTA Button -->
                    <table role="presentation" style="margin: 0 auto;">
                      <tr>
                        <td style="border-radius: 6px; background-color: #1a1a1a;">
                          <a href="${resetUrl}"
                             style="display: inline-block; padding: 16px 40px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: bold;">
                            Redefinir Senha
                          </a>
                        </td>
                      </tr>
                    </table>

                    <p style="color: #666666; font-size: 14px; line-height: 1.5; margin: 30px 0 0;">
                      Ou copie e cole este link no seu navegador:
                    </p>
                    <p style="color: #0066cc; font-size: 14px; word-break: break-all; margin: 10px 0 0;">
                      ${resetUrl}
                    </p>

                    <!-- Security Info -->
                    <div style="margin-top: 40px; padding: 20px; background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
                      <p style="color: #856404; font-size: 14px; margin: 0 0 10px;">
                        <strong>⚠️ Importante:</strong>
                      </p>
                      <ul style="color: #856404; font-size: 14px; margin: 0; padding-left: 20px;">
                        <li>Este link é válido por <strong>1 hora</strong></li>
                        <li>Por segurança, ele só pode ser usado uma vez</li>
                        <li>Se você não solicitou esta alteração, ignore este email</li>
                        <li>Sua senha atual continuará funcionando normalmente</li>
                      </ul>
                    </div>

                    <p style="color: #999999; font-size: 12px; line-height: 1.5; margin: 30px 0 0;">
                      Se você não solicitou a redefinição de senha, por favor ignore este email
                      ou entre em contato com nosso suporte se tiver alguma dúvida.
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="padding: 30px 40px; background-color: #f8f8f8; border-radius: 0 0 8px 8px; text-align: center;">
                    <p style="color: #666666; font-size: 14px; margin: 0 0 10px;">
                      © 2024 Wis Legal. Todos os direitos reservados.
                    </p>
                    <p style="color: #999999; font-size: 12px; margin: 0;">
                      <a href="https://wislegal.io/terms" style="color: #0066cc; text-decoration: none;">Termos de Uso</a> |
                      <a href="https://wislegal.io/privacy" style="color: #0066cc; text-decoration: none;">Política de Privacidade</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    // Enviar email via Resend API
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY não configurada");
    }

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Wis Legal <noreply@wislegal.io>",
        to: email,
        subject: "Redefinir Senha - Wis Legal",
        html: emailHtml,
      }),
    });

    if (!resendResponse.ok) {
      const errorData = await resendResponse.json();
      console.error('[Resend] Erro ao enviar email:', errorData);
      throw new Error('Erro ao enviar email via Resend');
    }

    // Registrar log do email enviado
    const { error: logError } = await supabase
      .from('email_logs')
      .insert({
        user_id: profileData.id,
        email_type: 'password_reset',
        to_email: email,
        subject: 'Redefinir Senha - Wis Legal',
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
