/*
  # Fix processos SELECT policy to avoid implicit JOIN issues

  1. Changes
    - Create a helper function to check if user is admin
    - Update processos SELECT policy to use the helper function
    - This avoids permission issues with auth.users table

  2. Security
    - Maintains same security level
    - Users can only see their own processos or all if admin
    - Fixes "permission denied for table users" error
*/

-- Create helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM user_profiles WHERE id = user_id),
    false
  );
$$;

-- Drop existing policy
DROP POLICY IF EXISTS "Users can view own processos or admins can view any" ON processos;

-- Recreate policy using helper function
CREATE POLICY "Users can view own processos or admins can view any"
  ON processos FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id 
    OR 
    is_admin(auth.uid())
  );
