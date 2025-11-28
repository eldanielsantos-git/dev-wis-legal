/*
  # Create processing_queue table for complex document processing

  1. New Tables
    - `processing_queue`
      - Global persistent queue for managing chunk processing
      - Supports distributed worker architecture
      - Handles priority, retries, and dead letter queue
      - Optimistic locking for concurrent workers

  2. Purpose
    - Manage sequential processing of chunks from large PDFs (1000+ pages)
    - Support long-running processes (hours or days)
    - Enable recovery from failures with automatic retry
    - Provide visibility into processing pipeline

  3. Security
    - Enable RLS on `processing_queue` table
    - Users can view their own queue items
    - Service role can manage all items for worker operations
    - Admins can view and manage all queue items
*/

-- Create processing_queue table
CREATE TABLE IF NOT EXISTS processing_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
  chunk_id uuid REFERENCES process_chunks(id) ON DELETE CASCADE,

  -- Queue management
  queue_type text NOT NULL, -- 'chunk_processing', 'consolidation', 'finalization'
  priority int DEFAULT 5, -- 1 = highest, 10 = lowest
  queue_position bigserial,
  status text NOT NULL DEFAULT 'pending',

  -- Processing context
  context_data jsonb, -- Summary from previous chunk, configuration, etc
  prompt_id uuid,
  prompt_content text,

  -- Retry and attempt control
  attempt_number int DEFAULT 0,
  max_attempts int DEFAULT 3,
  processing_started_at timestamptz,
  processing_completed_at timestamptz,
  last_heartbeat timestamptz,
  worker_id text, -- Identifier of worker processing this item

  -- Timeouts and locks
  lock_acquired_at timestamptz,
  lock_expires_at timestamptz,
  timeout_seconds int DEFAULT 900, -- 15 minutes per chunk

  -- Results and errors
  result_data jsonb,
  tokens_used int,
  error_message text,
  error_count int DEFAULT 0,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Constraints
  CONSTRAINT valid_queue_status CHECK (
    status IN ('pending', 'processing', 'completed', 'failed', 'retry', 'dead_letter')
  ),
  CONSTRAINT valid_queue_type CHECK (
    queue_type IN ('chunk_processing', 'consolidation', 'finalization')
  ),
  CONSTRAINT valid_priority CHECK (priority >= 1 AND priority <= 10)
);

-- Create indexes for efficient queue operations
CREATE INDEX IF NOT EXISTS idx_queue_status_priority
  ON processing_queue(status, priority, queue_position)
  WHERE status IN ('pending', 'retry');

CREATE INDEX IF NOT EXISTS idx_queue_processo
  ON processing_queue(processo_id);

CREATE INDEX IF NOT EXISTS idx_queue_chunk
  ON processing_queue(chunk_id)
  WHERE chunk_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_queue_worker
  ON processing_queue(worker_id, status)
  WHERE worker_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_queue_heartbeat
  ON processing_queue(last_heartbeat)
  WHERE status = 'processing';

CREATE INDEX IF NOT EXISTS idx_queue_expired_locks
  ON processing_queue(lock_expires_at)
  WHERE status = 'processing' AND lock_expires_at IS NOT NULL;

-- Enable RLS
ALTER TABLE processing_queue ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own queue items
CREATE POLICY "Users can view own queue items"
  ON processing_queue
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM processos
      WHERE processos.id = processing_queue.processo_id
      AND processos.user_id = auth.uid()
    )
  );

-- Policy: Admins can view all queue items
CREATE POLICY "Admins can view all queue items"
  ON processing_queue
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- Policy: Service role can manage all queue items (for workers)
CREATE POLICY "Service role can manage queue"
  ON processing_queue
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_processing_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_processing_queue_updated_at_trigger ON processing_queue;
CREATE TRIGGER update_processing_queue_updated_at_trigger
  BEFORE UPDATE ON processing_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_processing_queue_updated_at();
