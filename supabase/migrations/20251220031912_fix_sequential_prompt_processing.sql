/*
  # Fix Sequential Prompt Processing

  This migration fixes the issue where multiple prompts are processed in parallel
  instead of sequentially (1, 2, 3, 4... in order).

  ## Changes

  1. **RPC Function `acquire_next_prompt_lock`**
     - CRITICAL FIX: Now verifies if there are any prompts with status 'processing' or 'running'
     - If ANY prompt is currently running, returns NULL (no lock acquired)
     - Only returns and locks the next 'pending' prompt if NO other prompt is running
     - Ensures strict sequential processing: one prompt at a time

  2. **Security**
     - Function uses SECURITY DEFINER to ensure proper execution
     - Only accessible to authenticated users

  ## Why This Fix is Needed

  Previously, the system would:
  - Prompt 2 finishes → triggers Prompt 4
  - Prompt 3 still processing → but Prompt 4 already started ❌

  Now, the system will:
  - Prompt 2 finishes → checks if any prompt is running
  - Prompt 3 still running → returns NULL, waits ✅
  - Only when Prompt 3 completes → Prompt 4 can start ✅
*/

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS acquire_next_prompt_lock(uuid, timestamptz, timestamptz);

-- Create the fixed RPC function
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
  FROM forensic_analysis_prompts fap
  WHERE ar.prompt_id = fap.id
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
    fap.title as prompt_title,
    fap.prompt_content,
    fap.system_prompt,
    ar.execution_order,
    COALESCE(ar.retry_count, 0) as retry_count,
    COALESCE(ar.max_retries, 3) as max_retries;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION acquire_next_prompt_lock(uuid, timestamptz, timestamptz) TO authenticated;

-- Add comment explaining the function
COMMENT ON FUNCTION acquire_next_prompt_lock IS 'Acquires lock for next pending prompt ONLY if no other prompt is currently processing. Ensures sequential execution (1→2→3→4) instead of parallel execution.';
