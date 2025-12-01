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
    const resendTemplateId = Deno.env.get("RESEND_CONFIRMATION_TEMPLATE_ID");

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

    let resendSuccess = false;
    let resendResult: any = null;

    if (resendTemplateId) {
      console.log("Using Resend template:", resendTemplateId);

      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: "Wis Legal <noreply@wislegal.io>",
          to: [email],
          subject: "Confirme seu email - Wis Legal",
          react: resendTemplateId,
          params: {
            first_name: finalFirstName,
            confirmation_url: confirmationUrl
          }
        }),
      });

      if (!resendResponse.ok) {
        const errorText = await resendResponse.text();
        console.error("Resend API error:", resendResponse.status, errorText);
        throw new Error(`Failed to send email via Resend template: ${resendResponse.status} - ${errorText}`);
      } else {
        resendResult = await resendResponse.json();
        console.log("✓ Email sent successfully via Resend template:", resendResult);
        resendSuccess = true;
      }
    } else {
      console.log("No template ID found, using inline HTML");

      const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>Confirmação de Email - Wis Legal</title>

<style type="text/css">
		body{
			margin:0;
			padding:0;
			font-family:'Open Sans', Arial, sans-serif;
			background-color:#ffffff;
			-webkit-font-smoothing:antialiased;
			-moz-osx-font-smoothing:grayscale;
		}
		table{
			border-collapse:collapse;
		}
		img{
			border:0;
			display:block;
			outline:none;
			text-decoration:none;
		}
		.button{
			background-color:#1D1C1B;
			border-radius:6px;
			color:#ffffff;
			display:inline-block;
			font-size:16px;
			font-weight:600;
			line-height:48px;
			text-align:center;
			text-decoration:none;
			padding:0 32px;
			-webkit-text-size-adjust:none;
		}
</style></head>
<body style="margin: 0; padding: 0; background-color: #ffffff;">
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ffffff;">
        <tr>
            <td align="center" style="padding: 40px 20px 0;">
                <!-- Logo -->
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px;">
                    <tr>
                        <td align="center" style="padding-bottom: 32px;">
                            <img src="https://zvlqcxiwsrziuodiotar.supabase.co/storage/v1/object/public/assets/img/mail_logo_lettering.jpg" alt="Wis Legal" width="180" style="display: block; max-width: 180px; height: auto;">
                            <!--[if mso]>
                            <div style="font-family: 'Open Sans', Arial, sans-serif; font-size: 28px; font-weight: 700; color: #1D1C1B; text-align: center;">Wis Legal</div>
                            <![endif]-->
                        </td>
                    </tr>
                </table>

                <!-- Content Container -->
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; background-color: #FAFAFA; border-radius: 12px;">
                    <tr>
                        <td style="padding: 48px 40px;">
                            <!-- Greeting -->
                            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                                <tr>
                                    <td style="color: #29323A; font-family: 'Open Sans', Arial, sans-serif; font-size: 24px; font-weight: 600; line-height: 32px; padding-bottom: 24px;">
                                        Olá ${finalFirstName}, estamos felizes em ter você aqui!
                                    </td>
                                </tr>
                                <tr>
                                    <td style="color: #29323A; font-family: 'Open Sans', Arial, sans-serif; font-size: 16px; line-height: 24px; padding-bottom: 32px;">
                                        Para confirmar seu acesso e acessar nossa plataforma, confirme seu email clicando no botão abaixo.
                                    </td>
                                </tr>
                                <!-- Button -->
                                <tr>
                                    <td align="center" style="padding-bottom: 32px;">
                                        <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                                            <tr>
                                                <td align="center" style="border-radius: 6px; background-color: #1D1C1B;">
                                                    <a href="${confirmationUrl}" target="_blank" style="background-color: #1D1C1B; border-radius: 6px; color: #ffffff; display: inline-block; font-family: 'Open Sans', Arial, sans-serif; font-size: 16px; font-weight: 600; line-height: 48px; text-align: center; text-decoration: none; padding: 0 32px; -webkit-text-size-adjust: none;">Confirmar Email</a>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="color: #29323A; font-family: 'Open Sans', Arial, sans-serif; font-size: 14px; line-height: 21px; padding-bottom: 24px;">
                                        Este link é válido por 60 minutos, esperamos por você!
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>

                <!-- Signature -->
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px;">
                    <tr>
                        <td style="padding: 32px 0 24px;">
                            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                                <tr>
                                    <td style="color: #29323A; font-family: 'Open Sans', Arial, sans-serif; font-size: 14px; line-height: 21px; padding-bottom: 8px;">
                                        Atenciosamente,
                                    </td>
                                </tr>
                                <tr>
                                    <td style="color: #29323A; font-family: 'Open Sans', Arial, sans-serif; font-size: 14px; line-height: 21px; font-weight: 600;">
                                        Equipe Wis Legal
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>

                <!-- Footer -->
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px;">
                    <tr>
                        <td style="padding-top: 24px; border-top: 1px solid #E5E7EB;">
                            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                                <tr>
                                    <td align="center" style="padding-bottom: 16px;">
                                        <p style="margin: 0; color: #6B7280; font-family: 'Open Sans', Arial, sans-serif; font-size: 12px; line-height: 18px;">
                                            © 2025 Wis Legal. Todos os direitos reservados.
                                        </p>
                                    </td>
                                </tr>
                                <tr>
                                    <td align="center" style="padding-bottom: 40px;">
                                        <img src="https://zvlqcxiwsrziuodiotar.supabase.co/storage/v1/object/public/assets/img/mail_logo_footer.jpg" alt="Wis Legal" width="60" style="display: block; max-width: 60px; height: auto;">
                                        <!--[if mso]>
                                        <div style="font-family: 'Open Sans', Arial, sans-serif; font-size: 16px; font-weight: 600; color: #1D1C1B; text-align: center; margin-top: 8px;">Wis Legal</div>
                                        <![endif]-->
                                    </td>
                                </tr>
                            </table>
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
          from: "Wis Legal <noreply@wislegal.io>",
          to: [email],
          subject: "Confirme seu email - Wis Legal",
          html: htmlContent,
        }),
      });

      if (!resendResponse.ok) {
        const errorText = await resendResponse.text();
        console.error("Resend API error:", resendResponse.status, errorText);
        throw new Error(`Failed to send email via Resend: ${resendResponse.status} - ${errorText}`);
      } else {
        resendResult = await resendResponse.json();
        console.log("✓ Email sent successfully via Resend:", resendResult);
        resendSuccess = true;
      }
    }

    console.log("Step 4: Logging email send to database...");
    const { error: logError } = await supabaseClient
      .from("email_logs")
      .insert({
        user_id: user_id,
        email: email,
        type: "confirmation",
        status: resendSuccess ? "success" : "failed",
        email_provider_response: { resend_id: resendResult?.id || null },
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
