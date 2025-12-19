import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { GoogleGenerativeAI } from 'npm:@google/generative-ai@0.24.1';
import { notifyAdminSafe } from './_shared/notify-admin-safe.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface AnalysisResult {
  id: string;
  prompt_id: string;
  prompt_title: string;
  prompt_content: string;
  system_prompt: string | null;
  execution_order: number;
}

interface ProcessoData {
  id: string;
  file_name: string;
  user_id: string;
  pdf_base64: string | null;
  is_chunked: boolean;
  total_chunks: number | null;
  file_path: string | null;
}

interface ModelConfig {
  id: string;
  name: string;
  model_id: string;
  system_model: string | null;
  temperature: number;
  max_tokens: number;
  priority: number;
}

async function getActiveModels(supabase: any): Promise<ModelConfig[]> {
  const { data: models, error } = await supabase
    .from('admin_system_models')
    .select('id, name, model_id, system_model, temperature, model_config, priority')
    .eq('is_active', true)
    .order('priority', { ascending: true });

  if (error || !models || models.length === 0) {
    throw new Error('Nenhum modelo ativo encontrado');
  }

  return models.map((m: any) => ({
    id: m.id,
    name: m.name,
    model_id: m.system_model || m.model_id,
    system_model: m.system_model,
    temperature: m.temperature || 0.2,
    max_tokens: m.model_config?.max_tokens || 60000,
    priority: m.priority || 0,
  }));
}

async function getMaxOutputTokens(
  supabase: any,
  contextKey: string,
  fallbackValue: number
): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('token_limits_config')
      .select('max_output_tokens, is_active')
      .eq('context_key', contextKey)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.warn(`⚠️ Error fetching token limit for ${contextKey}, using fallback:`, error);
      return fallbackValue;
    }

    if (data) {
      console.log(`✅ Token limit for ${contextKey}: ${data.max_output_tokens}`);
      return data.max_output_tokens;
    }

    console.warn(`⚠️ No active token limit found for ${contextKey}, using fallback: ${fallbackValue}`);
    return fallbackValue;
  } catch (error) {
    console.warn(`⚠️ Exception fetching token limit for ${contextKey}, using fallback:`, error);
    return fallbackValue;
  }
}

async function loadPDFData(
  supabase: any,
  processo: ProcessoData,
  processo_id: string
): Promise<string> {
  if (processo.is_chunked && processo.total_chunks) {
    console.log(`📦 Carregando PDF chunkeado (${processo.total_chunks} chunks)...`);

    const { data: chunks, error: chunksError } = await supabase
      .from('pdf_chunks')
      .select('chunk_data, chunk_number')
      .eq('processo_id', processo_id)
      .order('chunk_number', { ascending: true });

    if (chunksError || !chunks) {
      throw new Error('Erro ao carregar chunks do PDF');
    }

    const base64Data = chunks.map((c: any) => c.chunk_data).join('');
    console.log(`✅ ${chunks.length} chunks reunidos`);
    return base64Data;
  }

  if (processo.pdf_base64) {
    console.log('📄 Usando PDF inline do banco de dados');
    return processo.pdf_base64;
  }

  if (processo.file_path) {
    console.log('⚠️ PDF não encontrado no banco, baixando do Storage...');

    const { data: storageData } = await supabase.storage
      .from('processos')
      .download(processo.file_path);

    if (!storageData) {
      throw new Error('Arquivo não encontrado no storage');
    }

    const arrayBuffer = await storageData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    let binary = '';
    const chunkSize = 8192;

    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }

    return btoa(binary);
  }

  throw new Error('Nenhuma fonte de PDF disponível (base64, chunks ou file_path)');
}

function isTimeoutError(error: any): boolean {
  const errorString = error?.message?.toLowerCase() || error?.toString()?.toLowerCase() || '';
  return (
    errorString.includes('connection closed') ||
    errorString.includes('timeout') ||
    errorString.includes('timed out') ||
    errorString.includes('deadline exceeded') ||
    error?.name === 'Http'
  );
}

async function scheduleRetry(
  supabase: any,
  processo_id: string,
  analysis_result_id: string,
  error: any
): Promise<void> {
  console.log(`🔄 Agendando retry automático devido a timeout...`);

  try {
    await supabase
      .from('analysis_results')
      .update({
        status: 'pending',
        processing_at: null,
        error_message: `Timeout detectado, retry agendado: ${error?.message || 'Unknown error'}`,
        retry_count: supabase.raw('COALESCE(retry_count, 0) + 1'),
        last_retry_at: new Date().toISOString(),
      })
      .eq('id', analysis_result_id);

    console.log(`✅ Retry agendado - prompt voltou para pending`);
  } catch (retryError) {
    console.error('❌ Erro ao agendar retry:', retryError);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  let processo_id: string | null = null;
  let analysis_result_id: string | null = null;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')!;

    if (!supabaseUrl || !supabaseServiceKey || !geminiApiKey) {
      throw new Error('Variáveis de ambiente ausentes');
    }

    const body = await req.json();
    processo_id = body.processo_id;

    if (!processo_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'processo_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`\n========== PROCESS-NEXT-PROMPT START ==========`);
    console.log(`Processo ID: ${processo_id}`);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const genAI = new GoogleGenerativeAI(geminiApiKey);

    console.log(`📋 Obtendo próximo prompt para processo ${processo_id}...`);

    const now = new Date().toISOString();
    const lockTimeout = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const { data: lockResult, error: lockError } = await supabase
      .rpc('acquire_next_prompt_lock', {
        p_processo_id: processo_id,
        p_now: now,
        p_lock_timeout: lockTimeout
      });

    if (lockError) {
      console.error('❌ Erro ao obter lock:', lockError);
      return new Response(
        JSON.stringify({ success: false, error: 'Falha ao obter lock' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!lockResult || !Array.isArray(lockResult) || lockResult.length === 0) {
      console.log('⏭️ Nenhum prompt pendente ou já em processamento');
      return new Response(
        JSON.stringify({ success: true, message: 'Nenhum prompt disponível' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const analysisResult = lockResult[0] as AnalysisResult;
    analysis_result_id = analysisResult.id;

    console.log(`✅ Lock obtido para: ${analysisResult.prompt_title}`);
    console.log(`   - Analysis Result ID: ${analysis_result_id}`);
    console.log(`   - Execution Order: ${analysisResult.execution_order}`);

    const { data: processo, error: processoError } = await supabase
      .from('processos')
      .select('id, file_name, user_id, pdf_base64, is_chunked, total_chunks, file_path')
      .eq('id', processo_id)
      .single();

    if (processoError || !processo) {
      throw new Error(`Processo não encontrado: ${processo_id}`);
    }

    const processoData = processo as ProcessoData;

    console.log(`📄 Processo encontrado: ${processoData.file_name}`);
    console.log(`📝 Prompt para processar: ${analysisResult.prompt_title}`);
    console.log(`   - Prompt content length: ${analysisResult.prompt_content?.length || 0}`);
    console.log(`   - Is chunked: ${processoData.is_chunked}`);

    const pdfBase64Data = await loadPDFData(supabase, processoData, processo_id);

    if (!pdfBase64Data) {
      throw new Error('Falha ao carregar dados do PDF');
    }

    const activeModels = await getActiveModels(supabase);
    console.log(`🤖 ${activeModels.length} modelo(s) ativo(s) disponível(is)`);

    const contextKey = processoData.is_chunked ? 'analysis_complex_files' : 'analysis_small_files';

    let lastError: any = null;
    let attemptNumber = 0;

    for (const modelConfig of activeModels) {
      attemptNumber++;

      try {
        const configuredMaxTokens = await getMaxOutputTokens(
          supabase,
          contextKey,
          modelConfig.max_tokens
        );

        console.log(`\n🔄 Tentativa ${attemptNumber}/${activeModels.length}`);
        console.log(`   - Modelo: ${modelConfig.name}`);
        console.log(`   - Model ID: ${modelConfig.model_id}`);
        console.log(`   - Temperature: ${modelConfig.temperature}`);
        console.log(`   - Max Tokens: ${configuredMaxTokens}`);

        const startTime = Date.now();

        const model = genAI.getGenerativeModel({
          model: modelConfig.model_id,
        });

        console.log(`🚀 Enviando prompt para Gemini...`);

        if (!analysisResult.prompt_content || analysisResult.prompt_content.trim() === '') {
          throw new Error('Prompt content is empty or invalid');
        }

        const result = await model.generateContent({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType: 'application/pdf',
                    data: pdfBase64Data,
                  },
                },
                {
                  text: analysisResult.prompt_content.trim()
                },
              ],
            },
          ],
          systemInstruction: analysisResult.system_prompt || undefined,
          generationConfig: {
            temperature: modelConfig.temperature,
            maxOutputTokens: configuredMaxTokens,
          },
        });

        const response = result.response;
        let text = response.text().trim();

        console.log(`✅ Resposta recebida do Gemini`);
        console.log(`   - Tamanho da resposta: ${text.length} caracteres`);

        console.log(`💾 SALVAMENTO PREVENTIVO FASE 1: Salvando conteúdo RAW imediatamente...`);

        const { error: phase1Error } = await supabase
          .from('analysis_results')
          .update({
            result_content: text,
            raw_received_at: new Date().toISOString(),
          })
          .eq('id', analysis_result_id);

        if (phase1Error) {
          console.error('❌ CRÍTICO: Falha ao salvar conteúdo RAW:', phase1Error);
          throw phase1Error;
        }

        console.log(`✅ FASE 1 CONCLUÍDA: Conteúdo protegido contra 502`);

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

        const executionTime = Date.now() - startTime;
        const tokensUsed = response.usageMetadata?.totalTokenCount || 0;

        console.log(`📊 Estatísticas:`);
        console.log(`   - Tokens usados: ${tokensUsed}`);
        console.log(`   - Tempo de execução: ${executionTime}ms`);

        console.log(`💾 SALVAMENTO FASE 2: Atualizando metadados...`);

        const { error: phase2Error } = await supabase
          .from('analysis_results')
          .update({
            status: 'completed',
            result_content: text,
            execution_time_ms: executionTime,
            tokens_used: tokensUsed,
            current_model_id: modelConfig.id,
            current_model_name: modelConfig.name,
            processing_at: null,
            completed_at: new Date().toISOString(),
          })
          .eq('id', analysis_result_id);

        if (phase2Error) {
          console.warn('⚠️ Falha ao atualizar metadados (mas conteúdo já está salvo):', phase2Error);
        } else {
          console.log(`✅ FASE 2 CONCLUÍDA: Metadados atualizados`);
        }

        console.log(`✅ Sucesso com modelo: ${modelConfig.name}`);

        const { data: remainingPrompts, error: remainingError } = await supabase
          .from('analysis_results')
          .select('id')
          .eq('processo_id', processo_id)
          .in('status', ['pending', 'processing'])
          .limit(1)
          .maybeSingle();

        if (remainingError) {
          console.error('⚠️ Erro ao verificar prompts restantes:', remainingError);
        }

        const hasMorePrompts = !!remainingPrompts;

        if (!hasMorePrompts) {
          console.log(`🎉 Todos os prompts concluídos! Marcando processo como completo...`);

          const { error: processoUpdateError } = await supabase
            .from('processos')
            .update({
              status: 'completed',
              analysis_completed_at: new Date().toISOString(),
            })
            .eq('id', processo_id);

          if (processoUpdateError) {
            console.error('❌ Erro ao atualizar status do processo:', processoUpdateError);
          } else {
            console.log(`✅ Processo marcado como completed`);
          }

          const { error: notificationError } = await supabase.from('notifications').insert({
            user_id: processoData.user_id,
            type: 'analysis_completed',
            message: 'Análise de documento concluída com sucesso',
            related_processo_id: processo_id,
          });

          if (notificationError) {
            console.error('❌ Erro ao criar notificação:', notificationError);
          } else {
            console.log(`📩 Notificação criada para o usuário`);
          }

          console.log(`📧 Enviando email de processo concluído...`);
          try {
            const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-email-process-completed`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({ processo_id }),
            });

            if (emailResponse.ok) {
              const emailResult = await emailResponse.json();
              console.log(`✅ Email enviado com sucesso:`, emailResult.resend_id);
            } else {
              const errorText = await emailResponse.text();
              console.error(`❌ Falha ao enviar email:`, errorText);
            }
          } catch (emailError) {
            console.error(`❌ Erro ao chamar edge function de email:`, emailError);
          }

          console.log(`🔔 Enviando notificação administrativa...`);

          const { data: userData } = await supabase
            .from('user_profiles')
            .select('email, first_name, last_name')
            .eq('id', processoData.user_id)
            .maybeSingle();

          const userName = userData
            ? `${userData.first_name || ''} ${userData.last_name || ''}`.trim()
            : 'N/A';
          const userEmail = userData?.email || 'N/A';
          const fileName = processoData.file_name || 'N/A';

          const { data: allResults } = await supabase
            .from('analysis_results')
            .select('execution_time_ms')
            .eq('processo_id', processo_id)
            .eq('status', 'completed');

          const totalExecutionTime = allResults?.reduce((sum, r) => sum + (r.execution_time_ms || 0), 0) || 0;
          const durationMinutes = Math.floor(totalExecutionTime / 60000);
          const durationSeconds = Math.floor((totalExecutionTime % 60000) / 1000);
          const durationText =
            durationMinutes > 0 ? `${durationMinutes}m ${durationSeconds}s` : `${durationSeconds}s`;

          notifyAdminSafe({
            type: 'analysis_completed',
            title: 'Análise Concluída',
            message: `*Usuário:* ${userName} (${userEmail})\n*Arquivo:* ${fileName}\n*Duração:* ${durationText}\n*Prompts:* ${allResults?.length || 0}\n*Complexo:* ${processoData.is_chunked ? 'Sim' : 'Não'}`,
            severity: 'success',
            metadata: {
              processo_id,
              file_name: fileName,
              user_email: userEmail,
              user_name: userName,
              duration: durationText,
              prompts_count: allResults?.length || 0,
              is_complex: processoData.is_chunked,
            },
            userId: processoData.user_id,
            processoId: processo_id,
          });
        } else {
          console.log(`⏭️ Ainda há prompts pendentes, continuando processamento...`);
        }

        console.log(`========== PROCESS-NEXT-PROMPT END ==========\n`);

        return new Response(
          JSON.stringify({
            success: true,
            analysis_result_id,
            prompt_title: analysisResult.prompt_title,
            execution_order: analysisResult.execution_order,
            tokens_used: tokensUsed,
            execution_time_ms: executionTime,
            has_more_prompts: hasMorePrompts,
            model_used: modelConfig.name,
            attempt_number: attemptNumber,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      } catch (modelError: any) {
        lastError = modelError;
        console.error(`❌ Falha com modelo ${modelConfig.name}:`, modelError.message);

        if (isTimeoutError(modelError)) {
          console.log(`⏱️ Timeout detectado com ${modelConfig.name}`);

          if (attemptNumber < activeModels.length) {
            console.log(`🔄 Tentando próximo modelo disponível...`);
            continue;
          } else {
            console.log(`⏱️ Timeout no último modelo, agendando retry...`);
            await scheduleRetry(supabase, processo_id!, analysis_result_id!, modelError);

            return new Response(
              JSON.stringify({
                success: false,
                error: 'Timeout em todos os modelos - retry agendado',
                timeout: true,
                retry_scheduled: true,
                processo_id,
                analysis_result_id,
                attempts: attemptNumber,
              }),
              { status: 408, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        if (attemptNumber < activeModels.length) {
          console.log(`🔄 Tentando próximo modelo (${attemptNumber + 1}/${activeModels.length})...`);
          continue;
        }

        console.error(`❌ Todos os ${activeModels.length} modelos falharam`);
        break;
      }
    }

    console.error(`💥 Nenhum modelo conseguiu processar o prompt`);

    if (analysis_result_id) {
      await supabase
        .from('analysis_results')
        .update({
          status: 'failed',
          processing_at: null,
          error_message: `Todos os modelos falharam. Último erro: ${lastError?.message || 'Unknown'}`,
        })
        .eq('id', analysis_result_id);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: `Falha em todos os ${activeModels.length} modelo(s) disponíveis`,
        last_error: lastError?.message,
        attempts: attemptNumber,
        processo_id,
        analysis_result_id,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('💥 ERRO CRÍTICO:', error);
    console.error('Stack:', error?.stack);

    if (analysis_result_id) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        if (isTimeoutError(error)) {
          console.log('⏱️ Timeout detectado no catch geral, agendando retry...');
          await scheduleRetry(supabase, processo_id!, analysis_result_id, error);

          return new Response(
            JSON.stringify({
              success: false,
              error: 'Timeout - retry agendado automaticamente',
              timeout: true,
              retry_scheduled: true,
              processo_id,
              analysis_result_id,
            }),
            { status: 408, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        await supabase
          .from('analysis_results')
          .update({
            status: 'failed',
            processing_at: null,
            error_message: error?.message || 'Erro desconhecido',
          })
          .eq('id', analysis_result_id);

        console.log(`🔓 Lock liberado para analysis_result: ${analysis_result_id}`);
      } catch (unlockError) {
        console.error('❌ Erro ao liberar lock:', unlockError);
      }
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || 'Erro desconhecido',
        processo_id,
        analysis_result_id,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});