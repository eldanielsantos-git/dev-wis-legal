/*
  # Fix RLS Policies for Processos Table

  1. Security Changes
    - Remove all permissive policies that allow unrestricted access
    - Implement strict user isolation: users can only see their own processos
    - Admins can see all processos
    - Service role maintains full access for system operations

  2. Policy Structure
    - SELECT: Users see only their own, admins see all
    - INSERT: Users can only create processos for themselves
    - UPDATE: Users can only update their own processos
    - DELETE: Users can only delete their own processos
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "Allow anonymous read access to processos" ON processos;
DROP POLICY IF EXISTS "Allow anonymous write access to processos" ON processos;
DROP POLICY IF EXISTS "Allow authenticated full access to processos" ON processos;
DROP POLICY IF EXISTS "Permitir operações anônimas em processos" ON processos;
DROP POLICY IF EXISTS "Permitir todas operações em processos" ON processos;
DROP POLICY IF EXISTS "Users can view own processos" ON processos;
DROP POLICY IF EXISTS "Users can insert own processos" ON processos;
DROP POLICY IF EXISTS "Users can update own processos" ON processos;
DROP POLICY IF EXISTS "Users can delete own processos" ON processos;
DROP POLICY IF EXISTS "Admins can view all processos" ON processos;
DROP POLICY IF EXISTS "Service role has full access to processos" ON processos;

-- Create secure policies
CREATE POLICY "Users can view own processos"
  ON processos
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "Users can insert own processos"
  ON processos
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own processos"
  ON processos
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own processos"
  ON processos
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role has full access"
  ON processos
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
