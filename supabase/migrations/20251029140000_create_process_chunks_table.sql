/*
  # Create process_chunks table for handling large PDFs

  1. New Tables
    - `process_chunks`
      - `id` (uuid, primary key)
      - `processo_id` (uuid, foreign key to processos)
      - `chunk_index` (int) - Sequential chunk number (1, 2, 3, ...)
      - `total_chunks` (int) - Total number of chunks for this processo
      - `start_page` (int) - First page in this chunk (1-based)
      - `end_page` (int) - Last page in this chunk (inclusive)
      - `pages_count` (int) - Number of pages in this chunk
      - `file_path` (text) - Storage path for the chunk PDF
      - `file_size` (bigint) - Size of chunk file in bytes
      - `gemini_file_uri` (text) - Gemini File API URI
      - `gemini_file_name` (text) - Gemini file name
      - `gemini_file_state` (text) - State: PROCESSING, ACTIVE, FAILED
      - `gemini_file_uploaded_at` (timestamptz) - When uploaded to Gemini
      - `gemini_file_expires_at` (timestamptz) - Gemini file expiration
      - `status` (text) - pending, uploading, ready, processing, completed, failed
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Changes
    - Add `is_chunked` (boolean) to processos table
    - Add `total_chunks` (int) to processos table
    - Add `current_chunk` (int) to processos table for progress tracking

  3. Security
    - Enable RLS on `process_chunks` table
    - Add policies for authenticated users to manage their chunks
*/

-- Add chunking fields to processos table
ALTER TABLE processos
ADD COLUMN IF NOT EXISTS is_chunked boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS total_chunks_count int DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_processing_chunk int DEFAULT 0;

-- Create process_chunks table
CREATE TABLE IF NOT EXISTS process_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
  chunk_index int NOT NULL,
  total_chunks int NOT NULL,
  start_page int NOT NULL,
  end_page int NOT NULL,
  pages_count int NOT NULL,
  file_path text NOT NULL,
  file_size bigint NOT NULL,
  gemini_file_uri text,
  gemini_file_name text,
  gemini_file_state text DEFAULT 'pending',
  gemini_file_uploaded_at timestamptz,
  gemini_file_expires_at timestamptz,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_chunk_index CHECK (chunk_index > 0 AND chunk_index <= total_chunks),
  CONSTRAINT valid_pages CHECK (start_page > 0 AND end_page >= start_page),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'uploading', 'ready', 'processing', 'completed', 'failed')),
  UNIQUE(processo_id, chunk_index)
);

-- Create index for efficient chunk queries
CREATE INDEX IF NOT EXISTS idx_process_chunks_processo_id ON process_chunks(processo_id);
CREATE INDEX IF NOT EXISTS idx_process_chunks_status ON process_chunks(processo_id, status);
CREATE INDEX IF NOT EXISTS idx_process_chunks_order ON process_chunks(processo_id, chunk_index);

-- Enable RLS
ALTER TABLE process_chunks ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users
CREATE POLICY "Users can view own chunks"
  ON process_chunks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM processos
      WHERE processos.id = process_chunks.processo_id
      AND processos.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own chunks"
  ON process_chunks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM processos
      WHERE processos.id = process_chunks.processo_id
      AND processos.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own chunks"
  ON process_chunks
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM processos
      WHERE processos.id = process_chunks.processo_id
      AND processos.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM processos
      WHERE processos.id = process_chunks.processo_id
      AND processos.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own chunks"
  ON process_chunks
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM processos
      WHERE processos.id = process_chunks.processo_id
      AND processos.user_id = auth.uid()
    )
  );

-- Admin policies
CREATE POLICY "Admins can view all chunks"
  ON process_chunks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can update all chunks"
  ON process_chunks
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- Service role policies for edge functions
CREATE POLICY "Service role can manage all chunks"
  ON process_chunks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_process_chunks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_process_chunks_updated_at_trigger ON process_chunks;
CREATE TRIGGER update_process_chunks_updated_at_trigger
  BEFORE UPDATE ON process_chunks
  FOR EACH ROW
  EXECUTE FUNCTION update_process_chunks_updated_at();
