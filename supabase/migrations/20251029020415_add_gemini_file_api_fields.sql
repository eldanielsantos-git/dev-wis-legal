/*
  # Adicionar campos para Gemini File API

  ## Objetivo
  Adicionar campos necessários para suportar a File API do Gemini, eliminando
  dependência de Base64 e permitindo processamento de arquivos até 2GB.

  ## Novos Campos
  1. `gemini_file_uri` (text) - URI do arquivo no Gemini
  2. `gemini_file_name` (text) - Nome do arquivo no Gemini
  3. `gemini_file_mime_type` (text) - Tipo MIME do arquivo
  4. `gemini_file_state` (text) - Estado do arquivo (PROCESSING, ACTIVE, FAILED)
  5. `gemini_file_uploaded_at` (timestamptz) - Timestamp do upload
  6. `gemini_file_expires_at` (timestamptz) - Timestamp de expiração (48h após upload)
  7. `use_file_api` (boolean) - Flag para indicar se processo usa File API

  ## Campos Deprecados
  - `pdf_base64` - Mantido para retrocompatibilidade, não usado em novos processos
  - `is_chunked` - Mantido para retrocompatibilidade
  - `total_chunks` - Mantido para retrocompatibilidade

  ## Índices
  - Índice para busca rápida por estado do arquivo Gemini
  - Índice para busca por arquivos próximos da expiração

  ## Notas Importantes
  - Arquivos no Gemini expiram automaticamente após 48 horas
  - Sistema deve implementar re-upload automático para processos não finalizados
  - Limite de 20GB total de armazenamento no projeto Gemini
*/

-- Adicionar novos campos para File API do Gemini
ALTER TABLE processos
ADD COLUMN IF NOT EXISTS gemini_file_uri TEXT,
ADD COLUMN IF NOT EXISTS gemini_file_name TEXT,
ADD COLUMN IF NOT EXISTS gemini_file_mime_type TEXT DEFAULT 'application/pdf',
ADD COLUMN IF NOT EXISTS gemini_file_state TEXT,
ADD COLUMN IF NOT EXISTS gemini_file_uploaded_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS gemini_file_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS use_file_api BOOLEAN DEFAULT false;

-- Adicionar índices para performance
CREATE INDEX IF NOT EXISTS idx_processos_gemini_file_state 
  ON processos(gemini_file_state) 
  WHERE gemini_file_state IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_processos_gemini_file_expires 
  ON processos(gemini_file_expires_at) 
  WHERE gemini_file_expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_processos_use_file_api 
  ON processos(use_file_api) 
  WHERE use_file_api = true;

-- Adicionar comentários para documentação
COMMENT ON COLUMN processos.gemini_file_uri IS 'URI do arquivo armazenado no Gemini File API';
COMMENT ON COLUMN processos.gemini_file_name IS 'Nome único do arquivo no Gemini';
COMMENT ON COLUMN processos.gemini_file_mime_type IS 'Tipo MIME do arquivo (application/pdf)';
COMMENT ON COLUMN processos.gemini_file_state IS 'Estado do arquivo: PROCESSING, ACTIVE, FAILED';
COMMENT ON COLUMN processos.gemini_file_uploaded_at IS 'Timestamp do upload para o Gemini';
COMMENT ON COLUMN processos.gemini_file_expires_at IS 'Timestamp de expiração (48h após upload)';
COMMENT ON COLUMN processos.use_file_api IS 'Flag indicando se processo usa File API (true) ou Base64 legado (false)';

-- Adicionar constraint de validação para estado
ALTER TABLE processos
ADD CONSTRAINT chk_gemini_file_state 
CHECK (gemini_file_state IS NULL OR gemini_file_state IN ('PROCESSING', 'ACTIVE', 'FAILED'));
