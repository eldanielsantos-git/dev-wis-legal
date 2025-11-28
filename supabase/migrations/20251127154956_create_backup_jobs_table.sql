/*
  # Create backup_jobs table for async backup processing

  1. New Tables
    - `backup_jobs`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `status` (text) - processing, completed, failed
      - `total_files` (int)
      - `success_count` (int)
      - `fail_count` (int)
      - `filename` (text)
      - `download_url` (text)
      - `error_message` (text)
      - `started_at` (timestamptz)
      - `completed_at` (timestamptz)
  
  2. Security
    - Enable RLS
    - Admins can view all backup jobs
    - Users can only see their own backup jobs
*/

CREATE TABLE IF NOT EXISTS backup_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL CHECK (status IN ('processing', 'completed', 'failed')),
  total_files int DEFAULT 0,
  success_count int DEFAULT 0,
  fail_count int DEFAULT 0,
  filename text,
  download_url text,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE backup_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own backup jobs" ON backup_jobs;
DROP POLICY IF EXISTS "Admins can view all backup jobs" ON backup_jobs;
DROP POLICY IF EXISTS "Service role can manage backup jobs" ON backup_jobs;

CREATE POLICY "Users can view own backup jobs"
  ON backup_jobs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all backup jobs"
  ON backup_jobs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "Service role can manage backup jobs"
  ON backup_jobs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_backup_jobs_user_id ON backup_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_backup_jobs_status ON backup_jobs(status);
CREATE INDEX IF NOT EXISTS idx_backup_jobs_created_at ON backup_jobs(created_at DESC);
