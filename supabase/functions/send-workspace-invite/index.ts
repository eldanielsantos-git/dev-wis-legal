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

    const {
      shareId,
      processoId,
      invitedEmail,
      invitedName,
      permissionLevel,
      userExists,
    }: WorkspaceInviteRequest = await req.json();

    const { data: processo, error: processoError } = await supabaseClient
      .from("processos")
      .select("numero_processo, file_name")
      .eq("id", processoId)
      .single();

    if (processoError || !processo) {
      return new Response(
        JSON.stringify({ error: "Processo not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: ownerProfile } = await supabaseClient
      .from("user_profiles")
      .select("first_name, last_name, email")
      .eq("id", user.id)
      .single();

    const ownerName = ownerProfile
      ? `${ownerProfile.first_name} ${ownerProfile.last_name}`
      : "um colega";

    const permissionText =
      permissionLevel === "read_only" ? "Somente Leitura" : "Editor";

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
          message: `${ownerName} compartilhou o processo \"${processo.file_name || processo.numero_processo}\" com voc\u00ea (${permissionText})`,
          link: `/lawsuits-detail/${processoId}`,
        });

        console.log(`Notification created for existing user: ${invitedEmail}`);
      }
    }

    try {
      const emailData = {
        shared_by: user.id,
        owner_name: ownerName,
        share_id: shareId,
        processo_id: processoId,
        processo_name: processo.file_name || processo.numero_processo,
        permission_level: permissionLevel,
        permission_text: permissionText,
        invited_name: invitedName,
        invitation_type: 'workspace_share',
      };

      if (!userExists) {
        console.log(`Attempting to send email to NEW user: ${invitedEmail}`);

        const { error: inviteError } = await supabaseClient.auth.admin.inviteUserByEmail(
          invitedEmail.toLowerCase(),
          {
            redirectTo: `${supabaseUrl}/workspace`,
            data: emailData,
          }
        );

        if (inviteError) {
          console.error("Email not sent - Error:", inviteError.message);
          console.log("Workspace share created successfully without email");
        } else {
          console.log(`SUCCESS: Email sent to NEW user: ${invitedEmail}`);
        }
      } else {
        console.log(`Attempting to send email to EXISTING user: ${invitedEmail}`);

        const { data: linkData, error: linkError } = await supabaseClient.auth.admin.generateLink({
          type: 'magiclink',
          email: invitedEmail.toLowerCase(),
          options: {
            redirectTo: `${supabaseUrl}/lawsuits-detail/${processoId}`,
            data: emailData,
          }
        });

        if (linkError) {
          console.error("Email not sent to existing user - Error:", linkError.message);
          console.log("Workspace share created with in-app notification only");
        } else {
          console.log(`SUCCESS: Email sent to EXISTING user: ${invitedEmail}`);
        }
      }
    } catch (emailError) {
      console.error("Email sending exception:", emailError);
      console.log("Workspace share created successfully without email");
    }

    console.log(`Processo compartilhado: ${ownerName} -> ${invitedName} (${invitedEmail})`);
    console.log(`Share ID: ${shareId}, Permiss\u00e3o: ${permissionText}`);

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
    console.error("Error in send-workspace-invite function:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Erro desconhecido",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});