/*
  # Fix Infinite Recursion in Admin Update Policy

  1. Problem
    - The policy "Admins can update any user profile" causes infinite recursion
    - This happens because checking is_admin requires reading user_profiles
    - Reading user_profiles triggers RLS check, which reads user_profiles again

  2. Solution
    - Create a SECURITY DEFINER function that bypasses RLS to check admin status
    - Update the policy to use this function instead of direct table query
    - Function runs with elevated privileges, avoiding the recursion

  3. Security
    - Function is owned by postgres and runs with definer privileges
    - Only checks if the authenticated user is an admin
    - Does not expose any other data
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Admins can update any user profile" ON user_profiles;

-- Create a security definer function to check admin status
-- This bypasses RLS and prevents infinite recursion
CREATE OR REPLACE FUNCTION is_current_user_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM user_profiles WHERE id = auth.uid()),
    false
  );
$$;

-- Recreate the policy using the function
CREATE POLICY "Admins can update any user profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (is_current_user_admin())
  WITH CHECK (is_current_user_admin());
