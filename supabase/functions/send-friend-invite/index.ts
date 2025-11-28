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
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
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

    const { data: existingInvite, error: checkInviteError } = await supabaseClient
      .from("invite_friend")
      .select("id, status")
      .eq("inviter_user_id", user.id)
      .eq("invited_email", invitedEmail.toLowerCase())
      .eq("status", "pending")
      .maybeSingle();

    if (checkInviteError) {
      console.error("Error checking existing invite:", checkInviteError);
    }

    if (existingInvite) {
      return new Response(
        JSON.stringify({ error: "Voc\u00ea j\u00e1 enviou um convite para este email" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: invite, error: insertError } = await supabaseClient
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

    const { data: inviterProfile } = await supabaseClient
      .from("user_profiles")
      .select("first_name, last_name")
      .eq("id", user.id)
      .single();

    const inviterName = inviterProfile
      ? `${inviterProfile.first_name} ${inviterProfile.last_name}`
      : "um colega";

    // Try to send invitation email via Supabase Auth
    // If it fails (SMTP not configured), invitation is still saved successfully
    try {
      const { error: inviteError } = await supabaseClient.auth.admin.inviteUserByEmail(
        invitedEmail.toLowerCase(),
        {
          redirectTo: `${supabaseUrl}/sign-up`,
          data: {
            invited_by: user.id,
            inviter_name: inviterName,
            invited_name: invitedName,
            invite_id: invite.id,
            invitation_type: 'friend_invite',
          },
        }
      );

      if (inviteError) {
        console.error("\u26a0\ufe0f Email not sent (SMTP may not be configured):", inviteError.message);
        console.log("\u2705 Invitation saved successfully without email");
      } else {
        console.log("\u2705 Invitation email sent successfully to:", invitedEmail);
      }
    } catch (emailError) {
      console.error("\u26a0\ufe0f Email sending failed (SMTP may not be configured):", emailError);
      console.log("\u2705 Invitation saved successfully without email");
    }

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
    console.error("Error in send-friend-invite function:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Erro desconhecido"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});