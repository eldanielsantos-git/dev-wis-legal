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

    const { data: tokenBalance, error: balanceError } = await supabase
      .from('user_token_balance')
      .select('subscription_tokens, extra_tokens, total_tokens')
      .eq('user_id', user_id)
      .maybeSingle();

    if (balanceError) {
      console.error('[send-token-purchase-email] Error fetching token balance:', balanceError);
    }

    const { data: subscription, error: subError } = await supabase
      .from('stripe_user_subscriptions')
      .select('plan_name')
      .eq('user_id', user_id)
      .maybeSingle();

    if (subError) {
      console.error('[send-token-purchase-email] Error fetching subscription:', subError);
    }

    const planName = subscription?.plan_name || 'Gratuito';
    const planTokens = formatNumber(tokenBalance?.subscription_tokens || 0);
    const extraTokens = formatNumber(tokenBalance?.extra_tokens || 0);
    const totalTokens = formatNumber(tokenBalance?.total_tokens || 0);
    const formattedTokensPurchased = formatNumber(tokens_purchased);

    const currentDate = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    const baseUrl = Deno.env.get('FRONTEND_URL') || 'https://dev-app.wislegal.io';
    const tokensUrl = `${baseUrl}/tokens`;

    const emailProviderApiKey = Deno.env.get('EMAIL_PROVIDER_API_KEY');
    if (!emailProviderApiKey) {
      console.error('[send-token-purchase-email] EMAIL_PROVIDER_API_KEY not configured');

      await supabase.from('email_logs').insert({
        user_id,
        email: profile.email,
        type: 'token_purchase',
        status: 'pending_manual',
        metadata: {
          package_name,
          tokens_purchased: formattedTokensPurchased,
          amount_paid,
          reason: 'EMAIL_PROVIDER_API_KEY not configured',
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

    const emailResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': emailProviderApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: [{ email: profile.email, name: profile.first_name }],
        templateId: 9,
        params: {
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
        },
      }),
    });

    const emailResult = await emailResponse.json();

    if (!emailResponse.ok) {
      console.error('[send-token-purchase-email] Email provider error:', emailResult);

      await supabase.from('email_logs').insert({
        user_id,
        email: profile.email,
        type: 'token_purchase',
        status: 'failed',
        email_provider_response: emailResult,
        metadata: {
          package_name,
          tokens_purchased: formattedTokensPurchased,
          amount_paid,
        },
      });

      return new Response(
        JSON.stringify({ error: 'Failed to send email', details: emailResult }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    await supabase.from('email_logs').insert({
      user_id,
      email: profile.email,
      type: 'token_purchase',
      status: 'sent',
      email_provider_response: emailResult,
      sent_at: new Date().toISOString(),
      metadata: {
        package_name,
        tokens_purchased: formattedTokensPurchased,
        amount_paid,
        plan_name: planName,
        total_tokens: totalTokens,
      },
    });

    console.log(`[send-token-purchase-email] Email sent successfully to ${profile.email}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Token purchase email sent successfully',
        messageId: emailResult.messageId
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
