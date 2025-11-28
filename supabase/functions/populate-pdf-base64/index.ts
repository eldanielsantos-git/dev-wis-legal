import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

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

    const { data: processo, error: processoError } = await supabase
      .from('processos')
      .select('id, file_path, file_name, is_chunked, pdf_base64')
      .eq('id', processo_id)
      .maybeSingle();

    if (processoError || !processo) {
      return new Response(
        JSON.stringify({ error: 'Processo não encontrado' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (processo.is_chunked) {
      return new Response(
        JSON.stringify({
          error: 'Processo chunkeado',
          message: 'Processos chunkeados não suportam chat'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (processo.pdf_base64) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Processo já possui pdf_base64',
          already_populated: true
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`📥 Baixando arquivo do Storage: ${processo.file_path}`);

    const { data: fileData, error: downloadError } = await supabase.storage
      .from('processos')
      .download(processo.file_path);

    if (downloadError || !fileData) {
      return new Response(
        JSON.stringify({
          error: 'Erro ao baixar arquivo',
          details: downloadError?.message
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`✅ Arquivo baixado: ${(fileData.size / 1024 / 1024).toFixed(2)}MB`);

    const arrayBuffer = await fileData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    const chunkSize = 32768;
    let base64String = '';
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.slice(i, i + chunkSize);
      base64String += btoa(String.fromCharCode.apply(null, Array.from(chunk)));
    }

    const pdfBase64 = `data:application/pdf;base64,${base64String}`;

    console.log('💾 Salvando pdf_base64...');

    const { error: updateError } = await supabase
      .from('processos')
      .update({ pdf_base64: pdfBase64 })
      .eq('id', processo_id);

    if (updateError) {
      return new Response(
        JSON.stringify({
          error: 'Erro ao atualizar processo',
          details: updateError.message
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('✅ pdf_base64 salvo com sucesso');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'pdf_base64 populado com sucesso',
        file_name: processo.file_name,
        size_mb: (fileData.size / 1024 / 1024).toFixed(2)
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Erro ao popular pdf_base64:', error);
    return new Response(
      JSON.stringify({
        error: 'Erro interno',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});