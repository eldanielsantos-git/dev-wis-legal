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

    // Get processo details
    const { data: processo, error: processoError } = await supabaseClient
      .from("processos")
      .select("numero_processo, nome_processo")
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

    // Get owner profile
    const { data: ownerProfile } = await supabaseClient
      .from("user_profiles")
      .select("first_name, last_name, email")
      .eq("user_id", user.id)
      .single();

    const ownerName = ownerProfile
      ? `${ownerProfile.first_name} ${ownerProfile.last_name}`
      : "um colega";

    const permissionText =
      permissionLevel === "read_only" ? "Somente Leitura" : "Editor";

    // Create notification for existing users
    if (userExists) {
      const { data: invitedUserProfile } = await supabaseClient
        .from("user_profiles")
        .select("user_id")
        .eq("email", invitedEmail.toLowerCase())
        .maybeSingle();

      if (invitedUserProfile) {
        await supabaseClient.from("notifications").insert({
          user_id: invitedUserProfile.user_id,
          type: "workspace_share",
          title: "Novo processo compartilhado",
          message: `${ownerName} compartilhou o processo "${processo.nome_processo || processo.numero_processo}" com você (${permissionText})`,
          link: `/lawsuits-detail/${processoId}`,
        });
      }
    }

    // For new users, send invitation email
    if (!userExists) {
      try {
        const { error: inviteError } = await supabaseClient.auth.admin.inviteUserByEmail(
          invitedEmail.toLowerCase(),
          {
            redirectTo: `${supabaseUrl}/workspace`,
            data: {
              shared_by: user.id,
              owner_name: ownerName,
              share_id: shareId,
              processo_id: processoId,
              processo_name: processo.nome_processo || processo.numero_processo,
              permission_level: permissionLevel,
            },
          }
        );

        if (inviteError) {
          console.error("Error sending invite email:", inviteError);
          return new Response(
            JSON.stringify({
              success: true,
              warning: "Compartilhamento criado, mas houve erro ao enviar email",
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      } catch (emailError) {
        console.error("Exception sending email:", emailError);
      }
    }

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