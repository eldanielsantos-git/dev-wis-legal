-- Add OpenAI Assistant and Vector Store columns
ALTER TABLE processos 
ADD COLUMN IF NOT EXISTS openai_assistant_id TEXT,
ADD COLUMN IF NOT EXISTS openai_vector_store_id TEXT;

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_processos_openai_assistant ON processos(openai_assistant_id);
CREATE INDEX IF NOT EXISTS idx_processos_openai_vector_store ON processos(openai_vector_store_id);
