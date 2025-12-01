import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface InviteRequest {
  invitedName: string;
  invitedEmail: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log("=== SEND FRIEND INVITE - START ===");

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

    const { invitedName, invitedEmail }: InviteRequest = await req.json();

    console.log("Request data:", { invitedName, invitedEmail, inviter_id: user.id });

    if (!invitedName || !invitedEmail) {
      return new Response(
        JSON.stringify({ error: "Nome e email s\u00e3o obrigat\u00f3rios" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(invitedEmail)) {
      return new Response(
        JSON.stringify({ error: "Email inv\u00e1lido" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Step 1: Checking if email is already registered...");
    const { data: existingUser, error: checkUserError } = await supabaseClient
      .from("user_profiles")
      .select("email")
      .eq("email", invitedEmail.toLowerCase())
      .maybeSingle();

    if (checkUserError) {
      console.error("Error checking existing user:", checkUserError);
    }

    if (existingUser) {
      return new Response(
        JSON.stringify({ error: "Este email j\u00e1 est\u00e1 cadastrado na plataforma" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Step 2: Checking for existing invite...");
    const { data: existingInvite, error: checkInviteError } = await supabaseClient
      .from("invite_friend")
      .select("id, status")
      .eq("inviter_user_id", user.id)
      .eq("invited_email", invitedEmail.toLowerCase())
      .maybeSingle();

    if (checkInviteError) {
      console.error("Error checking existing invite:", checkInviteError);
    }

    let invite: any;

    if (existingInvite) {
      if (existingInvite.status === "accepted") {
        return new Response(
          JSON.stringify({ error: "Este convite j\u00e1 foi aceito. O usu\u00e1rio j\u00e1 est\u00e1 cadastrado na plataforma." }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      console.log("Step 3: Updating existing pending/expired invite...");
      const { data: updatedInvite, error: updateError } = await supabaseClient
        .from("invite_friend")
        .update({
          invited_name: invitedName,
          status: "pending"
        })
        .eq("id", existingInvite.id)
        .select()
        .single();

      if (updateError) {
        console.error("Error updating invite:", updateError);
        return new Response(
          JSON.stringify({ error: "Erro ao atualizar convite" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      invite = updatedInvite;
      console.log("✓ Existing invite updated successfully:", invite.id);
    } else {
      console.log("Step 3: Creating new invite in database...");
      const { data: newInvite, error: insertError } = await supabaseClient
        .from("invite_friend")
        .insert({
          inviter_user_id: user.id,
          invited_name: invitedName,
          invited_email: invitedEmail.toLowerCase(),
          status: "pending",
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error inserting invite:", insertError);
        return new Response(
          JSON.stringify({ error: "Erro ao salvar convite" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      invite = newInvite;
      console.log("✓ New invite created successfully:", invite.id);
    }

    console.log("Step 4: Fetching inviter profile...");
    const { data: inviterProfile } = await supabaseClient
      .from("user_profiles")
      .select("first_name, last_name")
      .eq("id", user.id)
      .maybeSingle();

    const inviterFirstName = inviterProfile?.first_name || "um colega";

    console.log("Step 5: Sending invitation email via Resend...");

    const templateId = "35d5eb17-4f31-4787-bb3b-c344eeb00693";
    const signUpUrl = `https://dev-app.wislegal.io/sign-up?invite=${invite.id}`;

    const resendPayload = {
      from: "WisLegal <noreply@wislegal.io>",
      to: [invitedEmail.toLowerCase()],
      template: {
        id: templateId,
        variables: {
          invited_name: invitedName,
          first_name: inviterFirstName,
          signup_url: signUpUrl
        }
      }
    };

    console.log("Sending email with template ID:", templateId);
    console.log("Template variables:", {
      invited_name: invitedName,
      first_name: inviterFirstName,
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
      console.error("⚠️ Email not sent, but invite was saved successfully");
    } else {
      resendResult = await resendResponse.json();
      console.log("✓ Email sent successfully via Resend template:", resendResult);
      resendSuccess = true;
    }

    console.log("Step 6: Logging email send to database...");
    const { error: logError } = await supabaseClient
      .from("email_logs")
      .insert({
        user_id: user.id,
        email: invitedEmail.toLowerCase(),
        type: "friend_invite",
        status: resendSuccess ? "success" : "failed",
        email_provider_response: { resend_id: resendResult?.id || null, invite_id: invite.id },
        sent_at: new Date().toISOString()
      });

    if (logError) {
      console.error("Failed to log email:", logError);
    } else {
      console.log("✓ Email send logged to database");
    }

    console.log("=== SEND FRIEND INVITE - SUCCESS ===");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Convite enviado com sucesso!",
        invite: {
          id: invite.id,
          invitedName: invite.invited_name,
          invitedEmail: invite.invited_email,
          createdAt: invite.created_at,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("💥 Error in send-friend-invite function:", error);
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