/*
  # Add finalization_lock_expires_at column

  1. Changes
    - Add `finalization_lock_expires_at` column to `processos` table
    - This column tracks when the finalization lock expires
    - Used by finalize-transcription edge function to prevent race conditions

  2. Purpose
    - Enables timeout-based lock expiration
    - Prevents deadlocks when finalization process crashes
    - Allows automatic lock cleanup after timeout period
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'processos' AND column_name = 'finalization_lock_expires_at'
  ) THEN
    ALTER TABLE processos 
    ADD COLUMN finalization_lock_expires_at timestamptz;
    
    CREATE INDEX IF NOT EXISTS idx_processos_finalization_lock_expires 
    ON processos(finalization_lock_expires_at) 
    WHERE finalization_lock_expires_at IS NOT NULL;
  END IF;
END $$;
