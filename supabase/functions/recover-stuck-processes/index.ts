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

    console.log(`\n[${workerId}] 🔍 Verificando processos travados...`);

    const stuckThresholdMinutes = 15;
    const stuckThreshold = new Date(Date.now() - stuckThresholdMinutes * 60 * 1000).toISOString();

    const { data: stuckProcesses, error: stuckError } = await supabase
      .from('complex_processing_status')
      .select('processo_id, current_phase, last_heartbeat, chunks_completed, total_chunks')
      .in('current_phase', ['consolidating', 'processing'])
      .lt('last_heartbeat', stuckThreshold);

    if (stuckError) {
      throw new Error(`Erro ao buscar processos travados: ${stuckError.message}`);
    }

    if (!stuckProcesses || stuckProcesses.length === 0) {
      console.log(`[${workerId}] ✅ Nenhum processo travado encontrado`);
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Nenhum processo travado encontrado',
          recovered: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`[${workerId}] 🚨 ${stuckProcesses.length} processos travados encontrados`);

    const recovered = [];
    const failed = [];

    for (const processo of stuckProcesses) {
      console.log(`[${workerId}] 🔄 Recuperando processo: ${processo.processo_id}`);
      console.log(`[${workerId}]    Phase: ${processo.current_phase}`);
      console.log(`[${workerId}]    Last heartbeat: ${processo.last_heartbeat}`);
      console.log(`[${workerId}]    Chunks: ${processo.chunks_completed}/${processo.total_chunks}`);

      try {
        if (processo.current_phase === 'consolidating' ||
            (processo.current_phase === 'processing' && processo.chunks_completed === processo.total_chunks)) {

          const { data: pendingResults } = await supabase
            .from('analysis_results')
            .select('id')
            .eq('processo_id', processo.processo_id)
            .in('status', ['pending', 'running'])
            .limit(1)
            .maybeSingle();

          if (pendingResults) {
            console.log(`[${workerId}] 🔄 Disparando consolidation-worker para ${processo.processo_id}`);

            const response = await fetch(`${supabaseUrl}/functions/v1/consolidation-worker`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({ processo_id: processo.processo_id }),
            });

            if (response.ok) {
              console.log(`[${workerId}] ✅ Consolidation-worker disparado com sucesso`);
              recovered.push({
                processo_id: processo.processo_id,
                action: 'consolidation_restarted',
              });
            } else {
              const errorText = await response.text();
              throw new Error(`Erro ao disparar consolidation: ${errorText}`);
            }
          } else {
            console.log(`[${workerId}] ✅ Processo ${processo.processo_id} já completado, atualizando status`);

            await supabase
              .from('processos')
              .update({
                status: 'completed',
                analysis_completed_at: new Date().toISOString(),
              })
              .eq('id', processo.processo_id);

            await supabase
              .from('complex_processing_status')
              .update({
                current_phase: 'completed',
                overall_progress_percent: 100,
                last_heartbeat: new Date().toISOString(),
              })
              .eq('processo_id', processo.processo_id);

            recovered.push({
              processo_id: processo.processo_id,
              action: 'marked_completed',
            });
          }
        } else if (processo.current_phase === 'processing') {
          console.log(`[${workerId}] 🔄 Disparando process-complex-worker para ${processo.processo_id}`);

          const response = await fetch(`${supabaseUrl}/functions/v1/process-complex-worker`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ processo_id: processo.processo_id }),
          });

          if (response.ok) {
            console.log(`[${workerId}] ✅ Process-complex-worker disparado com sucesso`);
            recovered.push({
              processo_id: processo.processo_id,
              action: 'processing_restarted',
            });
          } else {
            const errorText = await response.text();
            throw new Error(`Erro ao disparar processing: ${errorText}`);
          }
        }

        await supabase
          .from('complex_processing_status')
          .update({
            last_heartbeat: new Date().toISOString(),
          })
          .eq('processo_id', processo.processo_id);

      } catch (error: any) {
        console.error(`[${workerId}] ❌ Erro ao recuperar ${processo.processo_id}:`, error);
        failed.push({
          processo_id: processo.processo_id,
          error: error.message,
        });
      }
    }

    console.log(`[${workerId}] 📊 Recuperação concluída:`);
    console.log(`[${workerId}]    Recuperados: ${recovered.length}`);
    console.log(`[${workerId}]    Falhas: ${failed.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `${recovered.length} processos recuperados, ${failed.length} falhas`,
        recovered,
        failed,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error(`[${workerId}] ❌ Erro fatal:`, error);

    return new Response(
      JSON.stringify({
        error: error?.message || 'Erro ao recuperar processos travados',
        worker_id: workerId,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});