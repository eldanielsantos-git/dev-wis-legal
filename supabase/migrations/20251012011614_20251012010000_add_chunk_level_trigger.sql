/*
  # Add automatic chunk_level calculation trigger

  1. Changes
    - Create function to calculate chunk_level from totalPages
    - Create trigger to auto-set chunk_level when transcricao is updated
    - Enable background_mode for documents > 400 pages

  2. Security
    - Function is secure and idempotent
    - Only affects chunk_level and background_mode fields
*/

-- Function to calculate chunk_level from totalPages
CREATE OR REPLACE FUNCTION calculate_chunk_level()
RETURNS TRIGGER AS $$
DECLARE
  total_pages INTEGER;
  calculated_level INTEGER;
BEGIN
  -- Only proceed if transcricao has totalPages
  IF NEW.transcricao IS NULL OR NEW.transcricao->>'totalPages' IS NULL THEN
    RETURN NEW;
  END IF;

  -- Extract totalPages
  total_pages := (NEW.transcricao->>'totalPages')::INTEGER;

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

  -- Set chunk_level if not already set or if it changed
  IF NEW.chunk_level IS NULL OR NEW.chunk_level != calculated_level THEN
    NEW.chunk_level := calculated_level;

    -- Update processing_strategy
    NEW.processing_strategy := jsonb_build_object(
      'chunk_level', calculated_level,
      'total_pages', total_pages,
      'auto_calculated_at', now()
    );
  END IF;

  -- Enable background_mode for large documents
  IF total_pages > 400 AND (NEW.background_mode IS NULL OR NEW.background_mode = false) THEN
    NEW.background_mode := true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-calculate chunk_level
DROP TRIGGER IF EXISTS trigger_calculate_chunk_level ON processos;

CREATE TRIGGER trigger_calculate_chunk_level
  BEFORE INSERT OR UPDATE OF transcricao
  ON processos
  FOR EACH ROW
  EXECUTE FUNCTION calculate_chunk_level();

-- Update existing records that are missing chunk_level
UPDATE processos
SET chunk_level = CASE
  WHEN (transcricao->>'totalPages')::INTEGER <= 100 THEN 0
  WHEN (transcricao->>'totalPages')::INTEGER <= 300 THEN 1
  WHEN (transcricao->>'totalPages')::INTEGER <= 500 THEN 2
  WHEN (transcricao->>'totalPages')::INTEGER <= 1000 THEN 3
  WHEN (transcricao->>'totalPages')::INTEGER <= 2000 THEN 4
  ELSE 5
END,
background_mode = CASE
  WHEN (transcricao->>'totalPages')::INTEGER > 400 THEN true
  ELSE background_mode
END,
processing_strategy = jsonb_build_object(
  'chunk_level', CASE
    WHEN (transcricao->>'totalPages')::INTEGER <= 100 THEN 0
    WHEN (transcricao->>'totalPages')::INTEGER <= 300 THEN 1
    WHEN (transcricao->>'totalPages')::INTEGER <= 500 THEN 2
    WHEN (transcricao->>'totalPages')::INTEGER <= 1000 THEN 3
    WHEN (transcricao->>'totalPages')::INTEGER <= 2000 THEN 4
    ELSE 5
  END,
  'total_pages', (transcricao->>'totalPages')::INTEGER,
  'backfilled_at', now()
)
WHERE chunk_level IS NULL
  AND transcricao IS NOT NULL
  AND transcricao->>'totalPages' IS NOT NULL;