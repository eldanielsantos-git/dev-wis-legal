import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const workerId = crypto.randomUUID().slice(0, 8);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`\n[${workerId}] 🏥 Health check iniciado`);

    const { data: expiredLocks, error: releaseError } = await supabase
      .rpc('release_expired_locks')
      .single();

    if (releaseError) {
      console.error(`[${workerId}] ❌ Erro ao liberar locks expirados:`, releaseError);
    } else {
      const released = expiredLocks?.released_count || 0;
      const retry = expiredLocks?.moved_to_retry || 0;
      const deadLetter = expiredLocks?.moved_to_dead_letter || 0;

      if (released > 0) {
        console.log(`[${workerId}] 🔓 ${released} locks expirados liberados`);
        console.log(`[${workerId}]    - ${retry} movidos para retry`);
        console.log(`[${workerId}]    - ${deadLetter} movidos para dead_letter`);
      } else {
        console.log(`[${workerId}] ✅ Nenhum lock expirado encontrado`);
      }
    }

    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    const { data: unhealthyProcesses, error: healthError } = await supabase
      .from('complex_processing_status')
      .select('processo_id, current_phase, last_heartbeat, chunks_processing')
      .in('current_phase', ['processing', 'queued'])
      .lt('last_heartbeat', fifteenMinutesAgo);

    if (healthError) {
      console.error(`[${workerId}] ❌ Erro ao verificar processos sem heartbeat:`, healthError);
    } else if (unhealthyProcesses && unhealthyProcesses.length > 0) {
      console.log(`[${workerId}] ⚠️ ${unhealthyProcesses.length} processo(s) sem heartbeat detectado(s)`);

      for (const proc of unhealthyProcesses) {
        console.log(`[${workerId}] 🔧 Atualizando status de saúde do processo: ${proc.processo_id}`);

        await supabase
          .from('complex_processing_status')
          .update({
            is_healthy: false,
            health_check_message: `Último heartbeat em ${proc.last_heartbeat}. Possível falha no worker.`,
          })
          .eq('processo_id', proc.processo_id);

        const { data: pendingItems } = await supabase
          .from('processing_queue')
          .select('id')
          .eq('processo_id', proc.processo_id)
          .in('status', ['pending', 'retry'])
          .limit(1)
          .maybeSingle();

        if (pendingItems) {
          console.log(`[${workerId}] 🔄 Há itens pendentes, reiniciando worker para: ${proc.processo_id}`);

          fetch(`${supabaseUrl}/functions/v1/process-complex-worker`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ processo_id: proc.processo_id }),
          }).catch(err => {
            console.error(`[${workerId}] ❌ Erro ao reiniciar worker:`, err);
          });
        }
      }
    } else {
      console.log(`[${workerId}] ✅ Todos os processos ativos estão saudáveis`);
    }

    const { data: stats, error: statsError } = await supabase
      .from('processing_queue')
      .select('status')
      .in('status', ['pending', 'processing', 'retry', 'dead_letter']);

    if (statsError) {
      console.error(`[${workerId}] ❌ Erro ao buscar estatísticas:`, statsError);
    } else if (stats) {
      const pending = stats.filter(s => s.status === 'pending').length;
      const processing = stats.filter(s => s.status === 'processing').length;
      const retry = stats.filter(s => s.status === 'retry').length;
      const deadLetter = stats.filter(s => s.status === 'dead_letter').length;

      console.log(`[${workerId}] 📊 Fila de processamento:`);
      console.log(`[${workerId}]    - Pendentes: ${pending}`);
      console.log(`[${workerId}]    - Processando: ${processing}`);
      console.log(`[${workerId}]    - Retry: ${retry}`);
      console.log(`[${workerId}]    - Dead Letter: ${deadLetter}`);

      if (retry > 0) {
        console.log(`[${workerId}] 🔄 Há ${retry} item(ns) em retry. Disparando workers...`);

        const { data: retryItems } = await supabase
          .from('processing_queue')
          .select('processo_id')
          .eq('status', 'retry')
          .limit(5);

        if (retryItems) {
          const uniqueProcessos = [...new Set(retryItems.map(r => r.processo_id))];

          for (const processoId of uniqueProcessos) {
            fetch(`${supabaseUrl}/functions/v1/process-complex-worker`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({ processo_id: processoId }),
            }).catch(err => {
              console.error(`[${workerId}] ❌ Erro ao disparar worker de retry:`, err);
            });
          }
        }
      }

      if (deadLetter > 0) {
        console.log(`[${workerId}] ⚠️ ALERTA: ${deadLetter} item(ns) em dead letter queue`);

        const { data: deadLetterItems } = await supabase
          .from('processing_queue')
          .select('id, processo_id, error_message, attempt_number')
          .eq('status', 'dead_letter')
          .limit(10);

        if (deadLetterItems && deadLetterItems.length > 0) {
          console.log(`[${workerId}] 📋 Itens em dead letter:`);
          for (const item of deadLetterItems) {
            console.log(`[${workerId}]    - ID: ${item.id}`);
            console.log(`[${workerId}]      Processo: ${item.processo_id}`);
            console.log(`[${workerId}]      Tentativas: ${item.attempt_number}`);
            console.log(`[${workerId}]      Erro: ${item.error_message}`);
          }
        }
      }
    }

    console.log(`[${workerId}] ✅ Health check concluído`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Health check concluído',
        expired_locks_released: expiredLocks?.released_count || 0,
        unhealthy_processes: unhealthyProcesses?.length || 0,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error(`[${workerId}] ❌ Erro no health check:`, error);

    return new Response(
      JSON.stringify({
        error: error?.message || 'Erro no health check',
        worker_id: workerId,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});