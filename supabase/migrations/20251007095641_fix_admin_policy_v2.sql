/*
  # Fix Admin Policy - Version 2

  1. Changes
    - Drop the recursive policy
    - Create a simple policy that checks current row's is_admin or if viewing own profile
    - Use a security definer function to avoid recursion

  2. Security
    - Users can always view their own profile
    - If the current user is an admin, they can view all profiles
*/

-- Drop existing policy
DROP POLICY IF EXISTS "Users can view own profile or admins view all" ON user_profiles;

-- Create a function that checks if current user is admin without recursion
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM user_profiles WHERE id = auth.uid() LIMIT 1),
    false
  );
$$;

-- Create new policy using the function
CREATE POLICY "Users view own profile, admins view all"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id OR is_admin()
  );
