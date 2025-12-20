/*
  # Fix acquire_next_prompt_lock with correct syntax

  1. Changes
    - Drop and recreate function
    - Use CTE to select the next prompt first
    - Then update it
    - Remove max_retries (doesn't exist in table)
*/

DROP FUNCTION IF EXISTS acquire_next_prompt_lock(uuid, timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION acquire_next_prompt_lock(
  p_processo_id uuid,
  p_now timestamptz,
  p_lock_timeout timestamptz
)
RETURNS TABLE(
  id uuid,
  prompt_id uuid,
  prompt_title text,
  prompt_content text,
  system_prompt text,
  execution_order integer,
  retry_count integer
) 
LANGUAGE plpgsql
AS $$
DECLARE
  v_result_id uuid;
BEGIN
  SELECT ar.id INTO v_result_id
  FROM analysis_results ar
  WHERE ar.processo_id = p_processo_id
    AND ar.status = 'pending'
    AND (ar.processing_at IS NULL OR ar.processing_at < p_lock_timeout)
    AND NOT EXISTS (
      SELECT 1 
      FROM analysis_results ar_inner
      WHERE ar_inner.processo_id = p_processo_id
        AND ar_inner.execution_order < ar.execution_order
        AND ar_inner.status != 'completed'
    )
  ORDER BY ar.execution_order ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_result_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  UPDATE analysis_results ar
  SET 
    processing_at = p_now,
    status = 'processing'
  WHERE ar.id = v_result_id
  RETURNING 
    ar.id,
    ar.prompt_id,
    ar.prompt_title,
    ar.prompt_content,
    ar.system_prompt,
    ar.execution_order,
    COALESCE(ar.retry_count, 0) as retry_count;
END;
$$;
