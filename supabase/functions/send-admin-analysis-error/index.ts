import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AdminAnalysisErrorRequest {
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
    console.log("=== SEND ADMIN ANALYSIS ERROR EMAIL - START ===");

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

    const { error_id }: AdminAnalysisErrorRequest = await req.json();

    if (!error_id) {
      throw new Error("Missing required field: error_id");
    }

    console.log("Request data:", { error_id });

    // Step 1: Buscar informações do erro
    console.log("Step 1: Fetching error data from database...");
    const { data: errorData, error: errorFetchError } = await supabaseClient
      .from("analysis_errors")
      .select(`
        id,
        processo_id,
        user_id,
        error_type,
        error_category,
        error_message,
        severity,
        current_stage,
        prompt_title,
        execution_order,
        occurred_at,
        admin_notified
      `)
      .eq("id", error_id)
      .maybeSingle();

    if (errorFetchError || !errorData) {
      console.error("Error fetching error data:", errorFetchError);
      throw new Error(`Error not found: ${error_id}`);
    }

    if (errorData.admin_notified) {
      console.warn("Admin already notified for this error. Skipping.");
      return new Response(
        JSON.stringify({
          success: false,
          message: "Admin already notified for this error"
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Error data found:", {
      error_type: errorData.error_type,
      severity: errorData.severity,
      processo_id: errorData.processo_id
    });

    // Step 2: Buscar informações do processo
    console.log("Step 2: Fetching processo data...");
    const { data: processo, error: processoError } = await supabaseClient
      .from("processos")
      .select("id, file_name, user_id, current_prompt_number, total_prompts")
      .eq("id", errorData.processo_id)
      .maybeSingle();

    if (processoError || !processo) {
      console.error("Error fetching processo:", processoError);
      throw new Error(`Processo not found: ${errorData.processo_id}`);
    }

    console.log("Processo found:", {
      file_name: processo.file_name,
      current_prompt: processo.current_prompt_number,
      total_prompts: processo.total_prompts
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

    // Primeiro buscar o customer_id
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

    const getSeverityColor = (severity: string): string => {
      const colors: Record<string, string> = {
        'critical': '#C92A2A',
        'high': '#FF6B6B',
        'medium': '#FFA94D',
        'low': '#74C0FC'
      };
      return colors[severity.toLowerCase()] || '#999';
    };

    const getCurrentStage = (): string => {
      if (errorData.current_stage) {
        return errorData.current_stage;
      }
      if (errorData.prompt_title && errorData.execution_order) {
        return `Processando prompt ${errorData.execution_order} de ${processo.total_prompts} - ${errorData.prompt_title}`;
      }
      if (processo.current_prompt_number && processo.total_prompts) {
        return `Prompt ${processo.current_prompt_number} de ${processo.total_prompts}`;
      }
      return "Estágio desconhecido";
    };

    const templateVariables = {
      first_name: userProfile.first_name || "Usuário",
      last_name: userProfile.last_name || "",
      user_email: userProfile.email,
      plan_name: planName,
      file_name: processo.file_name,
      processo_id: processo.id,
      processo_detail_url: `${appUrl}/lawsuits-detail/${processo.id}`,
      error_datetime: formatDateTime(errorData.occurred_at),
      current_stage: getCurrentStage(),
      error_type: errorData.error_type,
      severity: errorData.severity.toUpperCase(),
      severity_color: getSeverityColor(errorData.severity),
      error_message: errorData.error_message
    };

    console.log("Template variables prepared:", {
      user: `${templateVariables.first_name} ${templateVariables.last_name}`,
      file: templateVariables.file_name,
      error_type: templateVariables.error_type,
      severity: templateVariables.severity
    });

    // Step 7: Enviar email para cada admin
    console.log("Step 7: Sending emails to admins...");

    const templateId = "27f9de05-6f16-4361-86b2-72d8ee8f53a4";
    const emailResults: string[] = [];

    for (const admin of admins) {
      try {
        console.log(`Sending email to ${admin.email}...`);

        // Adicionar first_name_admin específico para cada admin
        const adminTemplateVariables = {
          ...templateVariables,
          first_name_admin: admin.first_name || "Administrador"
        };

        const resendPayload = {
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
            type: "admin_analysis_error",
            status: "success",
            email_provider_response: {
              resend_id: resendResult.id,
              error_id: errorData.id,
              processo_id: processo.id,
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
    console.log("Step 8: Marking error as notified...");

    const { error: updateError } = await supabaseClient
      .from("analysis_errors")
      .update({
        admin_notified: true,
        admin_notified_at: new Date().toISOString(),
        admin_email_id: emailResults[0]
      })
      .eq("id", error_id);

    if (updateError) {
      console.error("Failed to mark error as notified:", updateError);
    } else {
      console.log("✓ Error marked as notified");
    }

    // Step 9: Enviar notificação Slack
    console.log("Step 9: Sending Slack notification...");

    try {
      const slackPayload = {
        type_slug: "analysis_failed",
        title: `Erro em Análise - ${processo.file_name}`,
        message: `**Usuário:** ${userProfile.first_name} ${userProfile.last_name} (${userProfile.email})
**Plano:** ${planName}
**Arquivo:** ${processo.file_name}
**Análise:** ${errorData.prompt_title}
**Tipo:** ${errorData.error_type}
**Severity:** ${errorData.severity.toUpperCase()}

${errorData.error_message}`,
        severity: errorData.severity,
        metadata: {
          user_id: errorData.user_id,
          processo_id: errorData.processo_id,
          error_id: errorData.id,
          error_type: errorData.error_type,
          prompt_title: errorData.prompt_title,
          execution_order: errorData.execution_order
        },
        user_id: errorData.user_id,
        processo_id: errorData.processo_id
      };

      const slackResponse = await fetch(`${supabaseUrl}/functions/v1/send-admin-notification`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(slackPayload)
      });

      if (slackResponse.ok) {
        const slackResult = await slackResponse.json();
        console.log("✓ Slack notification sent:", slackResult);
      } else {
        const slackError = await slackResponse.text();
        console.error("Failed to send Slack notification:", slackResponse.status, slackError);
      }
    } catch (slackError) {
      console.error("Error sending Slack notification (non-blocking):", slackError);
    }

    console.log("=== SEND ADMIN ANALYSIS ERROR EMAIL - SUCCESS ===");

    return new Response(
      JSON.stringify({
        success: true,
        message: `Admin error notification sent to ${admins.length} admin(s)`,
        emails_sent: emailResults.length,
        resend_ids: emailResults
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("💥 Error in send-admin-analysis-error function:", error);
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
