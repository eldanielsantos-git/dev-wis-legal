/*
  # Add 'queued' status to processo_status enum

  1. Changes
    - Add 'queued' value to processo_status enum type
    - This status indicates a complex process is in the queue waiting for processing

  2. Purpose
    - Enable tracking of processes that are queued for complex processing
    - Differentiate between 'created' (uploaded) and 'queued' (ready for processing)
*/

-- Add 'queued' to the processo_status enum
ALTER TYPE processo_status ADD VALUE IF NOT EXISTS 'queued';
