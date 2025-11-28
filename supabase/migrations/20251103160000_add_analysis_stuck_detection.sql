/*
  # Add Analysis Stuck Detection System

  1. Changes
    - Add `processing_at` timestamp to track when analysis starts running
    - Create function to detect stuck analysis results
    - Add index for faster stuck detection queries

  2. Purpose
    - Track when each analysis result starts processing
    - Detect analysis results stuck in 'running' status for more than 10 minutes
    - Help debugging and recovery of stuck processes
*/

-- Add processing_at column to track when analysis starts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'analysis_results' AND column_name = 'processing_at'
  ) THEN
    ALTER TABLE analysis_results ADD COLUMN processing_at timestamptz;
  END IF;
END $$;

-- Create function to find stuck analysis results
CREATE OR REPLACE FUNCTION find_stuck_analysis_results(
  stuck_threshold_minutes integer DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  processo_id uuid,
  prompt_title text,
  status text,
  processing_at timestamptz,
  stuck_duration_minutes integer
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ar.id,
    ar.processo_id,
    ar.prompt_title,
    ar.status,
    ar.processing_at,
    EXTRACT(EPOCH FROM (now() - ar.processing_at))::integer / 60 AS stuck_duration_minutes
  FROM analysis_results ar
  WHERE ar.status = 'running'
    AND ar.processing_at IS NOT NULL
    AND ar.processing_at < (now() - (stuck_threshold_minutes || ' minutes')::interval)
  ORDER BY ar.processing_at ASC;
END;
$$;

-- Create index for faster stuck detection
CREATE INDEX IF NOT EXISTS idx_analysis_results_running_processing_at
  ON analysis_results (processing_at)
  WHERE status = 'running';

-- Add comment
COMMENT ON FUNCTION find_stuck_analysis_results IS 'Finds analysis results that have been in running status for longer than the threshold';
COMMENT ON COLUMN analysis_results.processing_at IS 'Timestamp when the analysis result started processing (status changed to running)';
