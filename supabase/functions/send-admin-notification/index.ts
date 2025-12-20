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

    if (!authHeader) {
      console.warn('[send-admin-notification] Missing authorization header');
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[send-admin-notification] Request received');

    const notificationsEnabled = Deno.env.get('ADMIN_NOTIFICATIONS_ENABLED');
    if (notificationsEnabled === 'false') {
      return new Response(
        JSON.stringify({ success: true, message: 'Notifications disabled by flag' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: NotificationPayload = await req.json();
    const { type_slug, title, message, severity, metadata = {}, user_id, processo_id } = payload;

    console.log('[send-admin-notification] Processing notification:', type_slug);

    if (!type_slug || !title || !message) {
      console.warn('[send-admin-notification] Missing required fields');
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: notificationType, error: typeError } = await supabase
      .from('admin_notification_types')
      .select('id, slug, name, default_severity, category, icon')
      .eq('slug', type_slug)
      .eq('is_active', true)
      .maybeSingle();

    if (typeError || !notificationType) {
      console.warn('[send-admin-notification] Type not found or inactive:', type_slug, typeError);
      return new Response(
        JSON.stringify({ success: false, error: 'Notification type not found or inactive' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const typeData = notificationType as unknown as NotificationTypeRow;
    console.log('[send-admin-notification] Found notification type:', typeData.name);

    const { data: config, error: configError } = await supabase
      .from('admin_notification_config')
      .select('is_enabled, notify_slack')
      .eq('notification_type_id', typeData.id)
      .maybeSingle();

    if (configError || !config) {
      console.warn('[send-admin-notification] Config not found:', type_slug, configError);
      return new Response(
        JSON.stringify({ success: false, error: 'Notification config not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const configData = config as unknown as NotificationConfigRow;

    if (!configData.is_enabled) {
      console.log('[send-admin-notification] Notification type disabled:', type_slug);
      return new Response(
        JSON.stringify({ success: true, message: 'Notification type is disabled' }),
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
        JSON.stringify({ success: false, error: 'Failed to insert notification' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const notificationId = (insertedNotification as { id: string }).id;
    console.log('[send-admin-notification] Notification saved:', notificationId);

    if (configData.notify_slack) {
      try {
        console.log('[send-admin-notification] Fetching Slack configs for type:', type_slug);

        const { data: slackConfigs, error: slackConfigError } = await supabase
          .from('slack_notifications')
          .select('webhook_url, is_active, notification_types')
          .eq('is_active', true);

        console.log('[send-admin-notification] Slack configs found:', slackConfigs?.length || 0);

        if (slackConfigError) {
          console.error('[send-admin-notification] Error fetching Slack configs:', slackConfigError);
        }

        if (slackConfigs && slackConfigs.length > 0) {
          const matchingConfig = slackConfigs.find((config: { notification_types: string[] }) =>
            config.notification_types && config.notification_types.includes(type_slug)
          );

          console.log('[send-admin-notification] Matching config found:', !!matchingConfig);

          if (matchingConfig) {
            const slackConfig = matchingConfig as unknown as SlackNotificationRow;

            console.log('[send-admin-notification] Sending to Slack:', slackConfig.webhook_url.substring(0, 50) + '...');

            const slackResult = await sendToSlack({
              webhookUrl: slackConfig.webhook_url,
              severity: finalSeverity,
              title: title,
              message,
              metadata,
            });

            console.log('[send-admin-notification] Slack result:', slackResult.success ? 'SUCCESS' : 'FAILED');
            if (!slackResult.success) {
              console.error('[send-admin-notification] Slack error:', slackResult.error);
            }

            await supabase
              .from('admin_notifications')
              .update({
                sent_to_slack: slackResult.success,
                slack_message_id: slackResult.messageId || null,
                slack_response: slackResult.response ? JSON.parse(JSON.stringify(slackResult.response)) : null,
                error_message: slackResult.error || null,
              })
              .eq('id', notificationId);
          } else {
            console.log('[send-admin-notification] No matching Slack config for type:', type_slug);
          }
        } else {
          console.log('[send-admin-notification] No active Slack configs found');
        }
      } catch (slackError) {
        console.error('[send-admin-notification] Slack error (non-blocking):', slackError);
        
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
    console.error('[send-admin-notification] Critical error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});