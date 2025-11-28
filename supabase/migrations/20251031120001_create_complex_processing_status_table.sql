/*
  # Create complex_processing_status table for real-time progress tracking

  1. New Tables
    - `complex_processing_status`
      - Real-time dashboard for complex document processing
      - Tracks progress, metrics, and health status
      - Provides estimates for completion time
      - Enables frontend to display detailed progress UI

  2. Purpose
    - Give users visibility into long-running processes
    - Track chunk-level progress (uploaded, queued, processing, completed, failed)
    - Calculate estimated completion time based on average chunk processing time
    - Monitor system health with heartbeat mechanism
    - Store processing statistics (tokens, time, errors)

  3. Security
    - Enable RLS on `complex_processing_status` table
    - Users can view their own process status
    - Service role can manage all status records for worker updates
    - Admins can view all processing statuses
*/

-- Create complex_processing_status table
CREATE TABLE IF NOT EXISTS complex_processing_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid NOT NULL UNIQUE REFERENCES processos(id) ON DELETE CASCADE,

  -- Chunk progress metrics
  total_chunks int NOT NULL,
  chunks_uploaded int DEFAULT 0,
  chunks_queued int DEFAULT 0,
  chunks_processing int DEFAULT 0,
  chunks_completed int DEFAULT 0,
  chunks_failed int DEFAULT 0,

  -- Current processing state
  current_phase text DEFAULT 'initializing',
  current_chunk_index int,

  -- Time estimates
  started_at timestamptz DEFAULT now(),
  estimated_completion_at timestamptz,
  average_chunk_time_seconds int,
  elapsed_time_seconds int,

  -- Progress percentages
  upload_progress_percent int DEFAULT 0,
  processing_progress_percent int DEFAULT 0,
  overall_progress_percent int DEFAULT 0,

  -- Health monitoring
  last_heartbeat timestamptz DEFAULT now(),
  is_healthy boolean DEFAULT true,
  health_check_message text,

  -- Statistics
  total_tokens_used bigint DEFAULT 0,
  total_prompts_processed int DEFAULT 0,
  total_retries int DEFAULT 0,

  -- Additional metadata
  metadata jsonb DEFAULT '{}'::jsonb,
  error_log jsonb[] DEFAULT ARRAY[]::jsonb[],

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Constraints
  CONSTRAINT valid_phase CHECK (
    current_phase IN (
      'initializing',
      'uploading',
      'queued',
      'processing',
      'consolidating',
      'finalizing',
      'completed',
      'failed',
      'paused'
    )
  ),
  CONSTRAINT valid_percentages CHECK (
    upload_progress_percent >= 0 AND upload_progress_percent <= 100 AND
    processing_progress_percent >= 0 AND processing_progress_percent <= 100 AND
    overall_progress_percent >= 0 AND overall_progress_percent <= 100
  )
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_complex_status_processo
  ON complex_processing_status(processo_id);

CREATE INDEX IF NOT EXISTS idx_complex_status_phase
  ON complex_processing_status(current_phase)
  WHERE current_phase NOT IN ('completed', 'failed');

CREATE INDEX IF NOT EXISTS idx_complex_status_heartbeat
  ON complex_processing_status(last_heartbeat)
  WHERE current_phase = 'processing';

CREATE INDEX IF NOT EXISTS idx_complex_status_health
  ON complex_processing_status(is_healthy)
  WHERE is_healthy = false;

-- Enable RLS
ALTER TABLE complex_processing_status ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own processing status
CREATE POLICY "Users can view own processing status"
  ON complex_processing_status
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM processos
      WHERE processos.id = complex_processing_status.processo_id
      AND processos.user_id = auth.uid()
    )
  );

-- Policy: Admins can view all processing statuses
CREATE POLICY "Admins can view all processing statuses"
  ON complex_processing_status
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- Policy: Service role can manage all status records (for workers)
CREATE POLICY "Service role can manage processing status"
  ON complex_processing_status
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_complex_status_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_complex_status_updated_at_trigger ON complex_processing_status;
CREATE TRIGGER update_complex_status_updated_at_trigger
  BEFORE UPDATE ON complex_processing_status
  FOR EACH ROW
  EXECUTE FUNCTION update_complex_status_updated_at();

-- Function to calculate progress percentages automatically
CREATE OR REPLACE FUNCTION calculate_progress_percentages()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate upload progress
  IF NEW.total_chunks > 0 THEN
    NEW.upload_progress_percent = ROUND((NEW.chunks_uploaded::numeric / NEW.total_chunks::numeric) * 100);
  END IF;

  -- Calculate processing progress
  IF NEW.total_chunks > 0 THEN
    NEW.processing_progress_percent = ROUND((NEW.chunks_completed::numeric / NEW.total_chunks::numeric) * 100);
  END IF;

  -- Calculate overall progress (weighted: 20% upload, 80% processing)
  NEW.overall_progress_percent = ROUND(
    (NEW.upload_progress_percent * 0.2) +
    (NEW.processing_progress_percent * 0.8)
  );

  -- Calculate elapsed time
  NEW.elapsed_time_seconds = EXTRACT(EPOCH FROM (now() - NEW.started_at))::int;

  -- Calculate estimated completion time
  IF NEW.chunks_completed > 0 AND NEW.average_chunk_time_seconds IS NOT NULL THEN
    DECLARE
      chunks_remaining int;
      estimated_seconds_remaining int;
    BEGIN
      chunks_remaining = NEW.total_chunks - NEW.chunks_completed;
      estimated_seconds_remaining = chunks_remaining * NEW.average_chunk_time_seconds;
      NEW.estimated_completion_at = now() + (estimated_seconds_remaining || ' seconds')::interval;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate progress percentages
DROP TRIGGER IF EXISTS calculate_progress_trigger ON complex_processing_status;
CREATE TRIGGER calculate_progress_trigger
  BEFORE INSERT OR UPDATE ON complex_processing_status
  FOR EACH ROW
  EXECUTE FUNCTION calculate_progress_percentages();
