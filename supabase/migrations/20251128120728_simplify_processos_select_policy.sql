/*
  # Simplify processos SELECT policy to isolate permission issue

  1. Problem
    - Current policy still causes "permission denied for table users"
    - Need to identify which part of the policy is causing the issue

  2. Solution
    - Create minimal policy: own processos OR admin only
    - Remove workspace_shares check temporarily
    - This will help identify the root cause

  3. Security
    - Users can view their own processos
    - Admins can view all processos
    - Shared processos temporarily disabled (to be fixed separately)
*/

-- Drop current policy
DROP POLICY IF EXISTS "Users can view own, shared, or all if admin" ON processos;

-- Create simple policy without workspace_shares
CREATE POLICY "Users can view own processos or all if admin"
  ON processos FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR
    is_admin(auth.uid())
  );
