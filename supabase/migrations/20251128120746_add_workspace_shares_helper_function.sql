/*
  # Add helper function for workspace_shares check

  1. Problem
    - Direct EXISTS check on workspace_shares was causing permission issues
    
  2. Solution
    - Create helper function with SECURITY DEFINER
    - Function checks if user has access to processo via workspace_shares
    
  3. Security
    - Function runs with elevated privileges to avoid permission issues
    - Still maintains security by checking user_id
*/

-- Create helper function to check if user has shared access
CREATE OR REPLACE FUNCTION has_shared_access(processo_id uuid, user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM workspace_shares
    WHERE workspace_shares.processo_id = $1
      AND workspace_shares.shared_with_user_id = $2
      AND workspace_shares.invitation_status = 'accepted'
  );
$$;

-- Update processos SELECT policy to include shared access
DROP POLICY IF EXISTS "Users can view own processos or all if admin" ON processos;

CREATE POLICY "Users can view own, shared, or all if admin"
  ON processos FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR
    has_shared_access(id, auth.uid())
    OR
    is_admin(auth.uid())
  );
