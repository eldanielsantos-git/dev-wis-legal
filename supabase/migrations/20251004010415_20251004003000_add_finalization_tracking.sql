/*
  # Add Finalization Tracking for Large Files

  1. New Status Value
    - Add 'finalizing' to the processo_status enum
    - This status represents the phase where transcribed results are being extracted from GCS

  2. New Columns
    - `finalization_state` (jsonb) - Stores pagination state for chunked processing
      Contains: processed_files (array), total_files (int), current_batch (int),
                failed_files (array), last_updated (timestamp)
    - `finalization_progress_percent` (integer) - Progress percentage for UI (0-100)

  3. Indexes
    - Create GIN index on finalization_state for efficient JSONB queries

  4. Notes
    - This enables processing large documents (1000+ pages) in chunks
    - Each edge function call processes 10-15 JSON files from GCS
    - Progress is persisted to allow resuming after failures
    - Frontend orchestrates multiple calls until completion
*/

-- Add 'finalizing' status to enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'processo_status'
    AND e.enumlabel = 'finalizing'
  ) THEN
    ALTER TYPE processo_status ADD VALUE 'finalizing' AFTER 'processing_batch';
  END IF;
END $$;

-- Add finalization tracking columns
ALTER TABLE processos
ADD COLUMN IF NOT EXISTS finalization_state jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS finalization_progress_percent integer DEFAULT 0 CHECK (finalization_progress_percent >= 0 AND finalization_progress_percent <= 100);

-- Create GIN index for efficient JSONB queries
CREATE INDEX IF NOT EXISTS idx_processos_finalization_state ON processos USING GIN (finalization_state);

-- Add comment for documentation
COMMENT ON COLUMN processos.finalization_state IS 'Tracks progress of chunked finalization: processed_files, total_files, current_batch, failed_files, last_updated';
COMMENT ON COLUMN processos.finalization_progress_percent IS 'Progress percentage (0-100) for UI display during finalization';
