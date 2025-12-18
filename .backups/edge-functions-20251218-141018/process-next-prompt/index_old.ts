import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { GoogleGenerativeAI } from 'npm:@google/generative-ai@0.24.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

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
      throw new Error('GEMINI_API_KEY não configurada');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { processo_id } = await req.json();

    if (!processo_id) {
      return new Response(
        JSON.stringify({ error: 'processo_id é obrigatório' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: nextResult } = await supabase
      .from('analysis_results')
      .select('*')
      .eq('processo_id', processo_id)
      .eq('status', 'pending')
      .order('execution_order', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!nextResult) {
      const { data: allResults } = await supabase
        .from('analysis_results')
        .select('status')
        .eq('processo_id', processo_id);

      const hasFailures = allResults?.some(r => r.status === 'failed');

      await supabase
        .from('processos')
        .update({
          status: hasFailures ? 'error' : 'completed',
          analysis_completed_at: new Date().toISOString(),
        })
        .eq('id', processo_id);

      return new Response(
        JSON.stringify({
          completed: true,
          has_failures: hasFailures,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    await supabase
      .from('analysis_results')
      .update({ status: 'running' })
      .eq('id', nextResult.id);

    await supabase
      .from('processos')
      .update({ current_prompt_number: nextResult.execution_order })
      .eq('id', processo_id);

    const { data: processo } = await supabase
      .from('processos')
      .select('pdf_base64, is_chunked, total_chunks, file_path')
      .eq('id', processo_id)
      .single();

    if (!processo) {
      throw new Error('Processo não encontrado');
    }

    let base64Data: string;

    if (processo.is_chunked) {
      console.log(`📦 Carregando PDF chunkeado (${processo.total_chunks} chunks)...`);

      const { data: chunks, error: chunksError } = await supabase
        .from('pdf_chunks')
        .select('chunk_data, chunk_number')
        .eq('processo_id', processo_id)
        .order('chunk_number', { ascending: true });

      if (chunksError || !chunks) {
        throw new Error('Erro ao carregar chunks do PDF');
      }

      base64Data = chunks.map(c => c.chunk_data).join('');
      console.log(`✅ ${chunks.length} chunks reunidos`);
    } else if (processo.pdf_base64) {
      console.log('📄 Usando PDF inline do banco de dados');
      base64Data = processo.pdf_base64;
    } else {
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

      base64Data = btoa(binary);
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
    });

    const startTime = Date.now();

    try {
      const result = await model.generateContent({
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
              {
                text: nextResult.prompt_content || '',
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
        },
      });

      const response = await result.response;
      let text = response.text();
      const executionTime = Date.now() - startTime;

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

      await supabase
        .from('analysis_results')
        .update({
          status: 'completed',
          result_content: text,
          execution_time_ms: executionTime,
          completed_at: new Date().toISOString(),
        })
        .eq('id', nextResult.id);

      return new Response(
        JSON.stringify({
          success: true,
          completed: false,
          prompt_title: nextResult.prompt_title,
          execution_time_ms: executionTime,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } catch (error: any) {
      console.error('Erro ao processar prompt:', error);

      await supabase
        .from('analysis_results')
        .update({
          status: 'failed',
          error_message: error?.message || 'Erro desconhecido',
        })
        .eq('id', nextResult.id);

      throw error;
    }
  } catch (error: any) {
    console.error('Erro:', error);

    return new Response(
      JSON.stringify({
        error: error?.message || 'Erro ao processar prompt',
        code: error?.code || 'UNKNOWN_ERROR',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});