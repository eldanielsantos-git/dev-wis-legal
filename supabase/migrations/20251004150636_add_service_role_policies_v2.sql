/*
  # Add service_role policies for admin tables

  1. Changes
    - Add policies for service_role to access admin_system_models
    - Add policies for service_role to access admin_system_prompts
    - This allows edge functions to read configuration

  2. Security Note
    - service_role bypasses RLS by default, but we add explicit policies for clarity
*/

-- Drop existing service_role policies if they exist
DROP POLICY IF EXISTS "Allow service_role to read models" ON admin_system_models;
DROP POLICY IF EXISTS "Allow service_role to insert models" ON admin_system_models;
DROP POLICY IF EXISTS "Allow service_role to update models" ON admin_system_models;
DROP POLICY IF EXISTS "Allow service_role to delete models" ON admin_system_models;
DROP POLICY IF EXISTS "Allow service_role to read prompts" ON admin_system_prompts;
DROP POLICY IF EXISTS "Allow service_role to insert prompts" ON admin_system_prompts;
DROP POLICY IF EXISTS "Allow service_role to update prompts" ON admin_system_prompts;

-- Policies for service_role on admin_system_models
CREATE POLICY "Allow service_role to read models"
  ON admin_system_models
  FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Allow service_role to insert models"
  ON admin_system_models
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Allow service_role to update models"
  ON admin_system_models
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow service_role to delete models"
  ON admin_system_models
  FOR DELETE
  TO service_role
  USING (true);

-- Policies for service_role on admin_system_prompts
CREATE POLICY "Allow service_role to read prompts"
  ON admin_system_prompts
  FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Allow service_role to insert prompts"
  ON admin_system_prompts
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Allow service_role to update prompts"
  ON admin_system_prompts
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);