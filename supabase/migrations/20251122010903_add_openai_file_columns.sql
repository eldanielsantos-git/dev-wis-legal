/*
  # Add OpenAI File Support

  1. New Columns
    - `processos` table:
      - `openai_file_id` (text) - OpenAI file ID after upload
      - `openai_file_status` (text) - Upload status (uploaded, failed, etc)
      - `openai_uploaded_at` (timestamptz) - Timestamp of upload

    - `process_chunks` table:
      - `openai_file_id` (text) - OpenAI file ID for individual chunks
      - `openai_file_status` (text) - Upload status
      - `openai_uploaded_at` (timestamptz) - Timestamp of upload

  2. Purpose
    - Support multiple LLM providers (Gemini + OpenAI)
    - Allow provider switching without re-upload
    - Track upload status per provider
*/

-- Add OpenAI file columns to processos table
ALTER TABLE processos
ADD COLUMN IF NOT EXISTS openai_file_id TEXT,
ADD COLUMN IF NOT EXISTS openai_file_status TEXT,
ADD COLUMN IF NOT EXISTS openai_uploaded_at TIMESTAMPTZ;

-- Add OpenAI file columns to process_chunks table
ALTER TABLE process_chunks
ADD COLUMN IF NOT EXISTS openai_file_id TEXT,
ADD COLUMN IF NOT EXISTS openai_file_status TEXT,
ADD COLUMN IF NOT EXISTS openai_uploaded_at TIMESTAMPTZ;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_processos_openai_file_id ON processos(openai_file_id) WHERE openai_file_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_process_chunks_openai_file_id ON process_chunks(openai_file_id) WHERE openai_file_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN processos.openai_file_id IS 'OpenAI file ID after upload to OpenAI File API';
COMMENT ON COLUMN processos.openai_file_status IS 'Status of OpenAI upload: uploaded, failed, pending';
COMMENT ON COLUMN processos.openai_uploaded_at IS 'Timestamp when file was uploaded to OpenAI';

COMMENT ON COLUMN process_chunks.openai_file_id IS 'OpenAI file ID for individual chunk (if needed)';
COMMENT ON COLUMN process_chunks.openai_file_status IS 'Status of OpenAI chunk upload';
COMMENT ON COLUMN process_chunks.openai_uploaded_at IS 'Timestamp when chunk was uploaded to OpenAI';