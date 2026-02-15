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
  retry_count?: number;
  max_retries?: number;
}

interface ProcessoData {
  id: string;
  file_name: string;
  user_id: string;
  created_at: string;
  is_chunked: boolean;
  total_chunks: number | null;
  total_chunks_count?: number;
  file_path: string | null;
  gemini_file_uri: string | null;
  gemini_file_state: string | null;
  gemini_file_mime_type: string | null;
  upload_method: 'base64' | 'file_uri' | 'wis-api' | null;
  pdf_base64?: string | null;
}

interface ProcessChunk {
  id: string;
  chunk_index: number;
  gemini_file_uri: string | null;
  gemini_file_state: string | null;
}

interface ModelConfig {
  id: string;
  name: string;
  display_name: string | null;
  model_id: string;
  system_model: string | null;
  temperature: number;
  max_tokens: number;
  priority: number;
}

async function sendWhatsAppNotification(
  supabaseUrl: string,
  supabaseServiceKey: string,
  messageKey: string,
  userId: string,
  phone: string,
  processoId?: string,
  replacements?: Record<string, string>,
  documentBase64?: string,
  documentFilename?: string,
  linkUrl?: string,
  linkTitle?: string,
  linkDescription?: string
): Promise<void> {
  try {
    await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        message_key: messageKey,
        user_id: userId,
        processo_id: processoId,
        phone,
        replacements,
        document_base64: documentBase64,
        document_filename: documentFilename,
        link_url: linkUrl,
        link_title: linkTitle,
        link_description: linkDescription,
      }),
    });
  } catch (error) {
    console.error(`[process-next-prompt] Error sending WhatsApp notification:`, error);
  }
}

async function getActiveModels(supabase: any): Promise<ModelConfig[]> {
  const { data: models, error } = await supabase
    .from('admin_system_models')
    .select('id, name, display_name, model_id, system_model, temperature, model_config, priority')
    .eq('is_active', true)
    .order('priority', { ascending: true });

  if (error || !models || models.length === 0) {
    throw new Error('Nenhum modelo ativo encontrado');
  }

  return models.map((m: any) => ({
    id: m.id,
    name: m.name,
    display_name: m.display_name,
    model_id: m.system_model || m.model_id,
    system_model: m.system_model,
    temperature: m.temperature || 0.2,
    max_tokens: m.model_config?.max_tokens || 60000,
    priority: m.priority || 0,
  }));
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
    .maybeSingle();

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
  model: ModelConfig,
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
    .maybeSingle();

  if (processo?.user_id) {
    await supabase
      .from('notifications')
      .insert({
        user_id: processo.user_id,
        type: 'model_switch',
        message: `Troca de modelo: ${fromModel} → ${toModel}. Motivo: ${reason}`,
        processo_id: processoId,
      });
  }
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

async function ensureChunksUploaded(
  supabase: any,
  supabaseUrl: string,
  supabaseServiceKey: string,
  processo_id: string,
  callId: string
): Promise<ProcessChunk[]> {
  const { data: chunks, error: chunksError } = await supabase
    .from('process_chunks')
    .select('id, chunk_index, gemini_file_uri, gemini_file_state')
    .eq('processo_id', processo_id)
    .order('chunk_index', { ascending: true });

  if (chunksError || !chunks || chunks.length === 0) {
    throw new Error('Chunks não encontrados');
  }

  console.log(`[${callId}] 🔍 Verificando uploads de ${chunks.length} chunks...`);

  for (const chunk of chunks) {
    if (!chunk.gemini_file_uri || chunk.gemini_file_state !== 'ACTIVE') {
      console.log(`[${callId}] 📤 Upload necessário para chunk ${chunk.chunk_index}/${chunks.length}`);

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
        console.log(`[${callId}] ✅ Chunk ${chunk.chunk_index} enviado: ${uploadData.file_uri}`);

        chunk.gemini_file_uri = uploadData.file_uri;
        chunk.gemini_file_state = 'ACTIVE';
      } catch (uploadError: any) {
        console.error(`[${callId}] ❌ Erro no upload do chunk ${chunk.chunk_index}:`, uploadError);
        throw new Error(`Falha no upload do chunk ${chunk.chunk_index}: ${uploadError.message}`);
      }
    } else {
      console.log(`[${callId}] ✅ Chunk ${chunk.chunk_index} já enviado`);
    }
  }

  console.log(`[${callId}] ✅ Todos os chunks prontos para processamento`);
  return chunks as ProcessChunk[];
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

  if (processo.file_path) {
    console.log('📥 Baixando PDF do Storage...');

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

    const base64 = btoa(binary);
    console.log(`✅ PDF convertido para base64: ${(base64.length / 1024 / 1024).toFixed(2)}MB`);
    return base64;
  }

  throw new Error('Nenhuma fonte de PDF disponível (file_path não encontrado)');
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
  const callId = crypto.randomUUID().slice(0, 8);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')!;

    if (!supabaseUrl || !supabaseServiceKey || !geminiApiKey) {
      throw new Error('Variáveis de ambiente ausentes');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }

    const body = await req.json();
    processo_id = body.processo_id;

    if (!processo_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'processo_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`\n[${callId}] ========== PROCESS-NEXT-PROMPT START ==========`);
    console.log(`[${callId}] Processo ID: ${processo_id}`);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');
    const isServiceKeyCall = token === supabaseServiceKey;

    if (!isServiceKeyCall) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);

      if (authError || !user) {
        throw new Error('Unauthorized');
      }
    } else {
      console.log(`[${callId}] 🔑 Chamada interna com service key detectada`);
    }
    const genAI = new GoogleGenerativeAI(geminiApiKey);

    console.log(`[${callId}] 📋 Obtendo próximo prompt para processo ${processo_id}...`);

    const { data: processo, error: processoError } = await supabase
      .from('processos')
      .select('id, file_name, user_id, created_at, status, is_chunked, total_chunks, total_chunks_count, file_path, gemini_file_uri, gemini_file_state, gemini_file_mime_type, upload_method')
      .eq('id', processo_id)
      .single();

    if (processoError || !processo) {
      throw new Error(`Processo não encontrado: ${processo_id}`);
    }

    const processoData = processo as ProcessoData;

    if (processoData.status === 'completed') {
      console.log(`[${callId}] ✅ Processo já concluído`);
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

    const now = new Date().toISOString();
    const lockTimeout = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const { data: lockResult, error: lockError } = await supabase
      .rpc('acquire_next_prompt_lock', {
        p_processo_id: processo_id,
        p_now: now,
        p_lock_timeout: lockTimeout
      });

    if (lockError) {
      console.error(`[${callId}] ❌ Erro ao obter lock:`, lockError);
      return new Response(
        JSON.stringify({ success: false, error: 'Falha ao obter lock' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!lockResult || !Array.isArray(lockResult) || lockResult.length === 0) {
      console.log(`[${callId}] ⏭️ Nenhum prompt pendente ou já em processamento`);
      return new Response(
        JSON.stringify({ success: true, message: 'Nenhum prompt disponível' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const analysisResult = lockResult[0] as AnalysisResult;
    analysis_result_id = analysisResult.id;

    console.log(`[${callId}] ✅ Lock obtido para: ${analysisResult.prompt_title}`);
    console.log(`[${callId}]    - Analysis Result ID: ${analysis_result_id}`);
    console.log(`[${callId}]    - Execution Order: ${analysisResult.execution_order}`);
    console.log(`[${callId}]    - Retry Count: ${analysisResult.retry_count || 0}/${analysisResult.max_retries || 3}`);

    console.log(`[${callId}] 📄 Processo: ${processoData.file_name}`);
    console.log(`[${callId}] 📝 Prompt: ${analysisResult.prompt_title}`);
    console.log(`[${callId}]    - Is chunked: ${processoData.is_chunked}`);
    console.log(`[${callId}]    - Upload method: ${processoData.upload_method || 'legacy (null)'}`);
    console.log(`[${callId}] 🏃 Prompt já marcado como 'processing' pela função acquire_next_prompt_lock`);

    let useFileApi: boolean;

    if (processoData.is_chunked) {
      useFileApi = (processoData.total_chunks_count || 0) > 0;
    } else if (processoData.upload_method === 'base64') {
      useFileApi = false;
      console.log(`[${callId}] 📦 upload_method=base64 detectado - usando Base64 inline (otimizado)`);
    } else if (processoData.upload_method === 'file_uri') {
      useFileApi = processoData.gemini_file_uri !== null && processoData.gemini_file_state === 'ACTIVE';
      console.log(`[${callId}] 📂 upload_method=file_uri detectado - usando File API`);
    } else if (processoData.upload_method === 'wis-api') {
      useFileApi = processoData.gemini_file_uri !== null && processoData.gemini_file_state === 'ACTIVE';
      console.log(`[${callId}] 📱 upload_method=wis-api detectado - usando ${useFileApi ? 'File API' : 'Base64'}`);
    } else {
      useFileApi = processoData.gemini_file_uri !== null && processoData.gemini_file_state === 'ACTIVE';
      console.log(`[${callId}] ⚠️ upload_method não definido (registro legado) - fallback para lógica anterior`);
    }

    let chunks: ProcessChunk[] | null = null;

    if (useFileApi && processoData.is_chunked && (processoData.total_chunks_count || 0) > 0) {
      console.log(`[${callId}] 📂 Usando File API do Gemini para chunks`);
      chunks = await ensureChunksUploaded(supabase, supabaseUrl, supabaseServiceKey, processo_id, callId);
    } else if (!useFileApi) {
      console.log(`[${callId}] 📦 Usando Base64 inline`);
    }

    const activeModels = await getActiveModels(supabase);
    console.log(`[${callId}] 🤖 ${activeModels.length} modelo(s) ativo(s) disponível(is)`);

    const contextKey = processoData.is_chunked ? 'analysis_complex_files' : 'analysis_small_files';

    let lastError: any = null;
    let attemptNumber = 0;

    for (const modelConfig of activeModels) {
      attemptNumber++;
      let startTime = 0;

      const modelName = modelConfig.display_name || modelConfig.name;
      const modelId = modelConfig.system_model || modelConfig.model_id;
      const temperature = modelConfig.temperature ?? 0.2;

      console.log(`\n[${callId}] 🔍 Tentativa ${attemptNumber}/${activeModels.length}: ${modelName}`);

      await updateProcessoModelInfo(
        supabase,
        processo_id,
        modelConfig.id,
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
        console.log(`[${callId}] 📢 Notificação de troca de modelo enviada`);
      }

      try {
        const configuredMaxTokens = await getMaxOutputTokens(
          supabase,
          contextKey,
          modelConfig.max_tokens
        );

        console.log(`[${callId}]    - Model ID: ${modelId}`);
        console.log(`[${callId}]    - Temperature: ${temperature}`);
        console.log(`[${callId}]    - Max Tokens: ${configuredMaxTokens}`);

        startTime = Date.now();

        const model = genAI.getGenerativeModel({
          model: modelId,
        });

        console.log(`[${callId}] 🚀 Enviando prompt para Gemini...`);

        if (!analysisResult.prompt_content || analysisResult.prompt_content.trim() === '') {
          throw new Error('Prompt content is empty or invalid');
        }

        let result;
        let totalTokensUsed = 0;

        if (useFileApi && chunks && chunks.length >= 3) {
          console.log(`[${callId}] ⚡ Processando ${chunks.length} chunks individualmente`);

          const chunkResults: string[] = [];

          for (const chunk of chunks) {
            if (!chunk.gemini_file_uri) {
              throw new Error(`Chunk ${chunk.chunk_index} não foi enviado para Gemini`);
            }

            console.log(`[${callId}] 📄 Processando chunk ${chunk.chunk_index}/${chunks.length}...`);

            const chunkParts = [
              {
                fileData: {
                  mimeType: 'application/pdf',
                  fileUri: chunk.gemini_file_uri,
                },
              },
              {
                text: `${analysisResult.prompt_content}\n\nIMPORTANTE: Esta é a parte ${chunk.chunk_index} de ${chunks.length} do documento. Analise apenas este trecho e forneça os resultados correspondentes.`
              }
            ];

            const chunkResult = await model.generateContent({
              contents: [{ role: 'user', parts: chunkParts }],
              systemInstruction: analysisResult.system_prompt || undefined,
              generationConfig: {
                temperature,
                maxOutputTokens: configuredMaxTokens,
                responseMimeType: 'application/json',
              },
            });

            const chunkResponse = await chunkResult.response;
            let chunkText = chunkResponse.text().trim();

            const chunkTokens = chunkResponse.usageMetadata?.totalTokenCount || 0;
            totalTokensUsed += chunkTokens;

            console.log(`[${callId}] ✅ Chunk ${chunk.chunk_index} processado: ${chunkTokens} tokens`);

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

          console.log(`[${callId}] 🔄 Combinando resultados de ${chunks.length} chunks...`);

          const combinationPrompt = `Você está combinando ${chunks.length} análises parciais de um documento dividido em partes.\n\nANÁLISES PARCIAIS:\n${chunkResults.map((r, i) => `=== PARTE ${i + 1} ===\n${r}`).join('\n\n')}\n\nTAREFA: Combine essas análises em uma única análise completa e coerente, removendo duplicações e garantindo consistência.\n\nIMPORTANTE: Responda APENAS com o JSON ou conteúdo estruturado. NÃO inclua texto introdutório como "Com base na consolidação..." ou explicações. Inicie sua resposta DIRETAMENTE com o formato esperado (ex: começando com "{" para JSON).`;

          const combinationResult = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: combinationPrompt }] }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: configuredMaxTokens,
            },
          });

          result = combinationResult;
          const combinationTokens = combinationResult.response.usageMetadata?.totalTokenCount || 0;
          totalTokensUsed += combinationTokens;

          console.log(`[${callId}] ✅ Combinação concluída: ${combinationTokens} tokens`);
          console.log(`[${callId}] 📊 Total de tokens: ${totalTokensUsed}`);
        } else if (useFileApi && chunks) {
          console.log(`[${callId}] 📂 Processando ${chunks.length} chunks com File API`);

          const parts: any[] = [];

          for (const chunk of chunks) {
            if (!chunk.gemini_file_uri) {
              throw new Error(`Chunk ${chunk.chunk_index} não foi enviado para Gemini`);
            }

            parts.push({
              fileData: {
                mimeType: 'application/pdf',
                fileUri: chunk.gemini_file_uri,
              },
            });
          }

          parts.push({ text: analysisResult.prompt_content });

          result = await model.generateContent({
            contents: [{ role: 'user', parts }],
            systemInstruction: analysisResult.system_prompt || undefined,
            generationConfig: {
              temperature,
              maxOutputTokens: configuredMaxTokens,
              responseMimeType: 'application/json',
            },
          });
        } else if (useFileApi && processoData.gemini_file_uri) {
          console.log(`[${callId}] 📂 Processando com File API (arquivo único)`);

          result = await model.generateContent({
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    fileData: {
                      mimeType: processoData.gemini_file_mime_type,
                      fileUri: processoData.gemini_file_uri,
                    },
                  },
                  { text: analysisResult.prompt_content }
                ]
              }
            ],
            systemInstruction: analysisResult.system_prompt || undefined,
            generationConfig: {
              temperature,
              maxOutputTokens: configuredMaxTokens,
              responseMimeType: 'application/json',
            },
          });
        } else {
          console.log(`[${callId}] 📦 Processando com Base64 inline`);

          const pdfBase64Data = await loadPDFData(supabase, processoData, processo_id);

          if (!pdfBase64Data) {
            throw new Error('Falha ao carregar dados do PDF');
          }

          result = await model.generateContent({
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
              temperature,
              maxOutputTokens: configuredMaxTokens,
              responseMimeType: 'application/json',
            },
          });
        }

        const response = result.response;
        let text = response.text().trim();

        const executionTime = Date.now() - startTime;

        if (totalTokensUsed === 0) {
          totalTokensUsed = response.usageMetadata?.totalTokenCount || 0;
        }

        console.log(`[${callId}] ✅ Resposta recebida do Gemini`);
        console.log(`[${callId}]    - Tamanho: ${text.length} caracteres`);
        console.log(`[${callId}]    - Tokens: ${totalTokensUsed}`);
        console.log(`[${callId}]    - Tempo: ${executionTime}ms`);

        console.log(`[${callId}] 💾 SALVAMENTO FASE 1: Salvando conteúdo RAW + status completed...`);

        const { error: phase1Error } = await supabase
          .from('analysis_results')
          .update({
            status: 'completed',
            result_content: text,
            raw_received_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
          })
          .eq('id', analysis_result_id);

        if (phase1Error) {
          console.error(`[${callId}] ❌ CRÍTICO: Falha ao salvar conteúdo RAW:`, phase1Error);
          throw phase1Error;
        }

        console.log(`[${callId}] ✅ FASE 1 CONCLUÍDA: Conteúdo + status 'completed' salvos`);

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

        console.log(`[${callId}] 💾 SALVAMENTO FASE 2: Atualizando metadados...`);

        const { error: phase2Error } = await supabase
          .from('analysis_results')
          .update({
            status: 'completed',
            result_content: text,
            execution_time_ms: executionTime,
            tokens_used: totalTokensUsed,
            current_model_id: modelConfig.id,
            current_model_name: modelName,
            processing_at: null,
            completed_at: new Date().toISOString(),
          })
          .eq('id', analysis_result_id);

        if (phase2Error) {
          console.warn(`[${callId}] ⚠️ Falha ao atualizar metadados (conteúdo já salvo):`, phase2Error);
        } else {
          console.log(`[${callId}] ✅ FASE 2 CONCLUÍDA: Metadados atualizados`);
        }

        await supabase
          .from('processos')
          .update({ current_prompt_number: analysisResult.execution_order })
          .eq('id', processo_id);

        await addModelAttempt(supabase, processo_id, modelConfig.id, modelName, 'success');
        await recordExecution(supabase, processo_id, analysis_result_id, modelConfig, attemptNumber, 'success', null, null, executionTime);

        console.log(`[${callId}] ✅ Sucesso com modelo: ${modelName}`);

        const { data: promptsStatus, error: statusError } = await supabase
          .from('analysis_results')
          .select('status')
          .eq('processo_id', processo_id);

        if (statusError) {
          console.error(`[${callId}] ⚠️ Erro ao verificar status dos prompts:`, statusError);
        }

        const totalPrompts = promptsStatus?.length || 0;
        const completedPrompts = promptsStatus?.filter(p => p.status === 'completed').length || 0;
        const pendingPrompts = promptsStatus?.filter(p => p.status === 'pending').length || 0;
        const runningPrompts = promptsStatus?.filter(p => p.status === 'processing').length || 0;

        console.log(`[${callId}] 📊 Status dos prompts: ${completedPrompts}/${totalPrompts} concluídos, ${pendingPrompts} pendentes, ${runningPrompts} em execução`);

        const allPromptsCompleted = totalPrompts > 0 && completedPrompts === totalPrompts;
        const hasMoreToProcess = pendingPrompts > 0 || runningPrompts > 0;

        if (pendingPrompts > 0 && runningPrompts === 0) {
          console.log(`[${callId}] 🔄 Disparando processamento do próximo prompt...`);

          const dispatchNextPrompt = async (retries = 3) => {
            for (let attempt = 1; attempt <= retries; attempt++) {
              try {
                const response = await fetch(`${supabaseUrl}/functions/v1/process-next-prompt`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${supabaseServiceKey}`,
                  },
                  body: JSON.stringify({ processo_id }),
                });

                if (response.ok) {
                  console.log(`[${callId}] ✅ Próximo prompt disparado com sucesso`);
                  return;
                } else {
                  console.warn(`[${callId}] ⚠️ Resposta não-OK ao disparar próximo prompt (tentativa ${attempt}/${retries}): ${response.status}`);
                }
              } catch (err: any) {
                console.error(`[${callId}] ❌ Erro ao disparar próximo prompt (tentativa ${attempt}/${retries}):`, err?.message);
              }

              if (attempt < retries) {
                await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
              }
            }

            console.error(`[${callId}] 💥 FALHA CRÍTICA: Não foi possível disparar próximo prompt após ${retries} tentativas`);
            await supabase
              .from('processos')
              .update({ status: 'analyzing' })
              .eq('id', processo_id);
          };

          dispatchNextPrompt().catch(err => {
            console.error(`[${callId}] 💥 Erro fatal no dispatchNextPrompt:`, err);
          });
        } else if (hasMoreToProcess && runningPrompts > 0) {
          console.log(`[${callId}] ⏳ Há mais prompts pendentes, mas um já está em execução. Aguardando...`);
        } else if (allPromptsCompleted) {
          console.log(`[${callId}] 🎉 Todos os ${totalPrompts} prompts concluídos com sucesso! Finalizando processo...`);

          const { data: processoInfo } = await supabase
            .from('processos')
            .select('transcricao')
            .eq('id', processo_id)
            .single();

          const totalPages = processoInfo?.transcricao?.totalPages || 0;
          console.log(`[${callId}] 📄 Total de páginas processadas: ${totalPages}`);

          const { error: processoUpdateError } = await supabase
            .from('processos')
            .update({
              status: 'completed',
              pages_processed_successfully: totalPages,
              analysis_completed_at: new Date().toISOString(),
            })
            .eq('id', processo_id);

          if (processoUpdateError) {
            console.error(`[${callId}] ❌ Erro ao atualizar status do processo:`, processoUpdateError);
          } else {
            console.log(`[${callId}] ✅ Processo marcado como completed`);
          }

          const { error: notificationError } = await supabase.from('notifications').insert({
            user_id: processoData.user_id,
            type: 'analysis_completed',
            message: 'Análise de documento concluída com sucesso',
            processo_id: processo_id,
          });

          if (notificationError) {
            console.error(`[${callId}] ❌ Erro ao criar notificação:`, notificationError);
          } else {
            console.log(`[${callId}] 📩 Notificação criada para o usuário`);
          }

          console.log(`[${callId}] 📧 Enviando email de processo concluído...`);
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
              console.log(`[${callId}] ✅ Email enviado:`, emailResult.resend_id);
            } else {
              const errorText = await emailResponse.text();
              console.error(`[${callId}] ❌ Falha ao enviar email:`, errorText);
            }
          } catch (emailError) {
            console.error(`[${callId}] ❌ Erro ao chamar edge function de email:`, emailError);
          }

          console.log(`[${callId}] 🔔 Enviando notificação administrativa Slack...`);

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

          const startTime = new Date(processoData.created_at);
          const endTime = new Date();
          const durationMs = endTime.getTime() - startTime.getTime();
          const durationMinutes = Math.floor(durationMs / 60000);
          const durationSeconds = Math.floor((durationMs % 60000) / 1000);
          const durationText = durationMinutes > 0
            ? `${durationMinutes}m ${durationSeconds}s`
            : `${durationSeconds}s`;

          notifyAdminSafe({
            type: 'analysis_completed',
            title: 'Análise Concluída',
            message: `${userName || userEmail} | ${fileName} | ${durationText}`,
            severity: 'success',
            metadata: {
              processo_id,
              file_name: fileName,
              user_email: userEmail,
              user_name: userName || userEmail,
              duration: durationText,
              is_complex: processoData.is_chunked,
            },
            userId: processoData.user_id,
            processoId: processo_id,
          });

          if (processoData.upload_method === 'wis-api') {
            console.log(`[${callId}] 📱 Processo via WIS API - enviando notificações WhatsApp...`);

            const { data: userProfileForWhatsApp } = await supabase
              .from('user_profiles')
              .select('first_name, phone, phone_country_code')
              .eq('id', processoData.user_id)
              .maybeSingle();

            if (userProfileForWhatsApp?.phone) {
              const fullPhone = `${(userProfileForWhatsApp.phone_country_code || '+55').replace('+', '')}${userProfileForWhatsApp.phone}`;
              const userFirstName = userProfileForWhatsApp.first_name || 'Usuario';

              const { data: pdfData } = await supabase
                .from('processos')
                .select('pdf_base64')
                .eq('id', processo_id)
                .maybeSingle();

              if (pdfData?.pdf_base64) {
                EdgeRuntime.waitUntil(
                  sendWhatsAppNotification(
                    supabaseUrl,
                    supabaseServiceKey,
                    'analysis_completed',
                    processoData.user_id,
                    fullPhone,
                    processo_id,
                    { nome: userFirstName },
                    pdfData.pdf_base64,
                    `analise-${processoData.file_name || 'processo'}.pdf`
                  )
                );
              }

              const chatUrl = `https://app.wislegal.io/chat/${processo_id}`;
              EdgeRuntime.waitUntil(
                sendWhatsAppNotification(
                  supabaseUrl,
                  supabaseServiceKey,
                  'chat_link',
                  processoData.user_id,
                  fullPhone,
                  processo_id,
                  { nome: userFirstName, chat_url: chatUrl },
                  undefined,
                  undefined,
                  chatUrl,
                  'Wis Legal Chat',
                  'Converse sobre seu processo e tire duvidas'
                )
              );

              const detailUrl = `https://app.wislegal.io/lawsuits-detail/${processo_id}`;
              EdgeRuntime.waitUntil(
                sendWhatsAppNotification(
                  supabaseUrl,
                  supabaseServiceKey,
                  'detail_link',
                  processoData.user_id,
                  fullPhone,
                  processo_id,
                  { nome: userFirstName, detail_url: detailUrl },
                  undefined,
                  undefined,
                  detailUrl,
                  'Detalhes da Analise',
                  'Veja todos os detalhes e gerencie compartilhamento'
                )
              );

              console.log(`[${callId}] ✅ Notificações WhatsApp enviadas`);
            }
          }

          console.log(`[${callId}] ✅ Processo finalizado com sucesso!`);
        }

        console.log(`[${callId}] ========== PROCESS-NEXT-PROMPT END ==========\n`);

        return new Response(
          JSON.stringify({
            success: true,
            analysis_result_id,
            prompt_title: analysisResult.prompt_title,
            execution_order: analysisResult.execution_order,
            tokens_used: totalTokensUsed,
            execution_time_ms: executionTime,
            has_more_prompts: hasMoreToProcess,
            model_used: modelName,
            attempt_number: attemptNumber,
            method: useFileApi ? 'file_api' : 'base64_inline',
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      } catch (modelError: any) {
        const executionTime = Date.now() - startTime;
        lastError = modelError;
        console.error(`[${callId}] ❌ Falha com modelo ${modelName}:`, modelError.message);

        await addModelAttempt(supabase, processo_id, modelConfig.id, modelName, 'failed');
        await recordExecution(supabase, processo_id, analysis_result_id, modelConfig, attemptNumber, 'failed', modelError.message, modelError.code || null, executionTime);

        if (isTimeoutError(modelError)) {
          console.log(`[${callId}] ⏱️ Timeout detectado com ${modelName}`);

          if (attemptNumber < activeModels.length) {
            console.log(`[${callId}] 🔄 Tentando próximo modelo disponível...`);
            continue;
          } else {
            console.log(`[${callId}] ⏱️ Timeout no último modelo, agendando retry...`);
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
          console.log(`[${callId}] 🔄 Tentando próximo modelo (${attemptNumber + 1}/${activeModels.length})...`);
          continue;
        }

        console.error(`[${callId}] ❌ Todos os ${activeModels.length} modelos falharam`);
        break;
      }
    }

    console.error(`[${callId}] 💥 Nenhum modelo conseguiu processar o prompt`);

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
    console.error(`[${callId}] 💥 ERRO CRÍTICO:`, error);
    console.error(`[${callId}] Stack:`, error?.stack);

    if (analysis_result_id) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        if (isTimeoutError(error)) {
          console.log(`[${callId}] ⏱️ Timeout detectado no catch geral, agendando retry...`);
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

        console.log(`[${callId}] 🔓 Lock liberado para analysis_result: ${analysis_result_id}`);
      } catch (unlockError) {
        console.error(`[${callId}] ❌ Erro ao liberar lock:`, unlockError);
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