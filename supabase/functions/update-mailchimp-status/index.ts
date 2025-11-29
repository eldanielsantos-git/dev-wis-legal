import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface UpdateStatusRequest {
  email: string;
  status: "pendente" | "confirmado";
}

async function md5Hash(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("MD5", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req: Request) => {
  console.log("🚀 update-mailchimp-status function called");
  console.log("Method:", req.method);

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const mailchimpApiKey = Deno.env.get("MAILCHIMP_API_KEY");
    const mailchimpAudienceId = Deno.env.get("MAILCHIMP_AUDIENCE_ID");

    console.log("Environment check:");
    console.log("- SUPABASE_URL:", supabaseUrl ? "✓" : "✗");
    console.log("- SUPABASE_SERVICE_ROLE_KEY:", supabaseServiceKey ? "✓" : "✗");
    console.log("- MAILCHIMP_API_KEY:", mailchimpApiKey ? "✓" : "✗");
    console.log("- MAILCHIMP_AUDIENCE_ID:", mailchimpAudienceId ? "✓" : "✗");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    if (!mailchimpApiKey || !mailchimpAudienceId) {
      throw new Error("Missing Mailchimp environment variables");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      console.error("User verification error:", userError);
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("User verified:", user.id, user.email);

    const { email, status }: UpdateStatusRequest = await req.json();

    console.log("Request data:", { email, status });

    if (!email || !status) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: email, status" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (status !== "pendente" && status !== "confirmado") {
      return new Response(
        JSON.stringify({ error: "Invalid status. Must be 'pendente' or 'confirmado'" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Step 1: Calculating MD5 hash of email...");
    const emailHash = await md5Hash(email.toLowerCase());
    console.log("Email hash:", emailHash);

    console.log("Step 2: Updating Mailchimp member status...");
    const updateUrl = `https://us3.api.mailchimp.com/3.0/lists/${mailchimpAudienceId}/members/${emailHash}`;

    const updatePayload = {
      merge_fields: {
        CONFIRM_STATUS: status
      }
    };

    console.log("Update payload:", updatePayload);

    const updateResponse = await fetch(updateUrl, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${mailchimpApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updatePayload),
    });

    console.log("Mailchimp API response status:", updateResponse.status);

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error("Failed to update Mailchimp member:", errorText);

      return new Response(
        JSON.stringify({
          error: `Mailchimp API error: ${updateResponse.status}`,
          details: errorText,
          success: false
        }),
        {
          status: updateResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const responseData = await updateResponse.json();
    console.log("✓ Mailchimp member updated successfully:", responseData.id);

    console.log("Step 3: Logging status update to database...");
    const { error: logError } = await supabaseClient
      .from("email_logs")
      .insert({
        user_id: user.id,
        email: email,
        type: "status_update",
        status: "success",
        mailchimp_response: {
          status_updated: true,
          new_status: status,
          member_id: responseData.id
        },
        sent_at: new Date().toISOString()
      });

    if (logError) {
      console.error("Failed to log status update:", logError);
    } else {
      console.log("✓ Status update logged to database");
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Mailchimp status updated to: ${status}`,
        member_id: responseData.id
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("💥 Error in update-mailchimp-status function:", error);
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
