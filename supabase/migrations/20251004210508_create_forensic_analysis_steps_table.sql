/*
  # Create Forensic Analysis Steps Table for Incremental Analysis

  ## Summary
  This migration creates a new table to support incremental forensic analysis by storing
  partial results from each of the 8 modular analysis steps. This enables:
  - Step-by-step progress tracking
  - Retry of individual failed steps without reprocessing entire analysis
  - Better observability and debugging
  - Context accumulation across steps

  ## 1. New Tables
    - `forensic_analysis_steps`
      - `id` (uuid, primary key)
      - `processo_id` (uuid, foreign key to processos)
      - `step_number` (integer, 1-8 for main steps, 9 for consolidation)
      - `step_category` (text, e.g., 'ANALISE_FORENSE_ETAPA_1')
      - `step_status` (text, 'pending', 'in_progress', 'completed', 'failed')
      - `step_result` (jsonb, partial JSON result from this step)
      - `prompt_id` (uuid, foreign key to forensic_prompts)
      - `execution_time_ms` (integer, time taken to execute this step)
      - `tokens_used` (integer, tokens consumed by LLM)
      - `error_message` (text, error details if failed)
      - `retry_count` (integer, number of retry attempts)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `completed_at` (timestamptz)

  ## 2. Table Modifications
    - Add `step_order` column to `forensic_prompts` table to define execution sequence

  ## 3. Constraints
    - Unique constraint on (processo_id, step_number) to prevent duplicates
    - Check constraint: step_number between 1 and 9
    - Check constraint: step_status in valid states
    - Check constraint: execution_time_ms >= 0
    - Check constraint: retry_count >= 0

  ## 4. Indexes
    - Index on (processo_id, step_number) for fast step lookup
    - Index on (processo_id, step_status) for querying progress
    - Index on step_status for global status queries

  ## 5. Security
    - Enable RLS on forensic_analysis_steps
    - Service role: full access for edge functions
    - Anon: read access for demo purposes
*/

-- 1. Create forensic_analysis_steps table
CREATE TABLE IF NOT EXISTS forensic_analysis_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
  step_number integer NOT NULL,
  step_category text NOT NULL,
  step_status text NOT NULL DEFAULT 'pending',
  step_result jsonb DEFAULT NULL,
  prompt_id uuid REFERENCES forensic_prompts(id) ON DELETE SET NULL,
  execution_time_ms integer DEFAULT NULL,
  tokens_used integer DEFAULT NULL,
  error_message text DEFAULT NULL,
  retry_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz DEFAULT NULL,
  
  -- Constraints
  CONSTRAINT forensic_analysis_steps_step_number_check 
    CHECK (step_number BETWEEN 1 AND 9),
  CONSTRAINT forensic_analysis_steps_step_status_check 
    CHECK (step_status IN ('pending', 'in_progress', 'completed', 'failed')),
  CONSTRAINT forensic_analysis_steps_execution_time_check 
    CHECK (execution_time_ms IS NULL OR execution_time_ms >= 0),
  CONSTRAINT forensic_analysis_steps_retry_count_check 
    CHECK (retry_count >= 0),
  CONSTRAINT forensic_analysis_steps_unique_processo_step 
    UNIQUE (processo_id, step_number)
);

-- Add comment
COMMENT ON TABLE forensic_analysis_steps IS 'Stores partial results from each step of incremental forensic analysis';

-- 2. Add step_order column to forensic_prompts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'forensic_prompts' AND column_name = 'step_order'
  ) THEN
    ALTER TABLE forensic_prompts 
    ADD COLUMN step_order integer DEFAULT NULL;
    
    -- Add check constraint
    ALTER TABLE forensic_prompts
    ADD CONSTRAINT forensic_prompts_step_order_check
    CHECK (step_order IS NULL OR step_order BETWEEN 1 AND 9);
    
    COMMENT ON COLUMN forensic_prompts.step_order IS 'Execution order for incremental analysis (1-8 for steps, 9 for consolidation)';
  END IF;
END $$;

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_forensic_analysis_steps_processo_step 
  ON forensic_analysis_steps(processo_id, step_number);

CREATE INDEX IF NOT EXISTS idx_forensic_analysis_steps_processo_status 
  ON forensic_analysis_steps(processo_id, step_status);

CREATE INDEX IF NOT EXISTS idx_forensic_analysis_steps_status 
  ON forensic_analysis_steps(step_status) 
  WHERE step_status IN ('in_progress', 'failed');

CREATE INDEX IF NOT EXISTS idx_forensic_analysis_steps_created_at 
  ON forensic_analysis_steps(created_at DESC);

-- 4. Create GIN index for JSONB queries
CREATE INDEX IF NOT EXISTS idx_forensic_analysis_steps_step_result 
  ON forensic_analysis_steps USING GIN (step_result);

-- 5. Enable Row Level Security
ALTER TABLE forensic_analysis_steps ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS policies
-- Service role: full access
CREATE POLICY "Service role has full access to forensic_analysis_steps"
  ON forensic_analysis_steps
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Anon: read-only access (for demo purposes)
CREATE POLICY "Anonymous users can read forensic_analysis_steps"
  ON forensic_analysis_steps
  FOR SELECT
  TO anon
  USING (true);

-- 7. Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_forensic_analysis_steps_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Create trigger for auto-updating updated_at
DROP TRIGGER IF EXISTS trigger_update_forensic_analysis_steps_updated_at 
  ON forensic_analysis_steps;

CREATE TRIGGER trigger_update_forensic_analysis_steps_updated_at
  BEFORE UPDATE ON forensic_analysis_steps
  FOR EACH ROW
  EXECUTE FUNCTION update_forensic_analysis_steps_updated_at();
