/*
  # Add Workspace Shared Access to Analysis Results

  1. Problem
    - Users with shared access to a processo cannot view analysis_results
    - Current policy only allows processo owner to view results
    - Shared users see empty screen when viewing shared processos

  2. Solution
    - Update analysis_results SELECT policy to include shared access
    - Use existing has_shared_access() helper function
    - Maintain security by checking invitation_status = 'accepted'

  3. Security
    - Users can only view results for processos they own or have shared access to
    - Admins can view all results
    - Service role maintains full access
*/

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Usuários podem visualizar seus próprios resultados" ON analysis_results;

-- Create new policy that includes shared access
CREATE POLICY "Users can view own, shared, or all if admin results"
  ON analysis_results FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM processos
      WHERE processos.id = analysis_results.processo_id
      AND processos.user_id = auth.uid()
    )
    OR
    has_shared_access(analysis_results.processo_id, auth.uid())
    OR
    is_admin(auth.uid())
  );
