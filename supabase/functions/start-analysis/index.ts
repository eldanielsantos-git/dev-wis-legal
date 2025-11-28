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
    console.log(`[${callId}] Iniciando análise para processo: ${processo_id}`);

    const { data: updatedProcesso, error: updateError } = await supabase
      .from('processos')
      .update({
        status: 'analyzing',
        analysis_started_at: new Date().toISOString(),
      })
      .eq('id', processo_id)
      .eq('status', 'created')
      .select()
      .maybeSingle();

    if (updateError) {
      console.error(`[${callId}] ❌ Erro ao adquirir lock:`, updateError);
      throw new Error(`Erro ao iniciar análise: ${updateError.message}`);
    }

    if (!updatedProcesso) {
      console.log(`[${callId}] ⏸️ Processo já está sendo processado por outra chamada`);
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

    console.log(`[${callId}] ✅ Lock adquirido com sucesso`);

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

    if (updatedProcesso.is_chunked) {
      console.log(`[${callId}] 📦 Processo chunkeado detectado (${updatedProcesso.total_chunks_count} chunks)`);

      const { data: chunks, error: chunksError } = await supabase
        .from('process_chunks')
        .select('*')
        .eq('processo_id', processo_id)
        .order('chunk_index', { ascending: true });

      if (chunksError || !chunks || chunks.length === 0) {
        throw new Error('Chunks não encontrados para processo chunkeado');
      }

      console.log(`[${callId}] 🚀 Verificando uploads de ${chunks.length} chunks...`);

      const chunksToUpload = chunks.filter(chunk => !chunk.gemini_file_uri && geminiApiKey);

      if (chunksToUpload.length > 0) {
        console.log(`[${callId}] ⏳ ${chunksToUpload.length} chunks precisam ser enviados para Gemini`);
        console.log(`[${callId}] ⚠️ Uploads serão feitos durante o processamento das análises`);
      } else {
        console.log(`[${callId}] ✅ Todos os chunks já foram enviados para Gemini`);
      }
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

    console.log(`[${callId}] Análise iniciada com sucesso`);
    console.log(`[${callId}] 🚀 Disparando process-next-prompt...`);

    fetch(`${supabaseUrl}/functions/v1/process-next-prompt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ processo_id }),
    }).catch(error => {
      console.error('Erro ao disparar process-next-prompt:', error);
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Análise iniciada com sucesso',
        total_prompts: prompts.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Erro ao iniciar análise:', error);

    return new Response(
      JSON.stringify({
        error: error?.message || 'Erro ao iniciar análise',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});