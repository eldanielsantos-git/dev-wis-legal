import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { GoogleGenerativeAI } from 'npm:@google/generative-ai@0.24.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface RequestBody {
  processo_id: string;
  message: string;
}

function cleanMarkdownFromResponse(text: string): string {
  let cleaned = text.trim();

  if (cleaned.startsWith('\`\`\`json') || cleaned.startsWith('\`\`\`')) {
    cleaned = cleaned.replace(/^\`\`\`json\n?/, '').replace(/^\`\`\`\n?/, '');
    cleaned = cleaned.replace(/\n?\`\`\`$/, '');
    cleaned = cleaned.trim();
  }

  cleaned = cleaned.replace(/\*\*(.+?)\*\*/g, '$1');
  cleaned = cleaned.replace(/\*(.+?)\*/g, '$1');
  cleaned = cleaned.replace(/\`(.+?)\`/g, '$1');
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
      console.error('❌ Error details:', JSON.stringify(tokenCheckError, null, 2));
      return new Response(
        JSON.stringify({
          error: 'Erro ao verificar saldo de tokens',
          details: tokenCheckError.message || 'Erro desconhecido ao verificar tokens',
          code: tokenCheckError.code
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('✅ Token availability check result:', tokenAvailable);

    if (!tokenAvailable) {
      return new Response(
        JSON.stringify({
          error: 'Saldo de tokens insuficiente',
          details: 'Você não possui tokens suficientes para continuar o chat. Adquira mais tokens para continuar.'
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
      .eq('user_id', user.id)
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

    const { data: priorityModel, error: modelError } = await supabase
      .from('admin_system_models')
      .select('system_model, priority')
      .eq('is_active', true)
      .order('priority', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (modelError) {
      console.error('❌ Error fetching model:', modelError);
    }

    const modelName = priorityModel?.system_model || 'gemini-2.5-pro';
    console.log(`📱 Using model: ${modelName} (priority: ${priorityModel?.priority || 'fallback'})`);

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

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({
      model: modelName,
    });

    const chatHistory = [];

    if (previousMessages && previousMessages.length > 0) {
      for (let i = 0; i < previousMessages.length - 1; i++) {
        const msg = previousMessages[i];
        chatHistory.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }],
        });
      }
    }

    let promptType: string;
    let systemInstructionText: string;
    let chatMessage: any[];
    let contextData: any = {};

    if (processo.is_chunked) {
      console.log('🔄 Using chunks for large processo');

      const { data: chunks, error: chunksError } = await supabase
        .from('process_chunks')
        .select('chunk_index, start_page, end_page, gemini_file_uri, status')
        .eq('processo_id', processo_id)
        .order('chunk_index', { ascending: true });

      if (chunksError) {
        return new Response(
          JSON.stringify({
            error: 'Erro ao carregar chunks do processo',
            details: chunksError.message
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      if (!chunks || chunks.length === 0) {
        return new Response(
          JSON.stringify({
            error: 'Chunks não encontrados',
            details: 'Os chunks deste processo não estão disponíveis. Por favor, tente fazer upload novamente.'
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const validChunks = chunks.filter(c => c.gemini_file_uri && (c.status === 'uploaded' || c.status === 'completed'));

      if (validChunks.length === 0) {
        return new Response(
          JSON.stringify({
            error: 'Chunks não disponíveis para chat',
            details: 'Os chunks ainda estão sendo processados ou não foram enviados ao Gemini. Aguarde a conclusão da análise.'
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      console.log(`📊 Total valid chunks: ${validChunks.length}`);

      if (validChunks.length > 10) {
        promptType = 'large_file_analysis';
        console.log('⚠️  Too many chunks, using analysis results instead');

        const { data: analysisResults, error: analysisError } = await supabase
          .from('analysis_results')
          .select('execution_order, prompt_title, result_content, status')
          .eq('processo_id', processo_id)
          .eq('status', 'completed')
          .order('execution_order', { ascending: true });

        if (analysisError || !analysisResults || analysisResults.length === 0) {
          return new Response(
            JSON.stringify({
              error: 'Análises não disponíveis',
              details: 'Este processo é muito grande para chat com PDF completo. As análises forenses são necessárias mas ainda não foram concluídas.'
            }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        let analysisContext = `ANÁLISE FORENSE COMPLETA DO PROCESSO: ${processo.file_name}\n`;
        analysisContext += `Total de páginas: ${processo.total_pages || 0}\n\n`;

        for (const analysis of analysisResults) {
          analysisContext += `=== ANÁLISE ${analysis.execution_order}: ${analysis.prompt_title} ===\n\n`;
          analysisContext += `${analysis.result_content}\n\n`;
        }

        contextData = {
          processo_name: processo.file_name,
          total_pages: processo.total_pages || 0,
          chunks_count: validChunks.length
        };

        chatMessage = [
          { text: analysisContext },
          { text: message }
        ];

      } else {
        promptType = 'large_file_chunks';

        contextData = {
          processo_name: processo.file_name,
          total_pages: processo.total_pages || 0,
          chunks_count: validChunks.length
        };

        chatMessage = [];

        for (const chunk of validChunks) {
          chatMessage.push({
            fileData: {
              mimeType: 'application/pdf',
              fileUri: chunk.gemini_file_uri
            }
          });
        }

        chatMessage.push({ text: message });
      }

    } else {
      promptType = 'small_file';
      console.log('📄 Using PDF base64 for standard processo');

      if (!processo.pdf_base64 || processo.pdf_base64.trim() === '') {
        return new Response(
          JSON.stringify({
            error: 'PDF não disponível',
            details: 'O conteúdo do PDF não está disponível para chat. Tente fazer o upload novamente.'
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      contextData = {
        processo_name: processo.file_name,
        total_pages: processo.total_pages || 0,
        chunks_count: 0
      };

      let pdfBase64 = processo.pdf_base64;
      if (pdfBase64.startsWith('data:')) {
        pdfBase64 = pdfBase64.split(',')[1];
      }

      chatMessage = [
        {
          inlineData: {
            mimeType: 'application/pdf',
            data: pdfBase64,
          },
        },
        { text: message },
      ];
    }

    console.log(`🎯 Determined prompt type: ${promptType}`);

    const { data: promptData, error: promptError } = await supabase
      .from('chat_system_prompts')
      .select('id, system_prompt, description')
      .eq('prompt_type', promptType)
      .eq('is_active', true)
      .order('priority', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (promptError) {
      console.error('❌ Error fetching chat system prompt:', promptError);
      return new Response(
        JSON.stringify({
          error: 'Erro ao carregar configuração do chat',
          details: 'Erro ao buscar o prompt do sistema. Entre em contato com o administrador.',
          admin_action_required: true
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!promptData) {
      console.error(`❌ No active prompt found for type: ${promptType}`);
      return new Response(
        JSON.stringify({
          error: 'Configuração de chat não disponível',
          details: `Os prompts do sistema de chat não foram configurados para arquivos deste tipo (${promptType}). Entre em contato com o administrador.`,
          admin_action_required: true,
          prompt_type_needed: promptType
        }),
        {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`✅ Using prompt ID: ${promptData.id} (${promptData.description || 'No description'})`);

    systemInstructionText = promptData.system_prompt
      .replace(/\{processo_name\}/g, contextData.processo_name || '')
      .replace(/\{total_pages\}/g, String(contextData.total_pages || 0))
      .replace(/\{chunks_count\}/g, String(contextData.chunks_count || 0));

    const systemInstruction = {
      parts: [{ text: systemInstructionText }]
    };

    const chat = model.startChat({
      history: chatHistory,
      generationConfig: {
        maxOutputTokens: 60000,
        temperature: 0.7,
      },
      systemInstruction: systemInstruction,
    });

    const result = await chat.sendMessage(chatMessage);

    let responseText = result.response.text();

    responseText = cleanMarkdownFromResponse(responseText);
    responseText = removeIntroductoryPhrases(responseText);

    const responseLength = responseText.length;
    const tokensToDebit = responseLength * 2;

    console.log(`💬 Chat response - Characters: ${responseLength}, Tokens to debit: ${tokensToDebit}`);

    const { error: debitError } = await supabase.rpc('debit_user_tokens', {
      p_user_id: user.id,
      p_tokens_amount: tokensToDebit
    });

    if (debitError) {
      console.error('❌ Error debiting tokens:', debitError);
    }

    const { error: logError } = await supabase
      .from('token_usage_logs')
      .insert({
        user_id: user.id,
        processo_id: processo_id,
        operation_type: 'chat_response',
        tokens_used: tokensToDebit,
        model_name: modelName,
        metadata: {
          message_length: message.length,
          response_length: responseLength,
          tokens_per_character: 2,
          is_chunked: processo.is_chunked
        }
      });

    if (logError) {
      console.error('❌ Error logging token usage:', logError);
    }

    await supabase
      .from('chat_messages')
      .insert({
        processo_id: processo_id,
        user_id: user.id,
        role: 'assistant',
        content: responseText,
      });

    return new Response(
      JSON.stringify({ response: responseText }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in chat-with-processo:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});