/*
  # Increase file size limit to 3GB

  1. Changes
    - Update file_size constraint to allow up to 3GB (3221225472 bytes)
    - Supports very large legal documents that will be chunked for processing

  2. Rationale
    - Large case files can exceed 1GB
    - Chunking system handles processing of large files
    - The processos.file_size is metadata for the original file
*/

-- Drop existing constraint
ALTER TABLE processos DROP CONSTRAINT IF EXISTS processos_file_size_reasonable;

-- Add new constraint with 3GB limit
ALTER TABLE processos ADD CONSTRAINT processos_file_size_reasonable
  CHECK (file_size > 0 AND file_size <= 3221225472);