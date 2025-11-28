/*
  # Add email column to user_profiles table

  1. Changes
    - Add `email` column to `user_profiles` table
    - Populate email from auth.users for existing users
    - Create trigger to sync email on user creation/update

  2. Security
    - Email is populated automatically from auth.users
    - Users cannot modify their own email through user_profiles
*/

-- Add email column to user_profiles
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS email text;

-- Populate existing emails from auth.users
UPDATE user_profiles up
SET email = au.email
FROM auth.users au
WHERE up.id = au.id AND up.email IS NULL;

-- Create function to sync email from auth.users
CREATE OR REPLACE FUNCTION sync_user_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Get email from auth.users
  SELECT email INTO NEW.email
  FROM auth.users
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to sync email on insert/update
DROP TRIGGER IF EXISTS sync_user_email_trigger ON user_profiles;
CREATE TRIGGER sync_user_email_trigger
  BEFORE INSERT OR UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_user_email();
