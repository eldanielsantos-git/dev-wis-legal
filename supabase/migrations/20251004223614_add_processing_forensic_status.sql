/*
  # Add processing_forensic status to processo_status enum
  
  1. Changes
    - Add 'processing_forensic' value to processo_status enum
    - This status represents when transcription is complete and forensic analysis is running
  
  2. Notes
    - This is a critical status for the automatic forensic analysis flow
    - Appears between 'finalizing' and 'completed' in the process lifecycle
*/

ALTER TYPE processo_status ADD VALUE IF NOT EXISTS 'processing_forensic';
