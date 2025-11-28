/*
  # Periodic Lock Cleanup System
  
  1. New Functions
    - `periodic_cleanup_locks`: Limpa locks e prompts travados periodicamente
  
  2. Purpose
    - Executar limpeza automática a cada minuto
    - Detectar e limpar locks travados por mais de 3 minutos
    - Resetar prompts em "running" por mais de 3 minutos
  
  3. Changes
    - Add periodic cleanup function with cron schedule
*/

-- Function to perform periodic cleanup
CREATE OR REPLACE FUNCTION periodic_cleanup_locks()
RETURNS jsonb AS $$
DECLARE
  v_expired_locks int := 0;
  v_stuck_prompts int := 0;
  v_result jsonb;
BEGIN
  -- Cleanup locks older than 3 minutes
  UPDATE processos
  SET 
    processing_lock = false,
    processing_worker_id = null,
    processing_lock_acquired_at = null,
    processing_lock_expires_at = null
  WHERE processing_lock = true
    AND processing_lock_acquired_at < NOW() - interval '3 minutes';
  
  GET DIAGNOSTICS v_expired_locks = ROW_COUNT;
  
  -- Reset stuck analysis results (running for more than 3 minutes)
  UPDATE analysis_results
  SET 
    status = 'pending',
    processing_at = NULL
  WHERE status = 'running'
    AND processing_at < NOW() - interval '3 minutes';
  
  GET DIAGNOSTICS v_stuck_prompts = ROW_COUNT;
  
  -- Build result
  v_result := jsonb_build_object(
    'timestamp', NOW(),
    'expired_locks_cleaned', v_expired_locks,
    'stuck_prompts_reset', v_stuck_prompts
  );
  
  -- Log if any cleanup was performed
  IF v_expired_locks > 0 OR v_stuck_prompts > 0 THEN
    RAISE NOTICE 'Periodic cleanup: % locks, % prompts', v_expired_locks, v_stuck_prompts;
  END IF;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION periodic_cleanup_locks TO service_role;

COMMENT ON FUNCTION periodic_cleanup_locks IS 'Executa limpeza periódica de locks e prompts travados (deve ser chamado por cron a cada minuto)';
