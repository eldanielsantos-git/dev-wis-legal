/*
  # Corrigir Processamento Sequencial - Lock Global por Processo

  ## Problema
  Múltiplos workers chamando process-next-prompt simultaneamente resultam em:
  - Vários prompts sendo processados ao mesmo tempo (paralelo não controlado)
  - Performance muito pior devido à competição por recursos
  - Não respeita a ordem sequencial desejada

  ## Solução
  1. Adicionar campo `is_processing_locked` na tabela `processos`
  2. Modificar `acquire_next_prompt_lock` para verificar este lock global
  3. Apenas 1 worker pode processar prompts de um processo por vez
  4. Mantém processamento sequencial: Prompt 1 → Prompt 2 → ... → Prompt 9

  ## Comportamento
  - Worker 1 chama process-next-prompt → adquire lock global → processa Prompt 1
  - Worker 2 chama process-next-prompt → lock ocupado → retorna vazio (sem fazer nada)
  - Worker 1 termina Prompt 1 → libera lock → próxima chamada pega Prompt 2
*/

-- Adicionar campo de lock global por processo
ALTER TABLE processos
ADD COLUMN IF NOT EXISTS is_processing_locked boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS processing_lock_acquired_at timestamptz,
ADD COLUMN IF NOT EXISTS processing_lock_worker_id text;

-- Índice para otimizar consultas de lock
CREATE INDEX IF NOT EXISTS idx_processos_processing_lock
ON processos(id, is_processing_locked)
WHERE is_processing_locked = true;

-- Função para adquirir lock global do processo
CREATE OR REPLACE FUNCTION acquire_processo_lock(
  p_processo_id uuid,
  p_worker_id text,
  p_lock_timeout_minutes int DEFAULT 15
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_locked boolean;
  v_lock_timeout timestamptz;
BEGIN
  v_lock_timeout := now() - (p_lock_timeout_minutes || ' minutes')::interval;

  -- Tentar adquirir lock (ou renovar se já é dono)
  UPDATE processos
  SET
    is_processing_locked = true,
    processing_lock_acquired_at = now(),
    processing_lock_worker_id = p_worker_id
  WHERE id = p_processo_id
    AND (
      -- Lock disponível
      is_processing_locked = false
      -- Ou lock expirado
      OR processing_lock_acquired_at < v_lock_timeout
      -- Ou já é dono do lock
      OR processing_lock_worker_id = p_worker_id
    )
  RETURNING true INTO v_locked;

  RETURN COALESCE(v_locked, false);
END;
$$;

-- Função para liberar lock global do processo
CREATE OR REPLACE FUNCTION release_processo_lock(
  p_processo_id uuid,
  p_worker_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE processos
  SET
    is_processing_locked = false,
    processing_lock_acquired_at = NULL,
    processing_lock_worker_id = NULL
  WHERE id = p_processo_id
    AND processing_lock_worker_id = p_worker_id;
END;
$$;

-- Atualizar acquire_next_prompt_lock para verificar lock global
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
DECLARE
  v_is_locked boolean;
BEGIN
  -- Verificar se processo está travado para processamento
  SELECT is_processing_locked
  INTO v_is_locked
  FROM processos
  WHERE processos.id = p_processo_id;

  -- Se processo não está travado, não permite pegar próximo prompt
  -- (significa que outro worker não adquiriu o lock global ainda)
  IF NOT COALESCE(v_is_locked, false) THEN
    RETURN;
  END IF;

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

-- Grant permissions
GRANT EXECUTE ON FUNCTION acquire_processo_lock TO service_role;
GRANT EXECUTE ON FUNCTION release_processo_lock TO service_role;

-- Comentários
COMMENT ON FUNCTION acquire_processo_lock IS 'Adquire lock global para processar prompts de um processo. Apenas 1 worker pode processar por vez.';
COMMENT ON FUNCTION release_processo_lock IS 'Libera lock global de processamento de um processo.';
COMMENT ON COLUMN processos.is_processing_locked IS 'Indica se algum worker está processando prompts deste processo';
COMMENT ON COLUMN processos.processing_lock_acquired_at IS 'Timestamp de quando o lock foi adquirido';
COMMENT ON COLUMN processos.processing_lock_worker_id IS 'ID do worker que possui o lock';
