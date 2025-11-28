/*
  # Add Processing Time Tracking

  1. New Columns
    - `processing_started_at` (timestamptz) - Timestamp when processing actually started
    - `processing_completed_at` (timestamptz) - Timestamp when processing was completed
    - `processing_duration_seconds` (integer) - Total duration in seconds (calculated field)

  2. Changes
    - Add columns to track processing timeline
    - These fields will be populated by the edge functions during the transcription process

  3. Notes
    - `processing_started_at` is set when start-transcription is called
    - `processing_completed_at` is set when finalize-transcription completes
    - `processing_duration_seconds` is calculated as the difference between the two timestamps
*/

-- Add time tracking columns
ALTER TABLE processos
ADD COLUMN IF NOT EXISTS processing_started_at timestamptz,
ADD COLUMN IF NOT EXISTS processing_completed_at timestamptz,
ADD COLUMN IF NOT EXISTS processing_duration_seconds integer;