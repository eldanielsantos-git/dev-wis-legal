/*
  # Add raw_received_at to Analysis Results

  1. Changes
    - Add `raw_received_at` column to track when raw content was first received from AI model

  2. Purpose
    - Enable two-phase save strategy: save raw content immediately, then update with metadata
    - Protect against 502 errors by persisting AI responses as soon as they're received
    - Provide visibility into save timing for debugging and monitoring

  3. Security
    - No RLS changes needed (inherits existing policies)
*/

-- Add raw_received_at field to track immediate content save
ALTER TABLE analysis_results
ADD COLUMN IF NOT EXISTS raw_received_at TIMESTAMPTZ;

-- Create index for monitoring raw save timing
CREATE INDEX IF NOT EXISTS idx_analysis_results_raw_received
ON analysis_results(raw_received_at)
WHERE raw_received_at IS NOT NULL;
