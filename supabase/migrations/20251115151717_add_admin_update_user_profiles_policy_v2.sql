/*
  # Fix Admin Update Policy for User Profiles

  1. Changes
    - Remove old/conflicting update policies
    - Add comprehensive policy allowing admins to update any profile including is_admin field
    - Keep user self-update policy but prevent changing own is_admin status

  2. Security
    - Only admins can change the is_admin field of any user
    - Users can update their own profile data but not their admin status
*/

-- Drop ALL existing update policies to avoid conflicts
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON user_profiles;
DROP POLICY IF EXISTS "update_own_profile" ON user_profiles;

-- Policy for admins to update ANY profile (including is_admin field)
-- This must come FIRST to have priority
CREATE POLICY "Admins can update any profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (
    -- Check if current user is admin using the is_admin() function
    is_admin() = true
  )
  WITH CHECK (
    -- Admin can update anyone
    is_admin() = true
  );

-- Policy for users to update their own profile (but NOT is_admin field)
CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = id AND NOT is_admin()
  )
  WITH CHECK (
    auth.uid() = id AND
    -- Ensure users cannot change their own is_admin status
    is_admin = (SELECT is_admin FROM user_profiles WHERE id = auth.uid())
  );
