import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { processo_id } = await req.json();

    if (!processo_id) {
      return new Response(
        JSON.stringify({ error: 'processo_id é obrigatório' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const callId = crypto.randomUUID().slice(0, 8);
    console.log(`[${callId}] 🚀 Iniciando análise complexa para processo: ${processo_id}`);

    const { data: processo, error: processoError } = await supabase
      .from('processos')
      .select('*')
      .eq('id', processo_id)
      .single();

    if (processoError || !processo) {
      throw new Error('Processo não encontrado');
    }

    if (!processo.is_chunked || !processo.total_chunks_count) {
      throw new Error('Processo não está configurado para processamento complexo');
    }

    console.log(`[${callId}] 📦 Processo com ${processo.total_chunks_count} chunks detectado`);

    const { data: updatedProcesso, error: updateError } = await supabase
      .from('processos')
      .update({
        status: 'queued',
        analysis_started_at: new Date().toISOString(),
      })
      .eq('id', processo_id)
      .eq('status', 'created')
      .select()
      .maybeSingle();

    if (updateError) {
      console.error(`[${callId}] ❌ Erro ao atualizar status:`, updateError);
      throw new Error(`Erro ao iniciar análise: ${updateError.message}`);
    }

    if (!updatedProcesso) {
      console.log(`[${callId}] ⏸️ Processo já está sendo processado`);
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Processo já está em análise',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`[${callId}] ✅ Status atualizado para 'queued'`);

    const { data: complexStatus, error: statusError } = await supabase
      .from('complex_processing_status')
      .insert({
        processo_id,
        total_chunks: processo.total_chunks_count,
        current_phase: 'initializing',
        chunks_uploaded: processo.total_chunks_count,
        upload_progress_percent: 100,
      })
      .select()
      .single();

    if (statusError) {
      console.error(`[${callId}] ⚠️ Erro ao criar status complexo:`, statusError);
    } else {
      console.log(`[${callId}] ✅ Status de processamento complexo criado`);
    }

    const { data: prompts, error: promptsError } = await supabase
      .from('analysis_prompts')
      .select('id, title, prompt_content, system_prompt, execution_order')
      .eq('is_active', true)
      .order('execution_order', { ascending: true });

    if (promptsError || !prompts || prompts.length === 0) {
      throw new Error('Nenhum prompt ativo encontrado');
    }

    console.log(`[${callId}] Encontrados ${prompts.length} prompts ativos`);

    await supabase
      .from('processos')
      .update({
        current_prompt_number: 0,
        total_prompts: prompts.length,
      })
      .eq('id', processo_id);

    for (const prompt of prompts) {
      await supabase
        .from('analysis_results')
        .insert({
          processo_id,
          prompt_id: prompt.id,
          prompt_title: prompt.title,
          prompt_content: prompt.prompt_content,
          system_prompt: prompt.system_prompt,
          execution_order: prompt.execution_order,
          status: 'pending',
        });
    }

    console.log(`[${callId}] Análise complexa iniciada com sucesso`);
    console.log(`[${callId}] 🚀 Adicionando à fila de processamento...`);

    const { data: queueItem, error: queueError } = await supabase
      .from('processing_queue')
      .insert({
        processo_id,
        priority: 1,
        status: 'queued',
        total_chunks: processo.total_chunks_count,
      })
      .select()
      .single();

    if (queueError) {
      console.error(`[${callId}] ⚠️ Erro ao adicionar à fila:`, queueError);
    } else {
      console.log(`[${callId}] ✅ Adicionado à fila com prioridade ${queueItem.priority}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Análise complexa iniciada com sucesso',
        total_prompts: prompts.length,
        total_chunks: processo.total_chunks_count,
        status: 'queued',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Erro ao iniciar análise complexa:', error);

    return new Response(
      JSON.stringify({
        error: error?.message || 'Erro ao iniciar análise complexa',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});