/*
  # Fix UPDATE and DELETE policies on processos table

  1. Problem
    - UPDATE and DELETE policies use EXISTS subqueries to check admin
    - This causes "permission denied for table users" error

  2. Solution
    - Replace EXISTS subqueries with is_admin() helper function
    - Maintains same security level without permission issues

  3. Security
    - Users can only update/delete their own processos
    - Admins can update/delete any processo
*/

-- Drop existing UPDATE policy
DROP POLICY IF EXISTS "Users can update own processos or admins can update all" ON processos;

-- Recreate UPDATE policy using helper function
CREATE POLICY "Users can update own processos or admins can update all"
  ON processos FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR is_admin(auth.uid()))
  WITH CHECK (auth.uid() = user_id OR is_admin(auth.uid()));

-- Drop existing DELETE policy
DROP POLICY IF EXISTS "Users can delete own processos or admins can delete all" ON processos;

-- Recreate DELETE policy using helper function
CREATE POLICY "Users can delete own processos or admins can delete all"
  ON processos FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR is_admin(auth.uid()));
