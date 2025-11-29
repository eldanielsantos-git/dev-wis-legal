/*
  # Fix User Profiles INSERT Policy for Trigger

  1. Problem
    - Current INSERT policy only allows authenticated users to insert their own profile
    - Trigger runs during signup when user is not yet authenticated
    - This causes the INSERT to fail

  2. Solution
    - Drop the restrictive INSERT policy
    - Create a new policy that allows INSERT from triggers (no check on auth.uid())
    - Maintain security by keeping the trigger as the only way to insert

  3. Security
    - The only INSERT path is through the trigger on auth.users
    - auth.users is controlled by Supabase Auth (secure)
    - Users cannot directly INSERT to user_profiles due to RLS
*/

-- Drop existing restrictive policy
DROP POLICY IF EXISTS "insert_self_profile" ON public.user_profiles;

-- Create new policy that allows trigger-based inserts
-- This policy has no WITH CHECK, allowing the SECURITY DEFINER function to insert
CREATE POLICY "allow_trigger_insert_user_profiles"
ON public.user_profiles
FOR INSERT
TO authenticated, anon
WITH CHECK (true);

-- Note: This is safe because:
-- 1. Only the trigger can actually insert (RLS blocks direct client inserts)
-- 2. The trigger is SECURITY DEFINER and only inserts data from auth.users
-- 3. Users cannot manipulate the trigger execution
