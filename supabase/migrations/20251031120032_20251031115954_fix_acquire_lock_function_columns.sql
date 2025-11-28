/*
  # Corrigir Função acquire_next_prompt_lock

  1. Problema
    - Função está tentando retornar colunas model_id e model_name
    - Essas colunas não existem em analysis_results

  2. Solução
    - Dropar e recriar função com colunas corretas
*/

-- Dropar função antiga
DROP FUNCTION IF EXISTS acquire_next_prompt_lock(uuid, timestamptz, timestamptz);

-- Criar função corrigida
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

COMMENT ON FUNCTION acquire_next_prompt_lock IS 'Adquire lock atômico no próximo prompt disponível para processamento';
