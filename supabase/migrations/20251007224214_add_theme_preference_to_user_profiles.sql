/*
  # Add theme preference to user profiles

  1. Changes
    - Add `theme_preference` column to `user_profiles` table
      - Type: text with check constraint (dark or light)
      - Default value: 'dark'
      - Not null
    - Add index on theme_preference for optimization

  2. Notes
    - Default theme is dark mode as specified by user
    - Users can toggle between dark and light themes
    - Preference is stored per user and synced across devices
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'theme_preference'
  ) THEN
    ALTER TABLE user_profiles 
    ADD COLUMN theme_preference text NOT NULL DEFAULT 'dark'
    CHECK (theme_preference IN ('dark', 'light'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_profiles_theme_preference 
ON user_profiles(theme_preference);