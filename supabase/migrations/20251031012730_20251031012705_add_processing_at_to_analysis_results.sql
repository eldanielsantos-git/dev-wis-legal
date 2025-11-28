/*
  # Adicionar Coluna processing_at e Atualizar Status

  1. Mudanças
    - Adiciona coluna `processing_at` para controle de lock otimista
    - Atualiza constraint de status para incluir 'processing'
    - Cria índice para busca eficiente de prompts disponíveis

  2. Notas
    - `processing_at` é usado para lock: marca quando um prompt começa a ser processado
    - Lock expira automaticamente após 10 minutos de inatividade
    - Permite retry automático de processamentos travados
*/

-- Adicionar coluna processing_at
ALTER TABLE analysis_results
ADD COLUMN IF NOT EXISTS processing_at timestamptz;

-- Atualizar constraint de status para incluir 'processing'
ALTER TABLE analysis_results
DROP CONSTRAINT IF EXISTS check_status;

ALTER TABLE analysis_results
ADD CONSTRAINT check_status
CHECK (status IN ('pending', 'processing', 'running', 'completed', 'failed'));

-- Criar índice para busca eficiente de prompts disponíveis
CREATE INDEX IF NOT EXISTS idx_analysis_results_processing
ON analysis_results(processo_id, status, processing_at)
WHERE status = 'pending';

-- Comentário
COMMENT ON COLUMN analysis_results.processing_at IS 'Timestamp de quando o processamento iniciou (usado para lock otimista)';
