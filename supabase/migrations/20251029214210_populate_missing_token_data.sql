/*
  # Populate Missing Token Data for Completed Processes

  1. Purpose
    - Update completed processes that don't have pages_processed_successfully populated
    - Calculate and update tokens_consumed based on page count
    - Ensure historical data is available for the token usage dashboard

  2. Changes
    - Updates processos table where:
      - status = 'completed'
      - pages_processed_successfully = 0 or NULL
      - transcricao contains totalPages
    - Sets pages_processed_successfully from transcricao.totalPages
    - Calculates tokens_consumed using the formula: pages * 5500

  3. Notes
    - This is a one-time data migration
    - Does NOT trigger the token debit mechanism
    - Only updates historical display data
*/

-- Update pages_processed_successfully from transcricao.totalPages
UPDATE processos
SET 
  pages_processed_successfully = COALESCE(
    (transcricao->>'totalPages')::integer,
    0
  ),
  tokens_consumed = COALESCE(
    (transcricao->>'totalPages')::integer * 5500,
    0
  )
WHERE 
  status = 'completed' 
  AND (pages_processed_successfully = 0 OR pages_processed_successfully IS NULL)
  AND transcricao IS NOT NULL 
  AND transcricao->>'totalPages' IS NOT NULL
  AND (transcricao->>'totalPages')::integer > 0;
