/*
  # Forçar Processamento Sequencial de Prompts

  ## Alterações
  
  1. Modifica `acquire_next_queue_item()` para processar prompts de forma sequencial
  2. Garante que apenas 1 prompt seja processado por vez
  3. Dentro de cada prompt, processa todos os chunks paralelamente
  
  ## Ordem de Processamento
  
  1. Prompt 1 (Visão Geral) - todos os chunks
  2. Prompt 2 (Resumo Estratégico) - todos os chunks
  3. ... e assim por diante até Prompt 9
  
  ## Como Funciona
  
  - Busca o prompt com menor `execution_order` que ainda tem chunks pendentes
  - Dentro desse prompt, permite processar múltiplos chunks simultaneamente
  - Só passa para o próximo prompt quando TODOS os chunks do atual terminarem
*/

-- Drop the existing function first
DROP FUNCTION IF EXISTS acquire_next_queue_item(text, int);

-- Recreate with sequential prompt processing
CREATE OR REPLACE FUNCTION acquire_next_queue_item(
  p_worker_id text,
  p_lock_duration_minutes int DEFAULT 15
)
RETURNS TABLE (
  queue_item_id uuid,
  processo_id uuid,
  chunk_id uuid,
  queue_type text,
  context_data jsonb,
  prompt_id uuid,
  prompt_content text,
  attempt_number int
)
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  UPDATE processing_queue pq
  SET
    status = 'processing',
    processing_started_at = now(),
    lock_acquired_at = now(),
    lock_expires_at = now() + (p_lock_duration_minutes || ' minutes')::interval,
    worker_id = p_worker_id,
    attempt_number = pq.attempt_number + 1,
    last_heartbeat = now()
  WHERE pq.id = (
    WITH current_prompt AS (
      -- Encontrar o prompt com menor execution_order que ainda tem itens pendentes
      SELECT DISTINCT
        ar.execution_order,
        pq2.prompt_id
      FROM processing_queue pq2
      JOIN analysis_results ar ON pq2.prompt_id = ar.prompt_id
      WHERE pq2.status IN ('pending', 'retry')
        AND (pq2.lock_expires_at IS NULL OR pq2.lock_expires_at < now())
      ORDER BY ar.execution_order ASC
      LIMIT 1
    )
    -- Pegar próximo item desse prompt específico
    SELECT pq3.id 
    FROM processing_queue pq3
    INNER JOIN current_prompt cp ON pq3.prompt_id = cp.prompt_id
    WHERE pq3.status IN ('pending', 'retry')
      AND (pq3.lock_expires_at IS NULL OR pq3.lock_expires_at < now())
    ORDER BY pq3.priority ASC, pq3.queue_position ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING
    pq.id,
    pq.processo_id,
    pq.chunk_id,
    pq.queue_type,
    pq.context_data,
    pq.prompt_id,
    pq.prompt_content,
    pq.attempt_number;
END;
$$ LANGUAGE plpgsql;

-- Re-grant permissions
GRANT EXECUTE ON FUNCTION acquire_next_queue_item TO service_role;