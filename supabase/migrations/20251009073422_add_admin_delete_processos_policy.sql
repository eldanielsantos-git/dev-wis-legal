/*
  # Add Admin Delete Policy for Processos

  1. Changes
    - Update DELETE policy to allow admins to delete any processo
    - Users can still delete their own processos
    - Admins can delete any processo from any user

  2. Security
    - Maintains user isolation: regular users can only delete their own
    - Admins have elevated permissions to manage all processos
    - Service role maintains full access
*/

-- Drop existing DELETE policy
DROP POLICY IF EXISTS "Users can delete own processos" ON processos;

-- Create new DELETE policy that allows admins to delete any processo
CREATE POLICY "Users can delete own processos or admins can delete any"
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
