/*
  # Sync Email Verification from auth.users to user_profiles

  1. Purpose
    - When email_confirmed_at is set in auth.users, update user_profiles
    - Keeps email_verified in sync with Supabase Auth confirmation
    - Works for both custom Mailchimp flow and native Supabase confirmations

  2. Trigger Logic
    - Detects when email_confirmed_at changes from NULL to a value
    - Updates email_verified = true in user_profiles
    - Sets email_verified_at to the confirmation timestamp

  3. Security
    - Runs with SECURITY DEFINER to bypass RLS
    - Only updates matching user profile
    - Atomic operation, no race conditions
*/

-- Function to sync email verification status
CREATE OR REPLACE FUNCTION sync_email_verification_from_auth()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if email_confirmed_at was just set (changed from NULL to a value)
  IF NEW.email_confirmed_at IS NOT NULL AND (OLD.email_confirmed_at IS NULL OR OLD.email_confirmed_at != NEW.email_confirmed_at) THEN
    
    -- Update user_profiles with verification status
    UPDATE user_profiles
    SET 
      email_verified = true,
      email_verified_at = NEW.email_confirmed_at,
      updated_at = now()
    WHERE id = NEW.id
      AND email_verified = false; -- Only update if not already verified
    
    IF FOUND THEN
      RAISE LOG 'Email verification synced for user: % at %', NEW.id, NEW.email_confirmed_at;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on auth.users UPDATE
DROP TRIGGER IF EXISTS trigger_sync_email_verification ON auth.users;
CREATE TRIGGER trigger_sync_email_verification
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION sync_email_verification_from_auth();

-- Add comment
COMMENT ON FUNCTION sync_email_verification_from_auth IS 'Syncs email verification status from auth.users to user_profiles when email is confirmed';
