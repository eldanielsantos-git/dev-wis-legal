/*
  # Add Workspace Shared Access to Chat Messages

  1. Problem
    - Users with shared access to a processo cannot use chat
    - Current INSERT policy requires user to own the processo
    - Shared users cannot create chat messages for shared processos

  2. Solution
    - Update chat_messages INSERT policy to include shared access
    - Users can chat with processos they own OR have shared access to
    - Use existing has_shared_access() helper function

  3. Security
    - Users can only chat with processos they own or have shared access to
    - Users can only see their own messages (privacy maintained)
    - Admins can view all messages
*/

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Users can create own chat messages" ON chat_messages;

-- Create new INSERT policy that includes shared access
CREATE POLICY "Users can create messages for own or shared processos"
  ON chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      EXISTS (
        SELECT 1 FROM processos
        WHERE processos.id = chat_messages.processo_id
        AND processos.user_id = auth.uid()
      )
      OR
      has_shared_access(chat_messages.processo_id, auth.uid())
    )
  );
