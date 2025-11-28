/*
  # Atualizar Schema da Tabela admin_system_models

  ## Resumo

  Atualiza a estrutura da tabela de modelos LLM para suportar múltiplos
  provedores (Google, Anthropic, OpenAI, Deepseek, Grok) com campos
  de configuração específicos.

  ## 1. Alterações nas Colunas

  Remove colunas específicas do Google Cloud:
  - project_id (não usado por outros provedores)
  - location (não usado por outros provedores)

  Adiciona novas colunas:
  - `llm_provider` (text) - Provedor do LLM (Google, Anthropic, OpenAI, etc)
  - `display_name` (text) - Nome amigável para exibição
  - `system_model` (text) - Nome exato do modelo na API
  - `temperature` (numeric) - Temperatura de geração (padrão vem da aplicação)
  - `max_tokens` (integer) - Máximo de tokens (padrão vem da aplicação)

  Mantém:
  - `name` (text) - Nome interno/identificador
  - `model_id` (text) - ID do modelo (mantido para compatibilidade)
  - `priority` (integer) - Ordem de prioridade
  - `is_active` (boolean) - Se está ativo

  ## 2. Valores Padrão

  - temperature: null (usa padrão da aplicação: 0.7)
  - max_tokens: null (usa padrão da aplicação: 8192)
  - llm_provider: 'Google' (padrão)
*/

-- Adicionar novas colunas
DO $$
BEGIN
  -- Provedor do LLM
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_system_models'
    AND column_name = 'llm_provider'
  ) THEN
    ALTER TABLE admin_system_models
    ADD COLUMN llm_provider text DEFAULT 'Google' NOT NULL;
  END IF;

  -- Nome de exibição
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_system_models'
    AND column_name = 'display_name'
  ) THEN
    ALTER TABLE admin_system_models
    ADD COLUMN display_name text NOT NULL DEFAULT '';
  END IF;

  -- System Model (nome exato da API)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_system_models'
    AND column_name = 'system_model'
  ) THEN
    ALTER TABLE admin_system_models
    ADD COLUMN system_model text NOT NULL DEFAULT '';
  END IF;

  -- Temperatura
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_system_models'
    AND column_name = 'temperature'
  ) THEN
    ALTER TABLE admin_system_models
    ADD COLUMN temperature numeric(3,2);
  END IF;

  -- Max Tokens
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_system_models'
    AND column_name = 'max_tokens'
  ) THEN
    ALTER TABLE admin_system_models
    ADD COLUMN max_tokens integer;
  END IF;
END $$;

-- Adicionar constraint para llm_provider
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'admin_system_models_llm_provider_check'
  ) THEN
    ALTER TABLE admin_system_models
    ADD CONSTRAINT admin_system_models_llm_provider_check
    CHECK (llm_provider IN ('Google', 'Anthropic', 'OpenAI', 'Deepseek', 'Grok', 'Outro'));
  END IF;
END $$;

-- Adicionar constraint para temperatura (deve estar entre 0 e 2)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'admin_system_models_temperature_check'
  ) THEN
    ALTER TABLE admin_system_models
    ADD CONSTRAINT admin_system_models_temperature_check
    CHECK (temperature IS NULL OR (temperature >= 0 AND temperature <= 2));
  END IF;
END $$;

-- Adicionar constraint para max_tokens (deve ser positivo)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'admin_system_models_max_tokens_check'
  ) THEN
    ALTER TABLE admin_system_models
    ADD CONSTRAINT admin_system_models_max_tokens_check
    CHECK (max_tokens IS NULL OR max_tokens > 0);
  END IF;
END $$;

-- Migrar dados existentes
UPDATE admin_system_models
SET
  display_name = name,
  system_model = model_id
WHERE display_name = '' OR system_model = '';

-- Criar índice para busca por provedor
CREATE INDEX IF NOT EXISTS idx_admin_system_models_provider
ON admin_system_models(llm_provider, is_active)
WHERE is_active = true;

-- Comentários nas colunas
COMMENT ON COLUMN admin_system_models.llm_provider IS
  'Provedor do LLM: Google, Anthropic, OpenAI, Deepseek, Grok, Outro';

COMMENT ON COLUMN admin_system_models.display_name IS
  'Nome amigável para exibição na UI';

COMMENT ON COLUMN admin_system_models.system_model IS
  'Nome exato do modelo para ser usado na API do provedor';

COMMENT ON COLUMN admin_system_models.temperature IS
  'Temperatura de geração (0-2). NULL usa padrão da aplicação (0.7)';

COMMENT ON COLUMN admin_system_models.max_tokens IS
  'Máximo de tokens de saída. NULL usa padrão da aplicação (8192)';

COMMENT ON COLUMN admin_system_models.priority IS
  'Ordem de prioridade (menor número = maior prioridade)';
