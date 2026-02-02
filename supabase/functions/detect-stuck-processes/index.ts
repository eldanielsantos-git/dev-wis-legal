import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendToSlack } from "../_shared/slack-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAX_PAGES_FOR_DETECTION = 1000;
const STUCK_THRESHOLD_MINUTES = 30;
const NOTIFICATION_THROTTLE_MINUTES = 60;
const NOTIFICATION_TYPE_SLUG = "process_stuck";

interface StuckProcess {
  processo_id: string;
  processo_numero: string;
  user_email: string;
  total_pages: number;
  stuck_at_prompt_order: number;
  stuck_at_prompt_title: string;
  minutes_stuck: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const thresholdTime = new Date(
      Date.now() - STUCK_THRESHOLD_MINUTES * 60 * 1000
    ).toISOString();

    const { data: stuckResults, error: stuckError } = await supabase
      .from("analysis_results")
      .select(`
        processo_id,
        execution_order,
        prompt_title,
        processing_at,
        processos!inner(
          id,
          file_name,
          total_pages,
          status,
          user_id,
          user_profiles!inner(email)
        )
      `)
      .eq("status", "processing")
      .lt("processing_at", thresholdTime)
      .lt("processos.total_pages", MAX_PAGES_FOR_DETECTION)
      .eq("processos.status", "analyzing");

    if (stuckError) {
      console.error("Error querying stuck processes:", stuckError);
      return new Response(
        JSON.stringify({ error: "Failed to query stuck processes", details: stuckError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!stuckResults || stuckResults.length === 0) {
      return new Response(
        JSON.stringify({ message: "No stuck processes found", count: 0 }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const stuckProcesses: StuckProcess[] = stuckResults.map((result: Record<string, unknown>) => {
      const processo = result.processos as Record<string, unknown>;
      const userProfile = processo.user_profiles as Record<string, unknown>;
      const processingAt = result.processing_at as string;
      const minutesStuck = Math.floor(
        (Date.now() - new Date(processingAt).getTime()) / 60000
      );

      return {
        processo_id: result.processo_id as string,
        processo_numero: processo.file_name as string,
        user_email: userProfile.email as string,
        total_pages: processo.total_pages as number,
        stuck_at_prompt_order: result.execution_order as number,
        stuck_at_prompt_title: result.prompt_title as string,
        minutes_stuck: minutesStuck,
      };
    });

    const notificationThreshold = new Date(
      Date.now() - NOTIFICATION_THROTTLE_MINUTES * 60 * 1000
    ).toISOString();

    let notificationsSent = 0;
    let notificationsSkipped = 0;

    for (const process of stuckProcesses) {
      const { data: recentNotification } = await supabase
        .from("stuck_process_notifications")
        .select("id")
        .eq("processo_id", process.processo_id)
        .gt("notified_at", notificationThreshold)
        .is("resolved_at", null)
        .limit(1)
        .maybeSingle();

      if (recentNotification) {
        notificationsSkipped++;
        continue;
      }

      const { data: slackConfigs, error: slackConfigError } = await supabase
        .from("slack_notifications")
        .select("webhook_url, is_active, notification_types")
        .eq("is_active", true);

      if (slackConfigError) {
        console.error("Error fetching Slack configs:", slackConfigError);
        continue;
      }

      const matchingConfig = slackConfigs?.find(
        (config: { notification_types: string[] }) =>
          config.notification_types && config.notification_types.includes(NOTIFICATION_TYPE_SLUG)
      );

      if (!matchingConfig?.webhook_url) {
        console.log("No Slack webhook configured for stuck process notifications (process_stuck type)");
        continue;
      }

      const message = `*Processo:* ${process.processo_numero}\n*Usuario:* ${process.user_email}\n*Etapa Travada:* ${process.stuck_at_prompt_order}. ${process.stuck_at_prompt_title}\n*Tempo Travado:* ${process.minutes_stuck} minutos\n*Total de Paginas:* ${process.total_pages}`;

      try {
        const slackResult = await sendToSlack({
          webhookUrl: matchingConfig.webhook_url,
          severity: "high",
          title: "Processo Travado Detectado",
          message,
          metadata: {
            processo_id: process.processo_id,
            etapa: `${process.stuck_at_prompt_order}. ${process.stuck_at_prompt_title}`,
            tempo_travado: `${process.minutes_stuck} min`,
            paginas: process.total_pages,
          },
        });

        await supabase.from("stuck_process_notifications").insert({
          processo_id: process.processo_id,
          processo_numero: process.processo_numero,
          notification_sent_successfully: slackResult.success,
          error_message: slackResult.success ? null : slackResult.error,
          metadata: {
            stuck_at_prompt_order: process.stuck_at_prompt_order,
            stuck_at_prompt_title: process.stuck_at_prompt_title,
            minutes_stuck: process.minutes_stuck,
            total_pages: process.total_pages,
            user_email: process.user_email,
          },
        });

        if (slackResult.success) {
          notificationsSent++;
          console.log(`Slack notification sent for process ${process.processo_id}`);
        } else {
          console.error(`Failed to send Slack notification: ${slackResult.error}`);
        }
      } catch (slackError) {
        console.error("Error sending Slack notification:", slackError);

        await supabase.from("stuck_process_notifications").insert({
          processo_id: process.processo_id,
          processo_numero: process.processo_numero,
          notification_sent_successfully: false,
          error_message: slackError instanceof Error ? slackError.message : "Unknown error",
          metadata: {
            stuck_at_prompt_order: process.stuck_at_prompt_order,
            stuck_at_prompt_title: process.stuck_at_prompt_title,
            minutes_stuck: process.minutes_stuck,
            total_pages: process.total_pages,
            user_email: process.user_email,
          },
        });
      }
    }

    return new Response(
      JSON.stringify({
        message: "Stuck process detection completed",
        total_stuck: stuckProcesses.length,
        notifications_sent: notificationsSent,
        notifications_skipped: notificationsSkipped,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in detect-stuck-processes:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
