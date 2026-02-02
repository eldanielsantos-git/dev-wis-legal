/*
  # Create Process Unlock Audit and Notifications System

  ## Purpose
  This migration creates the infrastructure for tracking and auditing process unlock operations,
  as well as managing notifications for stuck processes.

  ## 1. New Tables

  ### process_unlock_audit
  - `id` (uuid, primary key) - Unique identifier for audit record
  - `processo_id` (uuid, foreign key) - Reference to the affected process
  - `processo_numero` (text) - Process number for easy identification
  - `user_id` (uuid) - Admin who performed the action
  - `user_email` (text) - Admin email for reference
  - `action_type` (text) - Type: 'simulation', 'unlock', 'auto_notification'
  - `unlock_reason` (text) - Reason provided for unlock
  - `affected_tables` (text[]) - List of tables modified
  - `before_state` (jsonb) - Complete state before action
  - `after_state` (jsonb) - Complete state after action
  - `duration_minutes_stuck` (numeric) - How long process was stuck
  - `stuck_at_prompt_order` (integer) - Which prompt was stuck
  - `stuck_at_prompt_title` (text) - Title of stuck prompt
  - `total_pages` (integer) - Total pages of the process
  - `simulation_mode` (boolean) - Whether this was a dry-run
  - `success` (boolean) - Whether operation succeeded
  - `error_message` (text) - Error message if failed
  - `metadata` (jsonb) - Additional data (worker_id, model_name, etc)
  - `created_at` (timestamptz) - When operation started
  - `completed_at` (timestamptz) - When operation finished

  ### stuck_process_notifications
  - `id` (uuid, primary key) - Unique identifier
  - `processo_id` (uuid, foreign key) - Reference to the stuck process
  - `processo_numero` (text) - Process number
  - `notified_at` (timestamptz) - When notification was sent
  - `resolved_at` (timestamptz) - When process was unstuck (nullable)
  - `notification_sent_successfully` (boolean) - Whether Slack notification succeeded
  - `slack_message_ts` (text) - Slack message timestamp for threading
  - `error_message` (text) - Error if notification failed
  - `metadata` (jsonb) - Details about the stuck state
  - `created_at` (timestamptz) - Record creation time

  ## 2. Security
  - RLS enabled on both tables
  - Only admins can read/write process_unlock_audit
  - Only service role and admins can access stuck_process_notifications

  ## 3. Indexes
  - Optimized indexes for common query patterns
*/

-- Create process_unlock_audit table
CREATE TABLE IF NOT EXISTS process_unlock_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid REFERENCES processos(id) ON DELETE SET NULL,
  processo_numero text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text,
  action_type text NOT NULL CHECK (action_type IN ('simulation', 'unlock', 'auto_notification')),
  unlock_reason text,
  affected_tables text[] DEFAULT '{}',
  before_state jsonb DEFAULT '{}',
  after_state jsonb DEFAULT '{}',
  duration_minutes_stuck numeric DEFAULT 0,
  stuck_at_prompt_order integer,
  stuck_at_prompt_title text,
  total_pages integer,
  simulation_mode boolean DEFAULT false,
  success boolean DEFAULT false,
  error_message text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Create stuck_process_notifications table
CREATE TABLE IF NOT EXISTS stuck_process_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid REFERENCES processos(id) ON DELETE CASCADE,
  processo_numero text,
  notified_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  notification_sent_successfully boolean DEFAULT false,
  slack_message_ts text,
  error_message text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Create indexes for process_unlock_audit
CREATE INDEX IF NOT EXISTS idx_process_unlock_audit_processo_id 
  ON process_unlock_audit(processo_id);
CREATE INDEX IF NOT EXISTS idx_process_unlock_audit_user_id 
  ON process_unlock_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_process_unlock_audit_action_type 
  ON process_unlock_audit(action_type);
CREATE INDEX IF NOT EXISTS idx_process_unlock_audit_created_at 
  ON process_unlock_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_process_unlock_audit_simulation_mode 
  ON process_unlock_audit(simulation_mode);

-- Create indexes for stuck_process_notifications
CREATE INDEX IF NOT EXISTS idx_stuck_process_notifications_processo_id 
  ON stuck_process_notifications(processo_id);
CREATE INDEX IF NOT EXISTS idx_stuck_process_notifications_notified_at 
  ON stuck_process_notifications(notified_at DESC);
CREATE INDEX IF NOT EXISTS idx_stuck_process_notifications_resolved 
  ON stuck_process_notifications(resolved_at) WHERE resolved_at IS NULL;

-- Enable RLS on both tables
ALTER TABLE process_unlock_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE stuck_process_notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies for process_unlock_audit (admin only)
CREATE POLICY "Admins can read process_unlock_audit"
  ON process_unlock_audit
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can insert process_unlock_audit"
  ON process_unlock_audit
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can update process_unlock_audit"
  ON process_unlock_audit
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

-- RLS policies for stuck_process_notifications (admin only)
CREATE POLICY "Admins can read stuck_process_notifications"
  ON stuck_process_notifications
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can insert stuck_process_notifications"
  ON stuck_process_notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can update stuck_process_notifications"
  ON stuck_process_notifications
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

-- Function to mark stuck process as resolved
CREATE OR REPLACE FUNCTION mark_stuck_process_resolved(p_processo_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE stuck_process_notifications
  SET resolved_at = now()
  WHERE processo_id = p_processo_id
    AND resolved_at IS NULL;
END;
$$;

-- Grant execute to authenticated users (admin check in application)
GRANT EXECUTE ON FUNCTION mark_stuck_process_resolved(uuid) TO authenticated;
