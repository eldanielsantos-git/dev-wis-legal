/*
  # Add chunk_level field to processos table

  1. Changes
    - Add `chunk_level` column (integer, 0-5) to processos table
    - Add `processing_strategy` column (jsonb) for storing processing configuration
    - Add index on chunk_level for fast queries
    - Update existing records based on totalPages

  2. Chunk Levels
    - Level 0: 1-100 pages (no chunking, direct processing)
    - Level 1: 101-300 pages (light chunking)
    - Level 2: 301-500 pages (moderate chunking)
    - Level 3: 501-1000 pages (heavy chunking)
    - Level 4: 1001-2000 pages (very heavy chunking)
    - Level 5: 2001-5000 pages (extreme chunking)

  3. Notes
    - Nullable for backward compatibility with old records
    - Default assumes level 2 (moderate) for null values
*/

-- Add chunk_level column
ALTER TABLE processos
ADD COLUMN IF NOT EXISTS chunk_level INTEGER CHECK (chunk_level >= 0 AND chunk_level <= 5);

-- Add processing_strategy column for metadata
ALTER TABLE processos
ADD COLUMN IF NOT EXISTS processing_strategy JSONB;

-- Add index for fast queries by chunk_level
CREATE INDEX IF NOT EXISTS idx_processos_chunk_level ON processos(chunk_level);

-- Add comment for documentation
COMMENT ON COLUMN processos.chunk_level IS 'Processing chunk level based on total pages: 0 (1-100), 1 (101-300), 2 (301-500), 3 (501-1000), 4 (1001-2000), 5 (2001-5000)';
COMMENT ON COLUMN processos.processing_strategy IS 'JSONB metadata storing processing configuration used (batch_size, timeout, max_page_text, etc)';

-- Update existing records based on transcricao.totalPages
DO $$
DECLARE
  rec RECORD;
  total_pages INTEGER;
  calculated_level INTEGER;
BEGIN
  -- Loop through all processos that have totalPages
  FOR rec IN
    SELECT id, transcricao
    FROM processos
    WHERE transcricao IS NOT NULL
      AND transcricao->>'totalPages' IS NOT NULL
      AND chunk_level IS NULL
  LOOP
    -- Extract totalPages
    total_pages := (rec.transcricao->>'totalPages')::INTEGER;

    -- Calculate chunk_level based on totalPages
    IF total_pages <= 100 THEN
      calculated_level := 0;
    ELSIF total_pages <= 300 THEN
      calculated_level := 1;
    ELSIF total_pages <= 500 THEN
      calculated_level := 2;
    ELSIF total_pages <= 1000 THEN
      calculated_level := 3;
    ELSIF total_pages <= 2000 THEN
      calculated_level := 4;
    ELSE
      calculated_level := 5;
    END IF;

    -- Update the record
    UPDATE processos
    SET chunk_level = calculated_level,
        processing_strategy = jsonb_build_object(
          'chunk_level', calculated_level,
          'total_pages', total_pages,
          'migrated_at', now(),
          'migration_version', '20251011220000'
        )
    WHERE id = rec.id;

  END LOOP;

  RAISE NOTICE 'Migration completed: Updated chunk_level for existing records';
END $$;
