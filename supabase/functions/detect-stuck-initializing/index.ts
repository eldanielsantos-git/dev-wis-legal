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

  const workerId = crypto.randomUUID().slice(0, 8);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`[${workerId}] Verificando processos travados em 'initializing'...`);

    const stuckThresholdMinutes = 15;
    const stuckThreshold = new Date(Date.now() - stuckThresholdMinutes * 60 * 1000).toISOString();

    const { data: stuckProcesses, error: stuckError } = await supabase
      .from('complex_processing_status')
      .select('processo_id, current_phase, chunks_uploaded, total_chunks, last_heartbeat')
      .eq('current_phase', 'initializing')
      .lt('last_heartbeat', stuckThreshold);

    if (stuckError) {
      throw new Error(`Erro ao buscar status: ${stuckError.message}`);
    }

    if (!stuckProcesses || stuckProcesses.length === 0) {
      console.log(`[${workerId}] Nenhum processo travado em 'initializing'`);
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Nenhum processo travado encontrado',
          fixed_count: 0,
          retriggered_count: 0,
          error_count: 0,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[${workerId}] Encontrados ${stuckProcesses.length} processos travados`);

    let fixedCount = 0;
    let retriggeredCount = 0;
    let errorCount = 0;
    const results: any[] = [];

    for (const proc of stuckProcesses) {
      try {
        console.log(`[${workerId}] Analisando processo: ${proc.processo_id}`);

        const { data: chunks, error: chunksError } = await supabase
          .from('process_chunks')
          .select('id, gemini_file_uri, gemini_file_state')
          .eq('processo_id', proc.processo_id);

        if (chunksError) {
          throw new Error(`Erro ao buscar chunks: ${chunksError.message}`);
        }

        const allUploaded = chunks?.every(c => c.gemini_file_uri && c.gemini_file_state === 'ACTIVE');
        const someUploaded = chunks?.some(c => c.gemini_file_uri);
        const noneUploaded = !chunks || chunks.length === 0 || !someUploaded;

        console.log(`[${workerId}] Status chunks: ${chunks?.length || 0} total, allActive=${allUploaded}, someUploaded=${someUploaded}`);

        const { data: queueItems } = await supabase
          .from('processing_queue')
          .select('id')
          .eq('processo_id', proc.processo_id)
          .limit(1);

        const hasQueue = queueItems && queueItems.length > 0;

        if (allUploaded && !hasQueue) {
          console.log(`[${workerId}] Chunks uploadados mas fila nao criada. Disparando upload-chunks-worker...`);

          const response = await fetch(`${supabaseUrl}/functions/v1/upload-chunks-worker`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ processo_id: proc.processo_id }),
          });

          if (response.ok) {
            retriggeredCount++;
            results.push({ processo_id: proc.processo_id, action: 'upload_worker_retriggered' });
            console.log(`[${workerId}] Upload worker disparado com sucesso`);
          } else {
            throw new Error(`Falha ao disparar upload worker: ${response.status}`);
          }

        } else if (allUploaded && hasQueue) {
          console.log(`[${workerId}] Chunks e fila OK. Atualizando fase e disparando worker...`);

          await supabase
            .from('complex_processing_status')
            .update({
              current_phase: 'processing',
              last_heartbeat: new Date().toISOString(),
            })
            .eq('processo_id', proc.processo_id);

          fetch(`${supabaseUrl}/functions/v1/process-complex-worker`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ processo_id: proc.processo_id }),
          }).catch(err => {
            console.error(`[${workerId}] Erro ao disparar worker:`, err);
          });

          fixedCount++;
          results.push({ processo_id: proc.processo_id, action: 'phase_updated_worker_triggered' });

        } else if (noneUploaded || !allUploaded) {
          console.log(`[${workerId}] Chunks nao foram uploadados. Disparando upload-chunks-worker...`);

          const response = await fetch(`${supabaseUrl}/functions/v1/upload-chunks-worker`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ processo_id: proc.processo_id }),
          });

          if (response.ok) {
            retriggeredCount++;
            results.push({ processo_id: proc.processo_id, action: 'upload_started' });
            console.log(`[${workerId}] Upload iniciado com sucesso`);
          } else {
            throw new Error(`Falha ao iniciar upload: ${response.status}`);
          }
        }

        await supabase
          .from('complex_processing_status')
          .update({ last_heartbeat: new Date().toISOString() })
          .eq('processo_id', proc.processo_id);

      } catch (procError: any) {
        console.error(`[${workerId}] Erro ao processar ${proc.processo_id}:`, procError);
        errorCount++;
        results.push({ processo_id: proc.processo_id, error: procError.message });
      }
    }

    console.log(`[${workerId}] Resumo: fixed=${fixedCount}, retriggered=${retriggeredCount}, errors=${errorCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        fixed_count: fixedCount,
        retriggered_count: retriggeredCount,
        error_count: errorCount,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error(`[${workerId}] Erro:`, error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
