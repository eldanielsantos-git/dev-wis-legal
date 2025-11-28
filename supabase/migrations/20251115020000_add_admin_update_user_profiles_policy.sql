/*
  # Add Admin Update Policy for User Profiles

  1. Changes
    - Add policy allowing admins to update other users' profiles (including is_admin field)
    - Add policy allowing users to update their own profiles (excluding is_admin field)

  2. Security
    - Only admins can change the is_admin field
    - Users can update their own profile data but not their admin status
*/

-- Drop existing update policy if any
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON user_profiles;

-- Policy for users to update their own profile (excluding is_admin)
CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND
    -- Prevent users from changing their own is_admin status
    (
      SELECT is_admin FROM user_profiles WHERE id = auth.uid()
    ) = is_admin
  );

-- Policy for admins to update any profile (including is_admin)
CREATE POLICY "Admins can update any profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (
    -- Check if current user is admin
    (
      SELECT is_admin FROM user_profiles WHERE id = auth.uid() LIMIT 1
    ) = true
  )
  WITH CHECK (
    -- Admin can update anyone
    (
      SELECT is_admin FROM user_profiles WHERE id = auth.uid() LIMIT 1
    ) = true
  );
