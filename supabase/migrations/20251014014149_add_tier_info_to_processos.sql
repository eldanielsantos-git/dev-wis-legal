/*
  # Add tier_info to processos table

  1. New Columns
    - `tier_info` (jsonb) - Stores document tier information
      - tier: Tier ID (xs, s, m, l, xl, xxl, 3xl, 4xl)
      - tierName: Human readable tier name
      - pageCount: Number of pages in document
      - estimatedTime: Estimated processing time in seconds
      - estimatedTokens: Estimated tokens required
      - estimatedCost: Estimated cost in USD
      - processingMode: Processing mode (synchronous, async, etc.)
      - confirmedAt: When user confirmed the tier (if required)

  2. Indexes
    - Index on tier ID for analytics queries

  3. Comments
    - Add helpful documentation for the field
*/

-- Add tier_info column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'processos' AND column_name = 'tier_info'
  ) THEN
    ALTER TABLE processos ADD COLUMN tier_info JSONB;
  END IF;
END $$;

-- Add comment to document the field
COMMENT ON COLUMN processos.tier_info IS
  'Document tier information for processing optimization. Schema: { tier: string, tierName: string, pageCount: number, estimatedTime: number, estimatedTokens: number, estimatedCost: number, processingMode: string, confirmedAt?: timestamp }';

-- Create index for tier analytics queries
CREATE INDEX IF NOT EXISTS idx_processos_tier
  ON processos ((tier_info->>'tier'));

-- Create index for processing mode queries
CREATE INDEX IF NOT EXISTS idx_processos_processing_mode
  ON processos ((tier_info->>'processingMode'));

-- Create index for page count range queries
CREATE INDEX IF NOT EXISTS idx_processos_page_count
  ON processos (((tier_info->>'pageCount')::int));
