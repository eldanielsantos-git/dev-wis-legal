/*
  # Add Email Verification Fields to User Profiles

  1. Changes
    - Add `email_verified` (boolean, default false) to user_profiles
    - Add `email_verified_at` (timestamptz, nullable) to user_profiles
    - Create index on email_verified for performance

  2. Notes
    - Maintains compatibility with existing users (default false)
    - Migration of existing users will be done in separate migration
    - OAuth users will be auto-verified via trigger
*/

-- Add email_verified column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'email_verified'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN email_verified boolean DEFAULT false NOT NULL;
  END IF;
END $$;

-- Add email_verified_at column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'email_verified_at'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN email_verified_at timestamptz;
  END IF;
END $$;

-- Create index for faster queries on email_verified
CREATE INDEX IF NOT EXISTS idx_user_profiles_email_verified
  ON user_profiles(email_verified);

-- Create composite index for admin queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_verified_created
  ON user_profiles(email_verified, created_at DESC);

-- Add comment to columns
COMMENT ON COLUMN user_profiles.email_verified IS 'Whether the user has verified their email address (custom verification system)';
COMMENT ON COLUMN user_profiles.email_verified_at IS 'Timestamp when the user verified their email address';
