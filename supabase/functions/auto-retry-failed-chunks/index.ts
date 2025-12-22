import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { PDFDocument } from 'npm:pdf-lib@1.17.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const MAX_RETRIES = 30;
const PAGES_PER_CHUNK = 100;

function calculateBackoff(retryCount: number): number {
  const baseDelay = Math.pow(2, retryCount);
  const maxDelay = 300;
  return Math.min(baseDelay, maxDelay);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const callId = crypto.randomUUID().slice(0, 8);
  console.log(`[${callId}] 🔄 Iniciando worker de retry automático de chunks`);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { processo_id } = await req.json();

    if (!processo_id) {
      return new Response(
        JSON.stringify({ error: 'processo_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[${callId}] 📋 Buscando processo: ${processo_id}`);

    const { data: processo, error: processoError } = await supabase
      .from('processos')
      .select('*')
      .eq('id', processo_id)
      .single();

    if (processoError || !processo) {
      throw new Error('Processo não encontrado');
    }

    if (!processo.current_failed_chunk && processo.current_failed_chunk !== 0) {
      console.log(`[${callId}] ✅ Nenhum chunk com falha, nada a fazer`);
      return new Response(
        JSON.stringify({ success: true, message: 'Nenhum chunk com falha' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (processo.chunk_retry_count >= MAX_RETRIES) {
      console.error(`[${callId}] ❌ Máximo de ${MAX_RETRIES} tentativas atingido`);
      
      await supabase
        .from('processos')
        .update({
          status: 'error',
          last_chunk_error: `Máximo de ${MAX_RETRIES} tentativas atingido para chunk ${processo.current_failed_chunk}`,
          next_chunk_retry_at: null,
        })
        .eq('id', processo_id);

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Máximo de tentativas atingido',
          retry_count: processo.chunk_retry_count
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const failedChunkIndex = processo.current_failed_chunk;
    console.log(`[${callId}] 🔄 Tentando reenviar chunk ${failedChunkIndex} (tentativa ${processo.chunk_retry_count + 1}/${MAX_RETRIES})`);

    if (!processo.original_file_path) {
      throw new Error('Arquivo original não encontrado no storage');
    }

    console.log(`[${callId}] 📥 Baixando arquivo original do storage...`);
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('processos')
      .download(processo.original_file_path);

    if (downloadError || !fileData) {
      throw new Error(`Erro ao baixar arquivo original: ${downloadError?.message}`);
    }

    console.log(`[${callId}] 📄 Carregando PDF e criando chunk ${failedChunkIndex}...`);
    const arrayBuffer = await fileData.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const totalPages = pdfDoc.getPageCount();

    const startPage = failedChunkIndex * PAGES_PER_CHUNK;
    const endPage = Math.min(startPage + PAGES_PER_CHUNK, totalPages);

    const chunkDoc = await PDFDocument.create();
    for (let pageNum = startPage; pageNum < endPage; pageNum++) {
      const [copiedPage] = await chunkDoc.copyPages(pdfDoc, [pageNum]);
      chunkDoc.addPage(copiedPage);
    }

    const chunkBytes = await chunkDoc.save();
    const chunkBlob = new Blob([chunkBytes], { type: 'application/pdf' });

    const sanitizedFileName = processo.file_name
      .normalize('NFD')
      .replace(/[\u0000-\u001f\u007f-\u009f/\\?%*:|"<>]/g, '')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase();

    const timestamp = Date.now();
    const chunkPath = `${processo.user_id}/${timestamp}-${sanitizedFileName.replace('.pdf', '')}_chunk${failedChunkIndex}.pdf`;

    console.log(`[${callId}] 📤 Fazendo upload do chunk para: ${chunkPath}`);

    const { error: uploadError } = await supabase.storage
      .from('processos')
      .upload(chunkPath, chunkBlob, {
        cacheControl: '3600',
        upsert: true,
        contentType: 'application/pdf'
      });

    if (uploadError) {
      console.error(`[${callId}] ❌ Erro no upload:`, uploadError);
      
      const newRetryCount = processo.chunk_retry_count + 1;
      const backoffSeconds = calculateBackoff(newRetryCount);
      const nextRetryAt = new Date(Date.now() + backoffSeconds * 1000).toISOString();

      await supabase
        .from('processos')
        .update({
          chunk_retry_count: newRetryCount,
          last_chunk_error: uploadError.message,
          next_chunk_retry_at: nextRetryAt,
        })
        .eq('id', processo_id);

      return new Response(
        JSON.stringify({
          success: false,
          error: uploadError.message,
          retry_count: newRetryCount,
          next_retry_in_seconds: backoffSeconds
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[${callId}] ✅ Chunk ${failedChunkIndex} enviado com sucesso!`);

    const newChunksUploaded = processo.chunks_uploaded_count + 1;
    const allChunksUploaded = newChunksUploaded >= processo.total_chunks_count;

    await supabase
      .from('processos')
      .update({
        chunks_uploaded_count: newChunksUploaded,
        last_chunk_uploaded_at: new Date().toISOString(),
        chunk_retry_count: 0,
        current_failed_chunk: null,
        last_chunk_error: null,
        next_chunk_retry_at: null,
        upload_interrupted: !allChunksUploaded,
        status: allChunksUploaded ? 'created' : 'uploading'
      })
      .eq('id', processo_id);

    if (allChunksUploaded) {
      console.log(`[${callId}] 🎉 Todos os chunks foram enviados! Processo completo.`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        chunk_index: failedChunkIndex,
        chunks_uploaded: newChunksUploaded,
        total_chunks: processo.total_chunks_count,
        all_chunks_uploaded: allChunksUploaded,
        message: allChunksUploaded ? 'Upload completo!' : 'Chunk reenviado com sucesso'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error(`[${callId}] ❌ Erro fatal:`, error);
    return new Response(
      JSON.stringify({
        error: 'Erro ao reenviar chunk',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
