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

    console.log(`🔄 Verificando chunks pendentes para processo: ${processo_id}`);

    const { data: pendingChunks, error: chunksError } = await supabase
      .from('process_chunks')
      .select('id, chunk_index, gemini_file_state, gemini_file_uri')
      .eq('processo_id', processo_id)
      .or('gemini_file_uri.is.null,gemini_file_state.neq.ACTIVE')
      .order('chunk_index', { ascending: true });

    if (chunksError) {
      throw chunksError;
    }

    if (!pendingChunks || pendingChunks.length === 0) {
      console.log(`✅ Todos os chunks já estão ACTIVE`);
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Todos os chunks já estão enviados e ACTIVE',
          pending_chunks: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`📤 ${pendingChunks.length} chunks precisam ser reenviados`);

    const uploadResults = [];

    for (const chunk of pendingChunks) {
      try {
        console.log(`📤 Reenviando chunk ${chunk.chunk_index + 1}...`);

        const response = await fetch(`${supabaseUrl}/functions/v1/upload-to-gemini`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            processo_id: processo_id,
            chunk_id: chunk.id,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ Erro no chunk ${chunk.chunk_index + 1}:`, errorText);
          uploadResults.push({
            chunk_index: chunk.chunk_index + 1,
            success: false,
            error: errorText,
          });
        } else {
          const result = await response.json();
          console.log(`✅ Chunk ${chunk.chunk_index + 1} enviado: ${result.state}`);
          uploadResults.push({
            chunk_index: chunk.chunk_index + 1,
            success: true,
            state: result.state,
          });
        }
      } catch (err) {
        console.error(`❌ Erro ao enviar chunk ${chunk.chunk_index + 1}:`, err);
        uploadResults.push({
          chunk_index: chunk.chunk_index + 1,
          success: false,
          error: err instanceof Error ? err.message : 'Erro desconhecido',
        });
      }
    }

    const successCount = uploadResults.filter(r => r.success).length;
    const failCount = uploadResults.filter(r => !r.success).length;

    console.log(`✅ Concluído: ${successCount} sucessos, ${failCount} falhas`);

    return new Response(
      JSON.stringify({
        success: failCount === 0,
        message: `${successCount} chunks reenviados com sucesso, ${failCount} falhas`,
        results: uploadResults,
        total_chunks: pendingChunks.length,
        success_count: successCount,
        fail_count: failCount,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('❌ Erro ao reenviar chunks:', error);
    return new Response(
      JSON.stringify({
        error: 'Erro ao reenviar chunks',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});