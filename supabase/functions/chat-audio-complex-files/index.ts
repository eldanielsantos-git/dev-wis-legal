/**
 * EDGE FUNCTION: chat-audio-complex-files
 *
 * Processa mensagens de áudio para arquivos COMPLEXOS (>= 1000 páginas ou com análises consolidadas).
 * Usa análises consolidadas ou chunks do Gemini File API.
 *
 * VARIÁVEIS SUPORTADAS NOS PROMPTS:
 *
 * Usuário:
 * - {{USUARIO_NOME}} / {user_full_name}  → Nome completo
 * - {user_first_name}                    → Primeiro nome
 * - {user_last_name}                     → Sobrenome
 * - {{USUARIO_EMAIL}} / {user_email}     → Email
 * - {{USUARIO_OAB}} / {user_oab}         → OAB (ou "N/A")
 * - {user_cpf}                           → CPF (ou "N/A")
 * - {user_city}                          → Cidade (ou "N/A")
 * - {user_state}                         → Estado (ou "N/A")
 * - {user_phone}                         → Telefone (ou "N/A")
 * - {user_phone_country_code}            → Código do país (padrão: +55)
 *
 * Processo:
 * - {processo_name}                      → Nome do arquivo
 * - {total_pages}                        → Total de páginas
 * - {chunks_count}                       → Número de chunks
 *
 * Sistema:
 * - {{DATA_HORA_ATUAL}}                  → Data/hora atual em Brasília
 */

import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { GoogleGenerativeAI } from 'npm:@google/generative-ai@0.24.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

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

interface RequestBody {
  processo_id: string;
  audio_data: string;
  audio_duration?: number;
}

function removeIntroductoryPhrases(text: string): string {
  let cleaned = text.trim();

  const introPatterns = [
    /^(Com certeza[.!]?\s*)/i,
    /^(Claro[.!]?\s*)/i,
    /^(Vou elaborar[^.!]*[.!]\s*)/i,
    /^(Com base [^.!]*[.!]\s*)/i,
    /^(Elaboro abaixo[^.!]*[.!]\s*)/i,
    /^(Segue[^.!]*[.!]\s*)/i,
    /^(Apresento[^.!]*[.!]\s*)/i,
    /^(Vou analisar[^.!]*[.!]\s*)/i,
    /^(Baseado [^.!]*[.!]\s*)/i,
    /^(Considerando [^.!]*[.!]\s*)/i,
    /^(Após análise[^.!]*[.!]\s*)/i,
    /^(De acordo com[^.!]*[.!]\s*)/i,
  ];

  for (const pattern of introPatterns) {
    if (pattern.test(cleaned)) {
      cleaned = cleaned.replace(pattern, '').trim();
      break;
    }
  }

  const lines = cleaned.split('\n');

  if (lines.length > 0) {
    const firstLine = lines[0].trim();
    const lowerFirstLine = firstLine.toLowerCase();

    const skipPhrases = [
      'com certeza',
      'claro',
      'vou elaborar',
      'com base',
      'elaboro abaixo',
      'segue',
      'apresento',
      'vou analisar',
      'baseado',
      'considerando',
      'após análise',
    ];

    const shouldSkipFirstLine = skipPhrases.some(phrase =>
      lowerFirstLine.includes(phrase) && firstLine.length < 200
    );

    if (shouldSkipFirstLine) {
      lines.shift();
      cleaned = lines.join('\n').trim();
    }
  }

  return cleaned;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log('[chat-audio-complex-files] Starting audio processing for complex files');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

    if (!geminiApiKey) {
      console.error('[chat-audio-complex-files] GEMINI_API_KEY not configured');
      throw new Error('GEMINI_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[chat-audio-complex-files] Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('[chat-audio-complex-files] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid authorization token' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[chat-audio-complex-files] User authenticated:', user.id);

    const { processo_id, audio_data, audio_duration }: RequestBody = await req.json();

    if (!processo_id || !audio_data) {
      console.error('[chat-audio-complex-files] Missing parameters');
      return new Response(
        JSON.stringify({ error: 'Missing processo_id or audio_data' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[chat-audio-complex-files] Processing for processo:', processo_id);

    const { data: processo, error: processoError } = await supabase
      .from('processos')
      .select('*')
      .eq('id', processo_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (processoError || !processo) {
      console.error('[chat-audio-complex-files] Processo error:', processoError);
      return new Response(
        JSON.stringify({ error: 'Processo not found or access denied' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[chat-audio-complex-files] Processing audio data');

    try {
      const audioBuffer = Uint8Array.from(atob(audio_data), c => c.charCodeAt(0));
      const timestamp = Date.now();

      const { data: modelConfig, error: modelError } = await supabase
        .from('admin_chat_models')
        .select('*')
        .eq('is_active', true)
        .order('priority', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (modelError || !modelConfig) {
        console.error('[chat-audio-complex-files] Model config error:', modelError);
        throw new Error('No active chat model configuration found');
      }

      const modelId = modelConfig.system_model;
      console.log('[chat-audio-complex-files] Using chat model:', modelConfig.model_name, '(', modelId, ')');

      const genAI = new GoogleGenerativeAI(geminiApiKey);

      console.log('[chat-audio-complex-files] Transcribing audio with Gemini');
      const maxOutputTokens = await getMaxOutputTokens(supabase, 'chat_audio_complex', 16384);
      const model = genAI.getGenerativeModel({
        model: modelId,
        generationConfig: {
          maxOutputTokens: maxOutputTokens,
          temperature: 0.2
        }
      });

      const transcriptionResult = await model.generateContent([
        {
          inlineData: {
            mimeType: 'audio/webm',
            data: audio_data
          }
        },
        { text: 'Transcreva este áudio em português. Forneça apenas o texto transcrito, sem formatação adicional.' }
      ]);

      const transcription = transcriptionResult.response.text();
      console.log('[chat-audio-complex-files] Transcription:', transcription);

      console.log('[chat-audio-complex-files] Uploading audio to storage');
      const storageFileName = `${user.id}/${processo_id}_${timestamp}.webm`;

      const { error: uploadError } = await supabase.storage
        .from('chat-audios')
        .upload(storageFileName, audioBuffer, {
          contentType: 'audio/webm',
          upsert: false
        });

      if (uploadError) {
        console.error('[chat-audio-complex-files] Upload error:', uploadError);
      }

      const { data: signedUrlData } = await supabase.storage
        .from('chat-audios')
        .createSignedUrl(storageFileName, 60 * 60 * 24 * 365);

      const audioUrl = signedUrlData?.signedUrl || '';

      const userMessageId = crypto.randomUUID();
      const { error: userMessageError } = await supabase
        .from('chat_messages')
        .insert({
          id: userMessageId,
          processo_id,
          user_id: user.id,
          role: 'user',
          content: transcription,
          audio_url: audioUrl,
          audio_duration,
          is_audio: true
        });

      if (userMessageError) {
        console.error('[chat-audio-complex-files] Error saving user message:', userMessageError);
      }

      console.log('[chat-audio-complex-files] User message saved');

      const { data: analysisResults, error: analysisError } = await supabase
        .from('analysis_results')
        .select('prompt_title, result_content, execution_order')
        .eq('processo_id', processo_id)
        .eq('status', 'completed')
        .not('result_content', 'is', null)
        .order('execution_order', { ascending: true });

      let useConsolidatedAnalysis = false;
      let useChunks = false;
      let chunks: any[] = [];
      const isComplexFile = processo.total_pages >= 1000;

      if (analysisResults && analysisResults.length >= 7) {
        useConsolidatedAnalysis = true;
        console.log(`[chat-audio-complex-files] Using consolidated analysis: ${analysisResults.length} analyses found`);
      } else if (isComplexFile) {
        console.log(`[chat-audio-complex-files] Complex file (>= 1000 pages) but analysis not complete (${analysisResults?.length || 0}/7)`);
        return new Response(
          JSON.stringify({
            transcription,
            audio_url: audioUrl,
            error: 'Analise ainda em andamento',
            details: `Este processo complexo (${processo.total_pages} paginas) requer que a analise esteja completa para o chat. Aguarde a finalizacao da analise.`
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      } else if (processo.is_chunked && processo.total_chunks_count > 0) {
        useChunks = true;
        console.log(`[chat-audio-complex-files] Large file (< 1000 pages, chunked): ${processo.total_chunks_count} chunks`);

        const { data: chunksData, error: chunksError } = await supabase
          .from('process_chunks')
          .select('chunk_index, start_page, end_page, gemini_file_uri, pages_count, status')
          .eq('processo_id', processo_id)
          .eq('status', 'completed')
          .order('chunk_index', { ascending: true });

        chunks = chunksData || [];

        if (chunksError) {
          console.error('[chat-audio-complex-files] Error fetching chunks:', chunksError);
        }

        const chunksWithValidUris = chunks.filter(c => c.gemini_file_uri && c.gemini_file_uri.trim() !== '');
        if (chunksWithValidUris.length === 0) {
          console.log('[chat-audio-complex-files] No valid chunk URIs available');
          useChunks = false;
        } else {
          console.log(`[chat-audio-complex-files] Found ${chunksWithValidUris.length} chunks with valid URIs`);
        }
      }

      if (!useConsolidatedAnalysis && !useChunks) {
        console.log('[chat-audio-complex-files] No analyses or chunks available');
        return new Response(
          JSON.stringify({
            transcription,
            audio_url: audioUrl,
            response: 'Audio recebido e transcrito com sucesso. O processo ainda esta sendo analisado. Aguarde a conclusao para fazer perguntas sobre o conteudo.'
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      console.log('[chat-audio-complex-files] Generating AI response');

      const { data: audioPromptData, error: promptError } = await supabase
        .from('chat_system_prompts')
        .select('system_prompt')
        .eq('prompt_type', 'audio_complex')
        .eq('is_active', true)
        .order('priority', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (promptError || !audioPromptData) {
        console.error('[chat-audio-complex-files] Error fetching audio complex prompt:', promptError);
        return new Response(
          JSON.stringify({
            error: 'Prompt de áudio para arquivos complexos não encontrado',
            details: 'Não há prompt ativo configurado para mensagens de áudio em arquivos complexos'
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('first_name, last_name, email, oab, cpf, city, state, phone, phone_country_code')
        .eq('id', user.id)
        .maybeSingle();

      const fullName = userProfile
        ? `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim() || 'Usuário'
        : 'Usuário';
      const firstName = userProfile?.first_name || 'Usuário';
      const lastName = userProfile?.last_name || '';

      let systemPrompt = audioPromptData.system_prompt;

      const now = new Date();
      const saoPauloTime = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        dateStyle: 'full',
        timeStyle: 'long'
      }).format(now);
      systemPrompt = systemPrompt.replace(/\{\{DATA_HORA_ATUAL\}\}/g, saoPauloTime);

      systemPrompt = systemPrompt.replace(/\{\{USUARIO_NOME\}\}/g, fullName);
      systemPrompt = systemPrompt.replace(/\{user_full_name\}/g, fullName);
      systemPrompt = systemPrompt.replace(/\{user_first_name\}/g, firstName);
      systemPrompt = systemPrompt.replace(/\{user_last_name\}/g, lastName);
      systemPrompt = systemPrompt.replace(/\{\{USUARIO_EMAIL\}\}/g, userProfile?.email || user.email || 'N/A');
      systemPrompt = systemPrompt.replace(/\{user_email\}/g, userProfile?.email || user.email || 'N/A');
      systemPrompt = systemPrompt.replace(/\{\{USUARIO_OAB\}\}/g, userProfile?.oab || 'N/A');
      systemPrompt = systemPrompt.replace(/\{user_oab\}/g, userProfile?.oab || 'N/A');
      systemPrompt = systemPrompt.replace(/\{user_cpf\}/g, userProfile?.cpf || 'N/A');
      systemPrompt = systemPrompt.replace(/\{user_city\}/g, userProfile?.city || 'N/A');
      systemPrompt = systemPrompt.replace(/\{user_state\}/g, userProfile?.state || 'N/A');
      systemPrompt = systemPrompt.replace(/\{user_phone\}/g, userProfile?.phone || 'N/A');
      systemPrompt = systemPrompt.replace(/\{user_phone_country_code\}/g, userProfile?.phone_country_code || '+55');
      systemPrompt = systemPrompt.replace(/\{processo_name\}/g, processo.nome_processo || processo.file_name);
      systemPrompt = systemPrompt.replace(/\{total_pages\}/g, String(processo.total_pages || 0));
      systemPrompt = systemPrompt.replace(/\{chunks_count\}/g, String(processo.total_chunks_count || 0));
      systemPrompt = systemPrompt.replace(/\{processo_number\}/g, '');

      console.log('[chat-audio-complex-files] System prompt prepared with user variables');

      let contextMessage: string;

      if (useConsolidatedAnalysis && analysisResults) {
        const analysisContext = analysisResults.map((analysis, index) =>
          `\n## ${index + 1}. ${analysis.prompt_title}\n\n${analysis.result_content}`
        ).join('\n\n---\n');

        contextMessage = `
# ANÁLISES CONSOLIDADAS DO PROCESSO

Este processo foi analisado em ${analysisResults.length} etapas especializadas. Abaixo estão os resultados completos:
${analysisContext}

---

# PERGUNTA DO USUÁRIO (TRANSCRIÇÃO DE ÁUDIO):
"${transcription}"

INSTRUÇÕES: Responda a pergunta acima baseando-se exclusivamente nas análises consolidadas fornecidas. Seja direto, objetivo e cite qual análise você usou quando relevante.`;

        console.log(`[chat-audio-complex-files] Using consolidated analysis context with ${analysisResults.length} analyses`);
      } else {
        contextMessage = `
Pergunta do usuário (transcrição de áudio): "${transcription}"

Responda de forma direta, clara e objetiva com base no documento do processo.`;
      }

      const chatMaxOutputTokens = await getMaxOutputTokens(supabase, 'chat_audio_complex', 16384);
      const chatModel = genAI.getGenerativeModel({
        model: modelId,
        systemInstruction: systemPrompt,
        generationConfig: {
          maxOutputTokens: chatMaxOutputTokens,
          temperature: 0.2
        }
      });

      let chatResult;

      if (useConsolidatedAnalysis) {
        console.log('[chat-audio-complex-files] Sending consolidated analysis context (text only)');
        chatResult = await chatModel.generateContent([
          { text: contextMessage }
        ]);
      } else if (useChunks && chunks.length > 0) {
        const chunksWithValidUris = chunks.filter(c => c.gemini_file_uri && c.gemini_file_uri.trim() !== '');

        if (chunksWithValidUris.length > 0) {
          console.log(`[chat-audio-complex-files] Sending ${chunksWithValidUris.length} chunks as fileData (URIs)`);

          const messageParts: any[] = chunksWithValidUris.map(chunk => ({
            fileData: {
              mimeType: 'application/pdf',
              fileUri: chunk.gemini_file_uri
            }
          }));

          messageParts.push({ text: contextMessage });

          chatResult = await chatModel.generateContent(messageParts);
        } else {
          console.log('[chat-audio-complex-files] No valid chunk URIs, sending text only');
          chatResult = await chatModel.generateContent([
            { text: contextMessage }
          ]);
        }
      } else {
        console.log('[chat-audio-complex-files] Sending text only (no data available)');
        chatResult = await chatModel.generateContent([
          { text: contextMessage }
        ]);
      }

      let assistantResponse = chatResult.response.text();
      assistantResponse = removeIntroductoryPhrases(assistantResponse);
      console.log('[chat-audio-complex-files] AI response generated');

      const assistantMessageId = crypto.randomUUID();
      await supabase
        .from('chat_messages')
        .insert({
          id: assistantMessageId,
          processo_id,
          user_id: user.id,
          role: 'assistant',
          content: assistantResponse
        });

      console.log('[chat-audio-complex-files] Assistant message saved');

      return new Response(
        JSON.stringify({
          transcription,
          audio_url: audioUrl,
          response: assistantResponse
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );

    } catch (processingError) {
      console.error('[chat-audio-complex-files] Processing error:', processingError);
      throw processingError;
    }

  } catch (error) {
    console.error('[chat-audio-complex-files] Fatal error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : '';
    console.error('[chat-audio-complex-files] Error stack:', errorStack);

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: errorMessage,
        stack: errorStack
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});