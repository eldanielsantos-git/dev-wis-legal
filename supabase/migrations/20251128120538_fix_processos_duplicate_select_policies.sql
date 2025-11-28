/*
  # Fix duplicate SELECT policies on processos table

  1. Problem
    - Two SELECT policies exist causing conflicts
    - Both use EXISTS subqueries accessing user_profiles
    - This causes "permission denied for table users" error

  2. Solution
    - Drop all existing SELECT policies
    - Create single consolidated SELECT policy using is_admin() helper
    - Policy allows: own processos, shared processos, or admin access

  3. Security
    - Maintains all existing access patterns
    - Uses SECURITY DEFINER function to avoid permission issues
*/

-- Drop existing SELECT policies
DROP POLICY IF EXISTS "Users can view own processos or admins can view any" ON processos;
DROP POLICY IF EXISTS "Users can view own, shared processos, and admins can view all" ON processos;

-- Create consolidated SELECT policy
CREATE POLICY "Users can view own, shared, or all if admin"
  ON processos FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR 
    EXISTS (
      SELECT 1 FROM workspace_shares
      WHERE workspace_shares.processo_id = processos.id
      AND workspace_shares.shared_with_user_id = auth.uid()
      AND workspace_shares.invitation_status = 'accepted'
    )
    OR
    is_admin(auth.uid())
  );
