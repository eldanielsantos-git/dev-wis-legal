import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface TokensLimitRequest {
  user_id: string;
}

interface NotificationThreshold {
  type: '75_percent' | '90_percent' | '100_percent';
  threshold: number;
  templateId: string;
}

const THRESHOLDS: NotificationThreshold[] = [
  { type: '100_percent', threshold: 100, templateId: 'tokens-limit-100' },
  { type: '90_percent', threshold: 90, templateId: 'tokens-limit-90' },
  { type: '75_percent', threshold: 75, templateId: 'tokens-limit-75' },
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log("=== SEND TOKENS LIMIT EMAIL - START ===");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const appUrl = Deno.env.get("APP_URL") || "https://app.wislegal.io";

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    if (!resendApiKey) {
      throw new Error("Missing RESEND_API_KEY environment variable");
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    const { user_id }: TokensLimitRequest = await req.json();

    console.log("Request data:", { user_id });

    if (!user_id) {
      throw new Error("Missing required field: user_id");
    }

    // Step 1: Buscar dados do usuário
    console.log("Step 1: Fetching user data...");
    const { data: userData, error: userError } = await supabaseClient
      .from("users")
      .select("id, email, name")
      .eq("id", user_id)
      .maybeSingle();

    if (userError || !userData) {
      console.error("Error fetching user:", userError);
      throw new Error(`User not found: ${user_id}`);
    }

    console.log("User found:", { email: userData.email, name: userData.name });

    // Step 2: Buscar customer do Stripe
    console.log("Step 2: Fetching Stripe customer...");
    const { data: customerData, error: customerError } = await supabaseClient
      .from("stripe_customers")
      .select("customer_id")
      .eq("user_id", user_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (customerError || !customerData) {
      console.log("No Stripe customer found for user, skipping notification");
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "User has no subscription or token package" 
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Step 3: Buscar dados de tokens da assinatura
    console.log("Step 3: Fetching subscription tokens data...");
    const { data: subscriptionData, error: subscriptionError } = await supabaseClient
      .from("stripe_subscriptions")
      .select("tokens_total, tokens_used, current_period_end")
      .eq("customer_id", customerData.customer_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (subscriptionError || !subscriptionData) {
      console.log("No active subscription found, skipping notification");
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "No active subscription found" 
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const tokensTotal = Number(subscriptionData.tokens_total) || 0;
    const tokensUsed = Number(subscriptionData.tokens_used) || 0;
    const tokensRemaining = Math.max(tokensTotal - tokensUsed, 0);
    const percentageUsed = tokensTotal > 0 ? (tokensUsed / tokensTotal) * 100 : 0;

    console.log("Token usage:", {
      tokensTotal,
      tokensUsed,
      tokensRemaining,
      percentageUsed: `${percentageUsed.toFixed(2)}%`,
    });

    // Step 4: Determinar qual notificação enviar
    let notificationToSend: NotificationThreshold | null = null;

    for (const threshold of THRESHOLDS) {
      if (percentageUsed >= threshold.threshold) {
        notificationToSend = threshold;
        break;
      }
    }

    if (!notificationToSend) {
      console.log("Token usage below 75%, no notification needed");
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Token usage below notification threshold" 
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Token usage triggered ${notificationToSend.type} notification`);

    // Step 5: Verificar se já foi enviada notificação recente (últimos 7 dias)
    console.log("Step 5: Checking for recent notifications...");
    const { data: recentCheck, error: checkError } = await supabaseClient
      .rpc("check_recent_token_notification", {
        p_user_id: user_id,
        p_notification_type: notificationToSend.type,
      });

    if (checkError) {
      console.error("Error checking recent notifications:", checkError);
    }

    if (recentCheck === true) {
      console.log("Recent notification already sent, skipping to avoid spam");
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Notification already sent recently" 
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Step 6: Preparar dados para o email
    const firstName = userData.name?.split(' ')[0] || 'Usuário';
    const periodEndDate = subscriptionData.current_period_end 
      ? new Date(subscriptionData.current_period_end * 1000).toLocaleDateString('pt-BR')
      : 'não definido';

    const emailData = {
      first_name: firstName,
      total_tokens: tokensTotal.toLocaleString('pt-BR'),
      used_tokens: tokensUsed.toLocaleString('pt-BR'),
      remaining_tokens: tokensRemaining.toLocaleString('pt-BR'),
      percentage_used: `${percentageUsed.toFixed(0)}%`,
      view_plans_url: `${appUrl}/subscription`,
      view_token_packages_url: `${appUrl}/tokens`,
      reset_date: periodEndDate,
    };

    console.log("Email data prepared:", emailData);

    // Step 7: Enviar email via Resend
    console.log("Step 7: Sending email via Resend...");
    
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "WisLegal <noreply@wislegal.io>",
        to: [userData.email],
        subject: `Alerta: Seus tokens estão chegando ao fim (${emailData.percentage_used} usado)`,
        template_id: notificationToSend.templateId,
        template_data: emailData,
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error("Resend API error:", resendData);
      throw new Error(`Failed to send email: ${JSON.stringify(resendData)}`);
    }

    console.log("Email sent successfully via Resend:", resendData);

    // Step 8: Registrar notificação no banco
    console.log("Step 8: Recording notification in database...");
    const { error: insertError } = await supabaseClient
      .from("token_limit_notifications")
      .insert({
        user_id: user_id,
        notification_type: notificationToSend.type,
        tokens_total: tokensTotal,
        tokens_used: tokensUsed,
        percentage_used: percentageUsed,
        email_sent: true,
        email_sent_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error("Error recording notification:", insertError);
    } else {
      console.log("Notification recorded successfully");
    }

    console.log("=== SEND TOKENS LIMIT EMAIL - SUCCESS ===");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Token limit notification sent successfully",
        notification_type: notificationToSend.type,
        email_id: resendData.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("=== SEND TOKENS LIMIT EMAIL - ERROR ===");
    console.error("Error:", error);

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