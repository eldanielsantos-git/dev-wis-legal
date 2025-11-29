/*
  # Create email_logs table for tracking email sending

  1. New Tables
    - `email_logs`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `email` (text, email address)
      - `type` (text, type of email: confirmation, password_reset, etc)
      - `status` (text, status: sent, error, success)
      - `mailchimp_response` (jsonb, response from Mailchimp API)
      - `sent_at` (timestamptz, when email was sent)
      - `created_at` (timestamptz, auto)

  2. Security
    - Enable RLS on `email_logs` table
    - Add policies for authenticated users to view their own logs
    - Add policies for admins to view all logs
*/

-- Create email_logs table
CREATE TABLE IF NOT EXISTS email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  type text NOT NULL CHECK (type IN ('confirmation', 'password_reset', 'status_update', 'notification')),
  status text NOT NULL CHECK (status IN ('sent', 'error', 'success', 'failed')),
  mailchimp_response jsonb DEFAULT '{}'::jsonb,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_email ON email_logs(email);
CREATE INDEX IF NOT EXISTS idx_email_logs_type ON email_logs(type);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at DESC);

-- Enable Row Level Security
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own email logs
CREATE POLICY "Users can view own email logs"
  ON email_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Admins can view all email logs
CREATE POLICY "Admins can view all email logs"
  ON email_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- Policy: Service role can insert email logs
CREATE POLICY "Service role can insert email logs"
  ON email_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Policy: Service role can update email logs
CREATE POLICY "Service role can update email logs"
  ON email_logs
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add comment to table
COMMENT ON TABLE email_logs IS 'Logs of all emails sent through the system, including Mailchimp transactional emails';