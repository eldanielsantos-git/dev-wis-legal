/*
  # Fix RLS policies for admin tables

  1. Changes
    - Update admin_system_models policies to allow anon access
    - Update admin_system_prompts policies to allow anon access
    - This allows the application to work without authentication

  2. Security Note
    - These tables contain system configuration
    - In production, you should implement proper authentication
    - For now, we allow anon access for functionality
*/

-- Drop existing policies for admin_system_models
DROP POLICY IF EXISTS "Authenticated users can read models" ON admin_system_models;
DROP POLICY IF EXISTS "Authenticated users can insert models" ON admin_system_models;
DROP POLICY IF EXISTS "Authenticated users can update models" ON admin_system_models;
DROP POLICY IF EXISTS "Authenticated users can delete models" ON admin_system_models;

-- Create new policies allowing anon access for admin_system_models
CREATE POLICY "Allow anon to read models"
  ON admin_system_models
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon to insert models"
  ON admin_system_models
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon to update models"
  ON admin_system_models
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon to delete models"
  ON admin_system_models
  FOR DELETE
  TO anon
  USING (true);

-- Also allow authenticated users (for future auth implementation)
CREATE POLICY "Allow authenticated to read models"
  ON admin_system_models
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated to insert models"
  ON admin_system_models
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated to update models"
  ON admin_system_models
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated to delete models"
  ON admin_system_models
  FOR DELETE
  TO authenticated
  USING (true);

-- Fix admin_system_prompts policies
DROP POLICY IF EXISTS "Authenticated users can read prompts" ON admin_system_prompts;
DROP POLICY IF EXISTS "Authenticated users can insert prompts" ON admin_system_prompts;
DROP POLICY IF EXISTS "Authenticated users can update prompts" ON admin_system_prompts;

-- Create new policies allowing anon access for admin_system_prompts
CREATE POLICY "Allow anon to read prompts"
  ON admin_system_prompts
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon to insert prompts"
  ON admin_system_prompts
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon to update prompts"
  ON admin_system_prompts
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Also allow authenticated users (for future auth implementation)
CREATE POLICY "Allow authenticated to read prompts"
  ON admin_system_prompts
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated to insert prompts"
  ON admin_system_prompts
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated to update prompts"
  ON admin_system_prompts
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);