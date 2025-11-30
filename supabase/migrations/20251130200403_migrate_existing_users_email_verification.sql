/*
  # Migrate Existing Users - Email Verification Status

  1. Purpose
    - Mark existing users as email verified to maintain compatibility
    - Preserve user experience for users already in the system

  2. Logic
    - Users with email_confirmed_at in auth.users → verified
    - Users created via OAuth (Google/Microsoft) → verified
    - Copy email_confirmed_at timestamp to email_verified_at

  3. Safety
    - Uses UPDATE with WHERE conditions
    - Idempotent - can be run multiple times safely
    - Only updates users where email_verified is still false
*/

-- Step 1: Mark users with confirmed email in auth.users as verified
UPDATE user_profiles
SET 
  email_verified = true,
  email_verified_at = COALESCE(
    (SELECT email_confirmed_at FROM auth.users WHERE auth.users.id = user_profiles.id),
    user_profiles.created_at
  )
WHERE 
  email_verified = false
  AND id IN (
    SELECT id FROM auth.users 
    WHERE email_confirmed_at IS NOT NULL
  );

-- Step 2: Mark OAuth users as verified (Google and Microsoft)
UPDATE user_profiles
SET 
  email_verified = true,
  email_verified_at = COALESCE(email_verified_at, user_profiles.created_at)
WHERE 
  email_verified = false
  AND id IN (
    SELECT user_id 
    FROM auth.identities 
    WHERE provider IN ('google', 'azure', 'microsoft')
  );

-- Step 3: Log migration results
DO $$
DECLARE
  verified_count INTEGER;
  oauth_count INTEGER;
  total_count INTEGER;
BEGIN
  -- Count verified users
  SELECT COUNT(*) INTO verified_count 
  FROM user_profiles 
  WHERE email_verified = true;
  
  -- Count OAuth users
  SELECT COUNT(DISTINCT user_id) INTO oauth_count
  FROM auth.identities
  WHERE provider IN ('google', 'azure', 'microsoft');
  
  -- Count total users
  SELECT COUNT(*) INTO total_count FROM user_profiles;
  
  -- Log to console (will appear in migration logs)
  RAISE NOTICE 'Email Verification Migration Complete:';
  RAISE NOTICE '  - Total users: %', total_count;
  RAISE NOTICE '  - Verified users: %', verified_count;
  RAISE NOTICE '  - OAuth users: %', oauth_count;
  RAISE NOTICE '  - Verification rate: %%%', ROUND((verified_count::NUMERIC / NULLIF(total_count, 0) * 100), 2);
END $$;
