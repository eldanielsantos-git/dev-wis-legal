/*
  # Clean up old queue system for Document AI Batch Architecture

  1. Remove transcription_queue table and related functions
  2. Keep only the main processos table with gcs_operation_name
*/

-- Drop the transcription queue table and related objects
DROP TABLE IF EXISTS transcription_queue CASCADE;

-- Drop related functions
DROP FUNCTION IF EXISTS get_next_queue_item() CASCADE;
DROP FUNCTION IF EXISTS append_to_transcription(uuid, jsonb) CASCADE;
DROP FUNCTION IF EXISTS check_processo_completion(uuid) CASCADE;

-- Keep transcription_logs for audit purposes
-- Keep processos table as-is with gcs_operation_name column