import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { GoogleGenerativeAI } from 'npm:@google/generative-ai@0.24.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

async function getActiveModels(supabase: any) {
  const { data, error } = await supabase
    .from('admin_system_models')
    .select('*')
    .eq('is_active', true)
    .order('priority', { ascending: true });

  if (error || !data || data.length === 0) {
    throw new Error('Nenhum modelo ativo encontrado');
  }

  return data.map((model: any) => ({
    id: model.id,
    name: model.display_name || model.name,
    modelId: model.system_model || model.model_id,
    llmProvider: model.llm_provider,
    temperature: model.temperature ?? 0.2,
    maxTokens: model.max_tokens ?? 60000,
    priority: model.priority,
  }));
}

function isRetryableError(error: any): boolean {
  const errorStr = error?.message?.toLowerCase() || '';
  const statusCode = error?.status;

  return (
    statusCode === 503 ||
    statusCode === 429 ||
    statusCode === 500 ||
    errorStr.includes('overloaded') ||
    errorStr.includes('rate limit') ||
    errorStr.includes('timeout') ||
    errorStr.includes('temporarily unavailable') ||
    errorStr.includes('service unavailable') ||
    errorStr.includes('resource_exhausted') ||
    errorStr.includes('invalid argument') ||
    errorStr.includes('invalid_argument') ||
    errorStr.includes('too large') ||
    errorStr.includes('context length') ||
    errorStr.includes('token limit')
  );
}

async function notifyModelSwitch(
  supabase: any,
  processoId: string,
  fromModel: string,
  toModel: string,
  reason: string
) {
  try {
    const { data: processo } = await supabase
      .from('processos')
      .select('user_id')
      .eq('id', processoId)
      .single();

    if (processo?.user_id) {
      await supabase
        .from('notifications')
        .insert({
          user_id: processo.user_id,
          message: `Modelo alterado de "${fromModel}" para "${toModel}" devido a: ${reason}`,
          read: false,
        });
    }
  } catch (err) {
    console.error('Erro ao criar notificação de troca de modelo:', err);
  }
}

async function generateContextSummary(
  geminiModel: any,
  chunkResult: string,
  chunkIndex: number
): Promise<string> {
  const summaryPrompt = `Você é um assistente especializado em criar resumos executivos.

Analise o texto abaixo e crie um resumo executivo conciso (máximo 1500 tokens) que contenha:

1. Principais pontos identificados
2. Entidades mencionadas (nomes, datas, valores importantes)
3. Tópicos principais
4. Contexto relevante para análise das próximas seções

Este resumo será usado como contexto para análise das próximas partes do documento.

TEXTO DO CHUNK ${chunkIndex + 1}:
${chunkResult}

Responda apenas com o resumo executivo em formato de texto estruturado.`;

  const summaryResult = await geminiModel.generateContent({
    contents: [{ role: 'user', parts: [{ text: summaryPrompt }] }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 60000,
    },
  });

  const response = await summaryResult.response;
  return response.text().trim();
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const workerId = crypto.randomUUID().slice(0, 8);
  let queueItemId: string | null = null;
  let processoId: string | null = null;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`\n[${workerId}] 🔄 Worker iniciado`);

    const { data: queueItem, error: queueError } = await supabase
      .rpc('acquire_next_queue_item', {
        p_worker_id: workerId,
        p_lock_duration_minutes: 15
      })
      .maybeSingle();

    if (queueError) {
      console.error(`[${workerId}] ❌ Erro ao buscar item da fila:`, queueError);
      throw queueError;
    }

    if (!queueItem) {
      console.log(`[${workerId}] ⏸️ Nenhum item na fila`);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Nenhum item disponível na fila',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    queueItemId = queueItem.queue_item_id;
    processoId = queueItem.processo_id;

    console.log(`[${workerId}] ✅ Item adquirido da fila: ${queueItemId}`);
    console.log(`[${workerId}] 📦 Processo: ${processoId}, Chunk: ${queueItem.chunk_id}`);
    console.log(`[${workerId}] 🔢 Tentativa: ${queueItem.attempt_number}`);

    await supabase.rpc('register_worker', {
      p_processo_id: processoId,
      p_worker_id: workerId
    });

    await supabase
      .from('complex_processing_status')
      .update({
        current_phase: 'processing',
        chunks_processing: 1,
        last_heartbeat: new Date().toISOString(),
      })
      .eq('processo_id', processoId);

    const heartbeatInterval = setInterval(async () => {
      await supabase.rpc('update_queue_heartbeat', {
        p_queue_item_id: queueItemId,
        p_worker_id: workerId
      });
      console.log(`[${workerId}] 💓 Heartbeat enviado`);
    }, 30000);

    try {
      const startTime = Date.now();

      const { data: chunk, error: chunkError } = await supabase
        .from('process_chunks')
        .select('*')
        .eq('id', queueItem.chunk_id)
        .single();

      if (chunkError || !chunk) {
        throw new Error('Chunk não encontrado');
      }

      console.log(`[${workerId}] 📄 Processando chunk ${chunk.chunk_index + 1}/${chunk.total_chunks}`);

      let retries = 0;
      const maxRetries = 120;

      while ((!chunk.gemini_file_uri || chunk.gemini_file_state !== 'ACTIVE') && retries < maxRetries) {
        if (retries === 0) {
          console.log(`[${workerId}] ⏳ Chunk ainda não está ATIVO no Gemini, aguardando...`);
        }

        await new Promise(resolve => setTimeout(resolve, 5000));

        const { data: freshChunk } = await supabase
          .from('process_chunks')
          .select('gemini_file_uri, gemini_file_state')
          .eq('id', chunk.id)
          .single();

        if (freshChunk) {
          chunk.gemini_file_uri = freshChunk.gemini_file_uri;
          chunk.gemini_file_state = freshChunk.gemini_file_state;
        }

        retries++;

        if (retries % 12 === 0) {
          console.log(`[${workerId}] ⏳ Ainda aguardando upload do chunk (${retries * 5}s)...`);
        }
      }

      if (!chunk.gemini_file_uri || chunk.gemini_file_state !== 'ACTIVE') {
        console.error(`[${workerId}] ❌ Chunk não ficou ATIVO após ${maxRetries * 5}s. Estado: ${chunk.gemini_file_state}`);

        console.log(`[${workerId}] 🔄 Tentando reenviar chunk para Gemini...`);

        try {
          await fetch(`${supabaseUrl}/functions/v1/upload-to-gemini`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              processo_id: processoId,
              chunk_id: chunk.id,
            }),
          });

          throw new Error(`Chunk não estava ATIVO, reenvio disparado. Worker deve retentar.`);
        } catch (retryErr) {
          throw new Error(`Chunk não foi enviado para Gemini após ${maxRetries * 5} segundos. Estado: ${chunk.gemini_file_state}`);
        }
      }

      console.log(`[${workerId}] ✅ Chunk está ATIVO no Gemini: ${chunk.gemini_file_uri}`);


      let contextFromPrevious: any = null;
      if (queueItem.context_data?.has_previous_context) {
        const { data: prevContext } = await supabase
          .rpc('get_chunk_context', {
            p_processo_id: processoId,
            p_current_chunk_index: chunk.chunk_index + 1
          })
          .maybeSingle();

        contextFromPrevious = prevContext?.context_summary;
        console.log(`[${workerId}] 📚 Contexto do chunk anterior carregado`);
      }

      const models = await getActiveModels(supabase);
      let text = '';
      let tokensUsed = 0;
      let executionTime = 0;
      let usedModel = null;
      let modelErrors: string[] = [];

      for (let modelIndex = 0; modelIndex < models.length; modelIndex++) {
        const model = models[modelIndex];

        try {
          console.log(`[${workerId}] 🤖 Tentando modelo [${modelIndex + 1}/${models.length}]: ${model.name}`);

          await supabase
            .from('complex_processing_status')
            .update({
              metadata: {
                current_model: model.name,
                current_model_priority: model.priority,
                model_attempts: modelIndex + 1,
                searching_new_model: false,
              },
            })
            .eq('processo_id', processoId);

          const genAI = new GoogleGenerativeAI(geminiApiKey);
          const geminiModel = genAI.getGenerativeModel({ model: model.modelId });

          const parts: any[] = [
            {
              fileData: {
                mimeType: 'application/pdf',
                fileUri: chunk.gemini_file_uri,
              },
            },
          ];

          let finalPrompt = queueItem.prompt_content;

          if (contextFromPrevious) {
            finalPrompt = `CONTEXTO DAS SEÇÕES ANTERIORES DO DOCUMENTO:
${JSON.stringify(contextFromPrevious, null, 2)}

---

${queueItem.prompt_content}

IMPORTANTE: Este é o chunk ${chunk.chunk_index + 1} de ${chunk.total_chunks}. Considere o contexto anterior ao analisar este trecho.`;
          } else {
            finalPrompt = `${queueItem.prompt_content}

IMPORTANTE: Este é o chunk ${chunk.chunk_index + 1} de ${chunk.total_chunks} do documento.`;
          }

          parts.push({ text: finalPrompt });

          console.log(`[${workerId}] 🔄 Enviando para LLM...`);
          const startTime = Date.now();

          const result = await geminiModel.generateContent({
            contents: [{ role: 'user', parts }],
            generationConfig: {
              temperature: model.temperature,
              maxOutputTokens: model.maxTokens,
            },
          });

          const response = await result.response;
          text = response.text().trim();
          executionTime = Date.now() - startTime;
          usedModel = model;

          if (response.usageMetadata) {
            tokensUsed = response.usageMetadata.totalTokenCount || 0;
          }

          console.log(`[${workerId}] ✅ Sucesso com modelo: ${model.name}`);

          if (modelIndex > 0) {
            const previousModel = models[modelIndex - 1];
            await notifyModelSwitch(
              supabase,
              processoId,
              previousModel.name,
              model.name,
              'Modelo anterior indisponível'
            );
          }

          break;

        } catch (modelError: any) {
          const errorMsg = modelError?.message || 'Erro desconhecido';
          modelErrors.push(`${model.name}: ${errorMsg}`);

          console.error(`[${workerId}] ❌ Erro no modelo ${model.name}:`, errorMsg);

          if (modelIndex < models.length - 1) {
            console.log(`[${workerId}] 🔍 Buscando um novo modelo de processamento...`);

            await supabase
              .from('complex_processing_status')
              .update({
                status: 'processing',
                metadata: {
                  searching_new_model: true,
                  failed_model: model.name,
                  error_reason: errorMsg.substring(0, 200),
                  next_model_index: modelIndex + 1,
                },
              })
              .eq('processo_id', processoId);
          }

          if (isRetryableError(modelError)) {
            console.log(`[${workerId}] 🔄 Erro recuperável detectado, tentando próximo modelo...`);

            if (modelIndex === models.length - 1) {
              throw new Error(
                `Todos os modelos falharam. Erros: ${modelErrors.join('; ')}`
              );
            }
            continue;
          } else {
            console.error(`[${workerId}] ⚠️ Erro não recuperável, mas tentando próximo modelo...`);
            if (modelIndex === models.length - 1) {
              throw new Error(
                `Todos os modelos falharam. Último erro: ${errorMsg}. Todos os erros: ${modelErrors.join('; ')}`
              );
            }
            continue;
          }
        }
      }

      if (!text || !usedModel) {
        throw new Error(`Nenhum modelo conseguiu processar o chunk. Erros: ${modelErrors.join('; ')}`);
      }

      if (text.startsWith('```json')) {
        text = text.replace(/^```json\n?/, '');
      }
      if (text.startsWith('```')) {
        text = text.replace(/^```\n?/, '');
      }
      if (text.endsWith('```')) {
        text = text.replace(/\n?```$/, '');
      }
      text = text.trim();

      console.log(`[${workerId}] ✅ Resposta recebida: ${tokensUsed} tokens em ${Math.round(executionTime / 1000)}s`);
      console.log(`[${workerId}] ✅ Modelo usado: ${usedModel.name} (Prioridade: ${usedModel.priority})`);

      console.log(`[${workerId}] 📝 Gerando resumo contextual...`);
      const genAI = new GoogleGenerativeAI(geminiApiKey);
      const geminiModel = genAI.getGenerativeModel({ model: usedModel.modelId });
      const contextSummary = await generateContextSummary(geminiModel, text, chunk.chunk_index);
      console.log(`[${workerId}] ✅ Resumo contextual gerado`);

      await supabase
        .from('process_chunks')
        .update({
          status: 'completed',
          processing_result: { result: text, prompt_id: queueItem.prompt_id },
          context_summary: { summary: contextSummary, chunk_index: chunk.chunk_index },
          processing_time_seconds: Math.round(executionTime / 1000),
          tokens_used: tokensUsed,
        })
        .eq('id', chunk.id);

      await supabase.rpc('complete_queue_item', {
        p_queue_item_id: queueItemId,
        p_worker_id: workerId,
        p_result_data: { result: text, context_summary: contextSummary },
        p_tokens_used: tokensUsed
      });

      console.log(`[${workerId}] 💾 Resultados salvos no banco`);

      const { data: analysisResult } = await supabase
        .from('analysis_results')
        .select('id, status')
        .eq('processo_id', processoId)
        .eq('prompt_id', queueItem.prompt_id)
        .maybeSingle();

      if (analysisResult && analysisResult.status === 'pending') {
        await supabase
          .from('analysis_results')
          .update({
            status: 'running',
            processing_at: new Date().toISOString()
          })
          .eq('id', analysisResult.id);

        console.log(`[${workerId}] 🔄 Analysis result marcado como 'running'`);
      }

      await supabase.rpc('update_complex_processing_progress', {
        p_processo_id: processoId
      });

      const { data: queueStatsForPrompt } = await supabase
        .from('processing_queue')
        .select('status')
        .eq('processo_id', processoId)
        .eq('prompt_id', queueItem.prompt_id);

      if (queueStatsForPrompt) {
        const allCompleted = queueStatsForPrompt.every(q => q.status === 'completed');
        const hasRunning = queueStatsForPrompt.some(q => q.status === 'processing');

        if (allCompleted && !hasRunning) {
          console.log(`[${workerId}] ✅ Todos os chunks do prompt '${queueItem.prompt_title}' completos!`);
          console.log(`[${workerId}] 🔄 Disparando consolidação para este prompt...`);

          fetch(`${supabaseUrl}/functions/v1/consolidation-worker`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              processo_id: processoId,
              prompt_id: queueItem.prompt_id
            }),
          }).catch(err => {
            console.error(`[${workerId}] ❌ Erro ao disparar consolidação do prompt:`, err);
          });
        }
      }

      clearInterval(heartbeatInterval);

      await supabase.rpc('update_chunk_metrics', {
        p_processo_id: processoId,
        p_processing_seconds: Math.round(executionTime / 1000)
      });

      const { data: canSpawn } = await supabase
        .rpc('can_spawn_worker', { p_processo_id: processoId })
        .single();

      if (canSpawn) {
        console.log(`[${workerId}] 🔄 Disparando novo worker paralelo...`);

        fetch(`${supabaseUrl}/functions/v1/process-complex-worker`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ processo_id: processoId }),
        }).catch(err => {
          console.error(`[${workerId}] ❌ Erro ao disparar próximo worker:`, err);
        });
      } else {
        console.log(`[${workerId}] ✅ Todos os chunks processados!`);

        const { data: stats } = await supabase
          .rpc('get_queue_stats', { p_processo_id: processoId })
          .single();

        if (stats && stats.pending_items === 0 && stats.processing_items === 0) {
          console.log(`[${workerId}] 🎉 Processamento completo!`);

          const { data: pendingResults } = await supabase
            .from('analysis_results')
            .select('id')
            .eq('processo_id', processoId)
            .in('status', ['pending', 'running'])
            .limit(1)
            .maybeSingle();

          if (pendingResults) {
            console.log(`[${workerId}] 🔄 Ainda há prompts para consolidar, disparando consolidation-worker...`);

            fetch(`${supabaseUrl}/functions/v1/consolidation-worker`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({ processo_id: processoId }),
            }).catch(err => {
              console.error(`[${workerId}] ❌ Erro ao disparar consolidação final:`, err);
            });
          }
        }
      }

      if (processoId) {
        await supabase.rpc('unregister_worker', {
          p_processo_id: processoId,
          p_worker_id: workerId
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Chunk processado com sucesso',
          tokens_used: tokensUsed,
          execution_time_ms: executionTime,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );

    } catch (processingError: any) {
      clearInterval(heartbeatInterval);
      console.error(`[${workerId}] ❌ Erro no processamento:`, processingError);

      if (queueItemId) {
        await supabase.rpc('fail_queue_item', {
          p_queue_item_id: queueItemId,
          p_worker_id: workerId,
          p_error_message: processingError.message
        });
      }

      if (processoId) {
        await supabase.rpc('unregister_worker', {
          p_processo_id: processoId,
          p_worker_id: workerId
        });
      }

      throw processingError;
    }

  } catch (error: any) {
    console.error(`[${workerId}] ❌ Erro crítico:`, error);

    if (processoId) {
      try {
        await supabase.rpc('unregister_worker', {
          p_processo_id: processoId,
          p_worker_id: workerId
        });
      } catch (unregErr) {
        console.error(`[${workerId}] ❌ Erro ao desregistrar worker:`, unregErr);
      }
    }

    return new Response(
      JSON.stringify({
        error: error?.message || 'Erro no worker',
        worker_id: workerId,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});