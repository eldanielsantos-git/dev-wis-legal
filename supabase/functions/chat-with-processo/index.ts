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

    // Buscar processo (RLS já valida acesso: próprio ou compartilhado)
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

    const { data: systemPromptData } = await supabase
      .from('chat_system_prompts')
      .select('prompt_content')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    const systemPrompt = systemPromptData?.prompt_content || `Você é um assistente jurídico especializado em análise de processos. Seja objetivo, claro e profissional em suas respostas.`;

    const chatHistory = previousMessages?.map(msg => ({
      role: msg.role as 'user' | 'model',
      parts: [{ text: msg.content }]
    })) || [];

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: modelName });

    const chat = model.startChat({
      history: chatHistory,
      systemInstruction: systemPrompt,
    });

    const contextualMessage = `
Processo: ${processo.nome_processo || processo.file_name}
Número: ${processo.numero_processo || 'N/A'}

Transcrição completa:
${processo.transcricao || 'Transcrição não disponível'}

Pergunta do usuário:
${message}`;

    const result = await chat.sendMessage(contextualMessage);
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