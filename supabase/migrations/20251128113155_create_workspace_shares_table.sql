/*
  # Create Workspace Shares System

  1. New Tables
    - `workspace_shares`
      - `id` (uuid, primary key)
      - `processo_id` (uuid, references processos)
      - `owner_user_id` (uuid, references user_profiles)
      - `shared_with_user_id` (uuid, nullable, references user_profiles)
      - `shared_with_email` (text, email of invited user)
      - `shared_with_name` (text, name of invited user)
      - `permission_level` (text, 'read_only' or 'editor')
      - `invitation_status` (text, 'pending' or 'accepted')
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `workspace_shares` table
    - Add policies for owners to manage shares
    - Add policies for invited users to view their shares
    - Add policies to allow deletion based on permission level

  3. Indexes
    - Index on processo_id for faster lookups
    - Index on shared_with_user_id for user queries
    - Index on shared_with_email for email lookups
*/

-- Create workspace_shares table
CREATE TABLE IF NOT EXISTS workspace_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  shared_with_user_id uuid REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  shared_with_email text NOT NULL,
  shared_with_name text NOT NULL,
  permission_level text NOT NULL DEFAULT 'read_only' CHECK (permission_level IN ('read_only', 'editor')),
  invitation_status text NOT NULL DEFAULT 'pending' CHECK (invitation_status IN ('pending', 'accepted')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_workspace_shares_processo_id ON workspace_shares(processo_id);
CREATE INDEX IF NOT EXISTS idx_workspace_shares_shared_with_user_id ON workspace_shares(shared_with_user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_shares_shared_with_email ON workspace_shares(shared_with_email);
CREATE INDEX IF NOT EXISTS idx_workspace_shares_owner_user_id ON workspace_shares(owner_user_id);

-- Enable RLS
ALTER TABLE workspace_shares ENABLE ROW LEVEL SECURITY;

-- Policy: Owners can view all shares for their processes
CREATE POLICY "Owners can view their process shares"
  ON workspace_shares
  FOR SELECT
  TO authenticated
  USING (owner_user_id = auth.uid());

-- Policy: Owners can insert shares for their processes
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
      AND processos.status = 'completed'
    )
  );

-- Policy: Owners can update shares for their processes
CREATE POLICY "Owners can update their process shares"
  ON workspace_shares
  FOR UPDATE
  TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

-- Policy: Owners can delete shares for their processes
CREATE POLICY "Owners can delete their process shares"
  ON workspace_shares
  FOR DELETE
  TO authenticated
  USING (owner_user_id = auth.uid());

-- Policy: Invited users can view shares where they are the recipient
CREATE POLICY "Invited users can view shares for them"
  ON workspace_shares
  FOR SELECT
  TO authenticated
  USING (
    shared_with_user_id = auth.uid() OR
    shared_with_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Policy: Invited users can update their own share status
CREATE POLICY "Invited users can update their share status"
  ON workspace_shares
  FOR UPDATE
  TO authenticated
  USING (
    shared_with_user_id = auth.uid() OR
    shared_with_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
  WITH CHECK (
    shared_with_user_id = auth.uid() OR
    shared_with_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Policy: Service role has full access
CREATE POLICY "Service role has full access to workspace_shares"
  ON workspace_shares
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create function to automatically accept invitation when user signs up with invited email
CREATE OR REPLACE FUNCTION accept_workspace_invitation()
RETURNS TRIGGER AS $$
BEGIN
  -- Update workspace_shares to link user_id and mark as accepted
  UPDATE workspace_shares
  SET
    shared_with_user_id = NEW.user_id,
    invitation_status = 'accepted',
    updated_at = now()
  WHERE shared_with_email = NEW.email
  AND invitation_status = 'pending';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to accept invitations on user profile creation
DROP TRIGGER IF EXISTS trigger_accept_workspace_invitation ON user_profiles;
CREATE TRIGGER trigger_accept_workspace_invitation
  AFTER INSERT ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION accept_workspace_invitation();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_workspace_shares_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at
DROP TRIGGER IF EXISTS trigger_update_workspace_shares_updated_at ON workspace_shares;
CREATE TRIGGER trigger_update_workspace_shares_updated_at
  BEFORE UPDATE ON workspace_shares
  FOR EACH ROW
  EXECUTE FUNCTION update_workspace_shares_updated_at();