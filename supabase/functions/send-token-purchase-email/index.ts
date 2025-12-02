import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface RequestBody {
  user_id: string;
  package_name: string;
  tokens_purchased: number;
  amount_paid: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body: RequestBody = await req.json();
    const { user_id, package_name, tokens_purchased, amount_paid } = body;

    if (!user_id || !package_name || !tokens_purchased || !amount_paid) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields: user_id, package_name, tokens_purchased, amount_paid'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`[send-token-purchase-email] Processing for user: ${user_id}`);

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('first_name, email')
      .eq('id', user_id)
      .maybeSingle();

    if (profileError || !profile) {
      console.error('[send-token-purchase-email] Error fetching user profile:', profileError);
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Buscar customer_id do usuário
    const { data: customer, error: customerError } = await supabase
      .from('stripe_customers')
      .select('customer_id')
      .eq('user_id', user_id)
      .is('deleted_at', null)
      .maybeSingle();

    if (customerError) {
      console.error('[send-token-purchase-email] Error fetching customer:', customerError);
    }

    let planName = 'Gratuito';
    let planTokens = '0';
    let extraTokens = '0';
    let totalTokens = '0';

    if (customer?.customer_id) {
      // Buscar dados REAIS da assinatura
      const { data: subscription, error: subError } = await supabase
        .from('stripe_subscriptions')
        .select('plan_tokens, extra_tokens, tokens_total, price_id')
        .eq('customer_id', customer.customer_id)
        .eq('status', 'active')
        .is('deleted_at', null)
        .maybeSingle();

      if (subError) {
        console.error('[send-token-purchase-email] Error fetching subscription:', subError);
      }

      if (subscription) {
        // Buscar nome do plano pelo price_id
        const { data: plan } = await supabase
          .from('subscription_plans')
          .select('name')
          .eq('stripe_price_id', subscription.price_id)
          .maybeSingle();

        planName = plan?.name || 'Premium';
        planTokens = formatNumber(subscription.plan_tokens || 0);
        extraTokens = formatNumber(subscription.extra_tokens || 0);
        totalTokens = formatNumber(subscription.tokens_total || 0);

        console.log('[send-token-purchase-email] Token balance:', {
          planName,
          planTokens,
          extraTokens,
          totalTokens
        });
      }
    }
    const formattedTokensPurchased = formatNumber(tokens_purchased);

    const currentDate = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    const baseUrl = Deno.env.get('FRONTEND_URL') || 'https://dev-app.wislegal.io';
    const tokensUrl = `${baseUrl}/tokens`;

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.error('[send-token-purchase-email] RESEND_API_KEY not configured');

      await supabase.from('email_logs').insert({
        user_id,
        email: profile.email,
        type: 'token_purchase',
        status: 'pending_manual',
        email_provider_response: {
          package_name,
          tokens_purchased: formattedTokensPurchased,
          amount_paid,
          reason: 'RESEND_API_KEY not configured',
        },
      });

      return new Response(
        JSON.stringify({
          success: false,
          message: 'Email provider not configured, logged as pending_manual'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`[send-token-purchase-email] Sending email to: ${profile.email}`);

    const templateId = '9fbb8652-2299-41b5-91ea-7aaeb716f139';

    const templateVariables = {
      first_name: profile.first_name || 'Usuário',
      package_name,
      tokens_purchased: formattedTokensPurchased,
      amount_paid,
      purchase_date: currentDate,
      plan_name: planName,
      plan_tokens: planTokens,
      extra_tokens: extraTokens,
      total_tokens_available: totalTokens,
      tokens_url: tokensUrl,
    };

    const resendPayload = {
      from: 'WisLegal <noreply@wislegal.io>',
      to: [profile.email],
      template: {
        id: templateId,
        variables: templateVariables
      }
    };

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify(resendPayload),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error('[send-token-purchase-email] Resend API error:', emailResponse.status, errorText);

      await supabase.from('email_logs').insert({
        user_id,
        email: profile.email,
        type: 'token_purchase',
        status: 'failed',
        email_provider_response: {
          error: errorText,
          status: emailResponse.status,
          package_name,
          tokens_purchased: formattedTokensPurchased,
          amount_paid,
        },
      });

      return new Response(
        JSON.stringify({ error: 'Failed to send email', details: errorText }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const emailResult = await emailResponse.json();

    await supabase.from('email_logs').insert({
      user_id,
      email: profile.email,
      type: 'token_purchase',
      status: 'success',
      email_provider_response: {
        resend_id: emailResult.id,
        package_name,
        tokens_purchased: formattedTokensPurchased,
        amount_paid,
        plan_name: planName,
        total_tokens: totalTokens,
      },
      sent_at: new Date().toISOString(),
    });

    console.log(`[send-token-purchase-email] Email sent successfully to ${profile.email}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Token purchase email sent successfully',
        resend_id: emailResult.id
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[send-token-purchase-email] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function formatNumber(num: number): string {
  return num.toLocaleString('pt-BR');
}
