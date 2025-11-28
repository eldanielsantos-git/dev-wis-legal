/*
  # Add processing lock columns to processos table
  
  1. New Columns
    - `processing_lock`: Boolean flag indicating if processo is locked
    - `processing_worker_id`: ID of the worker that acquired the lock
    - `processing_lock_acquired_at`: When the lock was acquired
    - `processing_lock_expires_at`: When the lock expires
  
  2. Purpose
    - Enable global processo locking for sequential processing
    - Prevent concurrent processing of the same processo
    - Handle automatic lock expiration for stuck processes
*/

-- Add processing lock columns
ALTER TABLE processos 
ADD COLUMN IF NOT EXISTS processing_lock boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS processing_worker_id text,
ADD COLUMN IF NOT EXISTS processing_lock_acquired_at timestamptz,
ADD COLUMN IF NOT EXISTS processing_lock_expires_at timestamptz;

-- Create index for lock queries
CREATE INDEX IF NOT EXISTS idx_processos_processing_lock 
ON processos(id, processing_lock, processing_lock_expires_at)
WHERE processing_lock = true;