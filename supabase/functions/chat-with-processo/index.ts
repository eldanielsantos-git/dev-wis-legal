/**
 * EDGE FUNCTION: chat-with-processo
 *
 * Processa mensagens de chat com contexto de um processo jurídico.
 * Suporta arquivos pequenos (PDF completo) e grandes (chunks).
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
 * - {chunks_count}                       → Número de chunks (arquivos grandes)
 *
 * Sistema:
 * - {{DATA_HORA_ATUAL}}                  → Data/hora atual em Brasília
 *
 * NOTA: A variável {processo_number} foi REMOVIDA do sistema.
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
    /^(Após análise[^.!]*[.!]\s*)/i,
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
      console.error('❌ Error checking token availability:', tokenCheckError);
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
          details: 'Você não possui tokens suficientes para continuar o chat.'
        }),
        {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Buscar processo (RLS já valida acesso)
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

    // Determinar qual tipo de prompt usar baseado no processo
    let promptType: 'small_file' | 'large_file_chunks' = 'small_file';
    let contextualMessage = '';
    let chunks: any[] = [];

    if (processo.is_chunked && processo.total_chunks_count > 0) {
      // ARQUIVO GRANDE: Usa chunks
      promptType = 'large_file_chunks';
      console.log(`📚 Large file detected: ${processo.total_chunks_count} chunks`);

      // Buscar chunks completados em ordem
      const { data: chunksData, error: chunksError } = await supabase
        .from('process_chunks')
        .select('chunk_index, start_page, end_page, gemini_file_uri, pages_count, status')
        .eq('processo_id', processo_id)
        .eq('status', 'completed')
        .order('chunk_index', { ascending: true });

      chunks = chunksData || [];

      if (chunksError) {
        console.error('❌ Error fetching chunks:', chunksError);
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
            error: 'Chunks não disponíveis',
            details: 'Os chunks ainda estão sendo processados. Aguarde alguns instantes e tente novamente.'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validar que todos os chunks têm URIs válidos
      const chunksWithValidUris = chunks.filter(c => c.gemini_file_uri && c.gemini_file_uri.trim() !== '');
      if (chunksWithValidUris.length === 0) {
        return new Response(
          JSON.stringify({
            error: 'URIs dos chunks não disponíveis',
            details: 'Os arquivos ainda estão sendo preparados no Gemini. Aguarde alguns instantes e tente novamente.'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`✅ Found ${chunks.length} chunks, ${chunksWithValidUris.length} with valid URIs`);

      // Construir contexto com informações dos chunks
      const chunksInfo = chunks.map(c =>
        `Chunk ${c.chunk_index}: Páginas ${c.start_page}-${c.end_page} (${c.pages_count} páginas)`
      ).join('\n');

      contextualMessage = `
Processo: ${processo.nome_processo || processo.file_name}
Número: ${processo.numero_processo || 'N/A'}
Total de páginas: ${processo.total_pages || 'N/A'}
Dividido em ${chunks.length} partes

Chunks disponíveis:
${chunksInfo}

Pergunta do usuário:
${message}`;

      console.log(`✅ Using ${chunks.length} chunks for context with ${chunksWithValidUris.length} valid URIs`);
    } else {
      // ARQUIVO PEQUENO: Usa transcricao
      promptType = 'small_file';
      console.log('📄 Small file detected, using transcription');

      contextualMessage = `
Processo: ${processo.nome_processo || processo.file_name}
Número: ${processo.numero_processo || 'N/A'}

Transcrição completa:
${processo.transcricao || 'Transcrição não disponível'}

Pergunta do usuário:
${message}`;
    }

    // Buscar prompt ativo do tipo determinado
    const { data: systemPromptData, error: promptError } = await supabase
      .from('chat_system_prompts')
      .select('system_prompt, prompt_type')
      .eq('prompt_type', promptType)
      .eq('is_active', true)
      .order('priority', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (promptError || !systemPromptData) {
      console.error('❌ Error fetching system prompt:', promptError);
      return new Response(
        JSON.stringify({
          error: 'Prompt do sistema não encontrado',
          details: `Não há prompt ativo para o tipo: ${promptType}`
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar dados do usuário para substituição de variáveis
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('first_name, last_name, email, oab, cpf, city, state, phone, phone_country_code')
      .eq('user_id', user.id)
      .maybeSingle();

    // Construir full_name a partir de first_name e last_name
    const fullName = userProfile
      ? `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim() || 'Usuário'
      : 'Usuário';
    const firstName = userProfile?.first_name || 'Usuário';
    const lastName = userProfile?.last_name || '';

    // Substituir variáveis no prompt
    let systemPrompt = systemPromptData.system_prompt;

    // Substituir data/hora atual
    const now = new Date();
    const saoPauloTime = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      dateStyle: 'full',
      timeStyle: 'long'
    }).format(now);
    systemPrompt = systemPrompt.replace(/\{\{DATA_HORA_ATUAL\}\}/g, saoPauloTime);

    // Substituir variáveis do usuário (suporta múltiplas sintaxes)
    // Nome completo
    systemPrompt = systemPrompt.replace(/\{\{USUARIO_NOME\}\}/g, fullName);
    systemPrompt = systemPrompt.replace(/\{user_full_name\}/g, fullName);

    // Nome e sobrenome separados
    systemPrompt = systemPrompt.replace(/\{user_first_name\}/g, firstName);
    systemPrompt = systemPrompt.replace(/\{user_last_name\}/g, lastName);

    // Email
    systemPrompt = systemPrompt.replace(/\{\{USUARIO_EMAIL\}\}/g, userProfile?.email || user.email || 'N/A');
    systemPrompt = systemPrompt.replace(/\{user_email\}/g, userProfile?.email || user.email || 'N/A');

    // OAB
    systemPrompt = systemPrompt.replace(/\{\{USUARIO_OAB\}\}/g, userProfile?.oab || 'N/A');
    systemPrompt = systemPrompt.replace(/\{user_oab\}/g, userProfile?.oab || 'N/A');

    // CPF
    systemPrompt = systemPrompt.replace(/\{user_cpf\}/g, userProfile?.cpf || 'N/A');

    // Cidade e Estado
    systemPrompt = systemPrompt.replace(/\{user_city\}/g, userProfile?.city || 'N/A');
    systemPrompt = systemPrompt.replace(/\{user_state\}/g, userProfile?.state || 'N/A');

    // Telefone
    systemPrompt = systemPrompt.replace(/\{user_phone\}/g, userProfile?.phone || 'N/A');
    systemPrompt = systemPrompt.replace(/\{user_phone_country_code\}/g, userProfile?.phone_country_code || '+55');

    // Substituir variáveis do processo
    systemPrompt = systemPrompt.replace(/\{processo_name\}/g, processo.nome_processo || processo.file_name);
    systemPrompt = systemPrompt.replace(/\{total_pages\}/g, String(processo.total_pages || 0));
    systemPrompt = systemPrompt.replace(/\{chunks_count\}/g, String(processo.total_chunks_count || 0));

    // Remover variáveis não suportadas (processo_number foi removido do sistema)
    systemPrompt = systemPrompt.replace(/\{processo_number\}/g, '');

    console.log(`📝 Using prompt type: ${promptType}`);

    // Buscar modelo ativo para chat
    const { data: priorityModel } = await supabase
      .from('admin_chat_models')
      .select('system_model, model_name, supports_system_instruction')
      .eq('is_active', true)
      .order('priority', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!priorityModel) {
      console.error('❌ No active chat model found');
      return new Response(
        JSON.stringify({
          error: 'Modelo de chat não configurado',
          details: 'Não há nenhum modelo de chat ativo. Configure um modelo na área administrativa.'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const modelName = priorityModel.system_model;
    console.log(`📱 Using chat model: ${priorityModel.model_name} (${modelName})`);

    // Salvar mensagem do usuário
    await supabase
      .from('chat_messages')
      .insert({
        processo_id: processo_id,
        user_id: user.id,
        role: 'user',
        content: message,
      });

    // Buscar histórico de mensagens
    const { data: previousMessages } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('processo_id', processo_id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    // Converter role 'assistant' para 'model' (formato esperado pelo Gemini)
    const chatHistory = previousMessages?.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : msg.role as 'user' | 'model',
      parts: [{ text: msg.content }]
    })) || [];

    // Iniciar chat com Gemini
    const genAI = new GoogleGenerativeAI(geminiApiKey);

    // Determinar limite de tokens baseado no tipo de prompt
    const tokenContextKey = promptType === 'large_file_chunks' ? 'chat_complex_files' : 'chat_standard';
    const fallbackTokens = promptType === 'large_file_chunks' ? 16384 : 8192;
    const maxOutputTokens = await getMaxOutputTokens(supabase, tokenContextKey, fallbackTokens);

    // Para gemini-2.5-pro e modelos similares, usar formato correto de systemInstruction
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

    // Enviar mensagem com contexto apropriado
    let result;
    if (promptType === 'small_file' && processo.pdf_base64 && processo.pdf_base64.trim() !== '') {
      // Para arquivos pequenos, enviar PDF como inlineData + pergunta
      console.log('📎 Sending small file with inlineData (base64)');
      result = await chat.sendMessage([
        {
          inlineData: {
            mimeType: 'application/pdf',
            data: processo.pdf_base64
          }
        },
        { text: contextualMessage }
      ]);
    } else if (promptType === 'large_file_chunks' && chunks.length > 0) {
      // Para arquivos grandes, enviar URIs dos chunks + pergunta
      const chunksWithValidUris = chunks.filter(c => c.gemini_file_uri && c.gemini_file_uri.trim() !== '');

      if (chunksWithValidUris.length > 0) {
        console.log(`📎 Sending ${chunksWithValidUris.length} chunks as fileData (URIs)`);

        // Criar array de fileData para cada chunk
        const messageParts: any[] = chunksWithValidUris.map(chunk => ({
          fileData: {
            mimeType: 'application/pdf',
            fileUri: chunk.gemini_file_uri
          }
        }));

        // Adicionar a mensagem do usuário ao final
        messageParts.push({ text: contextualMessage });

        console.log(`📤 Sending message with ${messageParts.length - 1} file parts + 1 text part`);
        result = await chat.sendMessage(messageParts);
      } else {
        // Fallback: enviar apenas texto se não houver URIs válidos
        console.log('⚠️ No valid URIs found, sending text only');
        result = await chat.sendMessage(contextualMessage);
      }
    } else {
      // Fallback: para casos sem PDF ou chunks, enviar apenas texto
      console.log('📝 Sending text only (no files attached)');
      result = await chat.sendMessage(contextualMessage);
    }

    let aiResponse = result.response.text();

    // Limpar resposta
    aiResponse = cleanMarkdownFromResponse(aiResponse);
    aiResponse = removeIntroductoryPhrases(aiResponse);

    // Salvar resposta do assistente
    await supabase
      .from('chat_messages')
      .insert({
        processo_id: processo_id,
        user_id: user.id,
        role: 'assistant',
        content: aiResponse,
      });

    // Debitar tokens
    const estimatedTokens = Math.ceil((message.length + aiResponse.length) / 4);

    const { error: debitError } = await supabase.rpc('debit_user_tokens', {
      p_user_id: user.id,
      p_tokens: estimatedTokens,
      p_description: `Chat com processo ${processo.nome_processo || processo.file_name}`
    });

    if (debitError) {
      console.error('❌ Error debiting tokens:', debitError);
    } else {
      console.log(`✅ Debited ${estimatedTokens} tokens from user ${user.id}`);
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