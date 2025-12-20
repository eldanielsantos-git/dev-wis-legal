import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
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

    console.log(`\n[${workerId}] 🔍 Detectando processos pequenos travados...`);

    const stuckThresholdMinutes = 10;
    const stuckThreshold = new Date(Date.now() - stuckThresholdMinutes * 60 * 1000).toISOString();

    const { data: stuckPrompts, error: stuckError } = await supabase
      .from('analysis_results')
      .select(`
        id,
        processo_id,
        prompt_title,
        status,
        processing_at,
        processos!inner(is_chunked, status, file_name)
      `)
      .eq('status', 'processing')
      .lt('processing_at', stuckThreshold)
      .eq('processos.is_chunked', false)
      .eq('processos.status', 'analyzing');

    if (stuckError) {
      throw new Error(`Erro ao buscar prompts travados: ${stuckError.message}`);
    }

    if (!stuckPrompts || stuckPrompts.length === 0) {
      console.log(`[${workerId}] ✅ Nenhum processo pequeno travado encontrado`);
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Nenhum processo pequeno travado encontrado',
          recovered: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`[${workerId}] 🚨 ${stuckPrompts.length} prompts travados encontrados em processos pequenos`);

    const recovered = [];
    const failed = [];

    const processedProcessos = new Set<string>();

    for (const prompt of stuckPrompts) {
      const processoId = prompt.processo_id;

      if (processedProcessos.has(processoId)) {
        continue;
      }
      processedProcessos.add(processoId);

      console.log(`[${workerId}] 🔄 Recuperando processo: ${processoId}`);
      console.log(`[${workerId}]    Arquivo: ${(prompt as any).processos?.file_name}`);
      console.log(`[${workerId}]    Prompt: ${prompt.prompt_title}`);
      console.log(`[${workerId}]    Processing at: ${prompt.processing_at}`);

      try {
        console.log(`[${workerId}] 🔓 Liberando locks de prompts travados...`);

        const { error: resetError } = await supabase
          .from('analysis_results')
          .update({
            status: 'pending',
            processing_at: null,
          })
          .eq('processo_id', processoId)
          .eq('status', 'processing');

        if (resetError) {
          throw new Error(`Erro ao resetar prompts: ${resetError.message}`);
        }

        console.log(`[${workerId}] 🚀 Disparando process-next-prompt...`);

        const response = await fetch(`${supabaseUrl}/functions/v1/process-next-prompt`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ processo_id: processoId }),
        });

        if (response.ok) {
          console.log(`[${workerId}] ✅ Processo ${processoId} recuperado com sucesso`);
          recovered.push({
            processo_id: processoId,
            action: 'processing_restarted',
            file_name: (prompt as any).processos?.file_name,
          });
        } else {
          const errorText = await response.text();
          throw new Error(`Erro ao disparar process-next-prompt: ${errorText}`);
        }

      } catch (error: any) {
        console.error(`[${workerId}] ❌ Erro ao recuperar ${processoId}:`, error);
        failed.push({
          processo_id: processoId,
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
