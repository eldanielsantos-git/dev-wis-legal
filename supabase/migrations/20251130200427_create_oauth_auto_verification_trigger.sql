/*
  # Auto-Verify OAuth Users Trigger

  1. Purpose
    - Automatically mark OAuth users (Google/Microsoft) as email verified
    - Happens when user_profiles record is created via trigger from auth.users

  2. How It Works
    - Checks if user has OAuth identity (Google/Azure/Microsoft)
    - If yes, immediately marks email_verified = true
    - Sets email_verified_at to current timestamp

  3. Security
    - Runs with SECURITY DEFINER to bypass RLS
    - Only updates user's own profile
    - No external input, fully automated
*/

-- Function to auto-verify OAuth users
CREATE OR REPLACE FUNCTION auto_verify_oauth_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  has_oauth_identity BOOLEAN;
BEGIN
  -- Check if user has OAuth identity
  SELECT EXISTS (
    SELECT 1 
    FROM auth.identities 
    WHERE user_id = NEW.id 
    AND provider IN ('google', 'azure', 'microsoft')
  ) INTO has_oauth_identity;

  -- If OAuth user, auto-verify
  IF has_oauth_identity THEN
    NEW.email_verified := true;
    NEW.email_verified_at := COALESCE(NEW.email_verified_at, now());
    
    RAISE LOG 'Auto-verified OAuth user: %', NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on user_profiles INSERT
DROP TRIGGER IF EXISTS trigger_auto_verify_oauth_user ON user_profiles;
CREATE TRIGGER trigger_auto_verify_oauth_user
  BEFORE INSERT ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_verify_oauth_user();

-- Also create trigger for UPDATE in case OAuth is added later
DROP TRIGGER IF EXISTS trigger_auto_verify_oauth_user_update ON user_profiles;
CREATE TRIGGER trigger_auto_verify_oauth_user_update
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  WHEN (OLD.email_verified = false AND NEW.email_verified = false)
  EXECUTE FUNCTION auto_verify_oauth_user();

COMMENT ON FUNCTION auto_verify_oauth_user IS 'Automatically marks OAuth users (Google/Microsoft) as email verified';
