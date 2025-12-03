/*
  # Allow sharing processes in any status

  Remove the requirement that processes must be completed to be shared.
  This allows users to share processes at any stage to encourage platform adoption.
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "Owners can create shares for their processes" ON workspace_shares;

-- Recreate the policy without status check
CREATE POLICY "Owners can create shares for their processes"
  ON workspace_shares
  FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM processos
      WHERE processos.id = workspace_shares.processo_id
      AND processos.user_id = auth.uid()
    )
  );
