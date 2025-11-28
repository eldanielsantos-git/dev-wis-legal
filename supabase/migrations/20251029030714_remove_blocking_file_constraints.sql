/*
  # Remove blocking file constraints to allow temporary values during upload

  1. Changes
    - Remove CHECK constraint on file_path (allow temporary empty/placeholder values)
    - Remove CHECK constraint on file_url (allow temporary placeholder values)
    - Keep file_name and file_size constraints as they have real values from the start

  2. Reasoning
    - During upload phase, we need to create a processo record before we have the actual file_path/file_url
    - These will be populated immediately after upload completes
    - This allows proper status tracking from the very beginning of the upload process
*/

-- Remove the file_path check constraint
ALTER TABLE processos DROP CONSTRAINT IF EXISTS processos_file_path_check;

-- Remove the file_url check constraint  
ALTER TABLE processos DROP CONSTRAINT IF EXISTS processos_file_url_check;

-- Make file_path and file_url nullable to support the uploading state
ALTER TABLE processos ALTER COLUMN file_path DROP NOT NULL;
ALTER TABLE processos ALTER COLUMN file_url DROP NOT NULL;
