/*
  # Vincular Modelos LLM aos Provedores

  ## Resumo
  Adiciona relação entre modelos LLM e provedores de API para suportar
  sistema multi-provider dinâmico.

  ## Alterações
  - Adicionar coluna provider_id (foreign key para llm_api_providers)
  - Adicionar coluna usage_context para definir onde o modelo é usado
  - Criar índices para buscas otimizadas
*/

-- Adicionar provider_id se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_system_models' AND column_name = 'provider_id'
  ) THEN
    ALTER TABLE admin_system_models
    ADD COLUMN provider_id uuid REFERENCES llm_api_providers(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Adicionar usage_context se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_system_models' AND column_name = 'usage_context'
  ) THEN
    ALTER TABLE admin_system_models
    ADD COLUMN usage_context text;
  END IF;
END $$;

-- Constraint para usage_context válido
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'admin_system_models_context_check'
  ) THEN
    ALTER TABLE admin_system_models
    ADD CONSTRAINT admin_system_models_context_check
    CHECK (usage_context IS NULL OR usage_context IN ('file_processing', 'chat', 'consolidation', 'audio'));
  END IF;
END $$;

-- Índice para busca por provider e contexto
CREATE INDEX IF NOT EXISTS idx_models_provider_context
ON admin_system_models(provider_id, usage_context, is_active)
WHERE is_active = true;

-- Comentários
COMMENT ON COLUMN admin_system_models.provider_id IS
  'Referência ao provedor de API (llm_api_providers)';

COMMENT ON COLUMN admin_system_models.usage_context IS
  'Contexto de uso: file_processing, chat, consolidation, audio';
