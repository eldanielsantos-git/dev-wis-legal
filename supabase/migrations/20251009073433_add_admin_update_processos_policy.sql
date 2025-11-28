/*
  # Add Admin Update Policy for Processos

  1. Changes
    - Update UPDATE policy to allow admins to update any processo
    - Users can still update their own processos
    - Admins can update any processo from any user

  2. Security
    - Maintains user isolation: regular users can only update their own
    - Admins have elevated permissions to manage all processos
    - Service role maintains full access
*/

-- Drop existing UPDATE policy
DROP POLICY IF EXISTS "Users can update own processos" ON processos;

-- Create new UPDATE policy that allows admins to update any processo
CREATE POLICY "Users can update own processos or admins can update any"
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
