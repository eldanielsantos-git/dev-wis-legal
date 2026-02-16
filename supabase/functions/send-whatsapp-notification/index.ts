import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface NotificationRequest {
  message_key: string;
  user_id: string;
  processo_id?: string;
  phone: string;
  replacements?: Record<string, string>;
  document_base64?: string;
  document_filename?: string;
  link_url?: string;
  link_title?: string;
  link_description?: string;
  is_retry?: boolean;
  retry_count?: number;
}

interface WhatsAppMessage {
  message_key: string;
  message_type: string;
  message_text: string;
  send_via_whatsapp: boolean;
  link_title: string | null;
  link_description: string | null;
}

const MAX_RETRIES = 3;
const RETRY_DELAYS = [30000, 120000, 300000];

async function logWhatsAppMessage(
  supabase: ReturnType<typeof createClient>,
  params: {
    processo_id?: string;
    user_id: string;
    phone_number: string;
    message_key: string;
    message_type: string;
    message_sent: string;
    zapi_response: Record<string, unknown> | null;
    success: boolean;
    error_message?: string;
    retry_count: number;
  }
): Promise<void> {
  try {
    await supabase.from("wis_whatsapp_logs").insert({
      processo_id: params.processo_id || null,
      user_id: params.user_id,
      phone_number: params.phone_number,
      message_key: params.message_key,
      message_type: params.message_type,
      message_sent: params.message_sent,
      zapi_response: params.zapi_response,
      success: params.success,
      error_message: params.error_message || null,
      retry_count: params.retry_count,
    });
  } catch (error) {
    console.error("[send-whatsapp-notification] Error logging message:", error);
  }
}

async function sendTextMessage(
  supabaseUrl: string,
  serviceKey: string,
  phone: string,
  message: string
): Promise<{ success: boolean; response: Record<string, unknown> }> {
  const response = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-text`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ phone, message }),
  });

  const data = await response.json();
  return { success: data.success === true, response: data };
}

async function sendDocumentMessage(
  supabaseUrl: string,
  serviceKey: string,
  phone: string,
  document_base64: string,
  filename: string,
  caption: string
): Promise<{ success: boolean; response: Record<string, unknown> }> {
  const response = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-document`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ phone, document_base64, filename, caption }),
  });

  const data = await response.json();
  return { success: data.success === true, response: data };
}

async function sendLinkMessage(
  supabaseUrl: string,
  serviceKey: string,
  phone: string,
  message: string,
  link_url: string,
  title: string,
  link_description?: string
): Promise<{ success: boolean; response: Record<string, unknown> }> {
  const response = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-link`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      phone,
      message,
      link_url,
      title,
      link_description: link_description || "",
    }),
  });

  const data = await response.json();
  return { success: data.success === true, response: data };
}

function applyReplacements(text: string, replacements: Record<string, string>): string {
  let result = text;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }
  return result;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const requestData: NotificationRequest = await req.json();
    const {
      message_key,
      user_id,
      processo_id,
      phone,
      replacements = {},
      document_base64,
      document_filename,
      link_url,
      link_title,
      link_description,
      is_retry = false,
      retry_count = 0,
    } = requestData;

    console.log(`[send-whatsapp-notification] Processing: ${message_key} for user ${user_id}`);

    if (!message_key || !user_id || !phone) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: message_key, user_id, phone",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: config } = await supabase
      .from("wis_whatsapp_config")
      .select("is_enabled")
      .limit(1)
      .maybeSingle();

    if (!config?.is_enabled) {
      console.log("[send-whatsapp-notification] WhatsApp notifications are disabled globally");
      return new Response(
        JSON.stringify({
          success: false,
          skipped: true,
          reason: "WhatsApp notifications disabled",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: messageTemplate } = await supabase
      .from("wis_whatsapp_messages")
      .select("*")
      .eq("message_key", message_key)
      .maybeSingle();

    if (!messageTemplate) {
      console.error(`[send-whatsapp-notification] Message template not found: ${message_key}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Message template not found: ${message_key}`,
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const whatsappMessage = messageTemplate as WhatsAppMessage;

    if (!whatsappMessage.send_via_whatsapp) {
      console.log(`[send-whatsapp-notification] Message ${message_key} is not enabled for WhatsApp`);
      return new Response(
        JSON.stringify({
          success: false,
          skipped: true,
          reason: "Message not enabled for WhatsApp",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const messageText = applyReplacements(whatsappMessage.message_text, replacements);

    let sendResult: { success: boolean; response: Record<string, unknown> };
    let messageType: string;

    if (document_base64 && document_filename) {
      messageType = "document";
      sendResult = await sendDocumentMessage(
        supabaseUrl,
        supabaseServiceKey,
        phone,
        document_base64,
        document_filename,
        messageText
      );
    } else if (link_url) {
      messageType = "link";
      const rawLinkTitle = link_title || whatsappMessage.link_title || message_key;
      const rawLinkDescription = link_description || whatsappMessage.link_description || "";
      const finalLinkTitle = applyReplacements(rawLinkTitle, replacements);
      const finalLinkDescription = applyReplacements(rawLinkDescription, replacements);
      sendResult = await sendLinkMessage(
        supabaseUrl,
        supabaseServiceKey,
        phone,
        messageText,
        link_url,
        finalLinkTitle,
        finalLinkDescription
      );
    } else {
      messageType = "text";
      sendResult = await sendTextMessage(supabaseUrl, supabaseServiceKey, phone, messageText);
    }

    await logWhatsAppMessage(supabase, {
      processo_id,
      user_id,
      phone_number: phone,
      message_key,
      message_type: messageType,
      message_sent: messageText,
      zapi_response: sendResult.response,
      success: sendResult.success,
      error_message: sendResult.success ? undefined : JSON.stringify(sendResult.response),
      retry_count,
    });

    if (!sendResult.success && retry_count < MAX_RETRIES) {
      const nextRetryCount = retry_count + 1;
      const delayMs = RETRY_DELAYS[retry_count] || RETRY_DELAYS[RETRY_DELAYS.length - 1];

      console.log(
        `[send-whatsapp-notification] Scheduling retry ${nextRetryCount}/${MAX_RETRIES} in ${delayMs}ms`
      );

      EdgeRuntime.waitUntil(
        (async () => {
          await new Promise((resolve) => setTimeout(resolve, delayMs));

          try {
            await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-notification`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                ...requestData,
                is_retry: true,
                retry_count: nextRetryCount,
              }),
            });
          } catch (retryError) {
            console.error("[send-whatsapp-notification] Retry failed:", retryError);
          }
        })()
      );
    }

    return new Response(
      JSON.stringify({
        success: sendResult.success,
        message_type: messageType,
        message_sent: messageText,
        retry_count,
        will_retry: !sendResult.success && retry_count < MAX_RETRIES,
        zapi_response: sendResult.response,
      }),
      {
        status: sendResult.success ? 200 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[send-whatsapp-notification] Error:", error);
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
