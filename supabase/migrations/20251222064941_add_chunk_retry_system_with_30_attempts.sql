/*
  # Sistema Robusto de Retry de Chunks com até 30 Tentativas

  ## Contexto
  Implementa sistema de retry automático para uploads de chunks que falharam
  por timeout ou erros temporários, permitindo até 30 tentativas antes de falhar.

  ## Campos Adicionados

  ### 1. `chunk_retry_count` (INTEGER, DEFAULT 0)
  - Contador específico de retries para o chunk atual que falhou
  - Resetado quando chunk é enviado com sucesso
  - Limite de 30 tentativas antes de falhar definitivamente

  ### 2. `current_failed_chunk` (INTEGER, NULL)
  - Índice do chunk que está falhando e precisa de retry
  - NULL quando não há chunk com problema
  - Usado para rastrear qual chunk precisa ser reenviado

  ### 3. `last_chunk_error` (TEXT, NULL)
  - Última mensagem de erro do chunk
  - Ajuda em diagnóstico e decisão de retry
  - Limpo quando chunk é enviado com sucesso

  ### 4. `next_chunk_retry_at` (TIMESTAMPTZ, NULL)
  - Timestamp de quando próximo retry deve ocorrer
  - Implementa backoff exponencial
  - NULL quando não há retry pendente

  ## Índices
  
  ### `idx_processos_chunk_retry`
  - Otimiza busca por processos que precisam de retry
  - Filtro: status uploading + chunk retry pendente

  ## Estratégia de Retry
  - Backoff exponencial: 2^tentativa segundos (máx 5 minutos)
  - Tentativa 1: 2s, 2: 4s, 3: 8s, 4: 16s, 5: 32s, 6: 64s, 7+: 300s
  - Após 30 tentativas, marca processo como 'error'

  ## Notas de Segurança
  - Sistema não entra em loop infinito (limite de 30)
  - Backoff exponencial previne sobrecarga do servidor
  - Erros permanentes (403, 404) não geram retry
*/

-- Adicionar campos para sistema de retry robusto
ALTER TABLE processos 
ADD COLUMN IF NOT EXISTS chunk_retry_count INTEGER DEFAULT 0;

ALTER TABLE processos 
ADD COLUMN IF NOT EXISTS current_failed_chunk INTEGER;

ALTER TABLE processos 
ADD COLUMN IF NOT EXISTS last_chunk_error TEXT;

ALTER TABLE processos 
ADD COLUMN IF NOT EXISTS next_chunk_retry_at TIMESTAMPTZ;

-- Criar índice para queries de retry eficientes
CREATE INDEX IF NOT EXISTS idx_processos_chunk_retry 
ON processos(status, next_chunk_retry_at) 
WHERE status = 'uploading' 
  AND next_chunk_retry_at IS NOT NULL;

-- Comentários para documentação
COMMENT ON COLUMN processos.chunk_retry_count IS 
  'Contador de tentativas de retry do chunk atual. Máximo 30 tentativas antes de falhar.';

COMMENT ON COLUMN processos.current_failed_chunk IS 
  'Índice do chunk que precisa de retry. NULL se não há chunk falhando.';

COMMENT ON COLUMN processos.last_chunk_error IS 
  'Última mensagem de erro do chunk para diagnóstico.';

COMMENT ON COLUMN processos.next_chunk_retry_at IS 
  'Timestamp de quando próximo retry deve ser tentado. Implementa backoff exponencial.';

-- Atualizar limite de resume_attempts para 30
COMMENT ON COLUMN processos.resume_attempts IS 
  'Contador de tentativas de retomada. Limitado a 30 para prevenir loops infinitos.';
