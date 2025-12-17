/*
  # Create Admin Operation Progress Table

  1. New Tables
    - `admin_operation_progress`
      - `id` (uuid, primary key)
      - `operation_id` (uuid, unique) - ID único da operação
      - `operation_type` (text) - Tipo de operação (delete_user, etc)
      - `user_id` (uuid) - ID do usuário alvo
      - `admin_user_id` (uuid) - ID do admin executando
      - `progress` (jsonb) - Array de etapas com status
      - `status` (text) - Status geral: running, completed, error
      - `error` (text) - Mensagem de erro se houver
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `completed_at` (timestamptz)

  2. Security
    - Enable RLS
    - Only admins can read/write operation progress
*/

CREATE TABLE IF NOT EXISTS admin_operation_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid UNIQUE NOT NULL,
  operation_type text NOT NULL,
  user_id uuid,
  admin_user_id uuid NOT NULL,
  progress jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'running',
  error text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE admin_operation_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read operation progress"
  ON admin_operation_progress
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can insert operation progress"
  ON admin_operation_progress
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can update operation progress"
  ON admin_operation_progress
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE INDEX IF NOT EXISTS idx_admin_operation_progress_operation_id ON admin_operation_progress(operation_id);
CREATE INDEX IF NOT EXISTS idx_admin_operation_progress_status ON admin_operation_progress(status);
CREATE INDEX IF NOT EXISTS idx_admin_operation_progress_created_at ON admin_operation_progress(created_at);
