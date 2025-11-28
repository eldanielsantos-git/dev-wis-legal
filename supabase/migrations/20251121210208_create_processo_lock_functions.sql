/*
  # Create processo lock functions
  
  1. Functions Created
    - `acquire_processo_lock`: Acquires a global lock for a processo
    - `release_processo_lock`: Releases the global lock for a processo
  
  2. Purpose
    - Prevent concurrent processing of the same processo
    - Ensure sequential prompt processing
    - Handle lock timeouts for stuck processes
*/

-- Function to acquire a global lock for a processo
CREATE OR REPLACE FUNCTION acquire_processo_lock(
  p_processo_id uuid,
  p_worker_id text,
  p_lock_timeout_minutes int DEFAULT 15
) RETURNS boolean AS $$
DECLARE
  v_locked boolean;
  v_lock_expires_at timestamptz;
BEGIN
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

-- Function to release a global lock for a processo
CREATE OR REPLACE FUNCTION release_processo_lock(
  p_processo_id uuid,
  p_worker_id text
) RETURNS boolean AS $$
DECLARE
  v_released boolean;
BEGIN
  UPDATE processos
  SET 
    processing_lock = false,
    processing_worker_id = null,
    processing_lock_acquired_at = null,
    processing_lock_expires_at = null
  WHERE id = p_processo_id
    AND processing_worker_id = p_worker_id
  RETURNING true INTO v_released;
  
  RETURN COALESCE(v_released, false);
END;
$$ LANGUAGE plpgsql;