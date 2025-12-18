/*
  # Add profile_complete to achievement types

  1. Changes
    - Update the check constraint on user_achievements table
    - Add 'profile_complete' to the allowed achievement types
  
  2. Notes
    - This enables the profile completion achievement to be tracked
*/

-- Drop the old constraint
ALTER TABLE user_achievements 
  DROP CONSTRAINT IF EXISTS user_achievements_achievement_type_check;

-- Add the new constraint with profile_complete included
ALTER TABLE user_achievements
  ADD CONSTRAINT user_achievements_achievement_type_check 
  CHECK (achievement_type = ANY (ARRAY[
    'profile_complete'::text,
    'first_process'::text,
    'three_processes'::text,
    'ten_processes'::text,
    'fifty_processes'::text,
    'hundred_processes'::text
  ]));
