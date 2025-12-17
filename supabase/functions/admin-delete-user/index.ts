import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import Stripe from 'npm:stripe@17.7.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface DeletionProgress {
  step: string;
  completed: boolean;
  error?: string;
  count?: number;
}

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
        name: 'Admin Delete User',
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
    const { data: { user: adminUser }, error: adminError } = await supabase.auth.getUser(token);

    if (adminError || !adminUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: adminProfile } = await supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('id', adminUser.id)
      .single();

    if (!adminProfile?.is_admin) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { targetUserId } = await req.json();

    if (!targetUserId) {
      return new Response(
        JSON.stringify({ error: 'targetUserId is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const progress: DeletionProgress[] = [];

    progress.push({ step: 'Verificando se usuário existe', completed: false });
    const { data: targetUserProfile } = await supabase
      .from('user_profiles')
      .select('id, email')
      .eq('id', targetUserId)
      .maybeSingle();

    const { data: { user: targetAuthUser }, error: targetAuthError } = await supabase.auth.admin.getUserById(targetUserId);

    if (!targetUserProfile && !targetAuthUser) {
      progress[0] = { step: 'Usuário não encontrado', completed: false, error: 'O usuário já foi deletado ou não existe' };
      return new Response(
        JSON.stringify({ error: 'User not found', progress }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    progress[0] = { step: 'Usuário encontrado', completed: true };

    progress.push({ step: 'Cancelando assinatura', completed: false });
    try {
      const { data: customer } = await supabase
        .from('stripe_customers')
        .select('customer_id')
        .eq('user_id', targetUserId)
        .is('deleted_at', null)
        .maybeSingle();

      if (customer) {
        const { data: subscription } = await supabase
          .from('stripe_subscriptions')
          .select('subscription_id, status')
          .eq('customer_id', customer.customer_id)
          .maybeSingle();

        if (subscription && subscription.subscription_id && subscription.status !== 'canceled') {
          await stripe.subscriptions.cancel(subscription.subscription_id);
          await supabase
            .from('stripe_subscriptions')
            .update({
              status: 'canceled',
              cancel_at: null,
              canceled_at: new Date().toISOString()
            })
            .eq('subscription_id', subscription.subscription_id);
          progress[1] = { step: 'Assinatura cancelada', completed: true };
        } else {
          progress[1] = { step: 'Sem assinatura ativa', completed: true };
        }
      } else {
        progress[1] = { step: 'Sem assinatura ativa', completed: true };
      }
    } catch (error: any) {
      progress[1] = { step: 'Cancelando assinatura', completed: false, error: error.message };
    }

    progress.push({ step: 'Buscando processos do usuário', completed: false });
    const { data: processosData } = await supabase
      .from('processos')
      .select('id')
      .eq('user_id', targetUserId);

    const processoCount = processosData?.length || 0;
    progress[2] = { step: 'Processos encontrados', completed: true, count: processoCount };

    if (processosData && processosData.length > 0) {
      const processoIds = processosData.map(p => p.id);

      progress.push({ step: 'Excluindo páginas dos processos', completed: false });
      const { error: paginasError } = await supabase
        .from('paginas')
        .delete()
        .in('processo_id', processoIds);

      if (paginasError) {
        progress[progress.length - 1] = { step: 'Páginas dos processos', completed: false, error: paginasError.message };
      } else {
        progress[progress.length - 1] = { step: 'Páginas dos processos excluídas', completed: true };
      }

      progress.push({ step: 'Excluindo resultados de análise', completed: false });
      const { error: analysisError } = await supabase
        .from('analysis_results')
        .delete()
        .in('processo_id', processoIds);

      if (analysisError) {
        progress[progress.length - 1] = { step: 'Resultados de análise', completed: false, error: analysisError.message };
      } else {
        progress[progress.length - 1] = { step: 'Resultados de análise excluídos', completed: true };
      }

      progress.push({ step: 'Excluindo chunks de processos', completed: false });
      const { error: chunksError } = await supabase
        .from('process_chunks')
        .delete()
        .in('processo_id', processoIds);

      if (chunksError) {
        progress[progress.length - 1] = { step: 'Chunks de processos', completed: false, error: chunksError.message };
      } else {
        progress[progress.length - 1] = { step: 'Chunks de processos excluídos', completed: true };
      }

      progress.push({ step: 'Excluindo mensagens de chat', completed: false });
      const { error: chatError } = await supabase
        .from('chat_messages')
        .delete()
        .in('processo_id', processoIds);

      if (chatError) {
        progress[progress.length - 1] = { step: 'Mensagens de chat', completed: false, error: chatError.message };
      } else {
        progress[progress.length - 1] = { step: 'Mensagens de chat excluídas', completed: true };
      }
    }

    progress.push({ step: 'Excluindo processos', completed: false });
    const { error: processosError } = await supabase
      .from('processos')
      .delete()
      .eq('user_id', targetUserId);

    if (processosError) {
      progress[progress.length - 1] = { step: 'Processos', completed: false, error: processosError.message };
      return new Response(
        JSON.stringify({ error: 'Failed to delete user processos', progress }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } else {
      progress[progress.length - 1] = { step: 'Processos excluídos', completed: true };
    }

    progress.push({ step: 'Excluindo compartilhamentos de workspace', completed: false });
    await supabase.from('workspace_shares').delete().eq('owner_user_id', targetUserId);
    await supabase.from('workspace_shares').delete().eq('shared_with_user_id', targetUserId);
    progress[progress.length - 1] = { step: 'Compartilhamentos excluídos', completed: true };

    progress.push({ step: 'Excluindo erros de análise complexa', completed: false });
    await supabase.from('complex_analysis_errors').delete().eq('user_id', targetUserId);
    progress[progress.length - 1] = { step: 'Erros de análise complexa excluídos', completed: true };

    progress.push({ step: 'Excluindo erros de análise', completed: false });
    await supabase.from('analysis_errors').delete().eq('user_id', targetUserId);
    progress[progress.length - 1] = { step: 'Erros de análise excluídos', completed: true };

    progress.push({ step: 'Excluindo notificações', completed: false });
    await supabase.from('notifications').delete().eq('user_id', targetUserId);
    progress[progress.length - 1] = { step: 'Notificações excluídas', completed: true };

    progress.push({ step: 'Excluindo notificações admin', completed: false });
    await supabase.from('admin_notifications').delete().eq('user_id', targetUserId);
    progress[progress.length - 1] = { step: 'Notificações admin excluídas', completed: true };

    progress.push({ step: 'Excluindo logs de email', completed: false });
    await supabase.from('email_logs').delete().eq('user_id', targetUserId);
    progress[progress.length - 1] = { step: 'Logs de email excluídos', completed: true };

    progress.push({ step: 'Excluindo logs de uso de tokens', completed: false });
    await supabase.from('token_usage_logs').delete().eq('user_id', targetUserId);
    progress[progress.length - 1] = { step: 'Logs de tokens excluídos', completed: true };

    progress.push({ step: 'Excluindo reservas de tokens', completed: false });
    await supabase.from('token_reservations').delete().eq('user_id', targetUserId);
    progress[progress.length - 1] = { step: 'Reservas de tokens excluídas', completed: true };

    progress.push({ step: 'Excluindo notificações de limite de tokens', completed: false });
    await supabase.from('token_limit_notifications').delete().eq('user_id', targetUserId);
    progress[progress.length - 1] = { step: 'Notificações de limite excluídas', completed: true };

    progress.push({ step: 'Excluindo auditoria de créditos', completed: false });
    await supabase.from('token_credits_audit').delete().eq('user_id', targetUserId);
    progress[progress.length - 1] = { step: 'Auditoria de créditos excluída', completed: true };

    progress.push({ step: 'Excluindo conquistas do usuário', completed: false });
    await supabase.from('user_achievements').delete().eq('user_id', targetUserId);
    progress[progress.length - 1] = { step: 'Conquistas excluídas', completed: true };

    progress.push({ step: 'Excluindo preferências do usuário', completed: false });
    await supabase.from('user_preferences').delete().eq('user_id', targetUserId);
    progress[progress.length - 1] = { step: 'Preferências excluídas', completed: true };

    progress.push({ step: 'Excluindo dados de pagamento', completed: false });
    const { error: stripeError } = await supabase
      .from('stripe_customers')
      .delete()
      .eq('user_id', targetUserId);

    if (stripeError) {
      progress[progress.length - 1] = { step: 'Dados de pagamento', completed: false, error: stripeError.message };
    } else {
      progress[progress.length - 1] = { step: 'Dados de pagamento excluídos', completed: true };
    }

    if (targetUserProfile) {
      progress.push({ step: 'Excluindo perfil do usuário', completed: false });
      const { error: profileError } = await supabase
        .from('user_profiles')
        .delete()
        .eq('id', targetUserId);

      if (profileError) {
        progress[progress.length - 1] = { step: 'Perfil do usuário', completed: false, error: profileError.message };
        return new Response(
          JSON.stringify({ error: 'Failed to delete user profile', progress }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      } else {
        progress[progress.length - 1] = { step: 'Perfil do usuário excluído', completed: true };
      }
    } else {
      progress.push({ step: 'Perfil do usuário já estava excluído', completed: true });
    }

    if (targetAuthUser) {
      progress.push({ step: 'Excluindo conta de autenticação', completed: false });
      const { error: deleteUserError } = await supabase.auth.admin.deleteUser(targetUserId);

      if (deleteUserError) {
        progress[progress.length - 1] = { step: 'Conta de autenticação', completed: false, error: deleteUserError.message };
        return new Response(
          JSON.stringify({ error: 'Failed to delete user account', progress }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      } else {
        progress[progress.length - 1] = { step: 'Conta de autenticação excluída', completed: true };
      }
    } else {
      progress.push({ step: 'Conta de autenticação já estava excluída', completed: true });
    }

    return new Response(
      JSON.stringify({ success: true, message: 'User deleted successfully', progress }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error in admin-delete-user function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});