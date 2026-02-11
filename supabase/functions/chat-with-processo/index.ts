/**
 * EDGE FUNCTION: chat-with-processo
 *
 * Processa mensagens de chat com contexto de um processo jur\u00eddico.
 * Suporta arquivos pequenos (PDF completo) e grandes (chunks).
 */

import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { GoogleGenerativeAI } from 'npm:@google/generative-ai@0.24.1';
import { GoogleAIFileManager } from 'npm:@google/generative-ai@0.24.1/server';

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
      console.warn(`\u26a0\ufe0f Error fetching token limit for ${contextKey}, using fallback:`, error);
      return fallbackValue;
    }

    if (data) {
      console.log(`\u2705 Token limit for ${contextKey}: ${data.max_output_tokens}`);
      return data.max_output_tokens;
    }

    console.warn(`\u26a0\ufe0f No active token limit found for ${contextKey}, using fallback: ${fallbackValue}`);
    return fallbackValue;
  } catch (error) {
    console.warn(`\u26a0\ufe0f Exception fetching token limit for ${contextKey}, using fallback:`, error);
    return fallbackValue;
  }
}

interface RequestBody {
  processo_id: string;
  message: string;
}

function cleanMarkdownFromResponse(text: string): string {
  let cleaned = text.trim();

  if (cleaned.startsWith('```json') || cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```json\n?/, '').replace(/^```\n?/, '');
    cleaned = cleaned.replace(/\n?```$/, '');
    cleaned = cleaned.trim();
  }

  cleaned = cleaned.replace(/\*\*(.+?)\*\*/g, '$1');
  cleaned = cleaned.replace(/\*(.+?)\*/g, '$1');
  cleaned = cleaned.replace(/`(.+?)`/g, '$1');
  cleaned = cleaned.replace(/~~(.+?)~~/g, '$1');
  cleaned = cleaned.replace(/^#+\s*/gm, '');

  return cleaned;
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
    /^(Ap\u00f3s an\u00e1lise[^.!]*[.!]\s*)/i,
    /^(De acordo com[^.!]*[.!]\s*)/i,
    /^\([^)]*,?\s*elaboro[^)]*\)\s*/i,
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
      'elaboro o seguinte',
      'elaboro um',
      'segue',
      'apresento',
      'vou analisar',
      'baseado',
      'considerando',
      'ap\u00f3s an\u00e1lise',
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
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
      return new Response(
        JSON.stringify({ error: 'Invalid authorization token' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { processo_id, message }: RequestBody = await req.json();

    if (!processo_id || !message) {
      return new Response(
        JSON.stringify({ error: 'Missing processo_id or message' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: tokenAvailable, error: tokenCheckError } = await supabase.rpc(
      'check_token_availability',
      {
        p_user_id: user.id,
        p_tokens_needed: 100
      }
    );

    if (tokenCheckError) {
      console.error('\u274c Error checking token availability:', tokenCheckError);
      return new Response(
        JSON.stringify({
          error: 'Erro ao verificar saldo de tokens',
          details: tokenCheckError.message || 'Erro desconhecido'
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!tokenAvailable) {
      return new Response(
        JSON.stringify({
          error: 'Saldo de tokens insuficiente',
          details: 'Voc\u00ea n\u00e3o possui tokens suficientes para continuar o chat.'
        }),
        {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: processo, error: processoError } = await supabase
      .from('processos')
      .select('*')
      .eq('id', processo_id)
      .maybeSingle();

    if (processoError || !processo) {
      return new Response(
        JSON.stringify({ error: 'Processo not found or access denied' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: analysisResults, error: analysisError } = await supabase
      .from('analysis_results')
      .select('prompt_title, result_content, execution_order')
      .eq('processo_id', processo_id)
      .eq('status', 'completed')
      .not('result_content', 'is', null)
      .order('execution_order', { ascending: true });

    let promptType: 'consolidated_analysis' | 'small_file' | 'large_file_chunks' = 'small_file';
    let contextualMessage = '';
    let chunks: any[] = [];

    const hasDirectFile = !processo.is_chunked && processo.pdf_base64 && processo.pdf_base64.trim() !== '';
    const isChunked = processo.is_chunked && processo.total_chunks_count > 0;
    const isComplexFile = processo.total_pages >= 1000;
    const hasConsolidatedAnalysis = analysisResults && analysisResults.length >= 7;
    const shouldUseConsolidatedAnalysis = isComplexFile && isChunked && hasConsolidatedAnalysis;

    console.log(`[CHAT] File classification: total_pages=${processo.total_pages}, is_chunked=${processo.is_chunked}, has_pdf_base64=${!!processo.pdf_base64}, analyses_count=${analysisResults?.length || 0}`);
    console.log(`[CHAT] Decision: isComplexFile=${isComplexFile}, isChunked=${isChunked}, shouldUseConsolidatedAnalysis=${shouldUseConsolidatedAnalysis}`);

    if (shouldUseConsolidatedAnalysis) {
      promptType = 'consolidated_analysis';
      console.log(`[CHAT] Complex chunked file (>= 1000 pages, is_chunked) with ${analysisResults.length} analyses - using consolidated analysis`);

      const analysisContext = analysisResults.map((analysis, index) =>
        `\n## ${index + 1}. ${analysis.prompt_title}\n\n${analysis.result_content}`
      ).join('\n\n---\n');

      contextualMessage = `
Processo: ${processo.file_name}
Total de paginas: ${processo.total_pages || 'N/A'}

# ANALISES CONSOLIDADAS DO PROCESSO

Este processo foi analisado em ${analysisResults.length} etapas especializadas. Abaixo estao os resultados completos:
${analysisContext}

---

# PERGUNTA DO USUARIO:
${message}

INSTRUCOES: Responda a pergunta acima baseando-se exclusivamente nas analises consolidadas fornecidas. Seja direto, objetivo e cite qual analise voce usou quando relevante.`;

      console.log(`[CHAT] Formatted ${analysisResults.length} analyses (~${Math.round(contextualMessage.length/4)} tokens estimated)`);

    } else if (isComplexFile && isChunked && !hasConsolidatedAnalysis) {
      console.log(`[CHAT] Complex chunked file (>= 1000 pages, is_chunked) but analysis not complete (${analysisResults?.length || 0}/7) - cannot chat yet`);
      return new Response(
        JSON.stringify({
          error: 'Analise ainda em andamento',
          details: `Este processo complexo (${processo.total_pages} paginas) requer que a analise esteja completa para o chat. Aguarde a finalizacao da analise.`
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (hasDirectFile) {
      promptType = 'small_file';
      console.log(`[CHAT] Direct file available (pdf_base64) - using original PDF (${processo.total_pages} pages)`);

      contextualMessage = `
Processo: ${processo.file_name}
Total de paginas: ${processo.total_pages || 'N/A'}

Pergunta do usuario:
${message}`;

    } else if (isChunked) {
      promptType = 'large_file_chunks';
      console.log(`[CHAT] Chunked file (< 1000 pages): ${processo.total_chunks_count} chunks - using chunks`);

      const { data: chunksData, error: chunksError } = await supabase
        .from('process_chunks')
        .select('chunk_index, start_page, end_page, gemini_file_uri, pages_count, status')
        .eq('processo_id', processo_id)
        .eq('status', 'completed')
        .order('chunk_index', { ascending: true });

      chunks = chunksData || [];

      if (chunksError) {
        console.error('[CHAT] Error fetching chunks:', chunksError);
        return new Response(
          JSON.stringify({
            error: 'Erro ao buscar chunks do processo',
            details: chunksError.message
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!chunks || chunks.length === 0) {
        return new Response(
          JSON.stringify({
            error: 'Chunks nao disponiveis',
            details: 'Os chunks ainda estao sendo processados. Aguarde alguns instantes e tente novamente.'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const chunksWithValidUris = chunks.filter(c => c.gemini_file_uri && c.gemini_file_uri.trim() !== '');
      if (chunksWithValidUris.length === 0) {
        return new Response(
          JSON.stringify({
            error: 'URIs dos chunks nao disponiveis',
            details: 'Os arquivos ainda estao sendo preparados no Gemini. Aguarde alguns instantes e tente novamente.'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[CHAT] Found ${chunks.length} chunks, ${chunksWithValidUris.length} with valid URIs`);

      const chunksInfo = chunks.map(c =>
        `Chunk ${c.chunk_index}: Paginas ${c.start_page}-${c.end_page} (${c.pages_count} paginas)`
      ).join('\n');

      contextualMessage = `
Processo: ${processo.file_name}
Total de paginas: ${processo.total_pages || 'N/A'}
Dividido em ${chunks.length} partes

Chunks disponiveis:
${chunksInfo}

Pergunta do usuario:
${message}`;

      console.log(`[CHAT] Using ${chunks.length} chunks for context with ${chunksWithValidUris.length} valid URIs`);

    } else {
      promptType = 'small_file';
      console.log('[CHAT] Fallback: using transcription (no pdf_base64, no chunks)');

      contextualMessage = `
Processo: ${processo.file_name}
Total de paginas: ${processo.total_pages || 'N/A'}

Transcricao completa:
${processo.transcricao || 'Transcricao nao disponivel'}

Pergunta do usuario:
${message}`;
    }

    const { data: systemPromptData, error: promptError } = await supabase
      .from('chat_system_prompts')
      .select('system_prompt, prompt_type')
      .eq('prompt_type', promptType)
      .eq('is_active', true)
      .order('priority', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (promptError || !systemPromptData) {
      console.error('\u274c Error fetching system prompt:', promptError);
      return new Response(
        JSON.stringify({
          error: 'Prompt do sistema n\u00e3o encontrado',
          details: `N\u00e3o h\u00e1 prompt ativo para o tipo: ${promptType}`
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
      ? `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim() || 'Usu\u00e1rio'
      : 'Usu\u00e1rio';
    const firstName = userProfile?.first_name || 'Usu\u00e1rio';
    const lastName = userProfile?.last_name || '';

    let systemPrompt = systemPromptData.system_prompt;

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

    console.log(`\ud83d\udcdd Using prompt type: ${promptType}`);

    const { data: priorityModel } = await supabase
      .from('admin_chat_models')
      .select('system_model, model_name, supports_system_instruction')
      .eq('is_active', true)
      .order('priority', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!priorityModel) {
      console.error('\u274c No active chat model found');
      return new Response(
        JSON.stringify({
          error: 'Modelo de chat n\u00e3o configurado',
          details: 'N\u00e3o h\u00e1 nenhum modelo de chat ativo. Configure um modelo na \u00e1rea administrativa.'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const modelName = priorityModel.system_model;
    console.log(`\ud83d\udcf1 Using chat model: ${priorityModel.model_name} (${modelName})`);

    await supabase
      .from('chat_messages')
      .insert({
        processo_id: processo_id,
        user_id: user.id,
        role: 'user',
        content: message,
      });

    const { data: previousMessages } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('processo_id', processo_id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    const chatHistory = previousMessages?.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : msg.role as 'user' | 'model',
      parts: [{ text: msg.content }]
    })) || [];

    const genAI = new GoogleGenerativeAI(geminiApiKey);

    const tokenContextKey = (promptType === 'large_file_chunks' || promptType === 'consolidated_analysis') ? 'chat_complex_files' : 'chat_standard';
    const fallbackTokens = (promptType === 'large_file_chunks' || promptType === 'consolidated_analysis') ? 16384 : 8192;
    const maxOutputTokens = await getMaxOutputTokens(supabase, tokenContextKey, fallbackTokens);

    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: {
        role: 'system',
        parts: [{ text: systemPrompt }]
      },
      generationConfig: {
        maxOutputTokens: maxOutputTokens,
        temperature: 0.2
      }
    });

    const chat = model.startChat({
      history: chatHistory,
    });

    let result;
    if (promptType === 'consolidated_analysis') {
      console.log('\ud83c\udfaf Sending consolidated analysis context (text only, highly efficient)');
      result = await chat.sendMessage(contextualMessage);
    } else if (promptType === 'small_file') {
      let fileUri = processo.gemini_file_uri;

      if (!fileUri && processo.file_path) {
        console.log('[CHAT] No gemini_file_uri, uploading from Storage...');

        try {
          const { data: fileData, error: downloadError } = await supabase.storage
            .from('processos')
            .download(processo.file_path);

          if (downloadError || !fileData) {
            throw new Error(`Download failed: ${downloadError?.message}`);
          }

          console.log(`[CHAT] Downloaded file: ${(fileData.size / 1024 / 1024).toFixed(2)}MB`);

          const fileManager = new GoogleAIFileManager(geminiApiKey);
          const arrayBuffer = await fileData.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);

          const tempFilePath = `/tmp/chat_${processo_id}_${Date.now()}.pdf`;
          await Deno.writeFile(tempFilePath, uint8Array);

          const uploadResult = await fileManager.uploadFile(tempFilePath, {
            mimeType: 'application/pdf',
            displayName: processo.file_name || 'documento.pdf',
          });

          try {
            await Deno.remove(tempFilePath);
          } catch (e) {
            console.log('[CHAT] Temp file cleanup error:', e);
          }

          fileUri = uploadResult.file.uri;
          console.log(`[CHAT] Uploaded to Gemini: ${fileUri}`);

          await supabase
            .from('processos')
            .update({
              gemini_file_uri: uploadResult.file.uri,
              gemini_file_name: uploadResult.file.name,
              gemini_file_state: uploadResult.file.state,
              gemini_file_uploaded_at: new Date().toISOString(),
            })
            .eq('id', processo_id);

        } catch (uploadError) {
          console.error('[CHAT] Upload to Gemini failed:', uploadError);
        }
      }

      if (fileUri) {
        console.log(`[CHAT] Using fileData with URI: ${fileUri}`);
        result = await chat.sendMessage([
          {
            fileData: {
              mimeType: 'application/pdf',
              fileUri: fileUri
            }
          },
          { text: contextualMessage }
        ]);
      } else if (processo.pdf_base64 && processo.pdf_base64.trim() !== '') {
        console.log('[CHAT] Fallback to inlineData (base64)');

        let pdfData = processo.pdf_base64;
        if (pdfData.startsWith('data:')) {
          const commaIndex = pdfData.indexOf(',');
          if (commaIndex !== -1) {
            pdfData = pdfData.substring(commaIndex + 1);
          }
        }
        pdfData = pdfData.replace(/[^A-Za-z0-9+/=]/g, '');
        pdfData = pdfData.replace(/=+$/, '');
        const remainder = pdfData.length % 4;
        if (remainder === 2) pdfData += '==';
        else if (remainder === 3) pdfData += '=';
        else if (remainder === 1) pdfData = pdfData.slice(0, -1);

        result = await chat.sendMessage([
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: pdfData
            }
          },
          { text: contextualMessage }
        ]);
      } else {
        console.log('[CHAT] No file available, text only');
        result = await chat.sendMessage(contextualMessage);
      }
    } else if (promptType === 'large_file_chunks' && chunks.length > 0) {
      const chunksWithValidUris = chunks.filter(c => c.gemini_file_uri && c.gemini_file_uri.trim() !== '');

      if (chunksWithValidUris.length > 0) {
        console.log(`\ud83d\udcce Sending ${chunksWithValidUris.length} chunks as fileData (URIs)`);

        const messageParts: any[] = chunksWithValidUris.map(chunk => ({
          fileData: {
            mimeType: 'application/pdf',
            fileUri: chunk.gemini_file_uri
          }
        }));

        messageParts.push({ text: contextualMessage });

        console.log(`\ud83d\udce4 Sending message with ${messageParts.length - 1} file parts + 1 text part`);
        result = await chat.sendMessage(messageParts);
      } else {
        console.log('\u26a0\ufe0f No valid URIs found, sending text only');
        result = await chat.sendMessage(contextualMessage);
      }
    } else {
      console.log('\ud83d\udcdd Sending text only (no files attached)');
      result = await chat.sendMessage(contextualMessage);
    }

    let aiResponse = result.response.text();

    aiResponse = cleanMarkdownFromResponse(aiResponse);
    aiResponse = removeIntroductoryPhrases(aiResponse);

    await supabase
      .from('chat_messages')
      .insert({
        processo_id: processo_id,
        user_id: user.id,
        role: 'assistant',
        content: aiResponse,
      });

    const estimatedTokens = Math.ceil((message.length + aiResponse.length) / 4);
    console.log(`\ud83d\udcca Estimated tokens to debit: ${estimatedTokens} (message: ${message.length} chars, response: ${aiResponse.length} chars)`);

    try {
      const { data: debitResult, error: debitError } = await supabase.rpc('debit_user_tokens', {
        p_user_id: user.id,
        p_tokens_required: estimatedTokens,
        p_operation_type: 'chat',
        p_metadata: {
          processo_id: processo_id,
          processo_name: processo.nome_processo || processo.file_name,
          message_length: message.length,
          response_length: aiResponse.length
        }
      });

      if (debitError) {
        console.error('\u274c Error debiting tokens (RPC error):', JSON.stringify(debitError));
      } else if (debitResult?.success === false) {
        console.warn('\u26a0\ufe0f Token debit failed:', debitResult?.error, JSON.stringify(debitResult));
      } else {
        console.log(`\u2705 Debited ${estimatedTokens} tokens from user ${user.id}`, JSON.stringify(debitResult));

        await supabase
          .from('token_usage_history')
          .insert({
            user_id: user.id,
            processo_id: processo_id,
            tokens_consumed: estimatedTokens,
            pages_processed: 0,
            operation_type: 'chat',
            notes: `Chat: ${processo.nome_processo || processo.file_name}`
          });
        console.log(`\u2705 Token usage history recorded`);
      }
    } catch (debitException) {
      console.error('\u274c Exception during token debit:', debitException);
    }

    return new Response(
      JSON.stringify({ response: aiResponse }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in chat-with-processo function:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});