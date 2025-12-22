import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { GoogleAIFileManager } from 'npm:@google/generative-ai@0.24.1/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

async function waitForFileProcessing(
  fileManager: any,
  fileName: string,
  timeoutMs: number = 10 * 60 * 1000
): Promise<any> {
  const startTime = Date.now();
  const pollingInterval = 2000;

  while (Date.now() - startTime < timeoutMs) {
    const file = await fileManager.getFile(fileName);

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

  let processo_id: string | null = null;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY não configurada');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const fileManager = new GoogleAIFileManager(geminiApiKey);

    const requestData = await req.json();
    processo_id = requestData.processo_id;

    if (!processo_id) {
      return new Response(
        JSON.stringify({ error: 'processo_id é obrigatório' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const callId = crypto.randomUUID().slice(0, 8);
    console.log(`[${callId}] 📤 Iniciando worker de upload de chunks para: ${processo_id}`);

    const { data: chunks, error: chunksError } = await supabase
      .from('process_chunks')
      .select('*')
      .eq('processo_id', processo_id)
      .order('chunk_index', { ascending: true });

    if (chunksError || !chunks || chunks.length === 0) {
      throw new Error('Nenhum chunk encontrado para o processo');
    }

    console.log(`[${callId}] 📦 Encontrados ${chunks.length} chunks`);

    let uploadedCount = 0;
    let skippedCount = 0;
    const uploadErrors: string[] = [];

    for (const chunk of chunks) {
      try {
        if (chunk.gemini_file_uri && chunk.gemini_file_state === 'ACTIVE') {
          console.log(`[${callId}] ⏭️ Chunk ${chunk.chunk_index} já enviado: ${chunk.gemini_file_uri}`);
          skippedCount++;
          continue;
        }

        console.log(`[${callId}] 📤 Upload chunk ${chunk.chunk_index}/${chunk.total_chunks}...`);

        const { data: fileData, error: downloadError } = await supabase.storage
          .from('processos')
          .download(chunk.file_path);

        if (downloadError || !fileData) {
          throw new Error(`Erro ao baixar chunk ${chunk.chunk_index}: ${downloadError?.message || 'Arquivo não encontrado'}`);
        }

        const arrayBuffer = await fileData.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const chunkFileName = `chunk_${chunk.chunk_index}_of_${chunk.total_chunks}.pdf`;

        const MAX_RETRIES = 3;
        let lastError: Error | null = null;
        let uploadSuccess = false;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          try {
            const tempFilePath = `/tmp/${chunk.id}_${chunkFileName}`;
            await Deno.writeFile(tempFilePath, uint8Array);

            const uploadResult = await fileManager.uploadFile(tempFilePath, {
              mimeType: 'application/pdf',
              displayName: chunkFileName,
            });

            try {
              await Deno.remove(tempFilePath);
            } catch (e) {
              console.log(`[${callId}] ⚠️ Erro ao remover temp file:`, e);
            }

            console.log(`[${callId}] ✅ Chunk ${chunk.chunk_index} enviado: ${uploadResult.file.uri}`);

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
              .eq('id', chunk.id);

            if (uploadResult.file.state === 'PROCESSING') {
              console.log(`[${callId}] ⏳ Chunk ${chunk.chunk_index} processando, aguardando...`);

              const fileMetadata = await waitForFileProcessing(fileManager, uploadResult.file.name, 10 * 60 * 1000);

              await supabase
                .from('process_chunks')
                .update({
                  gemini_file_state: fileMetadata.state,
                })
                .eq('id', chunk.id);

              console.log(`[${callId}] ✅ Chunk ${chunk.chunk_index} ativo: ${fileMetadata.state}`);
            }

            uploadSuccess = true;
            uploadedCount++;
            break;
          } catch (uploadError) {
            lastError = uploadError instanceof Error ? uploadError : new Error('Erro desconhecido');
            console.error(`[${callId}] ❌ Tentativa ${attempt}/${MAX_RETRIES} falhou:`, lastError.message);

            if (attempt < MAX_RETRIES) {
              const waitTime = attempt * 2000;
              console.log(`[${callId}] ⏳ Aguardando ${waitTime}ms...`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
            }
          }
        }

        if (!uploadSuccess) {
          const errorMsg = `Chunk ${chunk.chunk_index} falhou após ${MAX_RETRIES} tentativas: ${lastError?.message}`;
          uploadErrors.push(errorMsg);
          console.error(`[${callId}] ❌ ${errorMsg}`);
        }
      } catch (error: any) {
        const errorMsg = `Erro chunk ${chunk.chunk_index}: ${error.message}`;
        uploadErrors.push(errorMsg);
        console.error(`[${callId}] ❌ ${errorMsg}`);
      }
    }

    console.log(`[${callId}] 📊 Resumo: ${uploadedCount} enviados, ${skippedCount} pulados, ${uploadErrors.length} erros`);

    if (uploadErrors.length > 0) {
      await supabase
        .from('complex_processing_status')
        .update({
          current_phase: 'upload_failed',
          error_message: `${uploadErrors.length} chunks falharam: ${uploadErrors.slice(0, 3).join('; ')}`,
          updated_at: new Date().toISOString(),
        })
        .eq('processo_id', processo_id);

      throw new Error(`Falha no upload de ${uploadErrors.length} chunks`);
    }

    await supabase
      .from('complex_processing_status')
      .update({
        current_phase: 'chunks_uploaded',
        chunks_uploaded: uploadedCount + skippedCount,
        upload_progress_percent: 100,
        updated_at: new Date().toISOString(),
      })
      .eq('processo_id', processo_id);

    console.log(`[${callId}] ✅ Upload concluído, criando fila de processamento...`);

    const { data: prompts, error: promptsError } = await supabase
      .from('analysis_prompts')
      .select('id, title, prompt_content, system_prompt, execution_order')
      .eq('is_active', true)
      .order('execution_order', { ascending: true });

    if (promptsError || !prompts || prompts.length === 0) {
      throw new Error('Nenhum prompt ativo encontrado');
    }

    const { data: existingQueue } = await supabase
      .from('processing_queue')
      .select('id')
      .eq('processo_id', processo_id)
      .limit(1);

    if (!existingQueue || existingQueue.length === 0) {
      console.log(`[${callId}] 📝 Criando fila (${chunks.length} chunks × ${prompts.length} prompts)...`);

      const queueItems = [];
      for (const chunk of chunks) {
        for (const prompt of prompts) {
          queueItems.push({
            processo_id,
            chunk_id: chunk.id,
            prompt_id: prompt.id,
            queue_type: 'chunk_processing',
            priority: prompt.execution_order,
            status: 'pending',
            prompt_content: prompt.prompt_content,
            context_data: {
              chunk_index: chunk.chunk_index,
              total_chunks: chunk.total_chunks,
              start_page: chunk.start_page,
              end_page: chunk.end_page,
              pages_count: chunk.pages_count,
              has_previous_context: chunk.chunk_index > 1,
              prompt_title: prompt.title,
              execution_order: prompt.execution_order,
            },
            max_attempts: 3,
          });
        }
      }

      const { error: queueError } = await supabase
        .from('processing_queue')
        .insert(queueItems);

      if (queueError) {
        console.error(`[${callId}] ❌ Erro ao criar fila:`, queueError);
        throw new Error(`Erro ao criar fila: ${queueError.message}`);
      }

      console.log(`[${callId}] ✅ Fila criada com ${queueItems.length} itens`);
    } else {
      console.log(`[${callId}] ⏭️ Fila já existe, pulando criação`);
    }

    console.log(`[${callId}] 🚀 Disparando processing worker...`);

    fetch(`${supabaseUrl}/functions/v1/process-complex-worker`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ processo_id }),
    }).catch(err => {
      console.error(`[${callId}] ⚠️ Erro ao disparar worker:`, err);
    });

    return new Response(
      JSON.stringify({
        success: true,
        uploaded: uploadedCount,
        skipped: skippedCount,
        errors: uploadErrors.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('❌ Erro no worker de upload:', error);

    if (processo_id) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const { data: processo } = await supabase
          .from('processos')
          .select('user_id, total_chunks_count')
          .eq('id', processo_id)
          .maybeSingle();

        await supabase
          .from('processos')
          .update({ status: 'error', last_error_type: error?.message })
          .eq('id', processo_id);

        const { data: errorRecord } = await supabase
          .from('complex_analysis_errors')
          .insert({
            processo_id,
            user_id: processo?.user_id,
            error_type: 'UploadError',
            error_category: 'chunk_upload',
            error_message: error?.message || 'Erro no upload de chunks',
            severity: 'high',
            current_phase: 'upload_chunks',
            occurred_at: new Date().toISOString(),
            total_chunks: processo?.total_chunks_count || 0,
          })
          .select()
          .single();

        if (errorRecord) {
          await fetch(`${supabaseUrl}/functions/v1/send-admin-complex-analysis-error`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ error_id: errorRecord.id }),
          });
        }
      } catch (notifyError) {
        console.error('Erro ao notificar:', notifyError);
      }
    }

    return new Response(
      JSON.stringify({ error: error?.message || 'Erro no upload' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
