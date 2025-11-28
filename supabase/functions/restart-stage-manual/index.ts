import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

    const { processo_id, stage_id, result_id } = await req.json();

    if (!processo_id) {
      return new Response(
        JSON.stringify({ error: 'processo_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[${workerId}] 🔄 Reiniciando etapa manualmente`);
    console.log(`[${workerId}]    Processo: ${processo_id}`);
    console.log(`[${workerId}]    Stage ID: ${stage_id || 'não especificado'}`);
    console.log(`[${workerId}]    Result ID: ${result_id || 'não especificado'}`);

    const { data: processo, error: processoError } = await supabase
      .from('processos')
      .select('id, status, is_chunked, total_chunks_count, file_name')
      .eq('id', processo_id)
      .single();

    if (processoError || !processo) {
      throw new Error(`Processo não encontrado: ${processoError?.message}`);
    }

    console.log(`[${workerId}] 📋 Processo: ${processo.file_name}`);
    console.log(`[${workerId}]    Status: ${processo.status}`);
    console.log(`[${workerId}]    Is chunked: ${processo.is_chunked}`);

    if (processo.is_chunked) {
      const { data: complexStatus, error: complexError } = await supabase
        .from('complex_processing_status')
        .select('*')
        .eq('processo_id', processo_id)
        .maybeSingle();

      if (complexError) {
        throw new Error(`Erro ao buscar status complexo: ${complexError.message}`);
      }

      console.log(`[${workerId}] 🔍 Status complexo atual:`);
      console.log(`[${workerId}]    Phase: ${complexStatus?.current_phase}`);
      console.log(`[${workerId}]    Chunks: ${complexStatus?.chunks_completed}/${complexStatus?.total_chunks}`);

      if (stage_id || result_id) {
        const resultFilter = result_id
          ? supabase.from('analysis_results').select('*').eq('id', result_id)
          : supabase.from('analysis_results').select('*').eq('prompt_id', stage_id).eq('processo_id', processo_id);

        const { data: result, error: resultError } = await resultFilter.maybeSingle();

        if (resultError || !result) {
          throw new Error(`Etapa não encontrada: ${resultError?.message}`);
        }

        console.log(`[${workerId}] 🎯 Reiniciando etapa específica: ${result.prompt_title}`);

        const { data: queueItems, error: queueError } = await supabase
          .from('processing_queue')
          .select('id, status, chunk_index')
          .eq('processo_id', processo_id)
          .eq('prompt_id', result.prompt_id)
          .in('status', ['processing', 'failed']);

        if (queueItems && queueItems.length > 0) {
          console.log(`[${workerId}] 🔄 Resetando ${queueItems.length} chunks para 'queued'`);

          const { error: resetError } = await supabase
            .from('processing_queue')
            .update({
              status: 'queued',
              attempts: 0,
              last_error: null,
              updated_at: new Date().toISOString(),
            })
            .in('id', queueItems.map(item => item.id));

          if (resetError) {
            console.error(`[${workerId}] ❌ Erro ao resetar chunks: ${resetError.message}`);
          }
        }

        if (result.status === 'running') {
          await supabase
            .from('analysis_results')
            .update({
              status: 'pending',
              processing_at: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', result.id);
        }
      }

      await supabase
        .from('complex_processing_status')
        .update({
          last_heartbeat: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('processo_id', processo_id);

      console.log(`[${workerId}] 🚀 Disparando process-complex-worker`);

      const workerResponse = await fetch(`${supabaseUrl}/functions/v1/process-complex-worker`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ processo_id }),
      });

      if (!workerResponse.ok) {
        const errorText = await workerResponse.text();
        throw new Error(`Erro ao disparar worker: ${errorText}`);
      }

      console.log(`[${workerId}] ✅ Worker disparado com sucesso`);

      return new Response(
        JSON.stringify({
          success: true,
          message: stage_id || result_id
            ? 'Etapa reiniciada com sucesso'
            : 'Processamento reiniciado com sucesso',
          processo_id,
          stage_restarted: !!(stage_id || result_id),
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else {
      console.log(`[${workerId}] 🔄 Processo não-chunked, reiniciando análise normal`);

      await supabase
        .from('analysis_results')
        .update({
          status: 'pending',
          processing_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('processo_id', processo_id)
        .in('status', ['running']);

      if (processo.status === 'analyzing') {
        await supabase
          .from('processos')
          .update({
            updated_at: new Date().toISOString(),
          })
          .eq('id', processo_id);
      }

      console.log(`[${workerId}] ✅ Análise reiniciada`);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Análise reiniciada com sucesso',
          processo_id,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error: any) {
    console.error(`[${workerId}] ❌ Erro ao reiniciar etapa:`, error);

    return new Response(
      JSON.stringify({
        error: error?.message || 'Erro ao reiniciar etapa',
        worker_id: workerId,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});