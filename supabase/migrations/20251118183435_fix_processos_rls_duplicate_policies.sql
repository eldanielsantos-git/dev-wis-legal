/*
  # Fix duplicate RLS policies on processos table

  1. Changes
    - Drop duplicate RLS policies on processos table
    - Keep only the admin-friendly policies that allow admins to manage all processos

  2. Security
    - Maintains admin access to all processos
    - Maintains user access to own processos
*/

-- Drop old duplicate policies
DROP POLICY IF EXISTS "Users can view own processos" ON processos;
DROP POLICY IF EXISTS "Users can insert own processos" ON processos;
DROP POLICY IF EXISTS "Users can update own processos" ON processos;
DROP POLICY IF EXISTS "Users can delete own processos" ON processos;

-- Recreate clean policies
CREATE POLICY "Users can view own processos or admins can view any"
  ON processos FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id 
    OR 
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "Users can insert own processos"
  ON processos FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
