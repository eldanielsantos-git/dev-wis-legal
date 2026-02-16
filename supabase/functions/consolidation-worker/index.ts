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
  const { data, error} = await supabase
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

    const { data: integrityCheck, error: integrityError } = await supabase
      .rpc('validate_chunks_integrity', { p_processo_id: processo_id })
      .maybeSingle();

    if (integrityError) {
      console.error(`[${workerId}] ❌ Erro ao validar integridade:`, integrityError);
    }

    if (integrityCheck && !integrityCheck.is_valid) {
      console.error(`[${workerId}] ❌ Integridade dos chunks falhou:`, {
        total: integrityCheck.total_chunks,
        valid: integrityCheck.valid_chunks,
        invalid: integrityCheck.invalid_chunk_count,
      });

      if (integrityCheck.invalid_chunks && integrityCheck.invalid_chunks.length > 0) {
        console.log(`[${workerId}] 🔄 Tentando recuperar ${integrityCheck.invalid_chunk_count} chunks inválidos...`);

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

        fetch(`${supabaseUrl}/functions/v1/retry-chunk-uploads`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ processo_id }),
        }).catch(err => {
          console.error(`[${workerId}] ❌ Erro ao disparar retry de chunks:`, err);
        });

        throw new Error(`Chunks inválidos detectados: ${integrityCheck.invalid_chunk_count} de ${integrityCheck.total_chunks}. Retry disparado automaticamente.`);
      }
    }

    console.log(`[${workerId}] ✅ Integridade dos chunks validada: ${integrityCheck?.valid_chunks}/${integrityCheck?.total_chunks}`);

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
      console.log(`[${workerId}] ✅ Nenhum prompt pendente para consolidar nesta chamada`);

      const { data: allResults } = await supabase
        .from('analysis_results')
        .select('id, status, prompt_title')
        .eq('processo_id', processo_id);

      const allCompleted = allResults?.every(r => r.status === 'completed');
      const hasRunning = allResults?.some(r => r.status === 'running');
      const hasPending = allResults?.some(r => r.status === 'pending');

      console.log(`[${workerId}] 📊 Status das etapas:`, {
        total: allResults?.length,
        completed: allResults?.filter(r => r.status === 'completed').length,
        running: allResults?.filter(r => r.status === 'running').length,
        pending: allResults?.filter(r => r.status === 'pending').length,
      });

      if (hasRunning || hasPending) {
        console.log(`[${workerId}] ⚠️ Há etapas ainda em processamento. NÃO marcar como completed.`);

        if (hasRunning) {
          const runningPrompts = allResults?.filter(r => r.status === 'running');
          console.log(`[${workerId}] 🔍 Etapas em running:`, runningPrompts?.map(r => r.prompt_title));
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Nenhum prompt para consolidar nesta chamada, mas há etapas ainda em processamento',
            has_running: hasRunning,
            has_pending: hasPending,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      if (!allCompleted) {
        console.log(`[${workerId}] ⚠️ Nem todas as etapas estão completed. NÃO marcar como concluído.`);
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Nem todas as etapas estão concluídas',
            all_completed: false,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const { data: processoInfo } = await supabase
        .from('processos')
        .select('transcricao')
        .eq('id', processo_id)
        .single();

      const totalPages = processoInfo?.transcricao?.totalPages || 0;
      console.log(`[${workerId}] 📄 Total de páginas processadas: ${totalPages}`);
      console.log(`[${workerId}] ✅ TODAS as etapas estão completed. Marcando processo como concluído.`);

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
        .eq('id', processo_id);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Consolidação concluída - todos os prompts já processados',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = await getActiveModel(supabase);

    console.log(`[${workerId}] 🤖 Usando modelo: ${model.name} (${model.modelId})`);

    const generativeModel = genAI.getGenerativeModel({
      model: model.modelId,
      generationConfig: {
        temperature: model.temperature,
        maxOutputTokens: model.maxTokens,
      },
    });

    for (const analysisResult of analysisResults) {
      console.log(`[${workerId}] 🔍 Consolidando: ${analysisResult.prompt_title}`);

      const fullPrompt = `${analysisResult.system_prompt || ''}\n\n${analysisResult.prompt_content}\n\nDOCUMENTO EM LOTES:\n${allSummaries}`;

      const startTime = Date.now();
      const result = await generativeModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
        generationConfig: {
          temperature: model.temperature,
          maxOutputTokens: model.maxTokens,
          responseMimeType: 'application/json',
        },
      });
      const response = result.response;
      const text = response.text();

      const tokensUsed = (
        (response.usageMetadata?.promptTokenCount || 0) +
        (response.usageMetadata?.candidatesTokenCount || 0)
      );

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

      await supabase
        .from('processos')
        .update({ current_prompt_number: analysisResult.execution_order })
        .eq('id', processo_id);

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

    const { data: allResultsAfterConsolidation } = await supabase
      .from('analysis_results')
      .select('id, status, prompt_title')
      .eq('processo_id', processo_id);

    const allCompleted = allResultsAfterConsolidation?.every(r => r.status === 'completed');
    const hasRunning = allResultsAfterConsolidation?.some(r => r.status === 'running');
    const hasPending = allResultsAfterConsolidation?.some(r => r.status === 'pending');

    console.log(`[${workerId}] 📊 Status final das etapas:`, {
      total: allResultsAfterConsolidation?.length,
      completed: allResultsAfterConsolidation?.filter(r => r.status === 'completed').length,
      running: allResultsAfterConsolidation?.filter(r => r.status === 'running').length,
      pending: allResultsAfterConsolidation?.filter(r => r.status === 'pending').length,
    });

    if (allCompleted && !hasRunning && !hasPending) {
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

      console.log(`[${workerId}] 🔄 Disparando processamento do próximo prompt pendente...`);

      fetch(`${supabaseUrl}/functions/v1/process-complex-worker`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ processo_id }),
      }).catch(err => {
        console.error(`[${workerId}] ❌ Erro ao disparar próximo prompt:`, err?.message);
      });
    }

    if (allCompleted && !hasRunning && !hasPending) {
      const { data: processoData } = await supabase
        .from('processos')
        .select('user_id, file_name, created_at, is_chunked, status')
        .eq('id', processo_id)
        .single();

      if (processoData?.user_id) {
        await supabase
          .from('notifications')
          .insert({
            user_id: processoData.user_id,
            type: 'analysis_completed',
            message: 'Análise de documento complexo concluída com sucesso',
            processo_id: processo_id,
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

        console.log(`[${workerId}] 🔔 Processo completo! Enviando notificação administrativa...`);

        const { data: userData } = await supabase
          .from('user_profiles')
          .select('email, first_name, last_name')
          .eq('id', processoData.user_id)
          .maybeSingle();

        const startTime = new Date(processoData.created_at);
        const endTime = new Date();
        const durationMs = endTime.getTime() - startTime.getTime();
        const durationMinutes = Math.floor(durationMs / 60000);
        const durationSeconds = Math.floor((durationMs % 60000) / 1000);
        const durationText = durationMinutes > 0
          ? `${durationMinutes}m ${durationSeconds}s`
          : `${durationSeconds}s`;

        const userName = userData ? `${userData.first_name || ''} ${userData.last_name || ''}`.trim() : 'N/A';
        const userEmail = userData?.email || 'N/A';
        const fileName = processoData.file_name || 'N/A';

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
            is_complex: processoData.is_chunked,
          },
          userId: processoData.user_id,
          processoId: processo_id,
        });
      }
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