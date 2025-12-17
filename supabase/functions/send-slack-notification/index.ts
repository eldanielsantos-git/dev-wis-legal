import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface NotificationPayload {
  type: string;
  data: Record<string, unknown>;
}

interface SlackMessage {
  text?: string;
  blocks?: Array<Record<string, unknown>>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: NotificationPayload = await req.json();
    const { type, data } = payload;

    // Buscar configurações ativas de Slack que incluem este tipo de notificação
    const { data: slackConfigs, error: configError } = await supabase
      .from("slack_notifications")
      .select("*")
      .eq("is_active", true)
      .contains("notification_types", [type]);

    if (configError) {
      console.error("Error fetching Slack configs:", configError);
      throw configError;
    }

    if (!slackConfigs || slackConfigs.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No active Slack configurations for this notification type" 
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Formatar mensagem baseada no tipo de notificação
    const slackMessage = formatSlackMessage(type, data);

    // Enviar para todos os webhooks configurados
    const results = await Promise.allSettled(
      slackConfigs.map((config) =>
        fetch(config.webhook_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(slackMessage),
        })
      )
    );

    const successCount = results.filter(r => r.status === "fulfilled").length;
    const failureCount = results.filter(r => r.status === "rejected").length;

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sent to ${successCount} webhook(s), ${failureCount} failed`,
        details: { successCount, failureCount, total: results.length }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error sending Slack notification:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function formatSlackMessage(type: string, data: Record<string, unknown>): SlackMessage {
  switch (type) {
    case "user_signup":
      return {
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "🎉 Novo Usuário Cadastrado",
              emoji: true
            }
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: `*Nome:*\n${data.first_name || ''} ${data.last_name || ''}`
              },
              {
                type: "mrkdwn",
                text: `*Email:*\n${data.email || 'N/A'}`
              },
              {
                type: "mrkdwn",
                text: `*Data:*\n${new Date(data.created_at as string).toLocaleString('pt-BR')}`
              },
              {
                type: "mrkdwn",
                text: `*Cidade/Estado:*\n${data.city || 'N/A'}/${data.state || 'N/A'}`
              }
            ]
          }
        ]
      };

    case "subscription_created":
      return {
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "💳 Nova Assinatura Criada",
              emoji: true
            }
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: `*Usuário:*\n${data.user_email || 'N/A'}`
              },
              {
                type: "mrkdwn",
                text: `*Plano:*\n${data.tier || 'N/A'}`
              },
              {
                type: "mrkdwn",
                text: `*Valor:*\nR$ ${(data.amount as number / 100).toFixed(2)}`
              },
              {
                type: "mrkdwn",
                text: `*Status:*\n${data.status || 'N/A'}`
              }
            ]
          }
        ]
      };

    case "subscription_cancelled":
      return {
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "❌ Assinatura Cancelada",
              emoji: true
            }
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: `*Usuário:*\n${data.user_email || 'N/A'}`
              },
              {
                type: "mrkdwn",
                text: `*Plano:*\n${data.tier || 'N/A'}`
              },
              {
                type: "mrkdwn",
                text: `*Motivo:*\n${data.reason || 'Não informado'}`
              },
              {
                type: "mrkdwn",
                text: `*Data:*\n${new Date().toLocaleString('pt-BR')}`
              }
            ]
          }
        ]
      };

    case "subscription_upgraded":
      return {
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "⬆️ Upgrade de Assinatura",
              emoji: true
            }
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: `*Usuário:*\n${data.user_email || 'N/A'}`
              },
              {
                type: "mrkdwn",
                text: `*De → Para:*\n${data.old_tier || 'N/A'} → ${data.new_tier || 'N/A'}`
              },
              {
                type: "mrkdwn",
                text: `*Novo Valor:*\nR$ ${(data.amount as number / 100).toFixed(2)}`
              },
              {
                type: "mrkdwn",
                text: `*Data:*\n${new Date().toLocaleString('pt-BR')}`
              }
            ]
          }
        ]
      };

    case "subscription_downgraded":
      return {
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "⬇️ Downgrade de Assinatura",
              emoji: true
            }
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: `*Usuário:*\n${data.user_email || 'N/A'}`
              },
              {
                type: "mrkdwn",
                text: `*De → Para:*\n${data.old_tier || 'N/A'} → ${data.new_tier || 'N/A'}`
              },
              {
                type: "mrkdwn",
                text: `*Novo Valor:*\nR$ ${(data.amount as number / 100).toFixed(2)}`
              },
              {
                type: "mrkdwn",
                text: `*Data:*\n${new Date().toLocaleString('pt-BR')}`
              }
            ]
          }
        ]
      };

    case "token_purchase":
      return {
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "🪙 Compra de Tokens",
              emoji: true
            }
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: `*Usuário:*\n${data.user_email || 'N/A'}`
              },
              {
                type: "mrkdwn",
                text: `*Quantidade:*\n${data.tokens || 0} tokens`
              },
              {
                type: "mrkdwn",
                text: `*Valor:*\nR$ ${(data.amount as number / 100).toFixed(2)}`
              },
              {
                type: "mrkdwn",
                text: `*Data:*\n${new Date().toLocaleString('pt-BR')}`
              }
            ]
          }
        ]
      };

    case "analysis_completed":
      return {
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "✅ Análise Concluída",
              emoji: true
            }
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: `*Usuário:*\n${data.user_email || 'N/A'}`
              },
              {
                type: "mrkdwn",
                text: `*Processo:*\n${data.process_number || 'N/A'}`
              },
              {
                type: "mrkdwn",
                text: `*Duração:*\n${data.duration || 'N/A'}`
              },
              {
                type: "mrkdwn",
                text: `*Tokens Usados:*\n${data.tokens_used || 0}`
              }
            ]
          }
        ]
      };

    case "analysis_failed":
      return {
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "⚠️ Análise Falhou",
              emoji: true
            }
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: `*Usuário:*\n${data.user_email || 'N/A'}`
              },
              {
                type: "mrkdwn",
                text: `*Processo:*\n${data.process_number || 'N/A'}`
              },
              {
                type: "mrkdwn",
                text: `*Erro:*\n${data.error || 'Erro desconhecido'}`
              },
              {
                type: "mrkdwn",
                text: `*Data:*\n${new Date().toLocaleString('pt-BR')}`
              }
            ]
          }
        ]
      };

    default:
      return {
        text: `Nova notificação: ${type}`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Tipo:* ${type}\n*Dados:* ${JSON.stringify(data, null, 2)}`
            }
          }
        ]
      };
  }
}