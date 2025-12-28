import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
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

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const processo_id = '864a047b-e2f6-4197-bfa0-a33040d43eb4';

    console.log(`🔄 Resetando etapa 4 do processo ${processo_id}`);

    // Busca a etapa 4 (execution_order = 4)
    const { data: stage4, error: stage4Error } = await supabase
      .from('analysis_results')
      .select('*')
      .eq('processo_id', processo_id)
      .eq('execution_order', 4)
      .maybeSingle();

    if (stage4Error) {
      throw new Error(`Erro ao buscar etapa 4: ${stage4Error.message}`);
    }

    if (!stage4) {
      throw new Error('Etapa 4 não encontrada');
    }

    console.log(`📋 Etapa 4 encontrada: ${stage4.prompt_title}`);
    console.log(`   Status atual: ${stage4.status}`);

    // Reset da etapa 4 para pending
    const { error: updateError } = await supabase
      .from('analysis_results')
      .update({
        status: 'pending',
        processing_at: null,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', stage4.id);

    if (updateError) {
      throw new Error(`Erro ao resetar etapa 4: ${updateError.message}`);
    }

    console.log(`✅ Etapa 4 resetada para pending`);

    // Dispara o processamento
    console.log(`🚀 Disparando process-next-prompt...`);

    const nextPromptResponse = await fetch(`${supabaseUrl}/functions/v1/process-next-prompt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ processo_id }),
    });

    if (!nextPromptResponse.ok) {
      const errorText = await nextPromptResponse.text();
      console.warn(`⚠️ Aviso ao disparar process-next-prompt: ${errorText}`);
    } else {
      console.log(`✅ process-next-prompt disparado com sucesso`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Etapa 4 resetada e processamento iniciado',
        stage: {
          id: stage4.id,
          title: stage4.prompt_title,
          execution_order: stage4.execution_order,
          previous_status: stage4.status,
          new_status: 'pending',
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error(`❌ Erro:`, error);

    return new Response(
      JSON.stringify({
        error: error?.message || 'Erro ao resetar etapa 4',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});