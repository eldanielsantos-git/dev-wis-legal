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
}

interface ProcessoData {
  id: string;
  file_name: string;
  user_id: string;
  pdf_base64: string | null;
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  let processo_id: string | null = null;
  let analysis_result_id: string | null = null;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')!;

    if (!supabaseUrl || !supabaseServiceKey || !geminiApiKey) {
      throw new Error('Variáveis de ambiente ausentes');
    }

    const body = await req.json();
    processo_id = body.processo_id;

    if (!processo_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'processo_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`\n========== PROCESS-NEXT-PROMPT START ==========`);
    console.log(`Processo ID: ${processo_id}`);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const genAI = new GoogleGenerativeAI(geminiApiKey);

    console.log(`📋 Obtendo próximo prompt para processo ${processo_id}...`);

    const now = new Date().toISOString();
    const lockTimeout = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const { data: lockResult, error: lockError } = await supabase
      .rpc('acquire_next_prompt_lock', {
        p_processo_id: processo_id,
        p_now: now,
        p_lock_timeout: lockTimeout
      });

    if (lockError) {
      console.error('❌ Erro ao obter lock:', lockError);
      return new Response(
        JSON.stringify({ success: false, error: 'Falha ao obter lock' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!lockResult || !Array.isArray(lockResult) || lockResult.length === 0) {
      console.log('⏭️ Nenhum prompt pendente ou já em processamento');
      return new Response(
        JSON.stringify({ success: true, message: 'Nenhum prompt disponível' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const analysisResult = lockResult[0] as AnalysisResult;
    analysis_result_id = analysisResult.id;

    console.log(`✅ Lock obtido para: ${analysisResult.prompt_title}`);
    console.log(`   - Analysis Result ID: ${analysis_result_id}`);
    console.log(`   - Execution Order: ${analysisResult.execution_order}`);

    const { data: processo, error: processoError } = await supabase
      .from('processos')
      .select('id, file_name, user_id, pdf_base64')
      .eq('id', processo_id)
      .single();

    if (processoError || !processo) {
      throw new Error(`Processo não encontrado: ${processo_id}`);
    }

    const processoData = processo as ProcessoData;

    if (!processoData.pdf_base64) {
      throw new Error('PDF base64 não encontrado no processo');
    }

    console.log(`📄 Processo encontrado: ${processoData.file_name}`);
    console.log(`📝 Prompt para processar: ${analysisResult.prompt_title}`);
    console.log(`   - Prompt content length: ${analysisResult.prompt_content?.length || 0}`);

    const { data: activeModel, error: modelError } = await supabase
      .from('admin_system_models')
      .select('id, name, model_id, system_model, temperature, model_config')
      .eq('is_active', true)
      .order('priority', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (modelError || !activeModel) {
      throw new Error('Nenhum modelo ativo encontrado');
    }

    const modelData = {
      id: activeModel.id,
      name: activeModel.name,
      model_id: activeModel.system_model || activeModel.model_id,
      temperature: activeModel.temperature || 0.2,
      max_tokens: activeModel.model_config?.max_tokens || 60000,
    };

    const configuredMaxTokens = await getMaxOutputTokens(
      supabase,
      'forensic_analysis',
      modelData.max_tokens
    );

    console.log(`🤖 Usando modelo: ${modelData.name}`);
    console.log(`   - Model ID: ${modelData.model_id}`);
    console.log(`   - Temperature: ${modelData.temperature}`);
    console.log(`   - Max Tokens: ${configuredMaxTokens}`);

    const startTime = Date.now();

    const model = genAI.getGenerativeModel({
      model: modelData.model_id,
    });

    console.log(`🚀 Enviando prompt para Gemini...`);

    if (!analysisResult.prompt_content || analysisResult.prompt_content.trim() === '') {
      throw new Error('Prompt content is empty or invalid');
    }

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: processoData.pdf_base64,
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
        temperature: modelData.temperature,
        maxOutputTokens: configuredMaxTokens,
      },
    });

    const response = result.response;
    let text = response.text().trim();

    console.log(`✅ Resposta recebida do Gemini`);
    console.log(`   - Tamanho da resposta: ${text.length} caracteres`);

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

    const validatedContent = text;

    const executionTime = Date.now() - startTime;
    const tokensUsed = response.usageMetadata?.totalTokenCount || 0;

    console.log(`📊 Estatísticas:`);
    console.log(`   - Tokens usados: ${tokensUsed}`);
    console.log(`   - Tempo de execução: ${executionTime}ms`);

    const { error: updateError } = await supabase
      .from('analysis_results')
      .update({
        status: 'completed',
        result_content: validatedContent,
        execution_time_ms: executionTime,
        tokens_used: tokensUsed,
        current_model_id: modelData.id,
        current_model_name: modelData.name,
        processing_at: null,
        completed_at: new Date().toISOString(),
      })
      .eq('id', analysis_result_id);

    if (updateError) {
      console.error('❌ Erro ao atualizar analysis_result:', updateError);
      throw updateError;
    }

    console.log(`✅ Analysis result atualizado com sucesso`);

    const { data: remainingPrompts, error: remainingError } = await supabase
      .from('analysis_results')
      .select('id')
      .eq('processo_id', processo_id)
      .in('status', ['pending', 'processing'])
      .limit(1)
      .maybeSingle();

    if (remainingError) {
      console.error('⚠️ Erro ao verificar prompts restantes:', remainingError);
    }

    const hasMorePrompts = !!remainingPrompts;

    if (!hasMorePrompts) {
      console.log(`🎉 Todos os prompts concluídos! Marcando processo como completo...`);

      const { error: processoUpdateError } = await supabase
        .from('processos')
        .update({
          status: 'completed',
          analysis_completed_at: new Date().toISOString(),
        })
        .eq('id', processo_id);

      if (processoUpdateError) {
        console.error('❌ Erro ao atualizar status do processo:', processoUpdateError);
      } else {
        console.log(`✅ Processo marcado como completed`);
      }

      const { error: notificationError } = await supabase.from('notifications').insert({
        user_id: processoData.user_id,
        type: 'analysis_completed',
        message: 'Análise de documento concluída com sucesso',
        related_processo_id: processo_id,
      });

      if (notificationError) {
        console.error('❌ Erro ao criar notificação:', notificationError);
      } else {
        console.log(`📩 Notificação criada para o usuário`);
      }

      console.log(`📧 Enviando email de processo concluído...`);
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
          console.log(`✅ Email enviado com sucesso:`, emailResult.resend_id);
        } else {
          const errorText = await emailResponse.text();
          console.error(`❌ Falha ao enviar email:`, errorText);
        }
      } catch (emailError) {
        console.error(`❌ Erro ao chamar edge function de email:`, emailError);
      }

      console.log(`🔔 Enviando notificação administrativa...`);

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

      const { data: allResults } = await supabase
        .from('analysis_results')
        .select('execution_time_ms')
        .eq('processo_id', processo_id)
        .eq('status', 'completed');

      const totalExecutionTime = allResults?.reduce((sum, r) => sum + (r.execution_time_ms || 0), 0) || 0;
      const durationMinutes = Math.floor(totalExecutionTime / 60000);
      const durationSeconds = Math.floor((totalExecutionTime % 60000) / 1000);
      const durationText =
        durationMinutes > 0 ? `${durationMinutes}m ${durationSeconds}s` : `${durationSeconds}s`;

      notifyAdminSafe({
        type: 'analysis_completed',
        title: 'Análise Concluída',
        message: `*Usuário:* ${userName} (${userEmail})
*Arquivo:* ${fileName}
*Duração:* ${durationText}
*Prompts:* ${allResults?.length || 0}
*Complexo:* Não`,
        severity: 'success',
        metadata: {
          processo_id,
          file_name: fileName,
          user_email: userEmail,
          user_name: userName,
          duration: durationText,
          prompts_count: allResults?.length || 0,
          is_complex: false,
        },
        userId: processoData.user_id,
        processoId: processo_id,
      });
    } else {
      console.log(`⏭️ Ainda há prompts pendentes, continuando processamento...`);
    }

    console.log(`========== PROCESS-NEXT-PROMPT END ==========\n`);

    return new Response(
      JSON.stringify({
        success: true,
        analysis_result_id,
        prompt_title: analysisResult.prompt_title,
        execution_order: analysisResult.execution_order,
        tokens_used: tokensUsed,
        execution_time_ms: executionTime,
        has_more_prompts: hasMorePrompts,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('💥 ERRO CRÍTICO:', error);
    console.error('Stack:', error?.stack);

    if (analysis_result_id) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        await supabase
          .from('analysis_results')
          .update({
            status: 'failed',
            processing_at: null,
          })
          .eq('id', analysis_result_id);

        console.log(`🔓 Lock liberado para analysis_result: ${analysis_result_id}`);
      } catch (unlockError) {
        console.error('❌ Erro ao liberar lock:', unlockError);
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
