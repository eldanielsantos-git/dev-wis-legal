import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { GoogleAIFileManager } from 'npm:@google/generative-ai@0.24.1/server';

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
    console.log(`[${callId}] 🚀 Iniciando análise complexa para processo: ${processo_id}`);

    const { data: processo, error: processoError } = await supabase
      .from('processos')
      .select('*')
      .eq('id', processo_id)
      .single();

    if (processoError || !processo) {
      throw new Error('Processo não encontrado');
    }

    if (!processo.is_chunked || !processo.total_chunks_count) {
      throw new Error('Processo não está configurado para processamento complexo');
    }

    console.log(`[${callId}] 📦 Processo com ${processo.total_chunks_count} chunks detectado`);

    const { data: updatedProcesso, error: updateError } = await supabase
      .from('processos')
      .update({
        status: 'queued',
        analysis_started_at: new Date().toISOString(),
      })
      .eq('id', processo_id)
      .eq('status', 'created')
      .select()
      .maybeSingle();

    if (updateError) {
      console.error(`[${callId}] ❌ Erro ao atualizar status:`, updateError);
      throw new Error(`Erro ao iniciar análise: ${updateError.message}`);
    }

    if (!updatedProcesso) {
      console.log(`[${callId}] ⏸️ Processo já está sendo processado`);
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Processo já está em análise',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`[${callId}] ✅ Status atualizado para 'queued'`);

    const { data: complexStatus, error: statusError } = await supabase
      .from('complex_processing_status')
      .insert({
        processo_id,
        total_chunks: processo.total_chunks_count,
        current_phase: 'initializing',
        chunks_uploaded: processo.total_chunks_count,
        upload_progress_percent: 100,
      })
      .select()
      .single();

    if (statusError) {
      console.error(`[${callId}] ⚠️ Erro ao criar status complexo:`, statusError);
    } else {
      console.log(`[${callId}] ✅ Status de processamento complexo criado`);
    }

    const { data: prompts, error: promptsError } = await supabase
      .from('analysis_prompts')
      .select('id, title, prompt_content, system_prompt, execution_order')
      .eq('is_active', true)
      .order('execution_order', { ascending: true });

    if (promptsError || !prompts || prompts.length === 0) {
      throw new Error('Nenhum prompt ativo encontrado');
    }

    console.log(`[${callId}] Encontrados ${prompts.length} prompts ativos`);

    await supabase
      .from('processos')
      .update({
        current_prompt_number: 0,
        total_prompts: prompts.length,
      })
      .eq('id', processo_id);

    for (const prompt of prompts) {
      await supabase
        .from('analysis_results')
        .insert({
          processo_id,
          prompt_id: prompt.id,
          prompt_title: prompt.title,
          prompt_content: prompt.prompt_content,
          system_prompt: prompt.system_prompt,
          execution_order: prompt.execution_order,
          status: 'pending',
        });
    }

    console.log(`[${callId}] Análise complexa iniciada com sucesso`);
    console.log(`[${callId}] 🚀 Populando fila de processamento...`);

    const { data: existingQueueItems, error: existingQueueError } = await supabase
      .from('processing_queue')
      .select('id')
      .eq('processo_id', processo_id)
      .limit(1);

    if (existingQueueError) {
      console.error(`[${callId}] ⚠️ Erro ao verificar fila existente:`, existingQueueError);
    }

    if (existingQueueItems && existingQueueItems.length > 0) {
      console.log(`[${callId}] ⏸️ Fila já foi populada anteriormente, pulando criação`);

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
          message: 'Processamento retomado',
          total_prompts: prompts.length,
          total_chunks: processo.total_chunks_count,
          status: 'queued',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: chunks, error: chunksError } = await supabase
      .from('process_chunks')
      .select('*')
      .eq('processo_id', processo_id)
      .order('chunk_index', { ascending: true });

    if (chunksError || !chunks || chunks.length === 0) {
      throw new Error('Nenhum chunk encontrado para o processo');
    }

    console.log(`[${callId}] 📦 Encontrados ${chunks.length} chunks para processar`);

    if (chunks.length !== processo.total_chunks_count) {
      console.warn(`[${callId}] ⚠️ Número de chunks (${chunks.length}) não corresponde ao esperado (${processo.total_chunks_count})`);
    }

    console.log(`[${callId}] 🚀 Iniciando upload de ${chunks.length} chunks para o Gemini...`);

    let uploadedCount = 0;
    let skippedCount = 0;
    const uploadErrors: string[] = [];

    for (const chunk of chunks) {
      try {
        if (chunk.gemini_file_uri && chunk.gemini_file_state === 'ACTIVE') {
          console.log(`[${callId}] ⏭️ Chunk ${chunk.chunk_index} já possui URI do Gemini: ${chunk.gemini_file_uri}`);
          skippedCount++;
          continue;
        }

        console.log(`[${callId}] 📤 Fazendo upload do chunk ${chunk.chunk_index}/${chunk.total_chunks}...`);

        const { data: fileData, error: downloadError } = await supabase.storage
          .from('processos')
          .download(chunk.file_path);

        if (downloadError || !fileData) {
          throw new Error(`Erro ao baixar chunk ${chunk.chunk_index}: ${downloadError?.message || 'Arquivo não encontrado'}. Path: ${chunk.file_path}`);
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
              console.log(`[${callId}] ⚠️ Erro ao remover arquivo temporário:`, e);
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
              console.log(`[${callId}] ⏳ Chunk ${chunk.chunk_index} em processamento no Gemini, aguardando...`);

              const fileMetadata = await waitForFileProcessing(fileManager, uploadResult.file.name, 10 * 60 * 1000);

              await supabase
                .from('process_chunks')
                .update({
                  gemini_file_state: fileMetadata.state,
                })
                .eq('id', chunk.id);

              console.log(`[${callId}] ✅ Chunk ${chunk.chunk_index} pronto: ${fileMetadata.state}`);
            }

            uploadSuccess = true;
            uploadedCount++;
            break;
          } catch (uploadError) {
            lastError = uploadError instanceof Error ? uploadError : new Error('Erro desconhecido');
            console.error(`[${callId}] ❌ Tentativa ${attempt}/${MAX_RETRIES} falhou para chunk ${chunk.chunk_index}:`, lastError.message);

            if (attempt < MAX_RETRIES) {
              const waitTime = attempt * 2000;
              console.log(`[${callId}] ⏳ Aguardando ${waitTime}ms antes de tentar novamente...`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
            }
          }
        }

        if (!uploadSuccess) {
          const errorMsg = `Falha ao enviar chunk ${chunk.chunk_index} após ${MAX_RETRIES} tentativas: ${lastError?.message || 'Erro desconhecido'}`;
          uploadErrors.push(errorMsg);
          console.error(`[${callId}] ❌ ${errorMsg}`);
        }
      } catch (error: any) {
        const errorMsg = `Erro ao processar chunk ${chunk.chunk_index}: ${error.message}`;
        uploadErrors.push(errorMsg);
        console.error(`[${callId}] ❌ ${errorMsg}`);
      }
    }

    console.log(`[${callId}] 📊 Resumo do upload:`);
    console.log(`[${callId}]   ✅ Enviados: ${uploadedCount}`);
    console.log(`[${callId}]   ⏭️ Já existentes: ${skippedCount}`);
    console.log(`[${callId}]   ❌ Falhas: ${uploadErrors.length}`);

    if (uploadErrors.length > 0) {
      console.error(`[${callId}] ❌ Erros encontrados:`, uploadErrors);

      await supabase
        .from('complex_processing_status')
        .update({
          current_phase: 'upload_failed',
          error_message: `${uploadErrors.length} chunks com falha no upload: ${uploadErrors.slice(0, 3).join('; ')}${uploadErrors.length > 3 ? '...' : ''}`,
          updated_at: new Date().toISOString(),
        })
        .eq('processo_id', processo_id);

      throw new Error(`Falha ao enviar ${uploadErrors.length} chunks para o Gemini. Primeira falha: ${uploadErrors[0]}`);
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

    console.log(`[${callId}] ✅ Todos os chunks foram enviados ao Gemini com sucesso!`);

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

    console.log(`[${callId}] 📝 Criando ${queueItems.length} itens na fila (${chunks.length} chunks × ${prompts.length} prompts)`);

    const { error: queueError } = await supabase
      .from('processing_queue')
      .insert(queueItems);

    if (queueError) {
      console.error(`[${callId}] ❌ Erro ao popular fila:`, queueError);
      throw new Error(`Erro ao popular fila: ${queueError.message}`);
    }

    console.log(`[${callId}] ✅ Fila populada com sucesso`);
    console.log(`[${callId}] 🚀 Disparando primeiro worker...`);

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

    console.log(`[${callId}] ✅ Worker disparado`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Análise complexa iniciada com sucesso',
        total_prompts: prompts.length,
        total_chunks: processo.total_chunks_count,
        status: 'queued',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Erro ao iniciar análise complexa:', error);

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

        const { data: errorRecord, error: errorInsertError } = await supabase
          .from('complex_analysis_errors')
          .insert({
            processo_id,
            user_id: processo?.user_id,
            error_type: 'ProcessError',
            error_category: 'initialization',
            error_message: error?.message || 'Erro desconhecido no processamento',
            severity: 'high',
            current_phase: 'start_analysis_complex',
            occurred_at: new Date().toISOString(),
            total_chunks: processo?.total_chunks_count || 0,
          })
          .select()
          .single();

        if (!errorInsertError && errorRecord) {
          await fetch(`${supabaseUrl}/functions/v1/send-admin-complex-analysis-error`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              error_id: errorRecord.id,
            }),
          });
        }
      } catch (notifyError) {
        console.error('Erro ao enviar notificação de erro:', notifyError);
      }
    }

    return new Response(
      JSON.stringify({
        error: error?.message || 'Erro ao iniciar análise complexa',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});