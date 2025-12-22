/*
  # Sistema de Tracking de Arquivo Original para Retomada de Upload

  ## Contexto
  Este migration adiciona campos essenciais para permitir a retomada automática
  de uploads interrompidos em arquivos grandes (≥1000 páginas).

  ## Campos Adicionados
  
  ### 1. `original_file_path` (TEXT)
  - **Propósito**: Armazena o caminho completo do arquivo original no Supabase Storage
  - **Uso**: Permite re-download do arquivo para retomada do upload
  - **Ciclo de vida**: Criado no início do upload, deletado junto com o processo
  - **Nullable**: YES (processos pequenos não usam este campo)

  ### 2. `resume_attempts` (INTEGER, DEFAULT 0)
  - **Propósito**: Contador de tentativas de retomada do upload
  - **Uso**: Previne loops infinitos limitando a 3 tentativas
  - **Reset**: Zerado quando upload é bem-sucedido

  ### 3. `resuming_upload` (BOOLEAN, DEFAULT false)
  - **Propósito**: Lock de concorrência para retomada de upload
  - **Uso**: Garante que apenas um processo tenta retomar por vez
  - **Atomic check**: Usado em UPDATE com WHERE resuming_upload = false

  ## Índices

  ### `idx_processos_resumable`
  - **Campos**: status, upload_interrupted, resuming_upload
  - **Filtro**: WHERE status = 'uploading' AND upload_interrupted = true AND resuming_upload = false
  - **Propósito**: Otimizar busca por uploads prontos para retomada

  ## Notas de Segurança
  - Arquivo original é permanente durante o ciclo de vida do processo
  - Deleção do processo deleta TODOS os arquivos (original + chunks)
  - Lock atômico previne condições de corrida
  - Limite de tentativas previne loops infinitos

  ## Impacto em Arquivos Existentes
  - Arquivos < 1000 páginas: ZERO impacto (campos ficam NULL)
  - Arquivos ≥ 1000 páginas: Novos campos serão populados nos próximos uploads
*/

-- Adicionar campo para path do arquivo original
ALTER TABLE processos 
ADD COLUMN IF NOT EXISTS original_file_path TEXT;

-- Adicionar contador de tentativas de retomada
ALTER TABLE processos 
ADD COLUMN IF NOT EXISTS resume_attempts INTEGER DEFAULT 0;

-- Adicionar flag de lock para retomada
ALTER TABLE processos 
ADD COLUMN IF NOT EXISTS resuming_upload BOOLEAN DEFAULT false;

-- Criar índice para queries de retomada eficientes
CREATE INDEX IF NOT EXISTS idx_processos_resumable 
ON processos(status, upload_interrupted, resuming_upload) 
WHERE status = 'uploading' 
  AND upload_interrupted = true 
  AND resuming_upload = false;

-- Comentários para documentação
COMMENT ON COLUMN processos.original_file_path IS 
  'Path do arquivo original no storage. Usado para retomada de uploads interrompidos. Deletado junto com o processo.';

COMMENT ON COLUMN processos.resume_attempts IS 
  'Contador de tentativas de retomada. Limitado a 3 para prevenir loops infinitos.';

COMMENT ON COLUMN processos.resuming_upload IS 
  'Lock de concorrência. TRUE indica que processo está sendo retomado. Usado em UPDATE atômico.';
