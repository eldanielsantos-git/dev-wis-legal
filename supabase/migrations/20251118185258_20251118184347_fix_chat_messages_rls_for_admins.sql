/*
  # Fix chat_messages RLS policies for admin access

  1. Changes
    - Update admin policy to use is_admin_user() helper function
    - Improves query performance and fixes loading issues

  2. Security
    - Maintains admin access to all chat messages
    - Maintains user access to own chat messages
    - Improves query performance
*/

-- Drop the old admin policy
DROP POLICY IF EXISTS "Admins can view all chat messages" ON chat_messages;

-- Recreate with the helper function
CREATE POLICY "Admins can view all chat messages"
  ON chat_messages
  FOR SELECT
  TO authenticated
  USING (public.is_admin_user());
