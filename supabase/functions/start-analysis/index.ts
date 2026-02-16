import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

async function sendWhatsAppNotification(
  supabaseUrl: string,
  supabaseServiceKey: string,
  messageKey: string,
  userId: string,
  phone: string,
  processoId?: string,
  replacements?: Record<string, string>
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
      }),
    });
  } catch (error) {
    console.error(`[start-analysis] Error sending WhatsApp notification:`, error);
  }
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

    const callId = crypto.randomUUID().slice(0, 8);
    console.log(`[${callId}] Iniciando análise para processo: ${processo_id}`);

    const { data: updatedProcesso, error: updateError } = await supabase
      .from('processos')
      .update({
        status: 'analyzing',
        analysis_started_at: new Date().toISOString(),
      })
      .eq('id', processo_id)
      .eq('status', 'created')
      .select('id, is_chunked, total_chunks_count, gemini_file_uri, file_path, file_name, upload_method, user_id')
      .maybeSingle();

    if (updateError) {
      console.error(`[${callId}] ❌ Erro ao adquirir lock:`, updateError);
      throw new Error(`Erro ao iniciar análise: ${updateError.message}`);
    }

    if (!updatedProcesso) {
      console.log(`[${callId}] ⏸️ Processo já está sendo processado por outra chamada`);
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Processo já está em análise',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`[${callId}] ✅ Lock adquirido com sucesso`);

    if (updatedProcesso.upload_method === 'wis-api' && updatedProcesso.user_id) {
      console.log(`[${callId}] 📱 Processo via WIS API - enviando notificação WhatsApp com delay de 5s...`);

      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('first_name, phone, phone_country_code')
        .eq('id', updatedProcesso.user_id)
        .maybeSingle();

      if (userProfile?.phone) {
        const fullPhone = `${(userProfile.phone_country_code || '+55').replace('+', '')}${userProfile.phone}`;
        EdgeRuntime.waitUntil(
          (async () => {
            await new Promise(resolve => setTimeout(resolve, 5000));
            await sendWhatsAppNotification(
              supabaseUrl,
              supabaseServiceKey,
              'analysis_started',
              updatedProcesso.user_id,
              fullPhone,
              processo_id,
              { nome: userProfile.first_name || 'Usuario' }
            );
          })()
        );
      }
    }

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

    const { data: processoDetails } = await supabase
      .from('processos')
      .select('file_size, total_pages')
      .eq('id', processo_id)
      .maybeSingle();

    const LARGE_FILE_THRESHOLD = 18 * 1024 * 1024;
    const LARGE_PAGES_THRESHOLD = 1000;
    const fileSizeBytes = processoDetails?.file_size || 0;
    const estimatedPages = processoDetails?.total_pages || Math.ceil(fileSizeBytes / (200 * 1024));

    if (!updatedProcesso.is_chunked && (fileSizeBytes > LARGE_FILE_THRESHOLD || estimatedPages >= LARGE_PAGES_THRESHOLD)) {
      console.error(`[${callId}] ❌ Arquivo muito grande para processamento direto: ${(fileSizeBytes / 1024 / 1024).toFixed(2)}MB, ~${estimatedPages} páginas`);
      console.error(`[${callId}] ❌ Este arquivo deveria ter sido processado como chunked`);

      await supabase
        .from('processos')
        .update({
          status: 'error',
          last_error_type: `Arquivo muito grande (${(fileSizeBytes / 1024 / 1024).toFixed(0)}MB, ~${estimatedPages} páginas). Por favor, faça upload novamente - o sistema irá dividir automaticamente.`,
        })
        .eq('id', processo_id);

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Arquivo muito grande para processamento direto',
          message: `Arquivo com ${(fileSizeBytes / 1024 / 1024).toFixed(0)}MB e ~${estimatedPages} páginas requer processamento chunked. Por favor, faça upload novamente.`,
          needs_rechunk: true,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (updatedProcesso.is_chunked) {
      console.log(`[${callId}] 📦 Processo chunkeado detectado (${updatedProcesso.total_chunks_count} chunks)`);

      const { data: chunks, error: chunksError } = await supabase
        .from('process_chunks')
        .select('*')
        .eq('processo_id', processo_id)
        .order('chunk_index', { ascending: true });

      if (chunksError || !chunks || chunks.length === 0) {
        throw new Error('Chunks não encontrados para processo chunkeado');
      }

      console.log(`[${callId}] 🚀 Verificando uploads de ${chunks.length} chunks...`);

      const chunksToUpload = chunks.filter(chunk => !chunk.gemini_file_uri && geminiApiKey);

      if (chunksToUpload.length > 0) {
        console.log(`[${callId}] ⏳ ${chunksToUpload.length} chunks precisam ser enviados para Gemini`);
        console.log(`[${callId}] ⚠️ Uploads serão feitos durante o processamento das análises`);
      } else {
        console.log(`[${callId}] ✅ Todos os chunks já foram enviados para Gemini`);
      }
    } else {
      if (updatedProcesso.file_path && geminiApiKey && !updatedProcesso.gemini_file_uri) {
        console.log(`[${callId}] 📤 Arquivo em Storage detectado - processando via upload-to-gemini...`);

        try {
          const uploadResponse = await fetch(`${supabaseUrl}/functions/v1/upload-to-gemini`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ processo_id }),
          });

          if (uploadResponse.ok) {
            const uploadResult = await uploadResponse.json();
            console.log(`[${callId}] ✅ Processamento concluído - método: ${uploadResult.method}`);
            if (uploadResult.file_uri) {
              console.log(`[${callId}]    File URI: ${uploadResult.file_uri}`);
            }
          } else {
            const errorText = await uploadResponse.text();
            console.error(`[${callId}] ❌ Falha no upload para Gemini: ${errorText}`);

            await supabase
              .from('processos')
              .update({
                status: 'error',
                last_error_type: `Falha no upload para Gemini: ${errorText.substring(0, 200)}`,
              })
              .eq('id', processo_id);

            throw new Error(`Falha no upload para Gemini: ${errorText}`);
          }
        } catch (uploadError) {
          console.error(`[${callId}] ❌ Erro ao chamar upload-to-gemini:`, uploadError);

          const errorMessage = uploadError instanceof Error ? uploadError.message : 'Erro desconhecido';

          if (!errorMessage.includes('Falha no upload para Gemini')) {
            await supabase
              .from('processos')
              .update({
                status: 'error',
                last_error_type: `Erro no upload: ${errorMessage.substring(0, 200)}`,
              })
              .eq('id', processo_id);
          }

          throw uploadError;
        }
      } else if (updatedProcesso.gemini_file_uri) {
        console.log(`[${callId}] ✅ Arquivo já possui gemini_file_uri: ${updatedProcesso.gemini_file_uri}`);
      } else {
        console.log(`[${callId}] 📦 Arquivo sem file_path - usando dados existentes`);
      }
    }

    const { data: prompts, error: promptsError } = await supabase
      .from('analysis_prompts')
      .select('id, title, prompt_content, system_prompt, execution_order')
      .eq('is_active', true)
      .order('execution_order', { ascending: true });

    if (promptsError || !prompts || prompts.length === 0) {
      throw new Error('Nenhum prompt ativo encontrado');
    }

    console.log(`[${callId}] Encontrados ${prompts.length} prompts ativos`);

    await supabase
      .from('processos')
      .update({
        current_prompt_number: 0,
        total_prompts: prompts.length,
      })
      .eq('id', processo_id);

    for (const prompt of prompts) {
      await supabase
        .from('analysis_results')
        .insert({
          processo_id,
          prompt_id: prompt.id,
          prompt_title: prompt.title,
          prompt_content: prompt.prompt_content,
          system_prompt: prompt.system_prompt,
          execution_order: prompt.execution_order,
          status: 'pending',
        });
    }

    console.log(`[${callId}] Análise iniciada com sucesso`);
    console.log(`[${callId}] 🚀 Disparando process-next-prompt...`);

    fetch(`${supabaseUrl}/functions/v1/process-next-prompt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ processo_id }),
    }).catch(error => {
      console.error('Erro ao disparar process-next-prompt:', error);
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Análise iniciada com sucesso',
        total_prompts: prompts.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Erro ao iniciar análise:', error);

    return new Response(
      JSON.stringify({
        error: error?.message || 'Erro ao iniciar análise',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});