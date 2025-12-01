import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ConfirmationEmailRequest {
  user_id: string;
  email: string;
  first_name: string;
  last_name?: string;
  phone?: string;
  phone_country_code?: string;
  city?: string;
  state?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log("=== SEND CONFIRMATION EMAIL - START ===");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    if (!resendApiKey) {
      throw new Error("Missing RESEND_API_KEY environment variable");
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    const {
      user_id,
      email,
      first_name,
      last_name = "",
      phone = "",
      phone_country_code = "+55",
      city = "",
      state = ""
    }: ConfirmationEmailRequest = await req.json();

    console.log("Request data:", { user_id, email, first_name });

    if (!user_id || !email || !first_name) {
      throw new Error("Missing required fields: user_id, email, first_name");
    }

    console.log("Step 1: Fetching user data from database...");
    const { data: userProfile, error: profileError } = await supabaseClient
      .from("user_profiles")
      .select("first_name, last_name, phone, phone_country_code, city, state")
      .eq("id", user_id)
      .maybeSingle();

    if (profileError) {
      console.error("Error fetching user profile:", profileError);
    }

    const finalFirstName = userProfile?.first_name || first_name;
    const finalLastName = userProfile?.last_name || last_name;
    const finalPhone = userProfile?.phone || phone;
    const finalPhoneCountryCode = userProfile?.phone_country_code || phone_country_code;
    const finalCity = userProfile?.city || city;
    const finalState = userProfile?.state || state;

    console.log("Step 2: Generating confirmation URL...");
    const confirmationUrl = `${supabaseUrl}/auth/v1/verify?token=MAGIC_LINK_TOKEN&type=signup&redirect_to=${encodeURIComponent('https://dev-app.wislegal.io/confirm-email')}`;

    console.log("Step 3: Sending email via Resend...");

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirme seu Email - WisLegal</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">WisLegal</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #1a1a1a; font-size: 24px; font-weight: 600;">
                Olá, ${finalFirstName}!
              </h2>

              <p style="margin: 0 0 20px; color: #4a5568; font-size: 16px; line-height: 24px;">
                Seja bem-vindo(a) à <strong>WisLegal</strong>! Estamos muito felizes em ter você conosco.
              </p>

              <p style="margin: 0 0 30px; color: #4a5568; font-size: 16px; line-height: 24px;">
                Para começar a usar nossa plataforma, precisamos confirmar seu endereço de email.
                Clique no botão abaixo para ativar sua conta:
              </p>

              <!-- CTA Button -->
              <table role="presentation" style="margin: 0 auto;">
                <tr>
                  <td style="border-radius: 6px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                    <a href="${confirmationUrl}" style="display: inline-block; padding: 16px 40px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 6px;">
                      Confirmar Email
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 30px 0 0; color: #718096; font-size: 14px; line-height: 20px;">
                Se você não criou uma conta na WisLegal, pode ignorar este email com segurança.
              </p>

              <p style="margin: 20px 0 0; color: #718096; font-size: 14px; line-height: 20px;">
                <strong>Problema para clicar no botão?</strong><br>
                Copie e cole este link no seu navegador:<br>
                <a href="${confirmationUrl}" style="color: #667eea; word-break: break-all;">${confirmationUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f7fafc; border-radius: 0 0 8px 8px; text-align: center;">
              <p style="margin: 0 0 10px; color: #718096; font-size: 14px;">
                <strong>WisLegal - Análise Jurídica Inteligente</strong>
              </p>
              <p style="margin: 0; color: #a0aec0; font-size: 12px;">
                Este é um email automático, por favor não responda.
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

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "WisLegal <noreply@wislegal.io>",
        to: [email],
        subject: "Confirme seu email - WisLegal",
        html: htmlContent,
      }),
    });

    let resendSuccess = false;
    let resendResult: any = null;

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      console.error("Resend API error:", resendResponse.status, errorText);
      throw new Error(`Failed to send email via Resend: ${resendResponse.status} - ${errorText}`);
    } else {
      resendResult = await resendResponse.json();
      console.log("✓ Email sent successfully via Resend:", resendResult);
      resendSuccess = true;
    }

    console.log("Step 4: Logging email send to database...");
    const { error: logError } = await supabaseClient
      .from("email_logs")
      .insert({
        user_id: user_id,
        email: email,
        type: "confirmation",
        status: resendSuccess ? "success" : "failed",
        mailchimp_response: { resend_id: resendResult?.id || null },
        sent_at: new Date().toISOString()
      });

    if (logError) {
      console.error("Failed to log email:", logError);
    } else {
      console.log("✓ Email send logged to database");
    }

    console.log("=== SEND CONFIRMATION EMAIL - SUCCESS ===");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Confirmation email sent successfully via Resend",
        resend_id: resendResult?.id || null
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("💥 Error in send-confirmation-email function:", error);
    console.error("Stack trace:", error instanceof Error ? error.stack : "No stack trace");

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error occurred",
        success: false
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
