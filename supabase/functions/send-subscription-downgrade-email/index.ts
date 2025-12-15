import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SubscriptionDowngradeRequest {
  subscription_id: string;
  old_price_id: string;
  new_price_id: string;
  tokens_preserved: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log("=== SEND SUBSCRIPTION DOWNGRADE EMAIL - START ===");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const plansUrl = "https://app.wislegal.io/signature";

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    if (!resendApiKey) {
      throw new Error("Missing RESEND_API_KEY environment variable");
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    const {
      subscription_id,
      old_price_id,
      new_price_id,
      tokens_preserved
    }: SubscriptionDowngradeRequest = await req.json();

    console.log("Request data:", {
      subscription_id,
      old_price_id,
      new_price_id,
      tokens_preserved
    });

    if (!subscription_id || !old_price_id || !new_price_id) {
      throw new Error("Missing required fields: subscription_id, old_price_id, or new_price_id");
    }

    console.log("Step 1: Fetching subscription data from database...");

    const { data: subscriptionData, error: subscriptionError } = await supabaseClient
      .from("stripe_subscriptions")
      .select(`
        subscription_id,
        customer_id,
        status,
        price_id,
        current_period_start,
        current_period_end,
        created_at
      `)
      .eq("subscription_id", subscription_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (subscriptionError || !subscriptionData) {
      console.error("Error fetching subscription:", subscriptionError);
      throw new Error(`Subscription not found: ${subscription_id}`);
    }

    console.log("Subscription found:", subscriptionData);

    console.log("Step 2: Fetching customer and user data...");

    const { data: customerData, error: customerError } = await supabaseClient
      .from("stripe_customers")
      .select("user_id")
      .eq("customer_id", subscriptionData.customer_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (customerError || !customerData) {
      console.error("Error fetching customer:", customerError);
      throw new Error(`Customer not found: ${subscriptionData.customer_id}`);
    }

    console.log("Customer found:", customerData);

    console.log("Step 3: Fetching user profile...");

    const { data: userProfile, error: profileError } = await supabaseClient
      .from("user_profiles")
      .select("id, first_name, last_name, email")
      .eq("id", customerData.user_id)
      .maybeSingle();

    if (profileError || !userProfile) {
      console.error("Error fetching user profile:", profileError);
      throw new Error(`User profile not found: ${customerData.user_id}`);
    }

    console.log("User profile found:", {
      id: userProfile.id,
      first_name: userProfile.first_name,
      email: userProfile.email
    });

    console.log("Step 4: Fetching old and new plan details...");

    const { data: oldPlanData, error: oldPlanError } = await supabaseClient
      .from("subscription_plans")
      .select("name")
      .eq("stripe_price_id", old_price_id)
      .eq("is_active", true)
      .maybeSingle();

    if (oldPlanError || !oldPlanData) {
      console.error("Error fetching old plan:", oldPlanError);
      throw new Error(`Old plan not found for price_id: ${old_price_id}`);
    }

    const { data: newPlanData, error: newPlanError } = await supabaseClient
      .from("subscription_plans")
      .select("name, price_brl, tokens_included")
      .eq("stripe_price_id", new_price_id)
      .eq("is_active", true)
      .maybeSingle();

    if (newPlanError || !newPlanData) {
      console.error("Error fetching new plan:", newPlanError);
      throw new Error(`New plan not found for price_id: ${new_price_id}`);
    }

    console.log("Plans found:", {
      old_plan: oldPlanData.name,
      new_plan: newPlanData.name
    });

    console.log("Step 5: Formatting data for email template...");

    const formatPrice = (price: string | number): string => {
      const numPrice = typeof price === 'string' ? parseFloat(price) : price;
      return `R$ ${numPrice.toFixed(2).replace('.', ',')}`;
    };

    const formatTokens = (tokens: number): string => {
      return tokens.toLocaleString('pt-BR');
    };

    const formatDate = (timestamp: number): string => {
      const date = new Date(timestamp * 1000);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    };

    console.log("Step 5.1: Fetching updated token balance after downgrade...");

    const { data: updatedSub, error: updatedSubError } = await supabaseClient
      .from('stripe_subscriptions')
      .select('plan_tokens, extra_tokens, tokens_total')
      .eq('subscription_id', subscription_id)
      .is('deleted_at', null)
      .maybeSingle();

    if (updatedSubError || !updatedSub) {
      console.error('Error fetching updated subscription:', updatedSubError);
    }

    const actualExtraTokens = updatedSub?.extra_tokens || 0;
    const actualTotalTokens = updatedSub?.tokens_total || 0;

    console.log("Updated subscription balance:", {
      plan_tokens: updatedSub?.plan_tokens,
      extra_tokens: actualExtraTokens,
      total_tokens: actualTotalTokens,
      tokens_preserved_param: tokens_preserved
    });

    const templateVariables = {
      first_name: userProfile.first_name || "Usuário",
      old_plan_name: oldPlanData.name,
      new_plan_name: newPlanData.name,
      new_plan_price: formatPrice(newPlanData.price_brl),
      new_plan_tokens: formatTokens(newPlanData.tokens_included),
      tokens_preserved: formatTokens(actualExtraTokens),
      total_tokens_available: formatTokens(actualTotalTokens),
      current_period_end: formatDate(subscriptionData.current_period_end),
      plans_url: plansUrl
    };

    console.log("Template variables prepared:", templateVariables);

    console.log("Step 6: Sending email via Resend with template...");

    const templateId = "265245b7-2a18-4ad3-958a-e3120453982c";

    const fromEmail = "WisLegal <noreply@wislegal.io>";

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

    console.log("Step 7: Logging email send to database...");

    const { error: logError } = await supabaseClient
      .from("email_logs")
      .insert({
        user_id: userProfile.id,
        email: userProfile.email,
        type: "subscription_downgraded",
        status: "success",
        email_provider_response: {
          resend_id: resendResult.id,
          subscription_id: subscription_id,
          old_plan_name: oldPlanData.name,
          new_plan_name: newPlanData.name,
          tokens_preserved: tokens_preserved
        },
        sent_at: new Date().toISOString()
      });

    if (logError) {
      console.error("Failed to log email:", logError);
    } else {
      console.log("✓ Email send logged to database");
    }

    console.log("=== SEND SUBSCRIPTION DOWNGRADE EMAIL - SUCCESS ===");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Subscription downgrade email sent successfully",
        resend_id: resendResult.id,
        recipient: userProfile.email,
        old_plan: oldPlanData.name,
        new_plan: newPlanData.name,
        tokens_preserved: tokens_preserved
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("💥 Error in send-subscription-downgrade-email function:", error);
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
