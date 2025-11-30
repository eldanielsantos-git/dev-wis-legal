/*
  # Make email_logs.user_id nullable

  1. Changes
    - Remove foreign key constraint from email_logs.user_id
    - Make user_id nullable to allow logging even when user creation fails
    - This prevents blocking email operations when user_id doesn't exist yet

  2. Security
    - Maintains RLS policies for authenticated users
    - Allows service role to insert logs without user_id
*/

-- Drop the foreign key constraint
ALTER TABLE email_logs
DROP CONSTRAINT IF EXISTS email_logs_user_id_fkey;

-- Make user_id nullable
ALTER TABLE email_logs
ALTER COLUMN user_id DROP NOT NULL;

-- Re-add foreign key constraint but without NOT NULL requirement
ALTER TABLE email_logs
ADD CONSTRAINT email_logs_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;
