/*
  # Add Upload Resumption Tracking

  1. New Fields
    - Add `chunks_uploaded_count` to processos table to track upload progress
    - Add `last_chunk_uploaded_at` to track last upload activity
    - Add `upload_interrupted` flag to indicate if upload was interrupted
  
  2. Purpose
    - Enable automatic resumption of interrupted chunk uploads
    - Track upload progress independently from processing progress
    - Detect stalled uploads for recovery
  
  3. Benefits
    - Users can resume uploads after browser crashes or connection losses
    - System can detect and recover from incomplete uploads
    - Better user experience with large file uploads
*/

-- Add upload tracking fields to processos table
DO $$
BEGIN
  -- Track how many chunks have been successfully uploaded
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'processos' AND column_name = 'chunks_uploaded_count'
  ) THEN
    ALTER TABLE processos ADD COLUMN chunks_uploaded_count integer DEFAULT 0;
  END IF;

  -- Track when the last chunk was uploaded (for detecting stalled uploads)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'processos' AND column_name = 'last_chunk_uploaded_at'
  ) THEN
    ALTER TABLE processos ADD COLUMN last_chunk_uploaded_at timestamptz;
  END IF;

  -- Flag to indicate upload was interrupted and needs resumption
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'processos' AND column_name = 'upload_interrupted'
  ) THEN
    ALTER TABLE processos ADD COLUMN upload_interrupted boolean DEFAULT false;
  END IF;
END $$;

-- Create index for finding interrupted uploads
CREATE INDEX IF NOT EXISTS idx_processos_upload_status 
  ON processos(status, upload_interrupted, last_chunk_uploaded_at) 
  WHERE status = 'uploading' AND upload_interrupted = true;

-- Update existing 'uploading' processes to mark them as interrupted
UPDATE processos 
SET upload_interrupted = true 
WHERE status = 'uploading' 
  AND created_at < NOW() - INTERVAL '5 minutes';
