import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ProcessCompletedEmailRequest {
  processo_id: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log("=== SEND PROCESS COMPLETED EMAIL - START ===");

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

    const { processo_id }: ProcessCompletedEmailRequest = await req.json();

    console.log("Request data:", { processo_id });

    if (!processo_id) {
      throw new Error("Missing required field: processo_id");
    }

    console.log("Step 1: Fetching processo data from database...");
    const { data: processo, error: processoError } = await supabaseClient
      .from("processos")
      .select("id, user_id, file_name, total_pages, status")
      .eq("id", processo_id)
      .maybeSingle();

    if (processoError || !processo) {
      console.error("Error fetching processo:", processoError);
      throw new Error(`Processo not found: ${processo_id}`);
    }

    if (processo.status !== "completed") {
      console.warn(`Processo ${processo_id} is not completed (status: ${processo.status}). Skipping email.`);
      return new Response(
        JSON.stringify({
          success: false,
          message: "Processo is not completed yet"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Step 1.5: Checking if email was already sent...");
    const { data: existingEmail, error: emailCheckError } = await supabaseClient
      .from("email_logs")
      .select("id, created_at")
      .eq("type", "process_completed")
      .eq("user_id", processo.user_id)
      .eq("status", "success")
      .contains("email_provider_response", { processo_id: processo_id })
      .maybeSingle();

    if (emailCheckError) {
      console.error("Error checking for existing email:", emailCheckError);
    }

    if (existingEmail) {
      console.warn(`Email already sent for processo ${processo_id} at ${existingEmail.created_at}. Skipping duplicate.`);
      return new Response(
        JSON.stringify({
          success: false,
          message: "Email already sent for this processo",
          existing_email_id: existingEmail.id,
          sent_at: existingEmail.created_at
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Step 2: Fetching user profile data...");
    const { data: userProfile, error: profileError } = await supabaseClient
      .from("user_profiles")
      .select("first_name, last_name, email")
      .eq("id", processo.user_id)
      .maybeSingle();

    if (profileError || !userProfile) {
      console.error("Error fetching user profile:", profileError);
      throw new Error(`User profile not found for user_id: ${processo.user_id}`);
    }

    console.log("Step 3: Preparing email data...");

    const analysisUrl = `https://app.wislegal.io/lawsuits-detail/${processo.id}`;
    const firstName = userProfile.first_name;
    const userEmail = userProfile.email;
    const fileName = processo.file_name;
    const pagesProcessed = processo.total_pages || 0;

    console.log("Email details:", {
      to: userEmail,
      first_name: firstName,
      file_name: fileName,
      pages_processed_successfully: pagesProcessed,
      analysis_url: analysisUrl
    });

    console.log("Step 4: Sending email via Resend with template...");

    const templateId = "60e5270e-5aa3-4f5c-9c0a-8050b08029af";

    const fromEmail = "WisLegal <noreply@wislegal.io>";

    const resendPayload = {
      from: fromEmail,
      to: [userEmail],
      template: {
        id: templateId,
        variables: {
          first_name: firstName,
          file_name: fileName,
          pages_processed_successfully: pagesProcessed.toString(),
          analysis_url: analysisUrl
        }
      }
    };

    console.log("Sending email with template ID:", templateId);
    console.log("Template variables:", resendPayload.template.variables);

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
    }

    const resendResult = await resendResponse.json();
    console.log("✓ Email sent successfully via Resend template:", resendResult);

    console.log("Step 5: Logging email send to database...");
    const { data: logData, error: logError } = await supabaseClient
      .from("email_logs")
      .insert({
        user_id: processo.user_id,
        email: userEmail,
        type: "process_completed",
        status: "success",
        email_provider_response: { resend_id: resendResult.id, processo_id: processo.id },
        sent_at: new Date().toISOString()
      })
      .select();

    if (logError) {
      console.error("❌ Failed to log email:", logError);
      console.error("Error details:", JSON.stringify(logError, null, 2));
    } else {
      console.log("✓ Email send logged to database successfully");
      console.log("Log data:", logData);
    }

    console.log("=== SEND PROCESS COMPLETED EMAIL - SUCCESS ===");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Process completed email sent successfully",
        resend_id: resendResult.id
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("💥 Error in send-email-process-completed function:", error);
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