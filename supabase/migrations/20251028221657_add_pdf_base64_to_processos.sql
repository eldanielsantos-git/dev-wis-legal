/*
  # Adicionar armazenamento de PDF em Base64

  1. Alterações na tabela processos
    - Adiciona coluna `pdf_base64` (text) para armazenar PDF em base64
    - Adiciona coluna `pdf_size_bytes` (bigint) para controle de tamanho
    - Adiciona coluna `is_chunked` (boolean) para indicar se foi dividido em chunks
    - Adiciona coluna `total_chunks` (integer) para PDFs divididos
    
  2. Nova tabela pdf_chunks (para PDFs muito grandes)
    - Armazena chunks de PDFs que excedem 50MB
    - Permite processar PDFs de até 1000 páginas em partes
    
  3. Índices
    - Índice para busca rápida de chunks por processo_id
    
  4. Notas importantes
    - PDFs até 50MB: armazenados integralmente em `pdf_base64`
    - PDFs acima de 50MB: divididos em chunks na tabela `pdf_chunks`
    - O base64 inline é enviado diretamente para Gemini AI
    - Elimina necessidade de download do Storage a cada prompt
*/

-- Adicionar colunas para armazenamento de PDF em base64
ALTER TABLE processos
  ADD COLUMN IF NOT EXISTS pdf_base64 TEXT,
  ADD COLUMN IF NOT EXISTS pdf_size_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS is_chunked BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS total_chunks INTEGER DEFAULT 0;

-- Criar tabela para chunks de PDFs grandes (>50MB)
CREATE TABLE IF NOT EXISTS pdf_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
  chunk_number INTEGER NOT NULL,
  chunk_data TEXT NOT NULL,
  chunk_size_bytes BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraint para garantir unicidade de chunk por processo
  UNIQUE(processo_id, chunk_number)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_pdf_chunks_processo_id 
  ON pdf_chunks(processo_id, chunk_number);

-- Habilitar RLS na tabela pdf_chunks
ALTER TABLE pdf_chunks ENABLE ROW LEVEL SECURITY;

-- Policy: Usuários podem ver chunks de seus próprios processos
CREATE POLICY "Users can view own pdf chunks"
  ON pdf_chunks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM processos
      WHERE processos.id = pdf_chunks.processo_id
      AND processos.user_id = auth.uid()
    )
  );

-- Policy: Service role pode gerenciar todos os chunks
CREATE POLICY "Service role can manage all pdf chunks"
  ON pdf_chunks FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Comentários nas colunas
COMMENT ON COLUMN processos.pdf_base64 IS 'PDF completo em base64 (para arquivos até 50MB)';
COMMENT ON COLUMN processos.pdf_size_bytes IS 'Tamanho do PDF original em bytes';
COMMENT ON COLUMN processos.is_chunked IS 'Indica se o PDF foi dividido em chunks';
COMMENT ON COLUMN processos.total_chunks IS 'Número total de chunks (para PDFs grandes)';

COMMENT ON TABLE pdf_chunks IS 'Armazena chunks de PDFs grandes (>50MB) em base64';
COMMENT ON COLUMN pdf_chunks.chunk_number IS 'Número sequencial do chunk (1, 2, 3...)';
COMMENT ON COLUMN pdf_chunks.chunk_data IS 'Dados do chunk em base64';
COMMENT ON COLUMN pdf_chunks.chunk_size_bytes IS 'Tamanho do chunk em bytes';
