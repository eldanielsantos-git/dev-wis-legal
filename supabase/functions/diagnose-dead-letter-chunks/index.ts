import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
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

    console.log('🔍 Diagnosticando chunks em dead_letter...');

    const { data: deadLetterChunks, error: chunksError } = await supabase
      .from('process_chunks')
      .select('processo_id, chunk_number, status, retry_count, last_error, created_at, updated_at')
      .eq('status', 'dead_letter')
      .order('updated_at', { ascending: true });

    if (chunksError) {
      throw new Error(`Erro ao buscar chunks: ${chunksError.message}`);
    }

    if (!deadLetterChunks || deadLetterChunks.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Nenhum chunk em dead_letter encontrado',
          total_dead_letter: 0,
          chunks: [],
          affected_processos: [],
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`📊 Total de chunks em dead_letter: ${deadLetterChunks.length}`);

    const processoIds = [...new Set(deadLetterChunks.map(c => c.processo_id))];
    console.log(`📁 Processos afetados: ${processoIds.length}`);

    const { data: processos } = await supabase
      .from('processos')
      .select('id, numero_processo, status, created_at')
      .in('id', processoIds);

    const diagnosticData = {
      success: true,
      total_dead_letter: deadLetterChunks.length,
      affected_processos_count: processoIds.length,
      chunks: deadLetterChunks.map(chunk => ({
        processo_id: chunk.processo_id,
        chunk_number: chunk.chunk_number,
        retry_count: chunk.retry_count,
        time_in_dead_letter: Math.floor((Date.now() - new Date(chunk.updated_at).getTime()) / (60 * 1000)),
        last_error: chunk.last_error,
        created_at: chunk.created_at,
        updated_at: chunk.updated_at,
      })),
      affected_processos: processos?.map(p => ({
        id: p.id,
        numero_processo: p.numero_processo,
        status: p.status,
        chunks_in_dead_letter: deadLetterChunks.filter(c => c.processo_id === p.id).length,
      })) || [],
      oldest_dead_letter: deadLetterChunks[0]?.updated_at,
      recommendations: generateRecommendations(deadLetterChunks),
    };

    return new Response(
      JSON.stringify(diagnosticData),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('❌ Erro no diagnóstico:', error);

    return new Response(
      JSON.stringify({
        error: error?.message || 'Erro ao diagnosticar chunks dead_letter',
        stack: error?.stack,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function generateRecommendations(chunks: any[]): string[] {
  const recommendations: string[] = [];

  const oldestChunk = chunks[0];
  if (oldestChunk) {
    const minutesInDeadLetter = Math.floor((Date.now() - new Date(oldestChunk.updated_at).getTime()) / (60 * 1000));

    if (minutesInDeadLetter > 60) {
      recommendations.push(`Há chunks em dead_letter há mais de ${Math.floor(minutesInDeadLetter / 60)} horas. Considere executar recovery manual.`);
    } else if (minutesInDeadLetter > 10) {
      recommendations.push(`Chunks mais antigos estão em dead_letter há ${minutesInDeadLetter} minutos. Recovery automático deve processar em breve.`);
    }
  }

  const highRetryCount = chunks.filter(c => c.retry_count >= 3);
  if (highRetryCount.length > 0) {
    recommendations.push(`${highRetryCount.length} chunks já tentaram 3+ vezes. Verifique se há um problema sistêmico.`);
  }

  const processoIds = [...new Set(chunks.map(c => c.processo_id))];
  if (processoIds.length > 5) {
    recommendations.push(`${processoIds.length} processos afetados. Pode indicar um problema geral no sistema de processamento.`);
  }

  if (chunks.length > 20) {
    recommendations.push('Mais de 20 chunks em dead_letter. Considere aumentar capacidade de processamento ou investigar erros comuns.');
  }

  if (recommendations.length === 0) {
    recommendations.push('Sistema operando normalmente. Recovery automático irá processar esses chunks.');
  }

  return recommendations;
}
