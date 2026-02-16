/*
  # Add pending_chunking status to processo_status enum

  1. Changes
    - Adds 'pending_chunking' value to processo_status enum for complex file processing

  2. Purpose
    - Allows complex files (300+ pages) to be tracked during the chunking phase
    - Used by WhatsApp API upload flow for large files
*/

ALTER TYPE processo_status ADD VALUE IF NOT EXISTS 'pending_chunking';
