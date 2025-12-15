/*
  # Corrigir Sistema de Locks Sequenciais
  
  Aplica as colunas e funções necessárias para garantir processamento sequencial.
*/

-- Adicionar colunas de lock sequencial se não existirem
ALTER TABLE processos
ADD COLUMN IF NOT EXISTS is_processing_locked boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS processing_lock_worker_id text;

-- Índice para otimizar consultas de lock
CREATE INDEX IF NOT EXISTS idx_processos_processing_lock_status
ON processos(id, is_processing_locked)
WHERE is_processing_locked = true;

-- Drop funções existentes para recriar com assinatura correta
DROP FUNCTION IF EXISTS acquire_processo_lock(uuid, text, int);
DROP FUNCTION IF EXISTS release_processo_lock(uuid, text);

-- Função para adquirir lock global do processo
CREATE FUNCTION acquire_processo_lock(
  p_processo_id uuid,
  p_worker_id text,
  p_lock_timeout_minutes int DEFAULT 15
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_locked boolean;
  v_lock_timeout timestamptz;
BEGIN
  v_lock_timeout := now() - (p_lock_timeout_minutes || ' minutes')::interval;

  UPDATE processos
  SET
    is_processing_locked = true,
    processing_lock_acquired_at = now(),
    processing_lock_worker_id = p_worker_id
  WHERE id = p_processo_id
    AND (
      is_processing_locked = false
      OR processing_lock_acquired_at < v_lock_timeout
      OR processing_lock_worker_id = p_worker_id
    )
  RETURNING true INTO v_locked;

  RETURN COALESCE(v_locked, false);
END;
$$;

-- Função para liberar lock global do processo
CREATE FUNCTION release_processo_lock(
  p_processo_id uuid,
  p_worker_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION acquire_processo_lock TO service_role;
GRANT EXECUTE ON FUNCTION release_processo_lock TO service_role;

-- Comentários
COMMENT ON FUNCTION acquire_processo_lock IS 'Adquire lock global para processar prompts de um processo sequencialmente';
COMMENT ON FUNCTION release_processo_lock IS 'Libera lock global de processamento';
