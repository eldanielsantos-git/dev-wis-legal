/*
  # Fix party_type constraint definitively

  1. Changes
    - Removes ALL existing party_type constraints (both old and new names)
    - Creates a single definitive constraint with correct values
    - Ensures the constraint accepts: 'author', 'defendant', 'both', 'third_party'

  2. Data Migration
    - Migrates any legacy 'accusation' values to 'author'

  3. Security
    - No security changes, maintains existing RLS policies
*/

-- First, migrate any legacy data
UPDATE process_deadlines 
SET party_type = 'author' 
WHERE party_type = 'accusation';

-- Drop ALL possible constraint variations
ALTER TABLE process_deadlines 
DROP CONSTRAINT IF EXISTS valid_party_type;

ALTER TABLE process_deadlines 
DROP CONSTRAINT IF EXISTS process_deadlines_party_type_check;

-- Add the definitive constraint with correct name and values
ALTER TABLE process_deadlines 
ADD CONSTRAINT valid_party_type 
CHECK (party_type IN ('author', 'defendant', 'both', 'third_party'));