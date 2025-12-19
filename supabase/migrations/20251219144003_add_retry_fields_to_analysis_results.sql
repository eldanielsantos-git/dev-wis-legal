/*
  # Add Retry Fields to Analysis Results

  1. Changes
    - Add `retry_count` column to track number of retry attempts
    - Add `last_retry_at` column to track when last retry was scheduled
  
  2. Purpose
    - Enable automatic retry mechanism for timeout errors
    - Track retry attempts to prevent infinite loops
    - Provide visibility into retry history for debugging
  
  3. Security
    - No RLS changes needed (inherits existing policies)
*/

-- Add retry_count field (defaults to 0)
ALTER TABLE analysis_results 
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

-- Add last_retry_at field
ALTER TABLE analysis_results 
ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ;

-- Create index for efficient retry queries
CREATE INDEX IF NOT EXISTS idx_analysis_results_retry_count 
ON analysis_results(retry_count) 
WHERE status = 'pending' AND retry_count > 0;
