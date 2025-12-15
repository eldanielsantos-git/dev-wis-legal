import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ChangeEmailRequest {
  user_id: string;
  old_email: string;
  new_email: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log("=== SEND CHANGE EMAIL - START ===");

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
      old_email,
      new_email
    }: ChangeEmailRequest = await req.json();

    console.log("Request data:", { user_id, old_email, new_email });

    if (!user_id || !old_email || !new_email) {
      throw new Error("Missing required fields: user_id, old_email, new_email");
    }

    console.log("Step 1: Fetching user data from database...");
    const { data: userProfile, error: profileError } = await supabaseClient
      .from("user_profiles")
      .select("first_name, last_name")
      .eq("id", user_id)
      .maybeSingle();

    if (profileError) {
      console.error("Error fetching user profile:", profileError);
      throw new Error("Failed to fetch user profile");
    }

    if (!userProfile) {
      throw new Error("User profile not found");
    }

    const firstName = userProfile.first_name || "Usuário";

    console.log("Step 2: Generating email change confirmation link...");

    const { data: linkData, error: linkError } = await supabaseClient.auth.admin.generateLink({
      type: 'email_change_current',
      email: old_email,
      newEmail: new_email,
      options: {
        redirectTo: 'https://app.wislegal.io/app'
      }
    });

    if (linkError || !linkData) {
      console.error("Failed to generate email change link:", linkError);
      throw new Error(`Failed to generate confirmation link: ${linkError?.message || 'Unknown error'}`);
    }

    const confirmationUrl = linkData.properties.action_link;
    console.log("Email change link generated successfully:", confirmationUrl);

    console.log("Step 3: Sending email via Resend with template...");

    let resendSuccess = false;
    let resendResult: any = null;

    const templateId = "c606283c-0609-4a42-9f50-f9b9cdfcaf18";

    const fromEmail = "WisLegal <noreply@wislegal.io>";

    const resendPayload: any = {
      from: fromEmail,
      to: [old_email],
      template: {
        id: templateId,
        variables: {
          first_name: firstName,
          old_email: old_email,
          new_email: new_email,
          confirmation_url: confirmationUrl
        }
      }
    };

    console.log("Sending email with template ID:", templateId);
    console.log("Template variables:", {
      first_name: firstName,
      old_email: old_email,
      new_email: new_email,
      confirmation_url: confirmationUrl
    });

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify(resendPayload),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      console.error("Resend API error:", resendResponse.status, errorText);
      throw new Error(`Failed to send email via Resend: ${resendResponse.status} - ${errorText}`);
    } else {
      resendResult = await resendResponse.json();
      console.log("✓ Email sent successfully via Resend template:", resendResult);
      resendSuccess = true;
    }

    console.log("Step 4: Logging email send to database...");
    const { error: logError } = await supabaseClient
      .from("email_logs")
      .insert({
        user_id: user_id,
        email: old_email,
        type: "email_change",
        status: resendSuccess ? "success" : "failed",
        email_provider_response: { resend_id: resendResult?.id || null },
        sent_at: new Date().toISOString()
      });

    if (logError) {
      console.error("Failed to log email:", logError);
    } else {
      console.log("✓ Email send logged to database");
    }

    console.log("=== SEND CHANGE EMAIL - SUCCESS ===");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Email change confirmation sent successfully via Resend",
        resend_id: resendResult?.id || null
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("💥 Error in send-change-email function:", error);
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
