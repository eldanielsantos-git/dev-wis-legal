import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AdminComplexAnalysisErrorRequest {
  error_id: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log("=== SEND ADMIN COMPLEX ANALYSIS ERROR EMAIL - START ===");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const appUrl = "https://app.wislegal.io";

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    if (!resendApiKey) {
      throw new Error("Missing RESEND_API_KEY environment variable");
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    const { error_id }: AdminComplexAnalysisErrorRequest = await req.json();

    if (!error_id) {
      throw new Error("Missing required field: error_id");
    }

    console.log("Request data:", { error_id });

    // Step 1: Buscar informações do erro complexo
    console.log("Step 1: Fetching complex error data from database...");
    const { data: errorData, error: errorFetchError } = await supabaseClient
      .from("complex_analysis_errors")
      .select("*")
      .eq("id", error_id)
      .maybeSingle();

    if (errorFetchError || !errorData) {
      console.error("Error fetching complex error data:", errorFetchError);
      throw new Error(`Complex error not found: ${error_id}`);
    }

    if (errorData.admin_notified) {
      console.warn("Admin already notified for this complex error. Skipping.");
      return new Response(
        JSON.stringify({
          success: false,
          message: "Admin already notified for this complex error"
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Complex error data found:", {
      error_type: errorData.error_type,
      severity: errorData.severity,
      chunk_index: errorData.failed_chunk_index,
      total_chunks: errorData.total_chunks
    });

    // Step 2: Buscar informações do processo
    console.log("Step 2: Fetching processo data...");
    const { data: processo, error: processoError } = await supabaseClient
      .from("processos")
      .select(`
        id,
        file_name,
        user_id,
        current_prompt_number,
        total_prompts,
        transcricao,
        total_chunks_count,
        is_chunked
      `)
      .eq("id", errorData.processo_id)
      .maybeSingle();

    if (processoError || !processo) {
      console.error("Error fetching processo:", processoError);
      throw new Error(`Processo not found: ${errorData.processo_id}`);
    }

    const totalPages = processo.transcricao?.totalPages || 0;

    console.log("Processo found:", {
      file_name: processo.file_name,
      total_pages: totalPages,
      total_chunks: processo.total_chunks_count,
      is_chunked: processo.is_chunked
    });

    // Step 3: Buscar informações do usuário
    console.log("Step 3: Fetching user profile...");
    const { data: userProfile, error: profileError } = await supabaseClient
      .from("user_profiles")
      .select("id, first_name, last_name, email")
      .eq("id", errorData.user_id)
      .maybeSingle();

    if (profileError || !userProfile) {
      console.error("Error fetching user profile:", profileError);
      throw new Error(`User profile not found: ${errorData.user_id}`);
    }

    console.log("User profile found:", {
      name: `${userProfile.first_name} ${userProfile.last_name}`,
      email: userProfile.email
    });

    // Step 4: Buscar plano ativo do usuário
    console.log("Step 4: Fetching user subscription...");
    const { data: customer } = await supabaseClient
      .from("stripe_customers")
      .select("customer_id")
      .eq("user_id", errorData.user_id)
      .maybeSingle();

    let planName = "Sem assinatura ativa";

    if (customer?.customer_id) {
      const { data: subscription } = await supabaseClient
        .from("stripe_subscriptions")
        .select(`
          price_id,
          subscription_plans!inner(name)
        `)
        .eq("customer_id", customer.customer_id)
        .eq("status", "active")
        .is("deleted_at", null)
        .maybeSingle();

      if (subscription?.subscription_plans) {
        planName = subscription.subscription_plans.name;
      }
    }

    console.log("User plan:", planName);

    // Step 5: Buscar todos os admins
    console.log("Step 5: Fetching admin users...");
    const { data: admins, error: adminsError } = await supabaseClient
      .from("user_profiles")
      .select("email, first_name")
      .eq("is_admin", true);

    if (adminsError || !admins || admins.length === 0) {
      console.error("Error fetching admins:", adminsError);
      throw new Error("No admin users found");
    }

    console.log(`Found ${admins.length} admin(s) to notify:`, admins.map(a => a.email));

    // Step 6: Preparar variáveis do template
    console.log("Step 6: Preparing email template variables...");

    const formatDateTime = (timestamp: string): string => {
      const date = new Date(timestamp);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${day}/${month}/${year} às ${hours}:${minutes}`;
    };

    const formatDuration = (seconds: number | null): string => {
      if (!seconds) return "N/A";
      if (seconds < 60) return `${seconds}s`;
      const minutes = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${minutes}min ${secs}s`;
    };

    const getCurrentPhase = (): string => {
      const phases: Record<string, string> = {
        'initializing': 'Inicialização',
        'processing': 'Processamento de Chunks',
        'consolidation': 'Consolidação',
        'finalization': 'Finalização'
      };
      return phases[errorData.current_phase] || errorData.current_phase || "Desconhecido";
    };

    const templateVariables = {
      // Admin info
      first_name_admin: "", // Será preenchido por admin

      // User info
      first_name: userProfile.first_name || "Usuário",
      last_name: userProfile.last_name || "",
      user_email: userProfile.email,
      plan_name: planName,

      // File info
      file_name: processo.file_name,
      processo_id: processo.id,
      total_pages: totalPages.toString(),
      total_chunks: (errorData.total_chunks || processo.total_chunks_count || 0).toString(),

      // Failed chunk info
      failed_chunk_index: (errorData.failed_chunk_index || 0).toString(),
      chunk_start_page: (errorData.chunk_start_page || 0).toString(),
      chunk_end_page: (errorData.chunk_end_page || 0).toString(),
      chunk_pages_count: (errorData.chunk_pages_count || 0).toString(),
      error_datetime: formatDateTime(errorData.occurred_at),

      // Processing status
      current_phase: getCurrentPhase(),
      chunks_completed: (errorData.chunks_completed || 0).toString(),
      progress_percent: (errorData.progress_percent || 0).toFixed(1) + "%",
      prompt_title: errorData.prompt_title || "N/A",
      execution_order: (errorData.execution_order || 0).toString(),
      total_prompts: (processo.total_prompts || 0).toString(),
      chunks_succeeded: (errorData.chunks_succeeded || 0).toString(),
      chunks_failed: (errorData.chunks_failed || 1).toString(),
      processing_duration: formatDuration(errorData.processing_duration),

      // Error details
      error_type: errorData.error_type,
      severity: errorData.severity.toUpperCase(),
      error_category: errorData.error_category,
      error_message: errorData.error_message,

      // Technical info
      worker_id: errorData.worker_id || "N/A",
      chunk_id: errorData.chunk_id || "N/A",
      retry_attempt: (errorData.retry_attempt || 0).toString(),
      max_retries: (errorData.max_retries || 3).toString(),
      estimated_tokens: errorData.estimated_tokens ? errorData.estimated_tokens.toLocaleString() : "N/A",
      token_validation_status: errorData.token_validation_status || "N/A",
      model_used: errorData.model_used || "N/A",
      gemini_file_uri: errorData.gemini_file_uri || "N/A",
      recovery_attempted: errorData.recovery_attempted ? "Sim" : "Não",

      // Automatic actions
      auto_recovery_enabled: errorData.auto_recovery_enabled ? "Sim" : "Não",
      next_retry_at: errorData.next_retry_at ? formatDateTime(errorData.next_retry_at) : "N/A",
      chunk_subdivision_triggered: errorData.chunk_subdivision_triggered ? "Sim" : "Não",
      monitoring_active: "Sim",

      // URLs
      processo_detail_url: `${appUrl}/lawsuits-detail/${processo.id}`
    };

    console.log("Template variables prepared:", {
      user: `${templateVariables.first_name} ${templateVariables.last_name}`,
      file: templateVariables.file_name,
      chunk: `${templateVariables.failed_chunk_index}/${templateVariables.total_chunks}`,
      error_type: templateVariables.error_type,
      severity: templateVariables.severity
    });

    // Step 7: Enviar email para cada admin
    console.log("Step 7: Sending emails to admins...");

    const templateId = "f5256a8e-e0bd-4eaa-99f5-baf1e4b8ab3b";
    const emailResults: string[] = [];

    for (const admin of admins) {
      try {
        console.log(`Sending email to ${admin.email}...`);

        const adminTemplateVariables = {
          ...templateVariables,
          first_name_admin: admin.first_name || "Administrador"
        };

        const fromEmail = "WisLegal <noreply@wislegal.io>";

        const resendPayload = {
          from: fromEmail,
          to: [admin.email],
          template: {
            id: templateId,
            variables: adminTemplateVariables
          }
        };

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
          console.error(`Failed to send to ${admin.email}:`, resendResponse.status, errorText);
          continue;
        }

        const resendResult = await resendResponse.json();
        console.log(`✓ Email sent to ${admin.email}:`, resendResult.id);
        emailResults.push(resendResult.id);

        // Log email send
        const { error: logError } = await supabaseClient
          .from("email_logs")
          .insert({
            user_id: errorData.user_id,
            email: admin.email,
            type: "admin_complex_analysis_error",
            status: "success",
            email_provider_response: {
              resend_id: resendResult.id,
              error_id: errorData.id,
              processo_id: processo.id,
              chunk_id: errorData.chunk_id,
              admin_email: admin.email
            },
            sent_at: new Date().toISOString()
          });

        if (logError) {
          console.error("Failed to log email:", logError);
        }

      } catch (emailError) {
        console.error(`Error sending to ${admin.email}:`, emailError);
      }
    }

    if (emailResults.length === 0) {
      throw new Error("Failed to send email to any admin");
    }

    // Step 8: Marcar erro como notificado
    console.log("Step 8: Marking complex error as notified...");

    const { error: updateError } = await supabaseClient
      .from("complex_analysis_errors")
      .update({
        admin_notified: true,
        admin_notified_at: new Date().toISOString(),
        admin_email_id: emailResults[0]
      })
      .eq("id", error_id);

    if (updateError) {
      console.error("Failed to mark complex error as notified:", updateError);
    } else {
      console.log("✓ Complex error marked as notified");
    }

    console.log("=== SEND ADMIN COMPLEX ANALYSIS ERROR EMAIL - SUCCESS ===");

    return new Response(
      JSON.stringify({
        success: true,
        message: `Admin complex error notification sent to ${admins.length} admin(s)`,
        emails_sent: emailResults.length,
        resend_ids: emailResults
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("💥 Error in send-admin-complex-analysis-error function:", error);
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
