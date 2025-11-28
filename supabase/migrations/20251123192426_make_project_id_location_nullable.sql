/*
  # Tornar project_id e location NULLABLE

  1. Alterações
    - Torna `project_id` NULLABLE (só necessário para Google Gemini)
    - Torna `location` NULLABLE (só necessário para Google Gemini)
    - Permite cadastro de modelos OpenAI, Anthropic, etc sem exigir esses campos

  2. Segurança
    - Mantém RLS policies existentes
    - Não afeta modelos já cadastrados
*/

-- Tornar project_id NULLABLE
ALTER TABLE admin_system_models
ALTER COLUMN project_id DROP NOT NULL;

-- Tornar location NULLABLE
ALTER TABLE admin_system_models
ALTER COLUMN location DROP NOT NULL;

-- Adicionar comentários
COMMENT ON COLUMN admin_system_models.project_id IS
  'Google Cloud Project ID. Obrigatório apenas para provider Google Gemini';

COMMENT ON COLUMN admin_system_models.location IS
  'Google Cloud Location. Obrigatório apenas para provider Google Gemini';
