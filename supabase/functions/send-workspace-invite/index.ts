import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface WorkspaceInviteRequest {
  shareId: string;
  processoId: string;
  invitedEmail: string;
  invitedName: string;
  permissionLevel: "read_only" | "editor";
  userExists: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log("=== SEND WORKSPACE INVITE - START ===");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    if (!resendApiKey) {
      throw new Error("Missing RESEND_API_KEY environment variable");
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
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const {
      shareId,
      processoId,
      invitedEmail,
      invitedName,
      permissionLevel,
      userExists,
    }: WorkspaceInviteRequest = await req.json();

    console.log("Request data:", {
      shareId,
      processoId,
      invitedEmail,
      invitedName,
      permissionLevel,
      userExists
    });

    console.log("Step 1: Fetching processo details...");
    const { data: processo, error: processoError } = await supabaseClient
      .from("processos")
      .select("file_name")
      .eq("id", processoId)
      .single();

    if (processoError || !processo) {
      console.error("Processo not found:", processoError);
      return new Response(
        JSON.stringify({ error: "Processo not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("✓ Processo found:", processo.file_name);

    console.log("Step 2: Fetching owner profile...");
    const { data: ownerProfile } = await supabaseClient
      .from("user_profiles")
      .select("first_name, last_name, email")
      .eq("id", user.id)
      .maybeSingle();

    const ownerFirstName = ownerProfile?.first_name || "um";
    const ownerLastName = ownerProfile?.last_name || "colega";

    console.log("Step 3: Creating notification for existing user (if applicable)...");
    const permissionText = permissionLevel === "read_only" ? "Somente Leitura" : "Editor";

    if (userExists) {
      const { data: invitedUserProfile } = await supabaseClient
        .from("user_profiles")
        .select("id")
        .eq("email", invitedEmail.toLowerCase())
        .maybeSingle();

      if (invitedUserProfile) {
        await supabaseClient.from("notifications").insert({
          user_id: invitedUserProfile.id,
          type: "workspace_share",
          title: "Novo processo compartilhado",
          message: `${ownerFirstName} ${ownerLastName} compartilhou o processo "${processo.file_name}" com você (${permissionText})`,
          link: `/lawsuits-detail/${processoId}`,
        });

        console.log("✓ Notification created for existing user");
      }
    }

    console.log("Step 4: Sending invitation email via Resend...");

    const templateId = "06d6d862-a22e-4aee-9b3f-e891b61d61ba";
    const signUpUrl = userExists
      ? `https://app.wislegal.io/lawsuits-detail/${processoId}`
      : `https://app.wislegal.io/sign-up?workspace=${shareId}`;

    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "WisLegal <noreply@wislegal.io>";

    const resendPayload = {
      from: fromEmail,
      to: [invitedEmail.toLowerCase()],
      template: {
        id: templateId,
        variables: {
          shared_with_name: invitedName,
          first_name: ownerFirstName,
          last_name: ownerLastName,
          file_name: processo.file_name,
          signup_url: signUpUrl
        }
      }
    };

    console.log("Sending email with template ID:", templateId);
    console.log("Template variables:", {
      shared_with_name: invitedName,
      first_name: ownerFirstName,
      last_name: ownerLastName,
      file_name: processo.file_name,
      signup_url: signUpUrl
    });

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify(resendPayload),
    });

    let resendSuccess = false;
    let resendResult: any = null;

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      console.error("Resend API error:", resendResponse.status, errorText);
      console.error("⚠️ Email not sent, but workspace share was created successfully");
    } else {
      resendResult = await resendResponse.json();
      console.log("✓ Email sent successfully via Resend template:", resendResult);
      resendSuccess = true;
    }

    console.log("Step 5: Logging email send to database...");
    const { error: logError } = await supabaseClient
      .from("email_logs")
      .insert({
        user_id: user.id,
        email: invitedEmail.toLowerCase(),
        type: "workspace_invite",
        status: resendSuccess ? "success" : "failed",
        email_provider_response: {
          resend_id: resendResult?.id || null,
          share_id: shareId,
          processo_id: processoId
        },
        sent_at: new Date().toISOString()
      });

    if (logError) {
      console.error("Failed to log email:", logError);
    } else {
      console.log("✓ Email send logged to database");
    }

    console.log("=== SEND WORKSPACE INVITE - SUCCESS ===");

    return new Response(
      JSON.stringify({
        success: true,
        message: userExists
          ? "Processo compartilhado com sucesso!"
          : "Convite enviado com sucesso!",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("💥 Error in send-workspace-invite function:", error);
    console.error("Stack trace:", error instanceof Error ? error.stack : "No stack trace");

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Erro desconhecido",
        success: false
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
