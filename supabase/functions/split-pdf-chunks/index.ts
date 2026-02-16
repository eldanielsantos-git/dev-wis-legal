import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { PDFDocument } from 'npm:pdf-lib@1.17.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const MAX_CHUNK_SIZE_BYTES = 15 * 1024 * 1024;
const OVERLAP_PAGES = 75;
const MAX_FILE_SIZE_FOR_FULL_LOAD = 80 * 1024 * 1024;

function calculateChunkSizeByFileSize(totalPages: number, fileSize: number): number {
  const avgBytesPerPage = fileSize / totalPages;
  const pagesPerMaxChunk = Math.floor(MAX_CHUNK_SIZE_BYTES / avgBytesPerPage);
  return Math.max(10, Math.min(pagesPerMaxChunk, 100));
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { processo_id, start_from_chunk } = await req.json();

    if (!processo_id) {
      return new Response(
        JSON.stringify({ error: 'processo_id obrigatorio' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[split-pdf-chunks] Iniciando divisao para processo: ${processo_id}`);

    const { data: processo, error: processoError } = await supabase
      .from('processos')
      .select('*')
      .eq('id', processo_id)
      .single();

    if (processoError || !processo) {
      throw new Error(`Processo nao encontrado: ${processoError?.message}`);
    }

    if (!processo.original_file_path) {
      throw new Error('Arquivo original nao encontrado');
    }

    const fileSize = processo.file_size || 0;

    if (fileSize > MAX_FILE_SIZE_FOR_FULL_LOAD) {
      return new Response(
        JSON.stringify({
          error: 'file_too_large',
          message: `Arquivo muito grande (${Math.round(fileSize / 1024 / 1024)}MB). Maximo: ${Math.round(MAX_FILE_SIZE_FOR_FULL_LOAD / 1024 / 1024)}MB para processamento automatico.`,
          suggestion: 'use_incremental'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[split-pdf-chunks] Baixando arquivo: ${processo.original_file_path}`);

    const { data: fileData, error: downloadError } = await supabase.storage
      .from('processos')
      .download(processo.original_file_path);

    if (downloadError || !fileData) {
      throw new Error(`Erro ao baixar arquivo: ${downloadError?.message}`);
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
    const totalPages = pdfDoc.getPageCount();
    const actualFileSize = arrayBuffer.byteLength;

    console.log(`[split-pdf-chunks] PDF carregado: ${totalPages} paginas, ${Math.round(actualFileSize / 1024 / 1024)}MB`);

    const chunkSize = calculateChunkSizeByFileSize(totalPages, actualFileSize);
    const totalChunks = Math.ceil(totalPages / chunkSize);

    console.log(`[split-pdf-chunks] Configuracao: ${chunkSize} paginas/chunk, ${totalChunks} chunks total`);

    await supabase
      .from('processos')
      .update({
        total_chunks_count: totalChunks,
        total_pages: totalPages
      })
      .eq('id', processo_id);

    let currentPage = (start_from_chunk || 0) * chunkSize;
    let chunkIndex = start_from_chunk || 0;

    while (currentPage < totalPages) {
      const isFirstChunk = chunkIndex === 0;
      const overlapStart = !isFirstChunk ? Math.max(0, currentPage - OVERLAP_PAGES) : null;
      const chunkStartPage = overlapStart !== null ? overlapStart : currentPage;
      const chunkEndPage = Math.min(currentPage + chunkSize, totalPages);

      console.log(`[split-pdf-chunks] Criando chunk ${chunkIndex + 1}/${totalChunks}: paginas ${chunkStartPage + 1}-${chunkEndPage}`);

      const chunkDoc = await PDFDocument.create();

      for (let pageNum = chunkStartPage; pageNum < chunkEndPage; pageNum++) {
        const [copiedPage] = await chunkDoc.copyPages(pdfDoc, [pageNum]);
        chunkDoc.addPage(copiedPage);
      }

      const chunkBytes = await chunkDoc.save();
      const chunkBlob = new Blob([chunkBytes], { type: 'application/pdf' });

      const timestamp = Date.now();
      const sanitizedName = processo.file_name
        .normalize('NFD')
        .replace(/[\u0000-\u001f\u007f-\u009f/\\?%*:|"<>]/g, '')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace('.pdf', '')
        .toLowerCase();

      const chunkPath = `${processo.user_id}/${timestamp}-${sanitizedName}_chunk${chunkIndex + 1}.pdf`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('processos')
        .upload(chunkPath, chunkBlob, { cacheControl: '3600', upsert: true });

      if (uploadError) {
        throw new Error(`Erro upload chunk ${chunkIndex + 1}: ${uploadError.message}`);
      }

      const { error: chunkInsertError } = await supabase
        .from('process_chunks')
        .insert({
          processo_id: processo_id,
          chunk_index: chunkIndex + 1,
          total_chunks: totalChunks,
          start_page: currentPage + 1,
          end_page: chunkEndPage,
          pages_count: chunkEndPage - chunkStartPage,
          overlap_start_page: overlapStart !== null ? overlapStart + 1 : null,
          overlap_end_page: overlapStart !== null ? currentPage : null,
          file_path: uploadData.path,
          file_size: chunkBytes.byteLength,
          status: 'ready',
        });

      if (chunkInsertError) {
        throw new Error(`Erro ao salvar chunk ${chunkIndex + 1}: ${chunkInsertError.message}`);
      }

      await supabase
        .from('processos')
        .update({
          chunks_uploaded_count: chunkIndex + 1,
          last_chunk_uploaded_at: new Date().toISOString(),
        })
        .eq('id', processo_id);

      currentPage += chunkSize;
      chunkIndex++;
    }

    await supabase
      .from('processos')
      .update({
        status: 'created',
        upload_interrupted: false,
        total_chunks: totalChunks,
        transcricao: { totalPages, totalChunks, chunkSize }
      })
      .eq('id', processo_id);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[split-pdf-chunks] Concluido em ${duration}s: ${totalChunks} chunks criados`);

    return new Response(
      JSON.stringify({
        success: true,
        totalChunks,
        totalPages,
        chunkSize,
        duration: `${duration}s`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[split-pdf-chunks] Erro:', error);

    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
