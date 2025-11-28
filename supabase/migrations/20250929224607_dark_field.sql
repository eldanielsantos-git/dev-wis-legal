/*
  # Add processing_batch status to processo_status enum

  1. New Status Value
    - Add 'processing_batch' to the processo_status enum
    - This status represents processes being handled by Document AI batch processing
  
  2. Security
    - No RLS changes needed as existing policies cover all enum values
*/

-- Add the new enum value after 'transcribing'
ALTER TYPE processo_status ADD VALUE 'processing_batch' AFTER 'transcribing';