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

    console.log('🔍 Buscando chunks com erro de token limit...');

    const { data: failedChunks, error } = await supabase
      .from('process_chunks')
      .select('id, processo_id, chunk_index, start_page, end_page, pages_count, token_validation_status, error_message')
      .eq('token_validation_status', 'exceeded')
      .eq('status', 'failed')
      .is('subdivision_parent_id', null)
      .limit(10);

    if (error) {
      throw new Error(`Erro ao buscar chunks: ${error.message}`);
    }

    if (!failedChunks || failedChunks.length === 0) {
      console.log('✅ Nenhum chunk com token limit encontrado');
      return new Response(
        JSON.stringify({
          message: 'Nenhum chunk com erro de token limit',
          count: 0,
          subdivided: []
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 Encontrados ${failedChunks.length} chunks para subdividir`);

    const results = [];

    for (const chunk of failedChunks) {
      console.log(`\n✂️ Subdividindo chunk ${chunk.id} (páginas ${chunk.start_page}-${chunk.end_page})`);

      const pagesCount = chunk.end_page - chunk.start_page + 1;
      const subChunkSize = 80;
      const subChunksCount = Math.ceil(pagesCount / subChunkSize);

      console.log(`   Dividindo ${pagesCount} páginas em ${subChunksCount} sub-chunks de ~${subChunkSize} páginas`);

      const subChunks = [];
      let currentPage = chunk.start_page;

      for (let i = 0; i < subChunksCount; i++) {
        const subChunkEndPage = Math.min(currentPage + subChunkSize - 1, chunk.end_page);
        const subChunkPages = subChunkEndPage - currentPage + 1;
        const estimatedTokens = subChunkPages * 1500;

        const { data: newSubChunk, error: insertError } = await supabase
          .from('process_chunks')
          .insert({
            processo_id: chunk.processo_id,
            chunk_index: chunk.chunk_index,
            start_page: currentPage,
            end_page: subChunkEndPage,
            pages_count: subChunkPages,
            total_chunks: subChunksCount,
            status: 'pending',
            subdivision_parent_id: chunk.id,
            subdivision_index: i,
            estimated_tokens: estimatedTokens,
            token_validation_status: estimatedTokens > 850000 ? 'exceeded' : 'valid'
          })
          .select()
          .single();

        if (insertError) {
          console.error(`   ❌ Erro ao criar sub-chunk ${i + 1}:`, insertError);
          continue;
        }

        subChunks.push(newSubChunk.id);

        const { data: prompts } = await supabase
          .from('analysis_prompts')
          .select('id, prompt_content')
          .eq('is_active', true);

        if (prompts) {
          for (const prompt of prompts) {
            await supabase
              .from('processing_queue')
              .insert({
                processo_id: chunk.processo_id,
                chunk_id: newSubChunk.id,
                queue_type: 'chunk_processing',
                priority: 10,
                prompt_id: prompt.id,
                prompt_content: prompt.prompt_content,
                context_data: {
                  chunk_index: chunk.chunk_index,
                  subdivision_index: i,
                  is_subdivided: true,
                  parent_chunk_id: chunk.id
                },
                timeout_seconds: 900,
              });
          }
        }

        console.log(`   ✅ Sub-chunk ${i + 1}/${subChunksCount} criado: ${currentPage}-${subChunkEndPage} (${subChunkPages} pgs, ~${estimatedTokens.toLocaleString()} tokens)`);

        currentPage = subChunkEndPage + 1;
      }

      await supabase
        .from('process_chunks')
        .update({
          status: 'subdivided',
          token_validation_status: 'subdivided'
        })
        .eq('id', chunk.id);

      await supabase
        .from('processing_queue')
        .update({
          status: 'completed',
          notes: 'Chunk subdivided into smaller parts'
        })
        .eq('chunk_id', chunk.id)
        .eq('status', 'dead_letter');

      results.push({
        original_chunk_id: chunk.id,
        pages: `${chunk.start_page}-${chunk.end_page}`,
        sub_chunks_created: subChunks.length,
        sub_chunk_ids: subChunks
      });

      console.log(`\n🚀 Disparando workers para processar sub-chunks...`);
      for (let i = 0; i < Math.min(3, subChunks.length); i++) {
        fetch(`${supabaseUrl}/functions/v1/process-complex-worker`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ processo_id: chunk.processo_id }),
        }).catch(err => {
          console.error(`   ❌ Erro ao disparar worker ${i + 1}:`, err);
        });
      }
    }

    console.log(`\n📊 Resumo:`);
    console.log(`   Chunks subdivididos: ${results.length}`);
    console.log(`   Total de sub-chunks criados: ${results.reduce((sum, r) => sum + r.sub_chunks_created, 0)}`);

    return new Response(
      JSON.stringify({
        message: 'Subdivisão automática concluída',
        total_subdivided: results.length,
        total_subchunks_created: results.reduce((sum, r) => sum + r.sub_chunks_created, 0),
        results
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