/*
  # Allow Shared Users to View All Chat Messages in Shared Processos

  1. Problem
    - Users with shared access can only see their own messages
    - Chat should be collaborative - all participants see all messages
    - Current policy restricts to user_id only

  2. Solution
    - Update SELECT policy to allow viewing all messages in shared processos
    - Users can view messages in processos they own OR have shared access to
    - Maintains security by checking processo ownership or shared access

  3. Security
    - Users can only view messages in processos they own or have shared access to
    - Admins can view all messages
    - Service role maintains full access
*/

-- Drop existing SELECT policies (keep admin policy)
DROP POLICY IF EXISTS "Users can view own chat messages" ON chat_messages;

-- Create new SELECT policy that includes all messages from shared processos
CREATE POLICY "Users can view messages in own or shared processos"
  ON chat_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM processos
      WHERE processos.id = chat_messages.processo_id
      AND processos.user_id = auth.uid()
    )
    OR
    has_shared_access(chat_messages.processo_id, auth.uid())
  );
