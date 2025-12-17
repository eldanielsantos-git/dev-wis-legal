import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { sendToSlack, type NotificationSeverity } from "./_shared/slack-client.ts";
import { corsHeaders, handleCorsPreflightRequest } from "./_shared/cors.ts";

interface NotificationPayload {
  type_slug: string;
  title: string;
  message: string;
  severity?: NotificationSeverity;
  metadata?: Record<string, unknown>;
  user_id?: string;
  processo_id?: string;
}

interface NotificationTypeRow {
  id: string;
  slug: string;
  name: string;
  default_severity: NotificationSeverity;
  category: string;
  icon: string;
}

interface NotificationConfigRow {
  is_enabled: boolean;
  notify_slack: boolean;
}

interface SlackNotificationRow {
  webhook_url: string;
  is_active: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return handleCorsPreflightRequest();
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!authHeader || !authHeader.includes(supabaseServiceKey || '')) {
      return new Response(
        JSON.stringify({ success: true, message: 'Unauthorized but silently ignored' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const notificationsEnabled = Deno.env.get('ADMIN_NOTIFICATIONS_ENABLED');
    if (notificationsEnabled === 'false') {
      return new Response(
        JSON.stringify({ success: true, message: 'Notifications disabled by flag' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey!);

    const payload: NotificationPayload = await req.json();
    const { type_slug, title, message, severity, metadata = {}, user_id, processo_id } = payload;

    if (!type_slug || !title || !message) {
      return new Response(
        JSON.stringify({ success: true, message: 'Missing required fields but silently ignored' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: notificationType, error: typeError } = await supabase
      .from('admin_notification_types')
      .select('id, slug, name, default_severity, category, icon')
      .eq('slug', type_slug)
      .eq('is_active', true)
      .maybeSingle();

    if (typeError || !notificationType) {
      console.warn('[send-admin-notification] Type not found or inactive:', type_slug);
      return new Response(
        JSON.stringify({ success: true, message: 'Type not found but silently ignored' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const typeData = notificationType as unknown as NotificationTypeRow;

    const { data: config, error: configError } = await supabase
      .from('admin_notification_config')
      .select('is_enabled, notify_slack')
      .eq('notification_type_id', typeData.id)
      .maybeSingle();

    if (configError || !config) {
      console.warn('[send-admin-notification] Config not found:', type_slug);
      return new Response(
        JSON.stringify({ success: true, message: 'Config not found but silently ignored' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const configData = config as unknown as NotificationConfigRow;

    if (!configData.is_enabled) {
      return new Response(
        JSON.stringify({ success: true, message: 'Notification type disabled' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const finalSeverity = severity || typeData.default_severity;

    const notificationRecord = {
      notification_type_id: typeData.id,
      severity: finalSeverity,
      title,
      message,
      metadata,
      user_id: user_id || null,
      processo_id: processo_id || null,
      sent_to_slack: false,
      slack_message_id: null,
      slack_response: null,
      error_message: null,
    };

    const { data: insertedNotification, error: insertError } = await supabase
      .from('admin_notifications')
      .insert(notificationRecord)
      .select('id')
      .single();

    if (insertError) {
      console.error('[send-admin-notification] Failed to insert notification:', insertError);
      return new Response(
        JSON.stringify({ success: true, message: 'Failed to insert but silently ignored' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const notificationId = (insertedNotification as { id: string }).id;

    if (configData.notify_slack) {
      try {
        const { data: slackConfigs, error: slackConfigError } = await supabase
          .from('slack_notifications')
          .select('webhook_url, is_active')
          .eq('is_active', true)
          .contains('notification_types', [type_slug]);

        if (!slackConfigError && slackConfigs && slackConfigs.length > 0) {
          const slackConfig = slackConfigs[0] as unknown as SlackNotificationRow;

          const slackResult = await sendToSlack({
            webhookUrl: slackConfig.webhook_url,
            severity: finalSeverity,
            title: `${typeData.icon} ${title}`,
            message,
            metadata,
          });

          await supabase
            .from('admin_notifications')
            .update({
              sent_to_slack: slackResult.success,
              slack_message_id: slackResult.messageId || null,
              slack_response: slackResult.response ? JSON.parse(JSON.stringify(slackResult.response)) : null,
              error_message: slackResult.error || null,
            })
            .eq('id', notificationId);
        }
      } catch (slackError) {
        console.error('[send-admin-notification] Slack error (ignored):', slackError);
        
        try {
          await supabase
            .from('admin_notifications')
            .update({
              error_message: slackError instanceof Error ? slackError.message : 'Unknown Slack error',
            })
            .eq('id', notificationId);
        } catch {
          // Ignore update errors
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, notification_id: notificationId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[send-admin-notification] Critical error (ignored):', error);
    return new Response(
      JSON.stringify({ success: true, message: 'Error ignored for safety' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
