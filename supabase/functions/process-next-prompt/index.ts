import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { GoogleGenerativeAI } from 'npm:@google/generative-ai@0.24.1';
import { notifyAdminSafe } from './_shared/notify-admin-safe.ts';
import { validateAnalysisJSON, formatValidationErrorMessage, ValidationResult } from './json-validator.ts';

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

async function registerAnalysisError(
  supabase: any,
  processoId: string,
  userId: string,
  analysisResultId: string,
  promptTitle: string,
  executionOrder: number,
  validation: ValidationResult,
  errorMessage: string
): Promise<string> {
  const { data, error } = await supabase
    .from('analysis_errors')
    .insert({
      processo_id: processoId,
      user_id: userId,
      analysis_result_id: analysisResultId,
      error_type: 'validation_error',
      error_category: 'json_validation',
      error_message: errorMessage,
      error_details: {
        validation_result: validation,
        errors: validation.errors,
        warnings: validation.warnings,
        diagnostics: validation.diagnostics
      },
      severity: 'high',
      current_stage: 'processing',
      prompt_title: promptTitle,
      execution_order: executionOrder,
      recovery_attempted: false,
      recovery_successful: false,
      admin_notified: false,
      occurred_at: new Date().toISOString()
    })
    .select('id')
    .single();

  if (error) {
    console.error('❌ Erro ao registrar erro de validação:', error);
    throw new Error(`Falha ao registrar erro: ${error.message}`);
  }

  console.log(`✅ Erro de validação registrado: ${data.id}`);
  return data.id;
}

async function triggerAdminErrorEmail(
  supabaseUrl: string,
  supabaseServiceKey: string,
  processoId: string,
  analysisResultId: string,
  promptTitle: string,
  errorMessage: string,
  errorDetails: any
): Promise<void> {
  try {
    console.log(`📧 Disparando email de erro para admin...`);

    const response = await fetch(`${supabaseUrl}/functions/v1/send-admin-analysis-error`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        processo_id: processoId,
        analysis_result_id: analysisResultId,
        prompt_title: promptTitle,
        error_message: errorMessage,
        error_details: errorDetails,
        severity: 'high',
        error_type: 'validation_error'
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Erro ao disparar email: ${response.status} - ${errorText}`);
    } else {
      console.log(`✅ Email de erro disparado com sucesso`);
    }
  } catch (error) {
    console.error(`❌ Exceção ao disparar email:`, error);
  }
}

async function getTokenLimitForContext(
  supabase: any,
  processo: any
): Promise<number> {
  const isComplexFile = processo.is_chunked ||
    (processo.transcricao?.totalPages && processo.transcricao.totalPages >= 1000);

  const contextKey = isComplexFile ? 'analysis_complex_files' : 'analysis_small_files';

  console.log(`🔧 Buscando limite de tokens para contexto: ${contextKey}`);

  const { data, error } = await supabase
    .from('token_limits_config')
    .select('max_output_tokens')
    .eq('context_key', contextKey)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error(`❌ Erro ao buscar limite de tokens:`, error);
    throw new Error(`Falha ao buscar limite de tokens: ${error.message}`);
  }

  if (!data) {
    throw new Error(`Limite de tokens não configurado para contexto: ${contextKey}`);
  }

  console.log(`✅ Limite de tokens obtido: ${data.max_output_tokens} para ${contextKey}`);

  return data.max_output_tokens;
}

async function sendProcessCompletedNotification(
  supabase: any,
  processo_id: string,
  file_name: string,
  user_id: string,
  created_at: string
) {
  try {
    const { data: userData } = await supabase
      .from('user_profiles')
      .select('email, first_name, last_name')
      .eq('id', user_id)
      .maybeSingle();

    const startTime = new Date(created_at);
    const endTime = new Date();
    const durationMs = endTime.getTime() - startTime.getTime();
    const durationMinutes = Math.floor(durationMs / 60000);
    const durationSeconds = Math.floor((durationMs % 60000) / 1000);
    const durationText = durationMinutes > 0
      ? `${durationMinutes}m ${durationSeconds}s`
      : `${durationSeconds}s`;

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    await fetch(`${supabaseUrl}/functions/v1/send-email-process-completed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        email: userData?.email,
        user_name: userData?.first_name || 'Usuário',
        processo_id,
        file_name,
        duration: durationText,
      }),
    });

    await supabase.from('notifications').insert({
      user_id,
      type: 'analysis_completed',
      message: `Análise do processo "${file_name}" concluída com sucesso!`,
      related_processo_id: processo_id,
    });
  } catch (error) {
    console.error('Erro ao enviar notificação de processo concluído:', error);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { processo_id } = await req.json();

    if (!processo_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing processo_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const genAI = new GoogleGenerativeAI(geminiApiKey);

    console.log(`📋 Obtendo próximo prompt para processo ${processo_id}...`);

    const { data: lockResult, error: lockError } = await supabase
      .rpc('acquire_next_prompt_lock', { p_processo_id: processo_id });

    if (lockError) {
      console.error('❌ Erro ao obter lock:', lockError);
      return new Response(
        JSON.stringify({ success: false, error: 'Falha ao obter lock' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!lockResult) {
      console.log('⏭️ Nenhum prompt pendente ou já em processamento');
      return new Response(
        JSON.stringify({ success: true, completed: true, message: 'No more pending prompts' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const nextResult = lockResult;
    console.log(`✅ Lock obtido: ${nextResult.id} - ${nextResult.prompt_title}`);

    const { data: processo, error: processoError } = await supabase
      .from('processos')
      .select('*')
      .eq('id', processo_id)
      .single();

    if (processoError || !processo) {
      console.error('❌ Erro ao buscar processo:', processoError);
      throw new Error('Processo não encontrado');
    }

    const models = await getActiveModelsOrderedByPriority(supabase);

    if (models.length === 0) {
      throw new Error('Nenhum modelo LLM ativo disponível');
    }

    let lastError = null;
    let attemptNumber = 0;
    const startTime = Date.now();

    for (const model of models) {
      try {
        attemptNumber++;

        console.log(`🤖 Tentativa ${attemptNumber}: usando modelo ${model.name}`);

        if (models.length > 1 && attemptNumber > 1) {
          const previousModel = models[attemptNumber - 2];
          await updateProcessoModelInfo(
            supabase,
            processo_id,
            model.id,
            model.name,
            true,
            `Erro no modelo ${previousModel.name}`
          );
          await notifyModelSwitch(
            supabase,
            processo_id,
            previousModel.name,
            model.name,
            'Erro no modelo anterior'
          );
        } else if (attemptNumber === 1) {
          await updateProcessoModelInfo(supabase, processo_id, model.id, model.name, false);
        }

        const modelName = model.system_model || model.model_id;
        const geminiModel = genAI.getGenerativeModel({ model: modelName });
        const temperature = model.temperature ?? 0.1;
        const maxTokens = await getTokenLimitForContext(supabase, processo);

        const parts: any[] = [];

        if (processo.pdf_base64) {
          console.log('📄 Usando PDF base64...');

          const useChunks = processo.is_chunked &&
            nextResult.prompt_type === 'forensic' &&
            nextResult.prompt_title !== 'Conclusões e Perspectivas';

          if (useChunks) {
            console.log('🧩 Processando chunks do PDF...');

            const { data: chunks } = await supabase
              .from('processo_chunks')
              .select('*')
              .eq('processo_id', processo_id)
              .order('chunk_index', { ascending: true });

            if (!chunks || chunks.length === 0) {
              throw new Error('Nenhum chunk encontrado para processo chunked');
            }

            console.log(`📦 Encontrados ${chunks.length} chunks`);

            const chunkResults: string[] = [];
            let totalTokensUsed = 0;

            for (const chunk of chunks) {
              console.log(`⚙️ Processando chunk ${chunk.chunk_index + 1}/${chunks.length}...`);

              if (!chunk.pdf_base64) {
                throw new Error(`Chunk ${chunk.chunk_index} sem PDF base64`);
              }

              const chunkResult = await geminiModel.generateContent({
                contents: [
                  {
                    role: 'user',
                    parts: [
                      {
                        inlineData: {
                          mimeType: 'application/pdf',
                          data: chunk.pdf_base64,
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

              const response = await chunkResult.response;
              let chunkText = response.text();

              const tokensUsed = response.usageMetadata?.totalTokenCount || 0;
              totalTokensUsed += tokensUsed;

              console.log(`✅ Chunk ${chunk.chunk_index + 1} processado: ${tokensUsed} tokens`);

              chunkText = chunkText.trim();
              if (chunkText.startsWith('```json')) {
                chunkText = chunkText.replace(/^```json\n?/, '');
              }
              if (chunkText.startsWith('```')) {
                chunkText = chunkText.replace(/^```\n?/, '');
              }
              if (chunkText.endsWith('```')) {
                chunkText = chunkText.replace(/\n?```$/, '');
              }
              chunkText = chunkText.trim();

              chunkResults.push(chunkText);
            }

            console.log(`🔄 Consolidando ${chunkResults.length} resultados...`);

            const combinationPrompt = `Você está combinando ${chunks.length} análises parciais de um documento dividido em partes.\n\nANÁLISES PARCIAIS:\n${chunkResults.map((r, i) => `=== PARTE ${i + 1} ===\n${r}`).join('\n\n')}\n\nTAREFA: Combine essas análises em uma única análise completa e coerente, removendo duplicações e garantindo consistência.\n\nIMPORTANTE: Responda APENAS com o JSON ou conteúdo estruturado. NÃO inclua texto introdutório como \"Com base na consolidação...\" ou explicações. Inicie sua resposta DIRETAMENTE com o formato esperado (ex: começando com \"{\" para JSON).`;

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
              console.error(`⚠️ AVISO: Conteúdo vazio para prompt \"${nextResult.prompt_title}\"`);
            }

            console.log(`🔍 Validando JSON antes de salvar...`);
            const validation = validateAnalysisJSON(text, nextResult.prompt_title);

            if (!validation.isValid) {
              console.error(`❌ JSON INVÁLIDO OU INCOMPLETO:`, validation.errors);

              const errorMessage = formatValidationErrorMessage(
                processo_id,
                nextResult.prompt_title,
                validation
              );

              const errorId = await registerAnalysisError(
                supabase,
                processo_id,
                processo.user_id,
                nextResult.id,
                nextResult.prompt_title,
                nextResult.execution_order,
                validation,
                errorMessage
              );

              await triggerAdminErrorEmail(
                supabaseUrl,
                supabaseServiceKey,
                processo_id,
                nextResult.id,
                nextResult.prompt_title,
                errorMessage,
                {
                  validation_result: validation,
                  error_id: errorId,
                  content_length: text.length,
                  content_preview: text.substring(0, 500)
                }
              );

              await supabase
                .from('analysis_results')
                .update({
                  status: 'failed',
                  error_message: 'JSON inválido ou incompleto',
                  error_details: { validation }
                })
                .eq('id', nextResult.id);

              throw new Error(`Validação de JSON falhou: ${validation.errors.join(', ')}`);
            }

            console.log(`✅ JSON válido e completo`);

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

            const { data: remainingPromptsChunk } = await supabase
              .from('analysis_results')
              .select('id')
              .eq('processo_id', processo_id)
              .eq('status', 'pending')
              .limit(1);

            const hasMorePrompts = remainingPromptsChunk && remainingPromptsChunk.length > 0;

            if (hasMorePrompts) {
              console.log('✅ Prompt concluído. Aguardando próxima chamada externa para processamento sequencial.');
            } else {
              console.log('🎉 Último prompt processado!');

              await supabase
                .from('processos')
                .update({
                  status: 'completed',
                  completed_at: new Date().toISOString(),
                  llm_model_switching: false,
                })
                .eq('id', processo_id);

              await updateProcessoModelInfo(supabase, processo_id, null, null, false);

              await sendProcessCompletedNotification(
                supabase,
                processo_id,
                processo.file_name,
                processo.user_id,
                processo.created_at
              );
            }

            return new Response(
              JSON.stringify({
                success: true,
                completed: !hasMorePrompts,
                message: hasMorePrompts ? 'Prompt processado com sucesso. Há mais prompts pendentes.' : 'Todos os prompts foram processados com sucesso',
                tokens_used: totalTokensUsed,
                execution_time_ms: executionTime,
                has_more_prompts: hasMorePrompts,
              }),
              {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              }
            );
          }

          parts.push({
            inlineData: {
              mimeType: 'application/pdf',
              data: processo.pdf_base64,
            },
          });
        } else {
          console.log('📄 Usando File API...');

          const { data: chunks } = await supabase
            .from('processo_chunks')
            .select('*')
            .eq('processo_id', processo_id)
            .order('chunk_index', { ascending: true });

          if (chunks && chunks.length > 0) {
            console.log(`📦 Processo chunked com ${chunks.length} chunks`);

            const useChunks = processo.is_chunked &&
              nextResult.prompt_type === 'forensic' &&
              nextResult.prompt_title !== 'Conclusões e Perspectivas';

            if (!useChunks) {
              console.log('⚠️ Análise de Conclusão - ignorando chunks');
              parts.push({
                fileData: {
                  mimeType: processo.gemini_file_mime_type,
                  fileUri: processo.gemini_file_uri,
                },
              });
            } else {
              console.log('✅ Usando chunks para análise forensic');

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
            }
          } else {
            parts.push({
              fileData: {
                mimeType: processo.gemini_file_mime_type,
                fileUri: processo.gemini_file_uri,
              },
            });
          }
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
          console.error(`⚠️ AVISO: Conteúdo vazio para prompt \"${nextResult.prompt_title}\" (File API)`);
        }

        console.log(`🔍 Validando JSON antes de salvar (File API)...`);
        const validation = validateAnalysisJSON(text, nextResult.prompt_title);

        if (!validation.isValid) {
          console.error(`❌ JSON INVÁLIDO OU INCOMPLETO (File API):`, validation.errors);

          const errorMessage = formatValidationErrorMessage(
            processo_id,
            nextResult.prompt_title,
            validation
          );

          const errorId = await registerAnalysisError(
            supabase,
            processo_id,
            processo.user_id,
            nextResult.id,
            nextResult.prompt_title,
            nextResult.execution_order,
            validation,
            errorMessage
          );

          await triggerAdminErrorEmail(
            supabaseUrl,
            supabaseServiceKey,
            processo_id,
            nextResult.id,
            nextResult.prompt_title,
            errorMessage,
            {
              validation_result: validation,
              error_id: errorId,
              content_length: text.length,
              content_preview: text.substring(0, 500)
            }
          );

          await supabase
            .from('analysis_results')
            .update({
              status: 'failed',
              error_message: 'JSON inválido ou incompleto',
              error_details: { validation }
            })
            .eq('id', nextResult.id);

          throw new Error(`Validação de JSON falhou: ${validation.errors.join(', ')}`);
        }

        console.log(`✅ JSON válido e completo (File API)`);

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
          console.log('✅ Prompt concluído. Aguardando próxima chamada externa para processamento sequencial.');

          return new Response(
            JSON.stringify({
              success: true,
              completed: false,
              message: 'Prompt processado com sucesso. Há mais prompts pendentes.',
              has_more_prompts: true,
            }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        } else {
          console.log('🎉 Todos os prompts foram processados!');

          await supabase
            .from('processos')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              llm_model_switching: false,
            })
            .eq('id', processo_id);

          await updateProcessoModelInfo(supabase, processo_id, null, null, false);

          await sendProcessCompletedNotification(
            supabase,
            processo_id,
            processo.file_name,
            processo.user_id,
            processo.created_at
          );

          return new Response(
            JSON.stringify({
              success: true,
              completed: true,
              message: 'Todos os prompts foram processados com sucesso',
            }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
      } catch (modelError: any) {
        console.error(`❌ Erro no modelo ${model.name}:`, modelError?.message);

        lastError = modelError;

        await addModelAttempt(supabase, processo_id, model.id, model.name, 'failed');
        await recordExecution(
          supabase,
          processo_id,
          nextResult.id,
          model,
          attemptNumber,
          'failed',
          modelError?.message || 'Unknown error',
          modelError?.code || null,
          Date.now() - startTime
        );

        if (attemptNumber < models.length) {
          console.log(`🔄 Tentando próximo modelo...`);
          continue;
        }

        throw modelError;
      }
    }

    throw new Error(
      `Todos os modelos falharam. Último erro: ${lastError?.message || 'Unknown'}`
    );
  } catch (error: any) {
    console.error('❌ Erro fatal:', error?.message);

    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
