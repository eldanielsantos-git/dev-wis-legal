/*
  # Update AI Analysis Columns to JSONB

  1. Changes
    - Convert `mapeamento_pecas` from text to JSONB to store array of objects
    - Convert `sintese_argumentos` from text to JSONB to store object with autor/reu keys
    - Keep `resumo_estruturado` as text since it's a string
    - Keep `process_content` as JSONB (already correct)

  2. Notes
    - Safe to drop and recreate since no existing data exists
    - Allows NULL values for optional analysis data
*/

-- Drop and recreate mapeamento_pecas as JSONB
ALTER TABLE processos DROP COLUMN IF EXISTS mapeamento_pecas;
ALTER TABLE processos ADD COLUMN IF NOT EXISTS mapeamento_pecas jsonb;

-- Drop and recreate sintese_argumentos as JSONB
ALTER TABLE processos DROP COLUMN IF EXISTS sintese_argumentos;
ALTER TABLE processos ADD COLUMN IF NOT EXISTS sintese_argumentos jsonb;
