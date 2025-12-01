import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { GoogleGenerativeAI } from 'npm:@google/generative-ai@0.24.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

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
    console.log('[process-audio-message] Starting audio processing');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

    if (!geminiApiKey) {
      console.error('[process-audio-message] GEMINI_API_KEY not configured');
      throw new Error('GEMINI_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[process-audio-message] Missing authorization header');
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
      console.error('[process-audio-message] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid authorization token' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[process-audio-message] User authenticated:', user.id);

    const { processo_id, audio_data, audio_duration }: RequestBody = await req.json();

    if (!processo_id || !audio_data) {
      console.error('[process-audio-message] Missing parameters');
      return new Response(
        JSON.stringify({ error: 'Missing processo_id or audio_data' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[process-audio-message] Processing for processo:', processo_id);

    const { data: processo, error: processoError } = await supabase
      .from('processos')
      .select('*')
      .eq('id', processo_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (processoError || !processo) {
      console.error('[process-audio-message] Processo error:', processoError);
      return new Response(
        JSON.stringify({ error: 'Processo not found or access denied' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[process-audio-message] Processing audio data');

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
        console.error('[process-audio-message] Model config error:', modelError);
        throw new Error('No active chat model configuration found');
      }

      const modelId = modelConfig.system_model;
      console.log('[process-audio-message] Using chat model:', modelConfig.model_name, '(', modelId, ')');

      const genAI = new GoogleGenerativeAI(geminiApiKey);

      console.log('[process-audio-message] Transcribing audio with Gemini');
      const model = genAI.getGenerativeModel({ model: modelId });

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
      console.log('[process-audio-message] Transcription:', transcription);

      console.log('[process-audio-message] Uploading audio to storage');
      const storageFileName = `${user.id}/${processo_id}_${timestamp}.webm`;

      const { error: uploadError } = await supabase.storage
        .from('chat-audios')
        .upload(storageFileName, audioBuffer, {
          contentType: 'audio/webm',
          upsert: false
        });

      if (uploadError) {
        console.error('[process-audio-message] Upload error:', uploadError);
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
        console.error('[process-audio-message] Error saving user message:', userMessageError);
      }

      console.log('[process-audio-message] User message saved');

      if (!processo.pdf_base64 || processo.pdf_base64.trim() === '') {
        console.log('[process-audio-message] No PDF available, returning transcription only');
        return new Response(
          JSON.stringify({
            transcription,
            audio_url: audioUrl,
            response: 'Áudio recebido e transcrito com sucesso. O PDF ainda está sendo processado.'
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      console.log('[process-audio-message] Generating AI response');

      // Buscar prompt específico para áudio
      const { data: audioPromptData, error: promptError } = await supabase
        .from('chat_system_prompts')
        .select('system_prompt')
        .eq('prompt_type', 'audio')
        .eq('is_active', true)
        .order('priority', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (promptError || !audioPromptData) {
        console.error('[process-audio-message] Error fetching audio prompt:', promptError);
        return new Response(
          JSON.stringify({
            error: 'Prompt de áudio não encontrado',
            details: 'Não há prompt ativo configurado para mensagens de áudio'
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Substituir variáveis no prompt
      let systemPrompt = audioPromptData.system_prompt;

      // Substituir data/hora atual
      const now = new Date();
      const saoPauloTime = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        dateStyle: 'full',
        timeStyle: 'long'
      }).format(now);
      systemPrompt = systemPrompt.replace(/\{\{DATA_HORA_ATUAL\}\}/g, saoPauloTime);

      // Substituir outras variáveis
      systemPrompt = systemPrompt.replace(/\{processo_name\}/g, processo.nome_processo || processo.file_name);
      systemPrompt = systemPrompt.replace(/\{total_pages\}/g, String(processo.total_pages || 0));

      const contextPrompt = `${systemPrompt}

Pergunta do usuário (transcrição de áudio): "${transcription}"

Responda de forma direta, clara e objetiva com base no documento do processo.`;

      const chatModel = genAI.getGenerativeModel({ model: modelId });

      const chatResult = await chatModel.generateContent([
        {
          inlineData: {
            mimeType: 'application/pdf',
            data: processo.pdf_base64
          }
        },
        { text: contextPrompt }
      ]);

      let assistantResponse = chatResult.response.text();
      assistantResponse = removeIntroductoryPhrases(assistantResponse);
      console.log('[process-audio-message] AI response generated');

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

      console.log('[process-audio-message] Assistant message saved');

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
      console.error('[process-audio-message] Processing error:', processingError);
      throw processingError;
    }

  } catch (error) {
    console.error('[process-audio-message] Fatal error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : '';
    console.error('[process-audio-message] Error stack:', errorStack);

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