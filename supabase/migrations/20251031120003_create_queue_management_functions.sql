/*
  # Create stored procedures for queue management

  1. Functions Created
    - acquire_next_queue_item() - Optimistic lock to get next item from queue
    - update_queue_heartbeat() - Update heartbeat during processing
    - complete_queue_item() - Mark item as completed with results
    - fail_queue_item() - Mark item as failed with error details
    - release_expired_locks() - Clean up expired locks automatically
    - get_queue_stats() - Get statistics about current queue state

  2. Purpose
    - Enable distributed workers to safely acquire and process queue items
    - Prevent race conditions with optimistic locking
    - Automatic recovery from worker failures via lock expiration
    - Health monitoring via heartbeat mechanism
    - Observability through queue statistics

  3. Security
    - Functions use SECURITY DEFINER to bypass RLS for workers
    - Only service role can execute these functions
*/

-- Function: Acquire next queue item with optimistic locking
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
    SELECT id FROM processing_queue
    WHERE status IN ('pending', 'retry')
    AND (lock_expires_at IS NULL OR lock_expires_at < now())
    ORDER BY priority ASC, queue_position ASC
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

-- Function: Update heartbeat during processing
CREATE OR REPLACE FUNCTION update_queue_heartbeat(
  p_queue_item_id uuid,
  p_worker_id text
)
RETURNS boolean
SECURITY DEFINER
AS $$
DECLARE
  updated boolean;
BEGIN
  UPDATE processing_queue
  SET last_heartbeat = now()
  WHERE id = p_queue_item_id
  AND worker_id = p_worker_id
  AND status = 'processing';

  updated := FOUND;
  RETURN updated;
END;
$$ LANGUAGE plpgsql;

-- Function: Complete queue item successfully
CREATE OR REPLACE FUNCTION complete_queue_item(
  p_queue_item_id uuid,
  p_worker_id text,
  p_result_data jsonb DEFAULT NULL,
  p_tokens_used int DEFAULT NULL
)
RETURNS boolean
SECURITY DEFINER
AS $$
DECLARE
  completed boolean;
BEGIN
  UPDATE processing_queue
  SET
    status = 'completed',
    processing_completed_at = now(),
    result_data = p_result_data,
    tokens_used = p_tokens_used,
    lock_acquired_at = NULL,
    lock_expires_at = NULL
  WHERE id = p_queue_item_id
  AND worker_id = p_worker_id
  AND status = 'processing';

  completed := FOUND;
  RETURN completed;
END;
$$ LANGUAGE plpgsql;

-- Function: Fail queue item with error details
CREATE OR REPLACE FUNCTION fail_queue_item(
  p_queue_item_id uuid,
  p_worker_id text,
  p_error_message text
)
RETURNS boolean
SECURITY DEFINER
AS $$
DECLARE
  v_attempt_number int;
  v_max_attempts int;
  failed boolean;
BEGIN
  -- Get current attempt information
  SELECT attempt_number, max_attempts
  INTO v_attempt_number, v_max_attempts
  FROM processing_queue
  WHERE id = p_queue_item_id;

  -- Determine new status based on attempts
  UPDATE processing_queue
  SET
    status = CASE
      WHEN v_attempt_number >= v_max_attempts THEN 'dead_letter'
      ELSE 'retry'
    END,
    error_message = p_error_message,
    error_count = error_count + 1,
    lock_acquired_at = NULL,
    lock_expires_at = NULL,
    worker_id = NULL
  WHERE id = p_queue_item_id
  AND worker_id = p_worker_id
  AND status = 'processing';

  failed := FOUND;
  RETURN failed;
END;
$$ LANGUAGE plpgsql;

-- Function: Release expired locks automatically
CREATE OR REPLACE FUNCTION release_expired_locks()
RETURNS TABLE (
  released_count int,
  moved_to_retry int,
  moved_to_dead_letter int
)
SECURITY DEFINER
AS $$
DECLARE
  v_released_count int := 0;
  v_retry_count int := 0;
  v_dead_letter_count int := 0;
BEGIN
  -- Update expired locks
  WITH updated AS (
    UPDATE processing_queue
    SET
      status = CASE
        WHEN attempt_number >= max_attempts THEN 'dead_letter'
        ELSE 'retry'
      END,
      lock_acquired_at = NULL,
      lock_expires_at = NULL,
      worker_id = NULL,
      error_count = error_count + 1,
      error_message = COALESCE(error_message, '') || ' [Lock expired at ' || now()::text || ']'
    WHERE status = 'processing'
    AND lock_expires_at < now()
    RETURNING
      id,
      CASE WHEN status = 'retry' THEN 1 ELSE 0 END as is_retry,
      CASE WHEN status = 'dead_letter' THEN 1 ELSE 0 END as is_dead_letter
  )
  SELECT
    COUNT(*)::int,
    SUM(is_retry)::int,
    SUM(is_dead_letter)::int
  INTO v_released_count, v_retry_count, v_dead_letter_count
  FROM updated;

  RETURN QUERY SELECT v_released_count, v_retry_count, v_dead_letter_count;
END;
$$ LANGUAGE plpgsql;

-- Function: Get queue statistics
CREATE OR REPLACE FUNCTION get_queue_stats(
  p_processo_id uuid DEFAULT NULL
)
RETURNS TABLE (
  total_items bigint,
  pending_items bigint,
  processing_items bigint,
  completed_items bigint,
  retry_items bigint,
  failed_items bigint,
  dead_letter_items bigint,
  avg_processing_time_seconds numeric
)
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::bigint as total_items,
    COUNT(*) FILTER (WHERE status = 'pending')::bigint as pending_items,
    COUNT(*) FILTER (WHERE status = 'processing')::bigint as processing_items,
    COUNT(*) FILTER (WHERE status = 'completed')::bigint as completed_items,
    COUNT(*) FILTER (WHERE status = 'retry')::bigint as retry_items,
    COUNT(*) FILTER (WHERE status = 'failed')::bigint as failed_items,
    COUNT(*) FILTER (WHERE status = 'dead_letter')::bigint as dead_letter_items,
    AVG(
      EXTRACT(EPOCH FROM (processing_completed_at - processing_started_at))
    ) FILTER (WHERE processing_completed_at IS NOT NULL) as avg_processing_time_seconds
  FROM processing_queue
  WHERE p_processo_id IS NULL OR processo_id = p_processo_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Get next chunk context for sequential processing
CREATE OR REPLACE FUNCTION get_chunk_context(
  p_processo_id uuid,
  p_current_chunk_index int
)
RETURNS TABLE (
  context_summary jsonb,
  previous_chunk_id uuid,
  previous_chunk_index int
)
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pc.context_summary,
    pc.id as previous_chunk_id,
    pc.chunk_index as previous_chunk_index
  FROM process_chunks pc
  WHERE pc.processo_id = p_processo_id
  AND pc.chunk_index = p_current_chunk_index - 1
  AND pc.status = 'completed'
  AND pc.context_summary IS NOT NULL
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function: Update complex processing status based on queue state
CREATE OR REPLACE FUNCTION update_complex_processing_progress(
  p_processo_id uuid
)
RETURNS boolean
SECURITY DEFINER
AS $$
DECLARE
  v_total_chunks int;
  v_chunks_completed int;
  v_chunks_processing int;
  v_chunks_failed int;
  v_avg_time numeric;
  updated boolean;
BEGIN
  -- Get chunk statistics
  SELECT
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE status = 'completed')::int,
    COUNT(*) FILTER (WHERE status = 'processing')::int,
    COUNT(*) FILTER (WHERE status = 'failed' OR status = 'dead_letter')::int,
    AVG(processing_time_seconds) FILTER (WHERE processing_time_seconds IS NOT NULL)
  INTO v_total_chunks, v_chunks_completed, v_chunks_processing, v_chunks_failed, v_avg_time
  FROM process_chunks
  WHERE processo_id = p_processo_id;

  -- Update complex processing status
  UPDATE complex_processing_status
  SET
    chunks_completed = v_chunks_completed,
    chunks_processing = v_chunks_processing,
    chunks_failed = v_chunks_failed,
    average_chunk_time_seconds = v_avg_time::int,
    current_chunk_index = (
      SELECT MIN(chunk_index)
      FROM process_chunks
      WHERE processo_id = p_processo_id
      AND status = 'processing'
    ),
    current_phase = CASE
      WHEN v_chunks_completed = v_total_chunks THEN 'consolidating'
      WHEN v_chunks_processing > 0 THEN 'processing'
      WHEN v_chunks_completed = 0 THEN 'queued'
      ELSE 'processing'
    END,
    last_heartbeat = now()
  WHERE processo_id = p_processo_id;

  updated := FOUND;
  RETURN updated;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions to service role
GRANT EXECUTE ON FUNCTION acquire_next_queue_item TO service_role;
GRANT EXECUTE ON FUNCTION update_queue_heartbeat TO service_role;
GRANT EXECUTE ON FUNCTION complete_queue_item TO service_role;
GRANT EXECUTE ON FUNCTION fail_queue_item TO service_role;
GRANT EXECUTE ON FUNCTION release_expired_locks TO service_role;
GRANT EXECUTE ON FUNCTION get_queue_stats TO service_role;
GRANT EXECUTE ON FUNCTION get_chunk_context TO service_role;
GRANT EXECUTE ON FUNCTION update_complex_processing_progress TO service_role;
