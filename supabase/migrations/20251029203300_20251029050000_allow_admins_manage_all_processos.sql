/*
  # Allow Admins to Manage All Processos

  1. Security Changes
    - Update UPDATE policy to allow admins to update any processo
    - Update DELETE policy to allow admins to delete any processo
    - Admins can view, update, and delete all processos from all users

  2. Policy Structure
    - SELECT: Users see only their own, admins see all (already exists)
    - INSERT: Users can only create processos for themselves (no change)
    - UPDATE: Users can update their own, admins can update all (NEW)
    - DELETE: Users can delete their own, admins can delete all (NEW)
*/

-- Drop existing UPDATE and DELETE policies
DROP POLICY IF EXISTS "Users can update own processos" ON processos;
DROP POLICY IF EXISTS "Users can delete own processos" ON processos;
DROP POLICY IF EXISTS "Admin can update all processos" ON processos;
DROP POLICY IF EXISTS "Admin can delete all processos" ON processos;

-- Recreate UPDATE policy with admin support
CREATE POLICY "Users can update own processos"
  ON processos
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- Recreate DELETE policy with admin support
CREATE POLICY "Users can delete own processos"
  ON processos
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );