/*
  # Add OpenAI Assistant and Vector Store Columns

  1. Changes
    - Add `openai_assistant_id` column to store persistent OpenAI Assistant ID
    - Add `openai_vector_store_id` column to store persistent Vector Store ID
    
  2. Performance
    - Add indexes for faster lookups on these columns
    
  3. Purpose
    - Optimize OpenAI processing by reusing Assistant and Vector Store
    - Previously created/deleted these resources for every prompt (slow)
    - Now created once during upload and reused for all prompts (fast)
*/

-- Add OpenAI Assistant and Vector Store columns
ALTER TABLE processos 
ADD COLUMN IF NOT EXISTS openai_assistant_id TEXT,
ADD COLUMN IF NOT EXISTS openai_vector_store_id TEXT;

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_processos_openai_assistant ON processos(openai_assistant_id);
CREATE INDEX IF NOT EXISTS idx_processos_openai_vector_store ON processos(openai_vector_store_id);