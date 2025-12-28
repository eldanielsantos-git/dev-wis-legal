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
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'public' },
      auth: { persistSession: false }
    });

    const processo_id = '864a047b-e2f6-4197-bfa0-a33040d43eb4';

    console.log(`🔄 Resetando etapa 4 do processo ${processo_id}`);

    // Primeira, vamos executar SQL raw para ver qual é o schema correto
    const { data: tables, error: tablesError } = await supabase
      .rpc('exec_sql', {
        query: `
          SELECT table_schema, table_name 
          FROM information_schema.tables 
          WHERE table_name LIKE '%analysis%' OR table_name LIKE '%prompt%'
          ORDER BY table_schema, table_name;
        `
      });

    console.log('Tables found:', JSON.stringify(tables, null, 2));

    if (tablesError) {
      console.error('Error listing tables:', tablesError);
    }

    // Tentar usar o cliente direto
    const { data: allData, error: dataError } = await supabase
      .from('analysis_prompts_results')
      .select('*')
      .eq('processo_id', processo_id)
      .eq('execution_order', 4)
      .maybeSingle();

    if (dataError) {
      console.error('Error with analysis_prompts_results:', dataError.message);
    } else if (allData) {
      console.log('Found stage 4:', JSON.stringify(allData, null, 2));

      // Resetar para pending
      const { error: updateError } = await supabase
        .from('analysis_prompts_results')
        .update({
          status: 'pending',
          started_at: null,
          error_details: null,
        })
        .eq('id', allData.id);

      if (updateError) {
        throw new Error(`Erro ao resetar etapa 4: ${updateError.message}`);
      }

      console.log(`✅ Etapa 4 resetada para pending`);

      // Disparar process-next-prompt
      const nextPromptResponse = await fetch(`${supabaseUrl}/functions/v1/process-next-prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ processo_id }),
      });

      const result = await nextPromptResponse.json();
      console.log('process-next-prompt response:', result);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Etapa 4 resetada e processamento iniciado',
          stage: allData,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        error: 'Etapa 4 não encontrada',
        tables_info: tables,
      }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error(`❌ Erro:`, error);

    return new Response(
      JSON.stringify({
        error: error?.message || 'Erro ao resetar etapa 4',
        stack: error?.stack,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});