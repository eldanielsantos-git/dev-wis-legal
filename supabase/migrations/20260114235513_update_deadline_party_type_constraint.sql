/*
  # Update deadline party_type constraint

  1. Changes
    - Updates the party_type CHECK constraint on process_deadlines table
    - Old values: 'accusation', 'defendant', 'both'
    - New values: 'author', 'defendant', 'both', 'third_party'
    - Migrates existing 'accusation' values to 'author'

  2. Security
    - No security changes
*/

DO $$
BEGIN
  UPDATE process_deadlines 
  SET party_type = 'author' 
  WHERE party_type = 'accusation';
END $$;

ALTER TABLE process_deadlines 
DROP CONSTRAINT IF EXISTS process_deadlines_party_type_check;

ALTER TABLE process_deadlines 
ADD CONSTRAINT process_deadlines_party_type_check 
CHECK (party_type IN ('author', 'defendant', 'both', 'third_party'));