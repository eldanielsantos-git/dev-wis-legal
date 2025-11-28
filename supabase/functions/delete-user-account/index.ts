import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import Stripe from 'npm:stripe@17.7.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const stripe = new Stripe(stripeSecret, {
      appInfo: {
        name: 'Wis Legal Integration',
        version: '1.0.0',
      },
    });

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const userId = user.id;

    const { data: customer } = await supabase
      .from('stripe_customers')
      .select('customer_id')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .maybeSingle();

    if (customer) {
      const { data: subscription } = await supabase
        .from('stripe_subscriptions')
        .select('subscription_id, status')
        .eq('customer_id', customer.customer_id)
        .maybeSingle();

      if (subscription && subscription.subscription_id && subscription.status !== 'canceled') {
        try {
          await stripe.subscriptions.cancel(subscription.subscription_id);
          console.log(`Stripe subscription ${subscription.subscription_id} cancelled for user ${userId}`);

          await supabase
            .from('stripe_subscriptions')
            .update({
              status: 'canceled',
              cancel_at: null,
              canceled_at: new Date().toISOString()
            })
            .eq('subscription_id', subscription.subscription_id);
        } catch (stripeError: any) {
          console.error('Error cancelling Stripe subscription:', stripeError);
        }
      }
    }

    const { data: processosData } = await supabase
      .from('processos')
      .select('id')
      .eq('user_id', userId);

    if (processosData && processosData.length > 0) {
      const processoIds = processosData.map(p => p.id);

      const { error: paginasError } = await supabase
        .from('paginas')
        .delete()
        .in('processo_id', processoIds);

      if (paginasError) {
        console.error('Error deleting paginas:', paginasError);
      }

      const { error: analysisError } = await supabase
        .from('analysis_results')
        .delete()
        .in('processo_id', processoIds);

      if (analysisError) {
        console.error('Error deleting analysis_results:', analysisError);
      }

      const { error: chunksError } = await supabase
        .from('process_chunks')
        .delete()
        .in('processo_id', processoIds);

      if (chunksError) {
        console.error('Error deleting process_chunks:', chunksError);
      }
    }

    const { error: processosError } = await supabase
      .from('processos')
      .delete()
      .eq('user_id', userId);

    if (processosError) {
      console.error('Error deleting processos:', processosError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete user data' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { error: chatError } = await supabase
      .from('chat_messages')
      .delete()
      .eq('user_id', userId);

    if (chatError) {
      console.error('Error deleting chat messages:', chatError);
    }

    const { error: notificationsError } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', userId);

    if (notificationsError) {
      console.error('Error deleting notifications:', notificationsError);
    }

    const { error: tokenUsageError } = await supabase
      .from('token_usage_logs')
      .delete()
      .eq('user_id', userId);

    if (tokenUsageError) {
      console.error('Error deleting token usage logs:', tokenUsageError);
    }

    const { error: tokenCreditsError } = await supabase
      .from('token_credits_audit')
      .delete()
      .eq('user_id', userId);

    if (tokenCreditsError) {
      console.error('Error deleting token credits audit:', tokenCreditsError);
    }

    const { error: profileError } = await supabase
      .from('user_profiles')
      .delete()
      .eq('id', userId);

    if (profileError) {
      console.error('Error deleting profile:', profileError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete user profile' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { error: deleteUserError } = await supabase.auth.admin.deleteUser(userId);

    if (deleteUserError) {
      console.error('Error deleting auth user:', deleteUserError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete user account' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Account deleted successfully' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error in delete-user-account function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});