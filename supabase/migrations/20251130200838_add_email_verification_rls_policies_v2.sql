/*
  # Add Email Verification RLS Policies

  1. Purpose
    - Add RLS policies to protect sensitive operations
    - Require email verification for creating/modifying data
    - Allow admins to bypass verification requirement

  2. Affected Tables
    - processos: require verification for INSERT/UPDATE/DELETE
    - chat_messages: require verification for INSERT
    - workspace_shares: require verification for all operations

  3. Exceptions
    - Admins can access regardless of verification status
    - SELECT operations allowed (read-only access for unverified users)
    - OAuth users are automatically verified by trigger
*/

-- Helper function to check if user is verified
CREATE OR REPLACE FUNCTION is_user_verified(user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT email_verified FROM user_profiles WHERE id = user_id),
    false
  );
$$;

-- Helper function to check if user is admin OR verified
CREATE OR REPLACE FUNCTION is_admin_or_verified(user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT is_admin OR email_verified FROM user_profiles WHERE id = user_id),
    false
  );
$$;

-- Update processos INSERT policy to require verification
DROP POLICY IF EXISTS "Users can create processos if verified" ON processos;
CREATE POLICY "Users can create processos if verified"
  ON processos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND is_admin_or_verified(auth.uid())
  );

-- Update processos UPDATE policy to require verification  
DROP POLICY IF EXISTS "Users can update own processos if verified" ON processos;
CREATE POLICY "Users can update own processos if verified"
  ON processos
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND is_admin_or_verified(auth.uid()))
  WITH CHECK (auth.uid() = user_id AND is_admin_or_verified(auth.uid()));

-- Update processos DELETE policy to require verification
DROP POLICY IF EXISTS "Users can delete own processos if verified" ON processos;
CREATE POLICY "Users can delete own processos if verified"
  ON processos
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id AND is_admin_or_verified(auth.uid()));

-- Update chat_messages INSERT policy to require verification
DROP POLICY IF EXISTS "Users can create chat messages if verified" ON chat_messages;
CREATE POLICY "Users can create chat messages if verified"
  ON chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND is_admin_or_verified(auth.uid())
  );

-- Update workspace_shares policies to require verification
DROP POLICY IF EXISTS "Users can create shares if verified" ON workspace_shares;
CREATE POLICY "Users can create shares if verified"
  ON workspace_shares
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = owner_user_id AND is_admin_or_verified(auth.uid())
  );

DROP POLICY IF EXISTS "Users can update own shares if verified" ON workspace_shares;
CREATE POLICY "Users can update own shares if verified"
  ON workspace_shares
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_user_id AND is_admin_or_verified(auth.uid()))
  WITH CHECK (auth.uid() = owner_user_id AND is_admin_or_verified(auth.uid()));

DROP POLICY IF EXISTS "Users can delete own shares if verified" ON workspace_shares;
CREATE POLICY "Users can delete own shares if verified"
  ON workspace_shares
  FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_user_id AND is_admin_or_verified(auth.uid()));

-- Add comments
COMMENT ON FUNCTION is_user_verified IS 'Returns true if user has verified their email address';
COMMENT ON FUNCTION is_admin_or_verified IS 'Returns true if user is admin OR has verified email';
