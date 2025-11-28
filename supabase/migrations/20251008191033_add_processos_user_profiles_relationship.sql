/*
  # Add Foreign Key Relationship between processos and user_profiles

  1. Changes
    - Add foreign key constraint from processos.user_id to user_profiles.id
    - This enables proper joins between processos and user_profiles tables
  
  2. Security
    - No RLS changes needed
    - Maintains existing security policies
*/

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'processos_user_id_user_profiles_fkey'
    AND table_name = 'processos'
  ) THEN
    ALTER TABLE processos 
    ADD CONSTRAINT processos_user_id_user_profiles_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES user_profiles(id) 
    ON DELETE CASCADE;
  END IF;
END $$;