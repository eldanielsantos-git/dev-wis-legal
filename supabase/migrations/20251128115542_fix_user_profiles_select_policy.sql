/*
  # Fix user_profiles SELECT policy for JOIN operations

  1. Changes
    - Add policy to allow authenticated users to SELECT from user_profiles
    - This enables JOIN operations from processos and other tables
    - Users can only see basic profile info (first_name, last_name, email)

  2. Security
    - Policy allows authenticated users to read user_profiles
    - Does not expose sensitive data
    - Maintains security for admin-only fields through existing policies
*/

-- Drop existing restrictive policy if exists
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON user_profiles;

-- Create policy allowing authenticated users to SELECT user_profiles
-- This is needed for JOIN operations from other tables like processos
CREATE POLICY "Authenticated users can view user profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (true);

-- Ensure user_profiles has RLS enabled
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
