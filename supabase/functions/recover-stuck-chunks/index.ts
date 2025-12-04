import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { threshold_minutes = 15 } = req.method === 'POST' ? await req.json() : {};

    console.log(`🔍 Buscando chunks travados há mais de ${threshold_minutes} minutos...`);

    const { data: stuckChunks, error: stuckError } = await supabase
      .rpc('get_stuck_chunks', { p_stuck_threshold_minutes: threshold_minutes });

    if (stuckError) {
      throw new Error(`Erro ao buscar chunks travados: ${stuckError.message}`);
    }

    if (!stuckChunks || stuckChunks.length === 0) {
      console.log('✅ Nenhum chunk travado encontrado');
      return new Response(
        JSON.stringify({
          message: 'Nenhum chunk travado encontrado',
          stuck_count: 0,
          recovered_count: 0,
          workers_triggered: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`⚠️ Encontrados ${stuckChunks.length} chunks travados`);
    stuckChunks.forEach((chunk: any) => {
      console.log(`   - Chunk ${chunk.chunk_id}: status='${chunk.status}', attempts=${chunk.attempt_number}, stuck=${chunk.minutes_stuck}min`);
    });

    console.log('\n🔄 Recuperando chunks travados...');
    const { data: recoveryResult, error: recoveryError } = await supabase
      .rpc('recover_stuck_chunks', { p_stuck_threshold_minutes: threshold_minutes })
      .single();

    if (recoveryError) {
      throw new Error(`Erro ao recuperar chunks: ${recoveryError.message}`);
    }

    const recoveredCount = recoveryResult?.recovered_count || 0;
    const processoIds = recoveryResult?.processo_ids || [];

    console.log(`✅ ${recoveredCount} chunks recuperados`);
    console.log(`📋 Processos afetados: ${processoIds.length}`);

    let workersTriggered = 0;
    if (processoIds.length > 0) {
      console.log('\n🚀 Disparando workers para reprocessar...');

      for (const processoId of processoIds) {
        const { data: canSpawn } = await supabase
          .rpc('can_spawn_worker', { p_processo_id: processoId })
          .maybeSingle();

        if (canSpawn) {
          fetch(`${supabaseUrl}/functions/v1/process-complex-worker`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ processo_id: processoId }),
          }).catch(err => {
            console.error(`   ❌ Erro ao disparar worker para ${processoId}:`, err);
          });
          workersTriggered++;
          console.log(`   ✅ Worker disparado para processo ${processoId}`);
        } else {
          console.log(`   ⏭️ Processo ${processoId} já tem workers suficientes`);
        }
      }
    }

    const summary = {
      message: 'Recuperação automática concluída',
      threshold_minutes,
      stuck_found: stuckChunks.length,
      recovered_count: recoveredCount,
      processos_affected: processoIds.length,
      workers_triggered: workersTriggered,
      processo_ids: processoIds
    };

    console.log('\n📊 Resumo:', summary);

    return new Response(
      JSON.stringify(summary),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('❌ Erro:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});