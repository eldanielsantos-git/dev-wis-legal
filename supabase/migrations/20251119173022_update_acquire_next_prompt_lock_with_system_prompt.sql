/*
  # Atualizar Função acquire_next_prompt_lock para Retornar System Prompt

  1. Alteração
    - Adiciona coluna `system_prompt` ao retorno da função acquire_next_prompt_lock
    - Necessário para que process-next-prompt receba o system_prompt do analysis_result

  2. Contexto
    - Tentativa anterior (20251104140650) falhou porque analysis_results não tinha a coluna
    - Agora que a coluna existe, podemos retornar o valor corretamente

  3. Uso
    - Edge function process-next-prompt já está preparada para usar este campo
    - Valor será enviado como systemInstruction para o Gemini
*/

-- Dropar função existente
DROP FUNCTION IF EXISTS acquire_next_prompt_lock(uuid, timestamptz, timestamptz);

-- Recriar função COM system_prompt
CREATE OR REPLACE FUNCTION acquire_next_prompt_lock(
  p_processo_id uuid,
  p_now timestamptz,
  p_lock_timeout timestamptz
)
RETURNS TABLE (
  id uuid,
  processo_id uuid,
  prompt_id uuid,
  prompt_title text,
  prompt_content text,
  system_prompt text,
  result_content text,
  execution_order integer,
  status text,
  error_message text,
  tokens_used integer,
  execution_time_ms integer,
  created_at timestamptz,
  completed_at timestamptz,
  processing_at timestamptz
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Buscar próximo prompt disponível e bloqueá-lo atomicamente
  RETURN QUERY
  UPDATE analysis_results
  SET
    status = 'processing',
    processing_at = p_now
  WHERE analysis_results.id = (
    SELECT analysis_results.id
    FROM analysis_results
    WHERE analysis_results.processo_id = p_processo_id
      AND analysis_results.status = 'pending'
      AND (
        analysis_results.processing_at IS NULL
        OR analysis_results.processing_at < p_lock_timeout
      )
    ORDER BY analysis_results.execution_order ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING
    analysis_results.id,
    analysis_results.processo_id,
    analysis_results.prompt_id,
    analysis_results.prompt_title,
    analysis_results.prompt_content,
    analysis_results.system_prompt,
    analysis_results.result_content,
    analysis_results.execution_order,
    analysis_results.status,
    analysis_results.error_message,
    analysis_results.tokens_used,
    analysis_results.execution_time_ms,
    analysis_results.created_at,
    analysis_results.completed_at,
    analysis_results.processing_at;
END;
$$;

COMMENT ON FUNCTION acquire_next_prompt_lock IS 'Adquire lock atômico no próximo prompt disponível para processamento. Retorna system_prompt para uso com LLMs.';