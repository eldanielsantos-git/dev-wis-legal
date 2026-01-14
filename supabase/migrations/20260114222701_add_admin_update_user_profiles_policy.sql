/*
  # Add Admin Update Policy for User Profiles

  1. Problem
    - Admins cannot update other users' profiles (including promoting to admin)
    - Current "Users can update own profile" policy only allows self-updates
    - The is_admin field cannot be changed by admins for other users

  2. Solution
    - Add new RLS policy allowing admins to update any user profile
    - Uses EXISTS check against user_profiles to verify requester is admin
    - Applies to UPDATE operations for authenticated users

  3. Security
    - Only users with is_admin = true can update other profiles
    - Regular users can still only update their own profile
    - Both USING and WITH CHECK ensure admin status is verified
*/

CREATE POLICY "Admins can update any user profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.is_admin = true
    )
  );
