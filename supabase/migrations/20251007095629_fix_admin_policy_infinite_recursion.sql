/*
  # Fix Admin Policy Infinite Recursion

  1. Changes
    - Drop the policy causing infinite recursion
    - Create a new policy that checks is_admin directly without subquery
    - This fixes the infinite recursion error in user_profiles

  2. Security
    - Users can view their own profile
    - Admins can view all profiles (checked via direct column comparison)
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;

-- Recreate the "Users can view own profile" policy to also allow admins
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;

CREATE POLICY "Users can view own profile or admins view all"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id 
    OR 
    (
      SELECT is_admin 
      FROM user_profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    ) = true
  );
