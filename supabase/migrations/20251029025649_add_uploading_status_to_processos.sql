/*
  # Add 'uploading' status to processo_status enum

  1. Changes
    - Add 'uploading' status to the processo_status enum type
    - This status represents when a file is being uploaded to storage

  2. Notes
    - Uses ALTER TYPE to add the new enum value
    - Safe operation that doesn't affect existing data
*/

-- Add 'uploading' status to the enum
ALTER TYPE processo_status ADD VALUE IF NOT EXISTS 'uploading';
