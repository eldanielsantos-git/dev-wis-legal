/*
  # Fix Admin Update Policy - Final Version

  1. Problem
    - Admins cannot update is_admin field of other users
    - RLS policies are blocking the update

  2. Solution
    - Simplify policies with clear separation
    - Admin policy has priority and allows all updates
    - User policy only for own profile, blocks is_admin changes

  3. Security
    - Only admins can change any user's is_admin field
    - Regular users can only update their own non-admin fields
*/

-- Drop ALL existing update policies
DROP POLICY IF EXISTS "Admins can update any profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "update_own_profile" ON user_profiles;

-- First: Admin policy (most permissive, checked first)
CREATE POLICY "Admins can update any profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() 
      AND is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() 
      AND is_admin = true
    )
  );

-- Second: User policy (restricted, only own profile, no admin field change)
CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = id
    AND NOT EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() 
      AND is_admin = true
    )
  )
  WITH CHECK (
    auth.uid() = id
    AND is_admin = (SELECT is_admin FROM user_profiles WHERE id = auth.uid())
  );
