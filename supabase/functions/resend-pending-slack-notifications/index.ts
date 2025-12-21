import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { sendToSlack, type NotificationSeverity } from "./_shared/slack-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log("[resend-pending-slack] Starting resend process...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: slackConfigs } = await supabase
      .from("slack_notifications")
      .select("webhook_url, notification_types")
      .eq("is_active", true);

    if (!slackConfigs || slackConfigs.length === 0) {
      console.log("[resend-pending-slack] No active Slack configs found");
      return new Response(
        JSON.stringify({ success: false, message: "No active Slack configs" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: pendingNotifications } = await supabase
      .from("admin_notifications")
      .select(`
        id,
        notification_type_id,
        severity,
        title,
        message,
        metadata,
        admin_notification_types!inner(slug)
      `)
      .eq("sent_to_slack", false)
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: true });

    if (!pendingNotifications || pendingNotifications.length === 0) {
      console.log("[resend-pending-slack] No pending notifications found");
      return new Response(
        JSON.stringify({ success: true, message: "No pending notifications", count: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[resend-pending-slack] Found ${pendingNotifications.length} pending notifications`);

    let successCount = 0;
    let failureCount = 0;

    for (const notification of pendingNotifications) {
      const notificationSlug = (notification.admin_notification_types as any).slug;

      const matchingConfig = slackConfigs.find((config: any) =>
        config.notification_types && config.notification_types.includes(notificationSlug)
      );

      if (!matchingConfig) {
        console.log(`[resend-pending-slack] No matching config for type: ${notificationSlug}`);
        continue;
      }

      console.log(`[resend-pending-slack] Sending notification ${notification.id} to Slack...`);

      const slackResult = await sendToSlack({
        webhookUrl: matchingConfig.webhook_url,
        severity: notification.severity as NotificationSeverity,
        title: notification.title,
        message: notification.message,
        metadata: notification.metadata as Record<string, unknown>,
      });

      await supabase
        .from("admin_notifications")
        .update({
          sent_to_slack: slackResult.success,
          slack_message_id: slackResult.messageId || null,
          slack_response: slackResult.response ? JSON.parse(JSON.stringify(slackResult.response)) : null,
          error_message: slackResult.error || null,
        })
        .eq("id", notification.id);

      if (slackResult.success) {
        successCount++;
        console.log(`[resend-pending-slack] ✓ Sent notification ${notification.id}`);
      } else {
        failureCount++;
        console.error(`[resend-pending-slack] ✗ Failed to send ${notification.id}:`, slackResult.error);
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`[resend-pending-slack] Completed: ${successCount} success, ${failureCount} failures`);

    return new Response(
      JSON.stringify({
        success: true,
        total: pendingNotifications.length,
        sent: successCount,
        failed: failureCount,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[resend-pending-slack] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});