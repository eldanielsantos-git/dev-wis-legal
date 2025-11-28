/*
  # Adicionar colunas de tracking de fallback

  1. Alterações em processos
    - `last_provider_switch_at` - Timestamp da última troca de provider
    - `provider_switch_count` - Contador de trocas de provider

  2. Alterações em admin_system_models
    - `failure_count` - Contador de falhas
    - `last_failure_at` - Timestamp da última falha
    - `last_failure_reason` - Motivo da última falha

  3. Benefícios
    - Rastreabilidade de falhas
    - Métricas de estabilidade por modelo
    - Visibilidade de fallbacks automáticos
*/

-- Adicionar colunas em processos
ALTER TABLE processos
ADD COLUMN IF NOT EXISTS last_provider_switch_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS provider_switch_count INTEGER DEFAULT 0;

-- Adicionar colunas em admin_system_models
ALTER TABLE admin_system_models
ADD COLUMN IF NOT EXISTS failure_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_failure_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_failure_reason TEXT;

-- Criar índices para queries de análise
CREATE INDEX IF NOT EXISTS idx_processos_provider_switch
ON processos(last_provider_switch_at)
WHERE last_provider_switch_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_models_failures
ON admin_system_models(failure_count, last_failure_at)
WHERE failure_count > 0;

-- Comentários
COMMENT ON COLUMN processos.last_provider_switch_at IS
  'Timestamp da última troca automática de provider (fallback)';

COMMENT ON COLUMN processos.provider_switch_count IS
  'Número de vezes que o processo trocou de provider automaticamente';

COMMENT ON COLUMN admin_system_models.failure_count IS
  'Contador de falhas consecutivas deste modelo';

COMMENT ON COLUMN admin_system_models.last_failure_at IS
  'Timestamp da última falha registrada';

COMMENT ON COLUMN admin_system_models.last_failure_reason IS
  'Descrição do motivo da última falha';
