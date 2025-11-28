/*
  # Add OAB and Phone Country Code to User Profiles

  1. Changes
    - Add `oab` column to store OAB registration number
    - Add `phone_country_code` column to store phone country code (e.g., +55)
    - Both columns are optional (nullable)

  2. Security
    - No RLS changes needed (existing policies cover new columns)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'oab'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN oab text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'phone_country_code'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN phone_country_code text DEFAULT '+55';
  END IF;
END $$;