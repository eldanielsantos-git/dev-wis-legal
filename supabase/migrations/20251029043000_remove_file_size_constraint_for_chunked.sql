/*
  # Remove file size constraint for chunked processos

  1. Changes
    - Drop the file_size check constraint on processos table
    - For chunked processos, the file_size represents the original PDF size
    - Individual chunks in process_chunks table still have size limits
    - This allows large PDFs to be stored as metadata while chunks respect limits

  2. Rationale
    - A 3710-page PDF may be 200MB+ but will be split into 4 chunks of ~50MB each
    - The processos.file_size is just metadata for the original file
    - Actual storage and processing happens via chunks
*/

-- Drop the file_size constraint
ALTER TABLE processos DROP CONSTRAINT IF EXISTS processos_file_size_check;

-- Add a new constraint that allows larger files but still has a reasonable upper limit (1GB)
ALTER TABLE processos ADD CONSTRAINT processos_file_size_reasonable
  CHECK (file_size > 0 AND file_size <= 1073741824);
