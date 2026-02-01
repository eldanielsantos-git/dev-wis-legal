/*
  # Correção: Prevenir Reprocessamento de Chunks de Processos Completados

  ## Problema
  A função `recover_stuck_chunks` estava reativando chunks de processos já completados,
  causando tentativas de reprocessamento de arquivos Gemini expirados (>48h),
  gerando centenas de erros 403 por dia.

  ## Solução
  Adicionar filtro para excluir chunks de processos com status 'completed' ou 'error'.

  ## Impacto
  - Elimina erros 403 de arquivos Gemini expirados
  - Reduz carga desnecessária nos workers
  - Mantém lógica de recuperação para processos legítimos
*/

-- Recriar função com filtro de processos completados
CREATE OR REPLACE FUNCTION recover_stuck_chunks(
  p_stuck_threshold_minutes INTEGER DEFAULT 15
)
RETURNS TABLE(
  recovered_count INTEGER,
  processo_ids UUID[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_recovered_count INTEGER := 0;
  v_processo_ids UUID[];
BEGIN
  -- Reset stuck chunks to 'pending' status
  -- EXCLUINDO chunks de processos já completados ou em erro
  WITH updated AS (
    UPDATE processing_queue
    SET
      status = 'pending',
      lock_acquired_at = NULL,
      lock_expires_at = NULL,
      worker_id = NULL,
      updated_at = NOW()
    WHERE id IN (
      SELECT pq.id
      FROM processing_queue pq
      INNER JOIN processos p ON pq.processo_id = p.id
      WHERE pq.status IN ('retry', 'failed')
        AND pq.attempt_number < pq.max_attempts
        AND pq.updated_at < (NOW() - (p_stuck_threshold_minutes || ' minutes')::INTERVAL)
        -- NOVO FILTRO: Só recuperar chunks de processos ativos
        AND p.status NOT IN ('completed', 'error')
    )
    RETURNING id, processo_id
  )
  SELECT
    COUNT(*)::INTEGER,
    ARRAY_AGG(DISTINCT processo_id)
  INTO v_recovered_count, v_processo_ids
  FROM updated;

  RAISE NOTICE 'Chunks recuperados (apenas de processos ativos): %', v_recovered_count;

  RETURN QUERY SELECT v_recovered_count, v_processo_ids;
END;
$$;

COMMENT ON FUNCTION recover_stuck_chunks IS
  'Recupera chunks travados, excluindo chunks de processos já completados ou em erro';


-- Dropar e recriar função get_stuck_chunks com novo filtro
DROP FUNCTION IF EXISTS get_stuck_chunks(INTEGER);

CREATE OR REPLACE FUNCTION get_stuck_chunks(
  p_stuck_threshold_minutes INTEGER DEFAULT 15
)
RETURNS TABLE(
  chunk_id UUID,
  processo_id UUID,
  status TEXT,
  attempt_number INTEGER,
  minutes_stuck NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pq.id as chunk_id,
    pq.processo_id,
    pq.status,
    pq.attempt_number,
    EXTRACT(EPOCH FROM (NOW() - pq.updated_at)) / 60 as minutes_stuck
  FROM processing_queue pq
  INNER JOIN processos p ON pq.processo_id = p.id
  WHERE pq.status IN ('retry', 'failed', 'processing')
    AND pq.attempt_number < pq.max_attempts
    AND pq.updated_at < (NOW() - (p_stuck_threshold_minutes || ' minutes')::INTERVAL)
    -- NOVO FILTRO: Só retornar chunks de processos ativos
    AND p.status NOT IN ('completed', 'error')
  ORDER BY pq.updated_at ASC;
END;
$$;

COMMENT ON FUNCTION get_stuck_chunks IS
  'Retorna chunks travados, excluindo chunks de processos já completados ou em erro';


-- Limpar itens órfãos da processing_queue de processos completados ou em erro
DELETE FROM processing_queue
WHERE processo_id IN (
  SELECT id FROM processos
  WHERE status IN ('completed', 'error')
  AND updated_at < NOW() - INTERVAL '48 hours'
);
