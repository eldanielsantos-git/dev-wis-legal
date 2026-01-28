/*
  # Create Process History Audit Table

  1. New Tables
    - `process_history`
      - `id` (uuid, primary key) - Unique identifier for history record
      - `process_id` (text) - Original process ID (stored as copy)
      - `user_id` (text) - Original user ID (stored as copy)
      - `user_first_name` (text) - User's first name at processing time
      - `user_last_name` (text) - User's last name at processing time
      - `user_email` (text) - User's email at processing time
      - `file_name` (text) - Name of the PDF file
      - `total_pages` (integer) - Number of pages in the document
      - `llm_model_name` (text) - AI model used for analysis
      - `llm_tokens_used` (bigint) - Total tokens returned by LLM (sum from analysis_results)
      - `processed_at` (timestamptz) - When the process was completed
      - `created_at` (timestamptz) - When the history record was created

  2. Security
    - Enable RLS on `process_history` table
    - Add policy for admin users only (SELECT)
    - No INSERT/UPDATE/DELETE policies for users (only trigger can insert)

  3. Triggers
    - `log_completed_process_to_history` - Automatically logs process when status becomes 'completed'

  4. Indexes
    - Index on `processed_at` for date range queries
    - Index on `user_email` for user searches
*/

CREATE TABLE IF NOT EXISTS process_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id text NOT NULL,
  user_id text NOT NULL,
  user_first_name text,
  user_last_name text,
  user_email text,
  file_name text NOT NULL,
  total_pages integer DEFAULT 0,
  llm_model_name text,
  llm_tokens_used bigint DEFAULT 0,
  processed_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_process_history_processed_at ON process_history(processed_at DESC);
CREATE INDEX IF NOT EXISTS idx_process_history_user_email ON process_history(user_email);

ALTER TABLE process_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view process history"
  ON process_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE OR REPLACE FUNCTION log_completed_process_to_history()
RETURNS TRIGGER AS $$
DECLARE
  v_user_first_name text;
  v_user_last_name text;
  v_user_email text;
  v_llm_tokens_total bigint;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status <> 'completed') THEN
    SELECT first_name, last_name, email
    INTO v_user_first_name, v_user_last_name, v_user_email
    FROM user_profiles
    WHERE id = NEW.user_id;

    SELECT COALESCE(SUM(tokens_used), 0)
    INTO v_llm_tokens_total
    FROM analysis_results
    WHERE processo_id = NEW.id;

    INSERT INTO process_history (
      process_id,
      user_id,
      user_first_name,
      user_last_name,
      user_email,
      file_name,
      total_pages,
      llm_model_name,
      llm_tokens_used,
      processed_at
    ) VALUES (
      NEW.id::text,
      NEW.user_id::text,
      v_user_first_name,
      v_user_last_name,
      v_user_email,
      NEW.file_name,
      COALESCE(NEW.total_pages, 0),
      NEW.current_llm_model_name,
      v_llm_tokens_total,
      COALESCE(NEW.completed_at, now())
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_completed_process ON processos;

CREATE TRIGGER trigger_log_completed_process
  AFTER UPDATE ON processos
  FOR EACH ROW
  EXECUTE FUNCTION log_completed_process_to_history();