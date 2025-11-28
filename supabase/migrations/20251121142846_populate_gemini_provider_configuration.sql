/*
  # Popular Configuração Inicial do Google Gemini

  ## Resumo
  Cria os provedores Google Gemini para cada contexto de uso e
  vincula os modelos existentes aos provedores.

  ## Dados Inseridos
  - 4 provedores Google Gemini (um para cada contexto)
  - Vinculação dos modelos existentes aos provedores
*/

-- Inserir provedores Google Gemini para cada contexto
INSERT INTO llm_api_providers (
  provider_name,
  provider_type,
  usage_contexts,
  is_active,
  configuration_json,
  priority,
  health_status
)
VALUES
  (
    'Google Gemini - Processamento de Arquivos',
    'google-gemini',
    ARRAY['file_processing']::text[],
    true,
    '{"api_version": "v1", "region": "us-central1"}'::jsonb,
    1,
    'healthy'
  ),
  (
    'Google Gemini - Chat',
    'google-gemini',
    ARRAY['chat']::text[],
    true,
    '{"api_version": "v1", "region": "us-central1"}'::jsonb,
    1,
    'healthy'
  ),
  (
    'Google Gemini - Consolidação',
    'google-gemini',
    ARRAY['consolidation']::text[],
    true,
    '{"api_version": "v1", "region": "us-central1"}'::jsonb,
    1,
    'healthy'
  ),
  (
    'Google Gemini - Audio',
    'google-gemini',
    ARRAY['audio']::text[],
    true,
    '{"api_version": "v1", "region": "us-central1"}'::jsonb,
    1,
    'healthy'
  )
ON CONFLICT DO NOTHING;

-- Atualizar modelos existentes para vincular ao provedor de file_processing
UPDATE admin_system_models
SET
  provider_id = (
    SELECT id FROM llm_api_providers
    WHERE provider_type = 'google-gemini'
    AND 'file_processing' = ANY(usage_contexts)
    LIMIT 1
  ),
  usage_context = 'file_processing'
WHERE provider_id IS NULL;

-- Comentário explicativo
COMMENT ON TABLE llm_api_providers IS
  'Provedores LLM configurados - Google Gemini ativo para todos os contextos inicialmente';
