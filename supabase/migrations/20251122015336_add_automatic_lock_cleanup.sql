/*
  # Automatic Lock Cleanup System
  
  1. New Functions
    - `cleanup_expired_processo_locks`: Cleans up expired global locks
    - `cleanup_stuck_analysis_results`: Resets analysis results stuck in 'running' state
  
  2. Purpose
    - Automatically clean up locks that have expired
    - Reset prompts stuck in 'running' state after timeout
    - Prevent deadlock situations
  
  3. Changes
    - Add automatic cleanup functions
    - Allow any worker to clean expired locks
*/

-- Function to cleanup expired processo locks
CREATE OR REPLACE FUNCTION cleanup_expired_processo_locks()
RETURNS TABLE(processo_id uuid, previous_worker_id text) AS $$
BEGIN
  RETURN QUERY
  UPDATE processos
  SET 
    processing_lock = false,
    processing_worker_id = null,
    processing_lock_acquired_at = null,
    processing_lock_expires_at = null
  WHERE processing_lock = true
    AND processing_lock_expires_at < NOW()
  RETURNING id, processing_worker_id;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup stuck analysis results
CREATE OR REPLACE FUNCTION cleanup_stuck_analysis_results(
  p_timeout_minutes int DEFAULT 5
)
RETURNS TABLE(
  result_id uuid, 
  processo_id uuid,
  prompt_title text,
  stuck_duration_seconds numeric
) AS $$
BEGIN
  RETURN QUERY
  UPDATE analysis_results
  SET 
    status = 'pending',
    processing_at = NULL
  WHERE status = 'running'
    AND processing_at < NOW() - (p_timeout_minutes || ' minutes')::interval
  RETURNING 
    id,
    analysis_results.processo_id,
    analysis_results.prompt_title,
    EXTRACT(EPOCH FROM (NOW() - processing_at))::numeric;
END;
$$ LANGUAGE plpgsql;

-- Update acquire_processo_lock to cleanup expired locks first
CREATE OR REPLACE FUNCTION acquire_processo_lock(
  p_processo_id uuid,
  p_worker_id text,
  p_lock_timeout_minutes int DEFAULT 15
) RETURNS boolean AS $$
DECLARE
  v_locked boolean;
  v_lock_expires_at timestamptz;
BEGIN
  -- First, cleanup any expired locks for this processo
  UPDATE processos
  SET 
    processing_lock = false,
    processing_worker_id = null,
    processing_lock_acquired_at = null,
    processing_lock_expires_at = null
  WHERE id = p_processo_id
    AND processing_lock = true
    AND processing_lock_expires_at < NOW();
  
  v_lock_expires_at := now() + (p_lock_timeout_minutes || ' minutes')::interval;
  
  -- Try to acquire lock
  UPDATE processos
  SET 
    processing_lock = true,
    processing_worker_id = p_worker_id,
    processing_lock_acquired_at = now(),
    processing_lock_expires_at = v_lock_expires_at
  WHERE id = p_processo_id
    AND (
      processing_lock IS NOT TRUE
      OR processing_lock_expires_at < now()
    )
  RETURNING true INTO v_locked;
  
  RETURN COALESCE(v_locked, false);
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION cleanup_expired_processo_locks TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_stuck_analysis_results TO service_role;

COMMENT ON FUNCTION cleanup_expired_processo_locks IS 'Limpa locks globais expirados de processos';
COMMENT ON FUNCTION cleanup_stuck_analysis_results IS 'Reseta analysis_results travados em running por mais de N minutos';
COMMENT ON FUNCTION acquire_processo_lock IS 'Adquire lock global após limpar locks expirados automaticamente';
