/*
  # Add Admin Policy to View All Users

  1. Changes
    - Add policy allowing administrators to view all user profiles
    - This enables the admin users management page to list all users

  2. Security
    - Policy checks if user is_admin = true in their own profile
    - Only authenticated users with admin privileges can view all profiles
*/

-- Create policy for admins to view all profiles
CREATE POLICY "Admins can view all profiles"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );
