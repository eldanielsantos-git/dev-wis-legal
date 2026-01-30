import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { GoogleAIFileManager } from 'npm:@google/generative-ai@0.24.1/server';

const FILE_SIZE_THRESHOLD_BYTES = 18874368; // 18MB - files <= this use base64, > this use File API

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

async function waitForFileProcessing(
  fileManager: any,
  fileName: string,
  timeoutMs: number = 5 * 60 * 1000
): Promise<any> {
  const startTime = Date.now();
  const pollingInterval = 2000;

  while (Date.now() - startTime < timeoutMs) {
    const file = await fileManager.getFile(fileName);
    console.log(`📊 Estado do arquivo: ${file.state}`);

    if (file.state === 'ACTIVE') {
      return file;
    }

    if (file.state === 'FAILED') {
      throw new Error(`Processamento do arquivo falhou: ${file.error?.message || 'Unknown error'}`);
    }

    await new Promise(resolve => setTimeout(resolve, pollingInterval));
  }

  throw new Error('Timeout aguardando processamento do arquivo');
}

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
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY não configurada');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { processo_id, chunk_id } = await req.json();

    if (!processo_id) {
      return new Response(
        JSON.stringify({ error: 'processo_id é obrigatório' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const fileManager = new GoogleAIFileManager(geminiApiKey);

    if (chunk_id) {
      console.log(`📤 Iniciando upload de chunk para Gemini File API - Chunk ID: ${chunk_id}`);

      const { data: chunk, error: chunkError } = await supabase
        .from('process_chunks')
        .select('*')
        .eq('id', chunk_id)
        .single();

      if (chunkError || !chunk) {
        throw new Error(`Chunk não encontrado: ${chunkError?.message}`);
      }

      console.log(`📥 Baixando chunk do Storage: ${chunk.file_path}`);
      console.log(`📂 Bucket: processos, Path: ${chunk.file_path}`);

      const { data: fileData, error: downloadError } = await supabase.storage
        .from('processos')
        .download(chunk.file_path);

      if (downloadError || !fileData) {
        console.error(`❌ Erro ao baixar chunk ${chunk.chunk_index}:`, {
          error: downloadError,
          message: downloadError?.message,
          chunk_id: chunk.id,
          file_path: chunk.file_path,
          processo_id: chunk.processo_id,
        });
        throw new Error(`Erro ao baixar chunk ${chunk.chunk_index}: ${downloadError?.message || 'Arquivo não encontrado'}. Path: ${chunk.file_path}`);
      }

      console.log(`✅ Chunk baixado: ${(fileData.size / 1024 / 1024).toFixed(2)}MB`);

      const arrayBuffer = await fileData.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const chunkFileName = `chunk_${chunk.chunk_index}_of_${chunk.total_chunks}.pdf`;

      console.log(`📤 Fazendo upload do chunk para Gemini (${(uint8Array.length / 1024 / 1024).toFixed(2)}MB)...`);

      const MAX_RETRIES = 3;
      let lastError: Error | null = null;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          console.log(`🔄 Tentativa ${attempt}/${MAX_RETRIES} de upload para Gemini...`);

          const tempFilePath = `/tmp/${chunk.id}_${chunkFileName}`;
          await Deno.writeFile(tempFilePath, uint8Array);

          const uploadResult = await fileManager.uploadFile(tempFilePath, {
            mimeType: 'application/pdf',
            displayName: chunkFileName,
          });

          try {
            await Deno.remove(tempFilePath);
          } catch (e) {
            console.log('⚠️ Erro ao remover arquivo temporário:', e);
          }

          console.log(`✅ Upload do chunk concluído: ${uploadResult.file.uri}`);

          const expiresAt = new Date(uploadResult.file.expirationTime!);
          const uploadedAt = new Date(uploadResult.file.createTime!);

          await supabase
            .from('process_chunks')
            .update({
              gemini_file_uri: uploadResult.file.uri,
              gemini_file_name: uploadResult.file.name,
              gemini_file_state: uploadResult.file.state,
              gemini_file_uploaded_at: uploadedAt.toISOString(),
              gemini_file_expires_at: expiresAt.toISOString(),
            })
            .eq('id', chunk_id);

          if (uploadResult.file.state === 'PROCESSING') {
            console.log('⏳ Chunk em processamento no Gemini, aguardando...');

            const fileMetadata = await waitForFileProcessing(fileManager, uploadResult.file.name, 10 * 60 * 1000);

            await supabase
              .from('process_chunks')
              .update({
                gemini_file_state: fileMetadata.state,
              })
              .eq('id', chunk_id);

            console.log(`✅ Chunk pronto: ${fileMetadata.state}`);
          }

          return new Response(
            JSON.stringify({
              success: true,
              file_uri: uploadResult.file.uri,
              file_name: uploadResult.file.name,
              state: uploadResult.file.state,
              chunk_index: chunk.chunk_index,
            }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        } catch (uploadError) {
          lastError = uploadError instanceof Error ? uploadError : new Error('Erro desconhecido');
          console.error(`❌ Tentativa ${attempt}/${MAX_RETRIES} falhou para chunk ${chunk.chunk_index}:`, {
            error: uploadError,
            message: lastError.message,
            chunk_index: chunk.chunk_index,
            file_size_mb: (uint8Array.length / 1024 / 1024).toFixed(2),
          });

          if (attempt < MAX_RETRIES) {
            const waitTime = attempt * 2000;
            console.log(`⏳ Aguardando ${waitTime}ms antes de tentar novamente...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }
      }

      throw new Error(`Falha no upload do chunk ${chunk.chunk_index} após ${MAX_RETRIES} tentativas: ${lastError?.message || 'Erro desconhecido'}`);
    } else {
      console.log(`📤 Iniciando processamento de arquivo - Processo: ${processo_id}`);

      const { data: processo, error: processoError } = await supabase
        .from('processos')
        .select('file_path, file_name, file_size')
        .eq('id', processo_id)
        .single();

      if (processoError || !processo) {
        throw new Error(`Processo não encontrado: ${processoError?.message}`);
      }

      console.log(`📥 Baixando arquivo do Storage: ${processo.file_path}`);

      const { data: fileData, error: downloadError } = await supabase.storage
        .from('processos')
        .download(processo.file_path);

      if (downloadError || !fileData) {
        throw new Error(`Erro ao baixar arquivo: ${downloadError?.message}`);
      }

      const fileSizeBytes = fileData.size;
      const fileSizeMB = (fileSizeBytes / 1024 / 1024).toFixed(2);
      console.log(`✅ Arquivo baixado: ${fileSizeMB}MB (${fileSizeBytes} bytes)`);

      const arrayBuffer = await fileData.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      if (fileSizeBytes <= FILE_SIZE_THRESHOLD_BYTES) {
        console.log(`📦 Arquivo <= 18MB (${fileSizeMB}MB) - Usando método BASE64 (mais rápido)`);
        console.log(`⏭️ Pulando upload para File API (desnecessário para arquivos pequenos)`);

        const chunkSize = 32768;
        let base64String = '';
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
          const chunk = uint8Array.slice(i, i + chunkSize);
          base64String += btoa(String.fromCharCode.apply(null, Array.from(chunk)));
        }
        const pdfBase64 = `data:application/pdf;base64,${base64String}`;

        await supabase
          .from('processos')
          .update({
            pdf_base64: pdfBase64,
            upload_method: 'base64',
            use_file_api: false,
          })
          .eq('id', processo_id);

        console.log(`✅ Base64 salvo com sucesso - upload_method: base64`);

        return new Response(
          JSON.stringify({
            success: true,
            method: 'base64',
            file_size_mb: fileSizeMB,
            message: 'Arquivo processado com base64 inline (otimizado para arquivos pequenos)',
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      console.log(`📂 Arquivo > 18MB (${fileSizeMB}MB) - Usando método FILE_URI (File API)`);
      console.log(`📤 Fazendo upload para Gemini File API (sem converter para base64)...`);

      const tempFilePath = `/tmp/${processo_id}_${processo.file_name}`;
      await Deno.writeFile(tempFilePath, uint8Array);

      const uploadResult = await fileManager.uploadFile(tempFilePath, {
        mimeType: 'application/pdf',
        displayName: processo.file_name,
      });

      try {
        await Deno.remove(tempFilePath);
      } catch (e) {
        console.log('⚠️ Erro ao remover arquivo temporário:', e);
      }

      console.log(`✅ Upload concluído: ${uploadResult.file.uri}`);

      const expiresAt = new Date(uploadResult.file.expirationTime!);
      const uploadedAt = new Date(uploadResult.file.createTime!);

      await supabase
        .from('processos')
        .update({
          gemini_file_uri: uploadResult.file.uri,
          gemini_file_name: uploadResult.file.name,
          gemini_file_mime_type: uploadResult.file.mimeType,
          gemini_file_state: uploadResult.file.state,
          gemini_file_uploaded_at: uploadedAt.toISOString(),
          gemini_file_expires_at: expiresAt.toISOString(),
          use_file_api: true,
          upload_method: 'file_uri',
        })
        .eq('id', processo_id);

      if (uploadResult.file.state === 'PROCESSING') {
        console.log('⏳ Arquivo em processamento no Gemini, aguardando...');

        const fileMetadata = await waitForFileProcessing(fileManager, uploadResult.file.name);

        await supabase
          .from('processos')
          .update({
            gemini_file_state: fileMetadata.state,
          })
          .eq('id', processo_id);

        console.log(`✅ Arquivo pronto: ${fileMetadata.state}`);
      }

      console.log(`✅ File API configurado - upload_method: file_uri`);

      return new Response(
        JSON.stringify({
          success: true,
          method: 'file_uri',
          file_uri: uploadResult.file.uri,
          file_name: uploadResult.file.name,
          state: uploadResult.file.state,
          file_size_mb: fileSizeMB,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  } catch (error) {
    console.error('Erro no upload para Gemini:', error);
    return new Response(
      JSON.stringify({
        error: 'Erro ao fazer upload',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});