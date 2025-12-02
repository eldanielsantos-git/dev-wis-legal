import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log("=== RESTART STUCK ANALYSIS - START ===");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { processo_id } = await req.json();

    if (!processo_id) {
      throw new Error("processo_id \u00e9 obrigat\u00f3rio");
    }

    console.log(`Verificando processo travado: ${processo_id}`);

    // 1. Verificar se o processo existe e est\u00e1 travado
    const { data: processo, error: processoError } = await supabase
      .from("processos")
      .select("id, status, created_at, updated_at")
      .eq("id", processo_id)
      .single();

    if (processoError || !processo) {
      throw new Error(`Processo n\u00e3o encontrado: ${processo_id}`);
    }

    console.log(`Processo encontrado - Status: ${processo.status}`);

    // 2. Verificar quantos prompts foram completados
    const { data: results, error: resultsError } = await supabase
      .from("analysis_results")
      .select("id, prompt_title, status, execution_order")
      .eq("processo_id", processo_id)
      .order("execution_order");

    if (resultsError) {
      throw new Error(`Erro ao buscar resultados: ${resultsError.message}`);
    }

    const completedCount = results?.filter(r => r.status === "completed").length || 0;
    const totalCount = results?.length || 0;
    const hasStuckPrompts = results?.some(r => r.status === "running") || false;

    console.log(`Progresso: ${completedCount}/${totalCount} prompts completados`);
    console.log(`Prompts travados (running): ${hasStuckPrompts}`);

    // 3. Determinar se est\u00e1 realmente travado
    const lastUpdate = new Date(processo.updated_at).getTime();
    const now = Date.now();
    const minutesSinceUpdate = (now - lastUpdate) / (1000 * 60);

    const isStuck =
      processo.status === "analyzing" &&
      (hasStuckPrompts || totalCount === 0 || completedCount < totalCount) &&
      minutesSinceUpdate > 2;

    if (!isStuck) {
      console.log("Processo n\u00e3o est\u00e1 travado, n\u00e3o \u00e9 necess\u00e1rio reiniciar");
      return new Response(
        JSON.stringify({
          success: false,
          message: "Processo n\u00e3o est\u00e1 travado",
          status: processo.status,
          completed: completedCount,
          total: totalCount,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("\ud83d\udd04 Processo travado detectado! Iniciando restart completo...");

    // 4. Limpar locks do processo
    console.log("Step 1: Limpando locks...");
    await supabase
      .from("processos")
      .update({
        processing_lock: false,
        processing_worker_id: null,
        processing_lock_acquired_at: null,
        processing_lock_expires_at: null,
      })
      .eq("id", processo_id);

    // 5. Deletar todos os analysis_results existentes
    console.log("Step 2: Deletando resultados anteriores...");
    const { error: deleteError } = await supabase
      .from("analysis_results")
      .delete()
      .eq("processo_id", processo_id);

    if (deleteError) {
      console.error("Erro ao deletar resultados:", deleteError);
    }

    // 6. Deletar analysis_executions
    console.log("Step 3: Deletando execu\u00e7\u00f5es anteriores...");
    await supabase
      .from("analysis_executions")
      .delete()
      .eq("processo_id", processo_id);

    // 7. Resetar o status do processo para 'created'
    console.log("Step 4: Resetando status do processo...");
    const { error: updateError } = await supabase
      .from("processos")
      .update({
        status: "created",
        analysis_started_at: null,
        analysis_completed_at: null,
        current_llm_model_id: null,
        current_llm_model_name: null,
        llm_model_switching: false,
        llm_switch_reason: null,
        llm_models_attempted: [],
        processing_lock: false,
        processing_worker_id: null,
        processing_lock_acquired_at: null,
        processing_lock_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", processo_id);

    if (updateError) {
      throw new Error(`Erro ao resetar processo: ${updateError.message}`);
    }

    console.log("\u2705 Processo resetado com sucesso!");

    // 8. Disparar nova an\u00e1lise
    console.log("Step 5: Disparando nova an\u00e1lise...");

    const startAnalysisResponse = await fetch(`${supabaseUrl}/functions/v1/start-analysis`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ processo_id }),
    });

    const startAnalysisResult = await startAnalysisResponse.json();

    if (!startAnalysisResponse.ok) {
      console.error("Erro ao disparar an\u00e1lise:", startAnalysisResult);
      throw new Error(`Erro ao disparar an\u00e1lise: ${startAnalysisResult.error || "Unknown error"}`);
    }

    console.log("\u2705 Nova an\u00e1lise disparada com sucesso!");
    console.log("=== RESTART STUCK ANALYSIS - SUCCESS ===");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Processo reiniciado com sucesso",
        processo_id,
        previous_progress: {
          completed: completedCount,
          total: totalCount,
        },
        restart_details: {
          results_deleted: results?.length || 0,
          new_analysis_started: true,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("\ud83d\udca5 Error in restart-stuck-analysis:", error);
    console.error("Stack trace:", error instanceof Error ? error.stack : "No stack trace");

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
