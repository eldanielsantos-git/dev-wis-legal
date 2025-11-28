/*
  # Add Finalization Lock System

  1. New Columns
    - `finalization_lock_at` (timestamptz) - Timestamp when lock was acquired
    - `finalization_locked_by` (text) - Unique identifier of the instance holding the lock

  2. Purpose
    - Prevents race conditions during chunked finalization
    - Only one edge function instance can process finalization at a time
    - Locks expire automatically after 5 minutes to prevent deadlocks
    - Enables safe concurrent requests without duplicate page insertions

  3. Indexes
    - Create index on finalization_lock_at for efficient lock queries

  4. Notes
    - NULL values indicate no active lock
    - Lock should be acquired before processing and released after completion
    - Edge function validates lock age and can override expired locks
*/

-- Add finalization lock columns
ALTER TABLE processos
ADD COLUMN IF NOT EXISTS finalization_lock_at timestamptz DEFAULT NULL,
ADD COLUMN IF NOT EXISTS finalization_locked_by text DEFAULT NULL;

-- Create index for efficient lock queries
CREATE INDEX IF NOT EXISTS idx_processos_finalization_lock
ON processos(finalization_lock_at)
WHERE finalization_lock_at IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN processos.finalization_lock_at IS 'Timestamp when finalization lock was acquired. NULL = no lock. Expires after 5 minutes.';
COMMENT ON COLUMN processos.finalization_locked_by IS 'Unique instance ID holding the lock. Used for debugging and monitoring.';