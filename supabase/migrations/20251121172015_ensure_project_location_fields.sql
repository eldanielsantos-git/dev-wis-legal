/*
  # Garantir Campos project_id e location para Google Gemini

  ## Resumo
  Verifica e garante que os campos project_id e location existem na tabela
  admin_system_models. Esses campos são obrigatórios para modelos Google Gemini
  que utilizam Vertex AI.

  ## 1. Alterações
  - Garantir campo project_id (text, nullable)
  - Garantir campo location (text, nullable)
  - Adicionar comentários explicativos

  ## 2. Campos
  - project_id: ID do projeto no Google Cloud Platform (ex: arpj-473315)
  - location: Região do Google Cloud (ex: us-central1, southamerica-east1)

  ## 3. Importante
  - Campos são nullable para suportar outros provedores (OpenAI, Anthropic)
  - Obrigatórios apenas para modelos Google quando use_vertex_ai = true
  - Já existem na tabela, esta migration apenas garante e documenta
*/

-- Garantir que project_id existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_system_models' AND column_name = 'project_id'
  ) THEN
    ALTER TABLE admin_system_models
    ADD COLUMN project_id text;
  END IF;
END $$;

-- Garantir que location existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_system_models' AND column_name = 'location'
  ) THEN
    ALTER TABLE admin_system_models
    ADD COLUMN location text;
  END IF;
END $$;

-- Comentários explicativos
COMMENT ON COLUMN admin_system_models.project_id IS
  'Google Cloud Project ID (obrigatório para modelos Google Gemini com Vertex AI). NULL para outros provedores. Exemplo: arpj-473315';

COMMENT ON COLUMN admin_system_models.location IS
  'Google Cloud Location/Region (obrigatório para modelos Google Gemini com Vertex AI). NULL para outros provedores. Exemplos: us-central1, southamerica-east1, europe-west1';

-- Índice para buscas por project_id/location (útil para billing e analytics)
CREATE INDEX IF NOT EXISTS idx_models_project_location
ON admin_system_models(project_id, location)
WHERE project_id IS NOT NULL AND location IS NOT NULL;