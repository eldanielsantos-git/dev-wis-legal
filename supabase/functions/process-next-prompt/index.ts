import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { GoogleGenerativeAI } from 'npm:@google/generative-ai@0.24.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface LLMModel {
  id: string;
  name: string;
  display_name: string | null;
  system_model: string | null;
  model_id: string;
  priority: number;
  is_active: boolean;
  temperature: number | null;
  max_tokens: number | null;
  llm_provider: string | null;
}

async function getActiveModelsOrderedByPriority(supabase: any): Promise<LLMModel[]> {
  const { data, error } = await supabase
    .from('admin_system_models')
    .select('*')
    .eq('is_active', true)
    .order('priority', { ascending: true });

  if (error) {
    console.error('Error fetching models:', error);
    throw new Error('Failed to fetch LLM models');
  }

  return data || [];
}

async function updateProcessoModelInfo(
  supabase: any,
  processoId: string,
  modelId: string | null,
  modelName: string | null,
  isSwitching: boolean,
  switchReason: string | null = null
) {
  await supabase
    .from('processos')
    .update({
      current_llm_model_id: modelId,
      current_llm_model_name: modelName,
      llm_model_switching: isSwitching,
      llm_switch_reason: switchReason,
    })
    .eq('id', processoId);
}

async function addModelAttempt(
  supabase: any,
  processoId: string,
  modelId: string,
  modelName: string,
  result: 'success' | 'failed'
) {
  const { data: processo } = await supabase
    .from('processos')
    .select('llm_models_attempted')
    .eq('id', processoId)
    .single();

  const attempts = processo?.llm_models_attempted || [];
  attempts.push({
    model_id: modelId,
    model_name: modelName,
    result,
    timestamp: new Date().toISOString(),
  });

  await supabase
    .from('processos')
    .update({ llm_models_attempted: attempts })
    .eq('id', processoId);
}

async function recordExecution(
  supabase: any,
  processoId: string,
  analysisResultId: string,
  model: LLMModel,
  attemptNumber: number,
  status: string,
  errorMessage: string | null = null,
  errorCode: string | null = null,
  executionTimeMs: number | null = null
) {
  await supabase
    .from('analysis_executions')
    .insert({
      processo_id: processoId,
      analysis_result_id: analysisResultId,
      model_id: model.id,
      model_name: model.name,
      attempt_number: attemptNumber,
      status,
      error_message: errorMessage,
      error_code: errorCode,
      execution_time_ms: executionTimeMs,
    });
}

async function notifyModelSwitch(
  supabase: any,
  processoId: string,
  fromModel: string,
  toModel: string,
  reason: string
) {
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
        type: 'model_switch',
        message: `Troca de modelo: ${fromModel} → ${toModel}. Motivo: ${reason}`,
        related_processo_id: processoId,
      });
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');
    const isServiceKeyCall = token === supabaseServiceKey;

    if (!isServiceKeyCall) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);

      if (authError || !user) {
        throw new Error('Unauthorized');
      }
    } else {
      console.log('🔑 Chamada interna com service key detectada');
    }

    const { processo_id } = await req.json();

    if (!processo_id) {
      throw new Error('processo_id é obrigatório');
    }

    const callId = crypto.randomUUID().slice(0, 8);
    console.log(`\n[${callId}] 🔄 Iniciando processamento do próximo prompt para processo ${processo_id}`);

    const { data: processo, error: processoError } = await supabase
      .from('processos')
      .select('*')
      .eq('id', processo_id)
      .single();

    if (processoError || !processo) {
      throw new Error('Processo não encontrado');
    }

    if (processo.status === 'completed') {
      console.log('✅ Processo já concluído');
      return new Response(
        JSON.stringify({
          success: true,
          completed: true,
          message: 'Processo já concluído',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`[${callId}] 🔒 Tentando adquirir lock para processar próximo prompt...`);

    const now = new Date().toISOString();
    const lockTimeout = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const { data: lockedResults, error: lockError } = await supabase.rpc('acquire_next_prompt_lock', {
      p_processo_id: processo_id,
      p_now: now,
      p_lock_timeout: lockTimeout
    });

    if (lockError) {
      console.error(`[${callId}] ❌ Erro ao adquirir lock:`, lockError);
      throw new Error('Erro ao adquirir lock: ' + lockError.message);
    }

    const nextResult = lockedResults?.[0];

    if (!nextResult) {
      console.log(`[${callId}] ⏸️ Nenhum prompt disponível para processar (todos em andamento ou concluídos)`);

      const { data: allResults } = await supabase
        .from('analysis_results')
        .select('status')
        .eq('processo_id', processo_id);

      const allCompleted = allResults?.every(r => r.status === 'completed');

      if (allCompleted) {
        console.log(`[${callId}] 🎉 Todos os prompts foram processados`);

        await supabase
          .from('processos')
          .update({
            status: 'completed',
            analysis_completed_at: new Date().toISOString(),
          })
          .eq('id', processo_id);

        return new Response(
          JSON.stringify({
            success: true,
            completed: true,
            message: 'Análise concluída com sucesso',
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      } else {
        return new Response(
          JSON.stringify({
            success: true,
            completed: false,
            message: 'Nenhum prompt disponível no momento (processamento em andamento)',
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    console.log(`[${callId}] ✅ Lock adquirido para prompt: ${nextResult.prompt_title} (ordem ${nextResult.execution_order})`);
    console.log(`[${callId}] 📝 Iniciando processamento...`);

    if (processo.is_chunked && processo.total_chunks_count > 0) {
      console.log(`📦 Processo chunkeado detectado: ${processo.total_chunks_count} chunks`);

      const { data: chunks, error: chunksError } = await supabase
        .from('process_chunks')
        .select('*')
        .eq('processo_id', processo_id)
        .order('chunk_index', { ascending: true });

      if (chunksError || !chunks || chunks.length === 0) {
        throw new Error('Chunks não encontrados');
      }

      console.log(`🔍 Verificando uploads dos chunks...`);

      for (const chunk of chunks) {
        if (!chunk.gemini_file_uri || chunk.gemini_file_state !== 'ACTIVE') {
          console.log(`📤 Upload necessário para chunk ${chunk.chunk_index}/${chunks.length}`);

          try {
            const uploadResponse = await fetch(`${supabaseUrl}/functions/v1/upload-to-gemini`, {
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

            if (!uploadResponse.ok) {
              const errorData = await uploadResponse.json();
              throw new Error(`Falha no upload do chunk ${chunk.chunk_index}: ${errorData.error}`);
            }

            const uploadData = await uploadResponse.json();
            console.log(`✅ Chunk ${chunk.chunk_index} enviado: ${uploadData.file_uri}`);
          } catch (uploadError: any) {
            console.error(`❌ Erro no upload do chunk ${chunk.chunk_index}:`, uploadError);
            throw new Error(`Falha no upload do chunk ${chunk.chunk_index}: ${uploadError.message}`);
          }
        } else {
          console.log(`✅ Chunk ${chunk.chunk_index} já enviado`);
        }
      }

      console.log(`✅ Todos os chunks prontos para processamento`);
    }

    const activeModels = await getActiveModelsOrderedByPriority(supabase);

    if (activeModels.length === 0) {
      throw new Error('Nenhum modelo ativo encontrado');
    }

    console.log(`🤖 ${activeModels.length} modelo(s) disponível(is)`);

    let lastError: Error | null = null;
    let attemptNumber = 0;

    for (const model of activeModels) {
      attemptNumber++;

      const modelName = model.display_name || model.name;
      const modelId = model.system_model || model.model_id;
      const temperature = model.temperature ?? 0.2;
      const maxTokens = model.max_tokens ?? 8192;

      console.log(`\n🔍 Tentativa ${attemptNumber}: ${modelName}`);

      await updateProcessoModelInfo(
        supabase,
        processo_id,
        model.id,
        modelName,
        attemptNumber > 1,
        attemptNumber > 1 ? 'Fallback devido a erro no modelo anterior' : null
      );

      if (attemptNumber > 1) {
        const previousModel = activeModels[attemptNumber - 2];
        const previousModelName = previousModel.display_name || previousModel.name;
        await notifyModelSwitch(
          supabase,
          processo_id,
          previousModelName,
          modelName,
          'Modelo anterior indisponível ou com erro'
        );
        console.log(`📢 Notificação de troca de modelo enviada: ${previousModelName} → ${modelName}`);
      }

      const shouldUseFileApi = processo.is_chunked
        ? (await supabase
            .from('process_chunks')
            .select('gemini_file_uri')
            .eq('processo_id', processo_id)
            .limit(1)
            .maybeSingle()).data?.gemini_file_uri
        : processo.gemini_file_uri && processo.gemini_file_state === 'ACTIVE';

      if (shouldUseFileApi) {
        console.log('📂 Usando File API do Gemini');

        console.log(`🏃 Marcando prompt como 'running': ${nextResult.prompt_title}`);
        const { error: runningUpdateError } = await supabase
          .from('analysis_results')
          .update({
            status: 'running',
            processing_at: new Date().toISOString()
          })
          .eq('id', nextResult.id);

        if (runningUpdateError) {
          console.error(`❌ Erro ao marcar como running:`, runningUpdateError);
        }

        const startTime = Date.now();

        try {
          const genAI = new GoogleGenerativeAI(geminiApiKey);
          const geminiModel = genAI.getGenerativeModel({ model: modelId });

          const parts: any[] = [];

          if (processo.is_chunked && processo.total_chunks_count > 0) {
            console.log(`📦 Carregando ${processo.total_chunks_count} chunks...`);

            const { data: chunks, error: chunksError } = await supabase
              .from('process_chunks')
              .select('*')
              .eq('processo_id', processo_id)
              .order('chunk_index', { ascending: true });

            if (chunksError || !chunks || chunks.length === 0) {
              throw new Error('Chunks não encontrados');
            }

            if (chunks.length >= 3) {
              console.log(`⚡ Processando ${chunks.length} chunks individualmente para evitar limite de tokens`);

              const chunkResults: string[] = [];
              let totalTokensUsed = 0;

              for (const chunk of chunks) {
                if (!chunk.gemini_file_uri) {
                  throw new Error(`Chunk ${chunk.chunk_index} não foi enviado para Gemini`);
                }

                console.log(`📄 Processando chunk ${chunk.chunk_index}/${chunks.length}...`);

                const chunkParts = [
                  {
                    fileData: {
                      mimeType: 'application/pdf',
                      fileUri: chunk.gemini_file_uri,
                    },
                  },
                  {
                    text: `${nextResult.prompt_content}\n\nIMPORTANTE: Esta é a parte ${chunk.chunk_index} de ${chunks.length} do documento. Analise apenas este trecho e forneça os resultados correspondentes.`
                  }
                ];

                const chunkResult = await geminiModel.generateContent({
                  contents: [{ role: 'user', parts: chunkParts }],
                  systemInstruction: nextResult.system_prompt || undefined,
                  generationConfig: {
                    temperature,
                    maxOutputTokens: maxTokens,
                  },
                });

                const chunkResponse = await chunkResult.response;
                let chunkText = chunkResponse.text().trim();

                const chunkTokens = chunkResponse.usageMetadata?.totalTokenCount || 0;
                totalTokensUsed += chunkTokens;

                console.log(`✅ Chunk ${chunk.chunk_index} processado: ${chunkTokens} tokens`);

                if (chunkText.startsWith('```json')) {
                  chunkText = chunkText.replace(/^```json\n?/, '');
                }
                if (chunkText.startsWith('```')) {
                  chunkText = chunkText.replace(/^```\n?/, '');
                }
                if (chunkText.endsWith('```')) {
                  chunkText = chunkText.replace(/\n?```$/, '');
                }

                chunkResults.push(chunkText.trim());
              }

              console.log(`🔄 Combinando resultados de ${chunks.length} chunks...`);

              const combinationPrompt = `Você está combinando ${chunks.length} análises parciais de um documento dividido em partes.

ANÁLISES PARCIAIS:
${chunkResults.map((r, i) => `=== PARTE ${i + 1} ===\n${r}`).join('\n\n')}

TAREFA: Combine essas análises em uma única análise completa e coerente, removendo duplicações e garantindo consistência.

IMPORTANTE: Responda APENAS com o JSON ou conteúdo estruturado. NÃO inclua texto introdutório como "Com base na consolidação..." ou explicações. Inicie sua resposta DIRETAMENTE com o formato esperado (ex: começando com "{" para JSON).`;

              const combinationResult = await geminiModel.generateContent({
                contents: [{ role: 'user', parts: [{ text: combinationPrompt }] }],
                generationConfig: {
                  temperature: 0.1,
                  maxOutputTokens: maxTokens,
                },
              });

              const response = await combinationResult.response;
              let text = response.text();

              const combinationTokens = response.usageMetadata?.totalTokenCount || 0;
              totalTokensUsed += combinationTokens;

              console.log(`✅ Combinação concluída: ${combinationTokens} tokens`);
              console.log(`📊 Total de tokens: ${totalTokensUsed}`);
              console.log(`📄 Tamanho do texto: ${text.length} caracteres`);

              text = text.trim();
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

              console.log(`📝 Salvando resultado: ${text.length} caracteres`);

              if (!text || text.length === 0) {
                console.error(`⚠️ AVISO: Conteúdo vazio para prompt "${nextResult.prompt_title}"`);
              }

              const executionTime = Date.now() - startTime;

              console.log(`📝 Atualizando status para 'completed' - ${nextResult.prompt_title}`);
              const { data: updateData, error: updateError } = await supabase
                .from('analysis_results')
                .update({
                  status: 'completed',
                  result_content: text,
                  execution_time_ms: executionTime,
                  tokens_used: totalTokensUsed,
                  current_model_id: model.id,
                  current_model_name: modelName,
                  completed_at: new Date().toISOString(),
                })
                .eq('id', nextResult.id)
                .select();

              if (updateError) {
                console.error(`❌ ERRO ao atualizar status para 'completed':`, updateError);
                throw new Error(`Falha ao atualizar status: ${updateError.message}`);
              }

              console.log(`✅ Status atualizado com sucesso:`, {
                id: nextResult.id,
                title: nextResult.prompt_title,
                status: 'completed',
                hasContent: !!text,
                contentLength: text.length,
                updated: !!updateData
              });

              await addModelAttempt(supabase, processo_id, model.id, modelName, 'success');
              await recordExecution(supabase, processo_id, nextResult.id, model, attemptNumber, 'success', null, null, executionTime);

              console.log(`✅ Análise concluída: ${nextResult.prompt_title}`);

              return new Response(
                JSON.stringify({
                  success: true,
                  completed: false,
                  message: 'Prompt processado com sucesso',
                  tokens_used: totalTokensUsed,
                  execution_time_ms: executionTime,
                }),
                {
                  status: 200,
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                }
              );
            }

            for (const chunk of chunks) {
              if (!chunk.gemini_file_uri) {
                throw new Error(`Chunk ${chunk.chunk_index} não foi enviado para Gemini`);
              }

              console.log(`📄 Adicionando chunk ${chunk.chunk_index}: ${chunk.gemini_file_uri}`);

              parts.push({
                fileData: {
                  mimeType: 'application/pdf',
                  fileUri: chunk.gemini_file_uri,
                },
              });
            }

            console.log(`✅ ${chunks.length} chunks adicionados ao prompt`);
          } else {
            parts.push({
              fileData: {
                mimeType: processo.gemini_file_mime_type,
                fileUri: processo.gemini_file_uri,
              },
            });
          }

          parts.push({ text: nextResult.prompt_content });

          const result = await geminiModel.generateContent({
            contents: [{ role: 'user', parts }],
            systemInstruction: nextResult.system_prompt || undefined,
            generationConfig: {
              temperature,
              maxOutputTokens: maxTokens,
            },
          });

          const response = await result.response;
          let text = response.text();

          const executionTime = Date.now() - startTime;
          const tokensUsed = response.usageMetadata?.totalTokenCount || 0;

          console.log(`📊 Tokens consumidos: ${tokensUsed}`);
          console.log(`📄 Tamanho do texto (File API): ${text.length} caracteres`);

          text = text.trim();
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

          console.log(`📝 Salvando resultado (File API): ${text.length} caracteres`);

          if (!text || text.length === 0) {
            console.error(`⚠️ AVISO: Conteúdo vazio para prompt "${nextResult.prompt_title}" (File API)`);
          }

          console.log(`📝 Atualizando status para 'completed' (File API) - ${nextResult.prompt_title}`);
          const { data: updateData, error: updateError } = await supabase
            .from('analysis_results')
            .update({
              status: 'completed',
              result_content: text,
              execution_time_ms: executionTime,
              tokens_used: tokensUsed,
              completed_at: new Date().toISOString(),
              current_model_id: model.id,
              current_model_name: modelName,
            })
            .eq('id', nextResult.id)
            .select();

          if (updateError) {
            console.error(`❌ ERRO ao atualizar status para 'completed' (File API):`, updateError);
            throw new Error(`Falha ao atualizar status: ${updateError.message}`);
          }

          console.log(`✅ Status atualizado com sucesso (File API):`, {
            id: nextResult.id,
            title: nextResult.prompt_title,
            status: 'completed',
            hasContent: !!text,
            contentLength: text.length,
            updated: !!updateData
          });

          await supabase
            .from('processos')
            .update({ current_prompt_number: nextResult.execution_order })
            .eq('id', processo_id);

          await addModelAttempt(supabase, processo_id, model.id, modelName, 'success');
          await recordExecution(supabase, processo_id, nextResult.id, model, attemptNumber, 'success', null, null, executionTime);

          console.log(`✅ Sucesso com modelo ${modelName} em ${executionTime}ms`);

          const { data: remainingPrompts } = await supabase
            .from('analysis_results')
            .select('id')
            .eq('processo_id', processo_id)
            .eq('status', 'pending')
            .limit(1);

          if (remainingPrompts && remainingPrompts.length > 0) {
            console.log('🔄 Disparando processamento do próximo prompt...');

            fetch(`${supabaseUrl}/functions/v1/process-next-prompt`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({ processo_id }),
            }).catch(err => {
              console.error('❌ Erro ao disparar próximo prompt:', err?.message);
            });
          } else {
            console.log('🎉 Todos os prompts foram processados! Finalizando processo...');

            await supabase
              .from('processos')
              .update({
                status: 'completed',
                analysis_completed_at: new Date().toISOString(),
              })
              .eq('id', processo_id);

            console.log('✅ Processo finalizado com sucesso!');

            // Chamar consolidation-worker para consolidar as análises
            console.log('📋 Chamando consolidation-worker...');
            fetch(`${supabaseUrl}/functions/v1/consolidation-worker`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({ processo_id }),
            }).catch(err => {
              console.error('❌ Erro ao chamar consolidation-worker:', err?.message);
            });

            // Email será enviado pelo consolidation-worker após consolidação
            console.log('✅ Processo concluído - consolidation-worker enviará o email');
          }

          return new Response(
            JSON.stringify({
              success: true,
              completed: false,
              prompt_title: nextResult.prompt_title,
              execution_time_ms: executionTime,
              model_used: modelName,
              attempt_number: attemptNumber,
              method: 'file_api',
            }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        } catch (error: any) {
          const executionTime = Date.now() - startTime;
          console.error(`❌ Erro com modelo ${modelName}:`, error.message);

          lastError = error;

          await addModelAttempt(supabase, processo_id, model.id, modelName, 'failed');
          await recordExecution(supabase, processo_id, nextResult.id, model, attemptNumber, 'failed', error.message, error.code || null, executionTime);

          if (attemptNumber < activeModels.length) {
            console.log(`🔄 Tentando próximo modelo...`);
            continue;
          }
        }
      } else {
        console.log('📦 Usando Base64 inline');

        let base64Data: string | null = null;

        if (processo.pdf_base64) {
          base64Data = processo.pdf_base64;
          console.log(`✅ PDF base64 carregado: ${(base64Data.length / 1024 / 1024).toFixed(2)}MB`);
        } else {
          throw new Error('PDF não disponível em base64 e File API não está disponível');
        }

        if (!base64Data) {
          throw new Error('Falha ao obter dados do PDF');
        }

        console.log(`🏃 Marcando prompt como 'running' (Base64): ${nextResult.prompt_title}`);
        const { error: runningUpdateError } = await supabase
          .from('analysis_results')
          .update({
            status: 'running',
            processing_at: new Date().toISOString()
          })
          .eq('id', nextResult.id);

        if (runningUpdateError) {
          console.error(`❌ Erro ao marcar como running (Base64):`, runningUpdateError);
        }

        const startTime = Date.now();

        try {
          const genAI = new GoogleGenerativeAI(geminiApiKey);
          const geminiModel = genAI.getGenerativeModel({ model: modelId });

          const result = await geminiModel.generateContent({
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    inlineData: {
                      mimeType: 'application/pdf',
                      data: base64Data,
                    },
                  },
                  { text: nextResult.prompt_content },
                ],
              },
            ],
            systemInstruction: nextResult.system_prompt || undefined,
            generationConfig: {
              temperature,
              maxOutputTokens: maxTokens,
            },
          });

          const response = await result.response;
          let text = response.text();

          const executionTime = Date.now() - startTime;
          const tokensUsed = response.usageMetadata?.totalTokenCount || 0;

          console.log(`📊 Tokens consumidos: ${tokensUsed}`);
          console.log(`📄 Tamanho do texto (Base64): ${text.length} caracteres`);

          base64Data = null;

          text = text.trim();
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

          console.log(`📝 Salvando resultado (Base64): ${text.length} caracteres`);

          if (!text || text.length === 0) {
            console.error(`⚠️ AVISO: Conteúdo vazio para prompt "${nextResult.prompt_title}" (Base64)`);
          }

          console.log(`📝 Atualizando status para 'completed' (Base64) - ${nextResult.prompt_title}`);
          const { data: updateData, error: updateError } = await supabase
            .from('analysis_results')
            .update({
              status: 'completed',
              result_content: text,
              execution_time_ms: executionTime,
              tokens_used: tokensUsed,
              completed_at: new Date().toISOString(),
              current_model_id: model.id,
              current_model_name: modelName,
            })
            .eq('id', nextResult.id)
            .select();

          if (updateError) {
            console.error(`❌ ERRO ao atualizar status para 'completed' (Base64):`, updateError);
            throw new Error(`Falha ao atualizar status: ${updateError.message}`);
          }

          console.log(`✅ Status atualizado com sucesso (Base64):`, {
            id: nextResult.id,
            title: nextResult.prompt_title,
            status: 'completed',
            hasContent: !!text,
            contentLength: text.length,
            updated: !!updateData
          });

          await supabase
            .from('processos')
            .update({ current_prompt_number: nextResult.execution_order })
            .eq('id', processo_id);

          await addModelAttempt(supabase, processo_id, model.id, modelName, 'success');
          await recordExecution(supabase, processo_id, nextResult.id, model, attemptNumber, 'success', null, null, executionTime);

          console.log(`✅ Sucesso com modelo ${modelName} em ${executionTime}ms`);

          const { data: remainingPrompts } = await supabase
            .from('analysis_results')
            .select('id')
            .eq('processo_id', processo_id)
            .eq('status', 'pending')
            .limit(1);

          if (remainingPrompts && remainingPrompts.length > 0) {
            console.log('🔄 Disparando processamento do próximo prompt...');

            fetch(`${supabaseUrl}/functions/v1/process-next-prompt`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({ processo_id }),
            }).catch(err => {
              console.error('❌ Erro ao disparar próximo prompt:', err?.message);
            });
          } else {
            console.log('🎉 Todos os prompts foram processados! Finalizando processo...');

            await supabase
              .from('processos')
              .update({
                status: 'completed',
                analysis_completed_at: new Date().toISOString(),
              })
              .eq('id', processo_id);

            console.log('✅ Processo finalizado com sucesso!');

            // Chamar consolidation-worker para consolidar as análises
            console.log('📋 Chamando consolidation-worker...');
            fetch(`${supabaseUrl}/functions/v1/consolidation-worker`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({ processo_id }),
            }).catch(err => {
              console.error('❌ Erro ao chamar consolidation-worker:', err?.message);
            });

            // Email será enviado pelo consolidation-worker após consolidação
            console.log('✅ Processo concluído - consolidation-worker enviará o email');
          }

          return new Response(
            JSON.stringify({
              success: true,
              completed: false,
              prompt_title: nextResult.prompt_title,
              execution_time_ms: executionTime,
              model_used: modelName,
              attempt_number: attemptNumber,
              method: 'base64_inline',
            }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        } catch (error: any) {
          const executionTime = Date.now() - startTime;
          console.error(`❌ Erro com modelo ${modelName}:`, error.message);

          lastError = error;

          await addModelAttempt(supabase, processo_id, model.id, modelName, 'failed');
          await recordExecution(supabase, processo_id, nextResult.id, model, attemptNumber, 'failed', error.message, error.code || null, executionTime);

          if (attemptNumber < activeModels.length) {
            console.log(`🔄 Tentando próximo modelo...`);
            continue;
          }
        }
      }
    }

    console.error(`❌ Todos os modelos falharam`);

    await supabase
      .from('analysis_results')
      .update({
        status: 'error',
        error_message: lastError?.message || 'Todos os modelos falharam',
      })
      .eq('id', nextResult.id);

    throw lastError || new Error('Todos os modelos falharam');
  } catch (error: any) {
    console.error('Erro no processamento:', error);

    return new Response(
      JSON.stringify({
        error: error?.message || 'Erro no processamento',
        details: error?.stack,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});