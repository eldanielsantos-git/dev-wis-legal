/*
  # Fix workspace_shares RLS policies to avoid auth.users access

  1. Problem
    - Policies access auth.users directly causing permission errors
    - Subqueries in USING clauses trigger cascading RLS checks
    
  2. Solution
    - Create helper function to get user email with SECURITY DEFINER
    - Simplify policies to avoid subqueries
    - Remove duplicate policies
    
  3. Security
    - Maintains same access control
    - Avoids permission denied errors
*/

-- Create helper function to get current user email
CREATE OR REPLACE FUNCTION get_user_email()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT COALESCE(
    (SELECT email FROM user_profiles WHERE id = auth.uid() LIMIT 1),
    ''
  );
$$;

-- Drop old policies that access auth.users
DROP POLICY IF EXISTS "Invited users can view shares for them" ON workspace_shares;
DROP POLICY IF EXISTS "Invited users can update their share status" ON workspace_shares;
DROP POLICY IF EXISTS "Users can view own and received shares" ON workspace_shares;

-- Create simplified SELECT policy
CREATE POLICY "Users can view workspace shares"
  ON workspace_shares FOR SELECT
  TO authenticated
  USING (
    owner_user_id = auth.uid()
    OR
    shared_with_user_id = auth.uid()
    OR
    shared_with_email = get_user_email()
  );

-- Create simplified UPDATE policy for invited users
CREATE POLICY "Users can update share status"
  ON workspace_shares FOR UPDATE
  TO authenticated
  USING (
    owner_user_id = auth.uid()
    OR
    shared_with_user_id = auth.uid()
    OR
    shared_with_email = get_user_email()
  )
  WITH CHECK (
    owner_user_id = auth.uid()
    OR
    shared_with_user_id = auth.uid()
    OR
    shared_with_email = get_user_email()
  );
