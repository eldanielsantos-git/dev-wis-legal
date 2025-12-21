import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { GoogleGenerativeAI } from 'npm:@google/generative-ai@0.24.1';
import { notifyAdminSafe } from './_shared/notify-admin-safe.ts';

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

async function getActiveModel(supabase: any) {
  const { data, error } = await supabase
    .from('admin_system_models')
    .select('*')
    .eq('is_active', true)
    .order('priority', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    throw new Error('Nenhum modelo ativo encontrado');
  }

  const configuredMaxTokens = await getMaxOutputTokens(supabase, 'analysis_consolidation', 60000);

  return {
    id: data.id,
    name: data.name,
    modelId: data.system_model || data.model_id,
    temperature: data.temperature ?? 0.2,
    maxTokens: data.max_tokens ?? configuredMaxTokens,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const workerId = crypto.randomUUID().slice(0, 8);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { processo_id, prompt_id } = await req.json();

    if (!processo_id) {
      throw new Error('processo_id é obrigatório');
    }

    if (prompt_id) {
      console.log(`\n[${workerId}] 🔄 Consolidação ESPECÍFICA - Processo: ${processo_id}, Prompt: ${prompt_id}`);
    } else {
      console.log(`\n[${workerId}] 🔄 Consolidação GERAL - Processo: ${processo_id}`);
    }

    await supabase
      .from('complex_processing_status')
      .update({
        current_phase: 'consolidating',
        last_heartbeat: new Date().toISOString(),
      })
      .eq('processo_id', processo_id);

    const { data: chunks, error: chunksError } = await supabase
      .from('process_chunks')
      .select('chunk_index, context_summary, processing_result')
      .eq('processo_id', processo_id)
      .order('chunk_index', { ascending: true });

    if (chunksError || !chunks || chunks.length === 0) {
      throw new Error('Chunks não encontrados');
    }

    console.log(`[${workerId}] 📦 ${chunks.length} chunks para consolidar`);

    const allSummaries = chunks
      .filter(c => c.processing_result?.result)
      .map(c => {
        const chunkResult = typeof c.processing_result.result === 'string'
          ? c.processing_result.result
          : JSON.stringify(c.processing_result.result);
        return `=== CHUNK ${c.chunk_index + 1} ===\n${chunkResult}`;
      })
      .join('\n\n');

    console.log(`[${workerId}] 📄 Total de conteúdo para consolidação: ${allSummaries.length} caracteres`);

    let analysisResultsQuery = supabase
      .from('analysis_results')
      .select('id, prompt_id, prompt_title, prompt_content, system_prompt, execution_order, status')
      .eq('processo_id', processo_id)
      .in('status', ['pending', 'running']);

    if (prompt_id) {
      analysisResultsQuery = analysisResultsQuery.eq('prompt_id', prompt_id);
    }

    const { data: analysisResults, error: resultsError } = await analysisResultsQuery
      .order('execution_order', { ascending: true });

    if (resultsError) {
      throw new Error('Erro ao buscar analysis_results');
    }

    console.log(`[${workerId}] 📋 Analysis Results encontrados:`, analysisResults?.map(r => ({
      id: r.id,
      title: r.prompt_title,
      status: r.status
    })));

    if (!analysisResults || analysisResults.length === 0) {
      console.log(`[${workerId}] ✅ Nenhum prompt pendente para consolidar`);

      const { data: processoInfo } = await supabase
        .from('processos')
        .select('transcricao')
        .eq('id', processo_id)
        .single();

      const totalPages = processoInfo?.transcricao?.totalPages || 0;
      console.log(`[${workerId}] 📄 Total de páginas processadas: ${totalPages}`);

      await supabase
        .from('processos')
        .update({
          status: 'completed',
          pages_processed_successfully: totalPages,
          analysis_completed_at: new Date().toISOString(),
        })
        .eq('id', processo_id);

      await supabase
        .from('complex_processing_status')
        .update({
          current_phase: 'completed',
          last_heartbeat: new Date().toISOString(),
        })
        .eq('processo_id', processo_id);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Consolidação concluída - todos os prompts já processados',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`[${workerId}] 📝 ${analysisResults.length} prompts para consolidar`);

    const model = await getActiveModel(supabase);
    console.log(`[${workerId}] 🤖 Usando modelo: ${model.name}`);

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const geminiModel = genAI.getGenerativeModel({ model: model.modelId });

    for (const analysisResult of analysisResults) {
      console.log(`[${workerId}] 🔄 Consolidando: ${analysisResult.prompt_title}`);

      const startTime = Date.now();

      const consolidationPrompt = `PROMPT ORIGINAL:\n${analysisResult.prompt_content}\n\nANÁLISES PARCIAIS DOS CHUNKS:\n${allSummaries}\n\nINSTRUÇÕES DE CONSOLIDAÇÃO:\n1. Combine as informações de todos os ${chunks.length} chunks em uma análise unificada\n2. Remova duplicações e contradições\n3. Garanta consistência e coerência no resultado final\n4. Siga estritamente o formato e estrutura solicitados no prompt original\n5. Considere todo o contexto do documento completo\n\nIMPORTANTE: Responda APENAS com o JSON ou conteúdo estruturado solicitado no prompt original. NÃO inclua texto introdutório, explicações ou observações antes ou depois do conteúdo. Inicie sua resposta diretamente com o formato esperado.`;

      await supabase
        .from('analysis_results')
        .update({ status: 'running' })
        .eq('id', analysisResult.id);

      const result = await geminiModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: consolidationPrompt }] }],
        systemInstruction: analysisResult.system_prompt || undefined,
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: model.maxTokens,
        },
      });

      const response = await result.response;
      let text = response.text().trim();

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

      const tokensUsed = response.usageMetadata?.totalTokenCount || 0;
      const executionTime = Date.now() - startTime;

      await supabase
        .from('analysis_results')
        .update({
          status: 'completed',
          result_content: text,
          execution_time_ms: executionTime,
          tokens_used: tokensUsed,
          current_model_id: model.id,
          current_model_name: model.name,
          completed_at: new Date().toISOString(),
        })
        .eq('id', analysisResult.id);

      console.log(`[${workerId}] ✅ Consolidado: ${analysisResult.prompt_title} (${tokensUsed} tokens)`);

      await supabase
        .from('complex_processing_status')
        .update({
          total_prompts_processed: analysisResults.length,
          last_heartbeat: new Date().toISOString(),
        })
        .eq('processo_id', processo_id);
    }

    console.log(`[${workerId}] 🎉 Consolidação concluída com sucesso`);

    const { data: remainingResults } = await supabase
      .from('analysis_results')
      .select('id')
      .eq('processo_id', processo_id)
      .in('status', ['pending', 'running'])
      .limit(1)
      .maybeSingle();

    if (!remainingResults) {
      console.log(`[${workerId}] ✅ TODOS os prompts consolidados! Marcando processo como completo`);

      const { data: processoInfo } = await supabase
        .from('processos')
        .select('transcricao')
        .eq('id', processo_id)
        .single();

      const totalPages = processoInfo?.transcricao?.totalPages || 0;
      console.log(`[${workerId}] 📄 Total de páginas processadas: ${totalPages}`);

      await supabase
        .from('processos')
        .update({
          status: 'completed',
          pages_processed_successfully: totalPages,
          analysis_completed_at: new Date().toISOString(),
        })
        .eq('id', processo_id);

      await supabase
        .from('complex_processing_status')
        .update({
          current_phase: 'completed',
          overall_progress_percent: 100,
          last_heartbeat: new Date().toISOString(),
        })
        .eq('processo_id', processo_id);
    } else {
      console.log(`[${workerId}] ⏳ Ainda há prompts pendentes, continuando processamento...`);

      await supabase
        .from('complex_processing_status')
        .update({
          current_phase: 'processing',
          last_heartbeat: new Date().toISOString(),
        })
        .eq('processo_id', processo_id);
    }

    if (!remainingResults) {
      const { data: processoData } = await supabase
        .from('processos')
        .select('user_id, file_name, created_at, is_chunked')
        .eq('id', processo_id)
        .single();

      if (processoData?.user_id) {
        await supabase
          .from('notifications')
          .insert({
            user_id: processoData.user_id,
            type: 'analysis_completed',
            message: 'Análise de documento complexo concluída com sucesso',
            related_processo_id: processo_id,
          });

        console.log(`[${workerId}] 📬 Notificação enviada ao usuário`);

        console.log(`[${workerId}] 📧 Enviando email de processo concluído...`);
        try {
          const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-email-process-completed`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ processo_id }),
          });

          if (emailResponse.ok) {
            const emailResult = await emailResponse.json();
            console.log(`[${workerId}] ✅ Email enviado com sucesso:`, emailResult.resend_id);
          } else {
            const errorText = await emailResponse.text();
            console.error(`[${workerId}] ❌ Falha ao enviar email:`, errorText);
          }
        } catch (emailError) {
          console.error(`[${workerId}] ❌ Erro ao chamar edge function de email:`, emailError);
        }
      }

      console.log(`[${workerId}] 🔔 Enviando notificação administrativa Slack...`);

      const { data: userData } = await supabase
        .from('user_profiles')
        .select('email, first_name, last_name')
        .eq('id', processoData?.user_id)
        .maybeSingle();

      const userName = userData
        ? `${userData.first_name || ''} ${userData.last_name || ''}`.trim()
        : 'N/A';
      const userEmail = userData?.email || 'N/A';
      const fileName = processoData?.file_name || 'N/A';

      const startTime = new Date(processoData?.created_at || Date.now());
      const endTime = new Date();
      const durationMs = endTime.getTime() - startTime.getTime();
      const durationMinutes = Math.floor(durationMs / 60000);
      const durationSeconds = Math.floor((durationMs % 60000) / 1000);
      const durationText = durationMinutes > 0
        ? `${durationMinutes}m ${durationSeconds}s`
        : `${durationSeconds}s`;

      notifyAdminSafe({
        type: 'analysis_completed',
        title: 'Análise Concluída',
        message: `${userName || userEmail} | ${fileName} | ${durationText}`,
        severity: 'success',
        metadata: {
          processo_id,
          file_name: fileName,
          user_email: userEmail,
          user_name: userName || userEmail,
          duration: durationText,
          chunks_count: chunks.length,
          prompts_consolidated: analysisResults.length,
          is_complex: processoData?.is_chunked,
        },
        userId: processoData?.user_id,
        processoId: processo_id,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Consolidação concluída',
        prompts_consolidated: analysisResults.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error(`[${workerId}] ❌ Erro na consolidação:`, error);

    return new Response(
      JSON.stringify({
        error: error?.message || 'Erro na consolidação',
        worker_id: workerId,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});