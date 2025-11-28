/*
  # Update schema for Document AI Batch Processing

  1. Schema Changes
    - Update processo_status enum to include 'processing_batch'
    - Ensure progress_info JSONB can store Document AI operation data

  2. New Status
    - 'processing_batch': When Document AI batch operation is running

  3. Progress Info Structure
    - operation_name: Document AI operation name for monitoring
    - gcs_input_uri: Input file location in Google Cloud Storage
    - gcs_output_path: Output directory in Google Cloud Storage
    - started_at: When batch processing started
    - completed_at: When batch processing completed
    - pages_processed: Number of pages processed
*/

-- Add new status to the enum
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t 
        JOIN pg_enum e ON t.oid = e.enumtypid 
        WHERE t.typname = 'processo_status' 
        AND e.enumlabel = 'processing_batch'
    ) THEN
        ALTER TYPE processo_status ADD VALUE 'processing_batch';
    END IF;
END $$;

-- Update the progress_info column comment to reflect new usage
COMMENT ON COLUMN processos.progress_info IS 'Progress information for various processing stages including Document AI batch operations';

-- Ensure the progress_info has a proper default structure
ALTER TABLE processos 
ALTER COLUMN progress_info 
SET DEFAULT '{"total_pages": 0, "current_page": 0, "chunks_processed": 0}'::jsonb;

-- Add index for processing_batch status for efficient monitoring
CREATE INDEX IF NOT EXISTS idx_processos_processing_batch 
ON processos(created_at) 
WHERE status = 'processing_batch';

-- Create a function to get next processo for Document AI monitoring
CREATE OR REPLACE FUNCTION get_next_batch_processo()
RETURNS TABLE (
    id uuid,
    progress_info jsonb,
    file_name text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.progress_info,
        p.file_name
    FROM processos p
    WHERE p.status = 'processing_batch'
    ORDER BY p.created_at
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;