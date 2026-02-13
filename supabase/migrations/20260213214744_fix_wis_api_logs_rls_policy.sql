/*
  # Fix WIS API Logs RLS Policy

  1. Changes
    - Drop existing policy that may have issues with nested RLS
    - Create new policy using is_current_user_admin() function
    
  2. Security
    - Only admins can read logs
    - Uses existing admin check function
*/

DROP POLICY IF EXISTS "Admins can read wis_api_logs" ON wis_api_logs;

CREATE POLICY "Admins can read wis_api_logs"
  ON wis_api_logs
  FOR SELECT
  TO authenticated
  USING (is_current_user_admin());