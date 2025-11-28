/*
  # Adicionar colunas de tracking de fallback

  1. Alterações na tabela `processos`
    - `last_provider_switch_at` (timestamptz): Timestamp da última troca de provider
    - `provider_switch_count` (integer): Contador de quantas vezes trocou de provider

  2. Alterações na tabela `admin_system_models`
    - `failure_count` (integer): Contador de falhas do modelo
    - `last_failure_at` (timestamptz): Timestamp da última falha
    - `last_failure_reason` (text): Motivo da última falha

  3. Índices
    - Índice em `processos(last_provider_switch_at)` para queries rápidas
    - Índice em `admin_system_models(failure_count, last_failure_at)` para monitoring
*/

-- Adicionar colunas à tabela processos
ALTER TABLE processos
ADD COLUMN IF NOT EXISTS last_provider_switch_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS provider_switch_count INTEGER DEFAULT 0;

-- Adicionar colunas à tabela admin_system_models
ALTER TABLE admin_system_models
ADD COLUMN IF NOT EXISTS failure_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_failure_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_failure_reason TEXT;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_processos_provider_switch
ON processos(last_provider_switch_at)
WHERE last_provider_switch_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_models_failures
ON admin_system_models(failure_count, last_failure_at)
WHERE failure_count > 0;

-- Comentários nas colunas
COMMENT ON COLUMN processos.last_provider_switch_at IS 'Timestamp da última troca de provider (OpenAI → Gemini)';
COMMENT ON COLUMN processos.provider_switch_count IS 'Número de vezes que o processo trocou de provider';
COMMENT ON COLUMN admin_system_models.failure_count IS 'Contador de falhas consecutivas do modelo';
COMMENT ON COLUMN admin_system_models.last_failure_at IS 'Timestamp da última falha do modelo';
COMMENT ON COLUMN admin_system_models.last_failure_reason IS 'Motivo da última falha do modelo';
