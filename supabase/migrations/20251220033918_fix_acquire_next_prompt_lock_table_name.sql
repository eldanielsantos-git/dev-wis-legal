/*
  # Fix acquire_next_prompt_lock - Correct Table Name

  ## Problem
  The RPC function `acquire_next_prompt_lock` was referencing the wrong table name:
  - Using: forensic_analysis_prompts ❌
  - Correct: analysis_prompts ✅

  ## Solution
  Recreate the function with the correct table name reference.

  ## Changes
  1. Drop existing function
  2. Recreate with correct table reference: analysis_prompts
*/

-- Drop the existing function with wrong table reference
DROP FUNCTION IF EXISTS acquire_next_prompt_lock(uuid, timestamptz, timestamptz);

-- Create the corrected RPC function
CREATE OR REPLACE FUNCTION acquire_next_prompt_lock(
  p_processo_id uuid,
  p_now timestamptz,
  p_lock_timeout timestamptz
)
RETURNS TABLE (
  id uuid,
  prompt_id uuid,
  prompt_title text,
  prompt_content text,
  system_prompt text,
  execution_order int,
  retry_count int,
  max_retries int
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- CRITICAL: Check if there are ANY prompts currently processing or running
  -- This ensures strict sequential processing
  IF EXISTS (
    SELECT 1
    FROM analysis_results
    WHERE processo_id = p_processo_id
      AND status IN ('processing', 'running')
  ) THEN
    -- Another prompt is running, do not acquire lock
    -- This prevents parallel execution
    RETURN;
  END IF;

  -- No prompts running, safe to acquire next pending prompt
  -- Get the next pending prompt by execution_order and lock it
  RETURN QUERY
  UPDATE analysis_results ar
  SET
    status = 'processing',
    processing_at = p_now
  FROM analysis_prompts ap
  WHERE ar.prompt_id = ap.id
    AND ar.processo_id = p_processo_id
    AND ar.status = 'pending'
    AND ar.id = (
      SELECT id
      FROM analysis_results
      WHERE processo_id = p_processo_id
        AND status = 'pending'
      ORDER BY execution_order ASC
      LIMIT 1
    )
  RETURNING
    ar.id,
    ar.prompt_id,
    ap.title as prompt_title,
    ap.prompt_content,
    ap.system_prompt,
    ar.execution_order,
    COALESCE(ar.retry_count, 0) as retry_count,
    COALESCE(ar.max_retries, 3) as max_retries;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION acquire_next_prompt_lock(uuid, timestamptz, timestamptz) TO authenticated;

-- Add comment explaining the function
COMMENT ON FUNCTION acquire_next_prompt_lock IS 'Acquires lock for next pending prompt ONLY if no other prompt is currently processing. Ensures sequential execution (1→2→3→4) instead of parallel execution. FIXED: Now correctly references analysis_prompts table.';