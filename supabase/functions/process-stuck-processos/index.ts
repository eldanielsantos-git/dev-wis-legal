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

    console.log('🔍 Buscando processos travados...');

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { data: stuckProcessos, error } = await supabase
      .from('processos')
      .select('id, file_name, user_id, analysis_started_at, current_prompt_number, total_prompts')
      .eq('status', 'analyzing')
      .lt('analysis_started_at', fiveMinutesAgo)
      .limit(10);

    if (error) {
      throw new Error(`Erro ao buscar processos: ${error.message}`);
    }

    if (!stuckProcessos || stuckProcessos.length === 0) {
      console.log('✅ Nenhum processo travado encontrado');
      return new Response(
        JSON.stringify({
          message: 'Nenhum processo travado encontrado',
          count: 0,
          stuck_processos: []
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 Encontrados ${stuckProcessos.length} processos potencialmente travados`);

    const results = [];

    for (const processo of stuckProcessos) {
      console.log(`\n🔄 Verificando: ${processo.file_name} (${processo.id})`);

      const { data: pendingResults, error: pendingError } = await supabase
        .from('analysis_results')
        .select('id, status')
        .eq('processo_id', processo.id)
        .in('status', ['pending', 'running'])
        .limit(1)
        .maybeSingle();

      if (pendingError) {
        console.error(`❌ Erro ao verificar análises: ${pendingError.message}`);
        results.push({
          processo_id: processo.id,
          file_name: processo.file_name,
          status: 'error',
          message: pendingError.message,
          needs_user_action: false,
        });
        continue;
      }

      if (!pendingResults) {
        console.log(`✅ Processo ${processo.id} não tem análises pendentes, marcando como completo`);

        await supabase
          .from('processos')
          .update({
            status: 'completed',
            analysis_completed_at: new Date().toISOString(),
          })
          .eq('id', processo.id);

        results.push({
          processo_id: processo.id,
          file_name: processo.file_name,
          status: 'completed',
          message: 'Marcado como completo automaticamente',
          needs_user_action: false,
        });
        continue;
      }

      console.log(`⚠️ Processo ${processo.id} está travado e precisa ser retomado`);

      results.push({
        processo_id: processo.id,
        file_name: processo.file_name,
        status: 'stuck',
        message: 'Aguardando retomada pelo usuário ou sistema',
        needs_user_action: true,
        current_prompt: processo.current_prompt_number,
        total_prompts: processo.total_prompts,
      });
    }

    console.log(`\n📊 Resumo: ${results.length} processos verificados`);

    return new Response(
      JSON.stringify({
        message: 'Verificação de processos concluída',
        total: stuckProcessos.length,
        stuck_count: results.filter(r => r.status === 'stuck').length,
        completed_count: results.filter(r => r.status === 'completed').length,
        stuck_processos: results,
      }),
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