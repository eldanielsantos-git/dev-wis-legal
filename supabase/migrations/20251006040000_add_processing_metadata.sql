/*
  # Add Processing Metadata to Processos Table

  1. Changes
    - Add `processing_metadata` JSONB column to store detailed processing information
    - This column stores:
      - File sizes and categories (normal, pesado, muito_pesado)
      - Processing times per file
      - Number of paragraphs and text segments
      - Error information and retry counts
      - Document statistics for analysis and optimization

  2. Purpose
    - Track performance metrics for different document types
    - Identify problematic documents requiring special handling
    - Provide data for adaptive processing configurations
    - Enable debugging of 546 errors and resource limit issues
*/

-- Add processing_metadata column to processos table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'processos' AND column_name = 'processing_metadata'
  ) THEN
    ALTER TABLE processos ADD COLUMN processing_metadata JSONB DEFAULT NULL;

    -- Create index for querying by document category
    CREATE INDEX IF NOT EXISTS idx_processos_processing_metadata_category
      ON processos USING gin ((processing_metadata->'category'));

    -- Create index for querying by file sizes
    CREATE INDEX IF NOT EXISTS idx_processos_processing_metadata_size
      ON processos USING btree (((processing_metadata->>'sizeMB')::numeric));
  END IF;
END $$;

-- Add comment explaining the column
COMMENT ON COLUMN processos.processing_metadata IS 'Stores detailed processing metrics including file sizes, processing times, document statistics, and error information for adaptive processing and debugging';
