/*
  # Adicionar Configuração Específica do Google Gemini

  ## Resumo
  Adiciona campos JSONB para armazenar configurações específicas do Google Gemini
  nos provedores e modelos, permitindo gerenciamento completo via admin.

  ## 1. Novas Colunas

  ### Tabela llm_api_providers:
  - `gemini_config` (JSONB) - Configuração específica do Google Gemini
    - api_version: Versão da API (v1, v1beta, etc)
    - use_vertex_ai: Se usa Vertex AI (requer project_id/location)
    - generation_config: Parâmetros de geração (temperature, maxOutputTokens, topK, topP)
    - safety_settings: Configurações de segurança do Gemini
    - request_options: Timeouts e retry logic

  ### Tabela admin_system_models:
  - `model_config` (JSONB) - Configuração específica do modelo
    - Permite override de configurações do provedor por modelo

  ## 2. Segurança
  - Campos nullable para manter compatibilidade
  - Índices GIN para buscas eficientes em JSONB
  - Valores padrão populados para provedores Gemini existentes

  ## 3. Exemplo de Estrutura JSON

  gemini_config:
  {
    "api_version": "v1",
    "use_vertex_ai": true,
    "generation_config": {
      "temperature": 0.7,
      "maxOutputTokens": 8192,
      "topK": 40,
      "topP": 0.95
    },
    "safety_settings": [
      {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
      {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
      {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
      {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"}
    ]
  }

  model_config:
  {
    "temperature": 0.2,
    "maxOutputTokens": 16384
  }
*/

-- Adicionar campo gemini_config à tabela llm_api_providers
ALTER TABLE llm_api_providers
ADD COLUMN IF NOT EXISTS gemini_config JSONB DEFAULT NULL;

-- Adicionar campo model_config à tabela admin_system_models
ALTER TABLE admin_system_models
ADD COLUMN IF NOT EXISTS model_config JSONB DEFAULT NULL;

-- Comentários explicativos
COMMENT ON COLUMN llm_api_providers.gemini_config IS
  'Configuração específica do Google Gemini (generation_config, safety_settings, etc). Aplicável apenas para provider_type = google-gemini';

COMMENT ON COLUMN admin_system_models.model_config IS
  'Configuração específica do modelo. Sobrescreve configurações do provedor quando definido';

-- Popular configuração padrão para provedores Gemini existentes
UPDATE llm_api_providers
SET gemini_config = '{
  "api_version": "v1",
  "use_vertex_ai": true,
  "generation_config": {
    "temperature": 0.7,
    "maxOutputTokens": 8192,
    "topK": 40,
    "topP": 0.95
  },
  "safety_settings": [
    {
      "category": "HARM_CATEGORY_HARASSMENT",
      "threshold": "BLOCK_NONE"
    },
    {
      "category": "HARM_CATEGORY_HATE_SPEECH",
      "threshold": "BLOCK_NONE"
    },
    {
      "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
      "threshold": "BLOCK_NONE"
    },
    {
      "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
      "threshold": "BLOCK_NONE"
    }
  ],
  "request_options": {
    "timeout": 300000,
    "retry": {
      "max_attempts": 3,
      "backoff_multiplier": 2
    }
  }
}'::jsonb
WHERE provider_type = 'google-gemini'
AND gemini_config IS NULL;

-- Índices GIN para buscas eficientes em JSONB
CREATE INDEX IF NOT EXISTS idx_providers_gemini_config
ON llm_api_providers USING gin (gemini_config);

CREATE INDEX IF NOT EXISTS idx_models_model_config
ON admin_system_models USING gin (model_config);