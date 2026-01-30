/*
  # Add upload_method field to processos table

  ## Purpose
  This migration adds a new field to track which upload method was used for each processo,
  enabling optimized file handling based on file size:
  - Files <= 18MB: Use base64 inline (faster, no File API upload needed)
  - Files > 18MB: Use Gemini File API (required for large files)

  ## Changes
  1. New Column
    - `upload_method` (text, nullable)
      - 'base64': File processed using base64 inline data
      - 'file_uri': File uploaded to Gemini File API
      - NULL: Legacy records (backward compatibility)

  ## Notes
  - Default is NULL to maintain compatibility with existing records
  - New uploads will set this field based on file size
  - The process-next-prompt function will use this to determine processing method
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'processos' AND column_name = 'upload_method'
  ) THEN
    ALTER TABLE processos ADD COLUMN upload_method text;
    
    COMMENT ON COLUMN processos.upload_method IS 'Upload method used: base64 (<=18MB) or file_uri (>18MB). NULL for legacy records.';
  END IF;
END $$;