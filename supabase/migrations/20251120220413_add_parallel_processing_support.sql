/*
  # Add Parallel Processing Support

  1. Changes to complex_processing_status table
    - Add `max_concurrent_workers` field to control parallelization
    - Add `current_active_workers` counter
    - Add `active_worker_ids` array to track active workers
    - Add `avg_chunk_processing_seconds` for performance metrics

  2. Security
    - Maintain existing RLS policies
    - Add service role access for worker management
*/

-- Add new columns to complex_processing_status for parallel processing
ALTER TABLE complex_processing_status
ADD COLUMN IF NOT EXISTS max_concurrent_workers integer DEFAULT 5,
ADD COLUMN IF NOT EXISTS current_active_workers integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS active_worker_ids jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS avg_chunk_processing_seconds integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_chunks_completed integer DEFAULT 0;

-- Create index for efficient worker queries
CREATE INDEX IF NOT EXISTS idx_complex_processing_active_workers
ON complex_processing_status(processo_id, current_active_workers);

-- Function to register a worker
CREATE OR REPLACE FUNCTION register_worker(
  p_processo_id uuid,
  p_worker_id text
) RETURNS boolean AS $$
DECLARE
  v_max_workers integer;
  v_current_workers integer;
  v_worker_ids jsonb;
BEGIN
  SELECT
    max_concurrent_workers,
    current_active_workers,
    active_worker_ids
  INTO v_max_workers, v_current_workers, v_worker_ids
  FROM complex_processing_status
  WHERE processo_id = p_processo_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_current_workers >= v_max_workers THEN
    RETURN false;
  END IF;

  IF v_worker_ids ? p_worker_id THEN
    RETURN true;
  END IF;

  UPDATE complex_processing_status
  SET
    current_active_workers = current_active_workers + 1,
    active_worker_ids = active_worker_ids || jsonb_build_array(p_worker_id),
    last_heartbeat = now()
  WHERE processo_id = p_processo_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to unregister a worker
CREATE OR REPLACE FUNCTION unregister_worker(
  p_processo_id uuid,
  p_worker_id text
) RETURNS void AS $$
DECLARE
  v_worker_ids jsonb;
BEGIN
  SELECT active_worker_ids INTO v_worker_ids
  FROM complex_processing_status
  WHERE processo_id = p_processo_id;

  IF NOT FOUND OR NOT (v_worker_ids ? p_worker_id) THEN
    RETURN;
  END IF;

  UPDATE complex_processing_status
  SET
    current_active_workers = GREATEST(0, current_active_workers - 1),
    active_worker_ids = (
      SELECT jsonb_agg(elem)
      FROM jsonb_array_elements(active_worker_ids) elem
      WHERE elem::text != to_jsonb(p_worker_id)::text
    ),
    last_heartbeat = now()
  WHERE processo_id = p_processo_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if can spawn new worker
CREATE OR REPLACE FUNCTION can_spawn_worker(
  p_processo_id uuid
) RETURNS boolean AS $$
DECLARE
  v_max_workers integer;
  v_current_workers integer;
  v_pending_count integer;
BEGIN
  SELECT
    max_concurrent_workers,
    current_active_workers
  INTO v_max_workers, v_current_workers
  FROM complex_processing_status
  WHERE processo_id = p_processo_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT COUNT(*)
  INTO v_pending_count
  FROM processing_queue
  WHERE processo_id = p_processo_id
    AND status = 'pending';

  RETURN v_current_workers < v_max_workers AND v_pending_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update processing metrics
CREATE OR REPLACE FUNCTION update_chunk_metrics(
  p_processo_id uuid,
  p_processing_seconds integer
) RETURNS void AS $$
BEGIN
  UPDATE complex_processing_status
  SET
    total_chunks_completed = total_chunks_completed + 1,
    avg_chunk_processing_seconds = (
      (avg_chunk_processing_seconds * total_chunks_completed + p_processing_seconds) /
      NULLIF(total_chunks_completed + 1, 0)
    )
  WHERE processo_id = p_processo_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment explaining the changes
COMMENT ON COLUMN complex_processing_status.max_concurrent_workers IS 'Maximum number of workers that can process chunks simultaneously for this processo';
COMMENT ON COLUMN complex_processing_status.current_active_workers IS 'Current number of active workers processing chunks';
COMMENT ON COLUMN complex_processing_status.active_worker_ids IS 'Array of currently active worker IDs';
COMMENT ON COLUMN complex_processing_status.avg_chunk_processing_seconds IS 'Average time in seconds to process a chunk';
COMMENT ON COLUMN complex_processing_status.total_chunks_completed IS 'Total number of chunks completed so far';
