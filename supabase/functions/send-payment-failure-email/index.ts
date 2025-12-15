import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PaymentFailureRequest {
  user_id: string;
  payment_intent_id: string;
  amount: number;
  currency: string;
  error_code?: string;
  error_message?: string;
  card_brand?: string;
  card_last4?: string;
  payment_type: 'assinatura_nova' | 'renovacao_assinatura' | 'compra_tokens';
  product_name?: string;
  subscription_id?: string;
  price_id?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log("=== SEND PAYMENT FAILURE EMAIL - START ===");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const appUrl = "https://app.wislegal.io";

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    if (!resendApiKey) {
      throw new Error("Missing RESEND_API_KEY environment variable");
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    const requestData: PaymentFailureRequest = await req.json();

    console.log("Request data:", {
      user_id: requestData.user_id,
      payment_intent_id: requestData.payment_intent_id,
      payment_type: requestData.payment_type,
      amount: requestData.amount
    });

    if (!requestData.user_id || !requestData.payment_intent_id || !requestData.payment_type) {
      throw new Error("Missing required fields: user_id, payment_intent_id, or payment_type");
    }

    console.log("Step 1: Fetching user profile...");

    const { data: userProfile, error: profileError } = await supabaseClient
      .from("user_profiles")
      .select("id, first_name, last_name, email")
      .eq("id", requestData.user_id)
      .maybeSingle();

    if (profileError || !userProfile) {
      console.error("Error fetching user profile:", profileError);
      throw new Error(`User profile not found: ${requestData.user_id}`);
    }

    console.log("User profile found:", {
      id: userProfile.id,
      first_name: userProfile.first_name,
      email: userProfile.email
    });

    console.log("Step 2: Preparing email template variables...");

    const formatPrice = (amount: number, currency: string): string => {
      const numAmount = amount / 100;
      if (currency.toUpperCase() === 'BRL') {
        return `R$ ${numAmount.toFixed(2).replace('.', ',')}`;
      }
      return `${currency.toUpperCase()} ${numAmount.toFixed(2)}`;
    };

    const formatDate = (date: Date = new Date()): string => {
      const saoPauloDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
      const day = String(saoPauloDate.getDate()).padStart(2, '0');
      const month = String(saoPauloDate.getMonth() + 1).padStart(2, '0');
      const year = saoPauloDate.getFullYear();
      const hours = String(saoPauloDate.getHours()).padStart(2, '0');
      const minutes = String(saoPauloDate.getMinutes()).padStart(2, '0');
      return `${day}/${month}/${year} às ${hours}:${minutes}`;
    };

    const translateErrorMessage = (errorCode?: string, errorMessage?: string): string => {
      const errorMap: { [key: string]: string } = {
        'card_declined': 'Cartão recusado pela operadora',
        'insufficient_funds': 'Saldo insuficiente no cartão',
        'expired_card': 'Cartão expirado',
        'incorrect_cvc': 'Código de segurança (CVV) incorreto',
        'processing_error': 'Erro ao processar o pagamento',
        'invalid_card_type': 'Tipo de cartão não aceito',
        'authentication_required': 'Autenticação adicional necessária',
        'card_velocity_exceeded': 'Limite de transações excedido',
        'do_not_honor': 'Transação não autorizada pelo banco',
        'generic_decline': 'Pagamento recusado'
      };

      if (errorMessage) {
        const messageLower = errorMessage.toLowerCase();

        if (messageLower.includes('insufficient funds') || messageLower.includes('insufficient_funds')) {
          return 'Saldo insuficiente no cartão';
        }
        if (messageLower.includes('expired')) {
          return 'Cartão expirado';
        }
        if (messageLower.includes('incorrect') && (messageLower.includes('cvc') || messageLower.includes('cvv') || messageLower.includes('security code'))) {
          return 'Código de segurança (CVV) incorreto';
        }
        if (messageLower.includes('lost') || messageLower.includes('stolen')) {
          return 'Cartão reportado como perdido ou roubado';
        }
        if (messageLower.includes('do not honor') || messageLower.includes('do_not_honor')) {
          return 'Transação não autorizada pelo banco';
        }
        if (messageLower.includes('authentication') || messageLower.includes('3d secure')) {
          return 'Autenticação adicional necessária';
        }
        if (messageLower.includes('processing error')) {
          return 'Erro ao processar o pagamento';
        }
        if (messageLower.includes('invalid number') || messageLower.includes('incorrect number')) {
          return 'Número do cartão inválido';
        }
        if (messageLower.includes('postal code') || messageLower.includes('zip')) {
          return 'CEP não corresponde ao do cartão';
        }
        if (messageLower.includes('velocity') || messageLower.includes('rate limit')) {
          return 'Limite de transações excedido';
        }
      }

      if (errorCode && errorMap[errorCode]) {
        return errorMap[errorCode];
      }

      if (errorMessage) {
        return errorMessage;
      }

      return 'Falha ao processar o pagamento';
    };

    const buildPaymentDescription = (): string => {
      const formattedAmount = formatPrice(requestData.amount, requestData.currency);

      switch (requestData.payment_type) {
        case 'assinatura_nova':
          return `A compra no valor de <strong>${formattedAmount}</strong> não foi concluída.`;
        case 'renovacao_assinatura':
          return `A renovação no valor de <strong>${formattedAmount}</strong> não foi concluída.`;
        case 'compra_tokens':
          return `A compra no valor de <strong>${formattedAmount}</strong> não foi concluída.`;
        default:
          return `A transação no valor de <strong>${formattedAmount}</strong> não foi concluída.`;
      }
    };

    const retryUrl = `${appUrl}/signature`;

    const templateVariables = {
      first_name: userProfile.first_name || "Usuário",
      payment_description: buildPaymentDescription(),
      error_message_pt: translateErrorMessage(requestData.error_code, requestData.error_message),
      card_brand: requestData.card_brand,
      card_last4: requestData.card_last4,
      failed_at: formatDate(),
      retry_url: retryUrl
    };

    console.log("Template variables prepared:", {
      ...templateVariables,
      card_brand: templateVariables.card_brand || 'not provided',
      card_last4: templateVariables.card_last4 || 'not provided'
    });

    console.log("Step 3: Sending email via Resend with template...");

    const templateId = "01f7210a-4d2d-47ad-8214-a4fb5ff5a521";

    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "WisLegal <noreply@wislegal.io>";

    const resendPayload = {
      from: fromEmail,
      to: [userProfile.email],
      template: {
        id: templateId,
        variables: templateVariables
      }
    };

    console.log("Sending email with template ID:", templateId);
    console.log("Recipient:", userProfile.email);

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify(resendPayload),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      console.error("Resend API error:", resendResponse.status, errorText);
      throw new Error(`Failed to send email via Resend: ${resendResponse.status} - ${errorText}`);
    }

    const resendResult = await resendResponse.json();
    console.log("✓ Email sent successfully via Resend template:", resendResult);

    console.log("Step 4: Logging email send to database...");

    const { error: logError } = await supabaseClient
      .from("email_logs")
      .insert({
        user_id: userProfile.id,
        email: userProfile.email,
        type: "payment_failure",
        status: "success",
        email_provider_response: {
          resend_id: resendResult.id,
          payment_intent_id: requestData.payment_intent_id,
          payment_type: requestData.payment_type,
          error_code: requestData.error_code,
          amount: requestData.amount,
          currency: requestData.currency
        },
        sent_at: new Date().toISOString()
      });

    if (logError) {
      console.error("Failed to log email:", logError);
    } else {
      console.log("✓ Email send logged to database");
    }

    console.log("=== SEND PAYMENT FAILURE EMAIL - SUCCESS ===");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Payment failure email sent successfully",
        resend_id: resendResult.id,
        recipient: userProfile.email,
        payment_type: requestData.payment_type
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("💥 Error in send-payment-failure-email function:", error);
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
