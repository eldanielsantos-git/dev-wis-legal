import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SendLinkRequest {
  phone: string;
  message: string;
  link_url: string;
  title: string;
  link_description?: string;
  image?: string;
}

interface ZApiResponse {
  zaapId?: string;
  messageId?: string;
  id?: string;
  error?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const zapiInstanceId = Deno.env.get("ZAPI_INSTANCE_ID");
    const zapiToken = Deno.env.get("ZAPI_TOKEN");
    const zapiClientToken = Deno.env.get("ZAPI_CLIENT_TOKEN");

    if (!zapiInstanceId || !zapiToken || !zapiClientToken) {
      console.error("[send-whatsapp-link] Missing Z-API environment variables");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Z-API not configured",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { phone, message, link_url, title, link_description, image }: SendLinkRequest = await req.json();

    if (!phone || !message || !link_url || !title) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: phone, message, link_url, title",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const cleanPhone = phone.replace(/[\s\-\(\)\+]/g, "");
    const phoneWithCountry = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

    console.log(`[send-whatsapp-link] Sending link "${title}" to ${phoneWithCountry}`);

    const zapiUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-link`;

    const messageWithLink = message.includes(link_url) ? message : `${message} ${link_url}`;

    const response = await fetch(zapiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": zapiClientToken,
      },
      body: JSON.stringify({
        phone: phoneWithCountry,
        message: messageWithLink,
        image: image || "https://wislegal.io/logo.png",
        linkUrl: link_url,
        title: title,
        linkDescription: link_description || "",
      }),
    });

    const responseData: ZApiResponse = await response.json();

    if (!response.ok) {
      console.error(`[send-whatsapp-link] Z-API error:`, responseData);
      return new Response(
        JSON.stringify({
          success: false,
          error: responseData.error || "Z-API request failed",
          status_code: response.status,
          zapi_response: responseData,
        }),
        {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[send-whatsapp-link] Link sent successfully:`, responseData.messageId);

    return new Response(
      JSON.stringify({
        success: true,
        message_id: responseData.messageId,
        zaap_id: responseData.zaapId,
        zapi_response: responseData,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[send-whatsapp-link] Error:", error);
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
