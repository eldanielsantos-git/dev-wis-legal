/*
  # Adicionar Rastreamento de Modelo LLM na Tabela Processos

  ## Resumo

  Adiciona campos para rastrear qual modelo LLM está sendo usado
  em tempo real para cada processo em análise.

  ## 1. Novas Colunas em processos

  - `current_llm_model_id` (uuid) - ID do modelo atualmente em uso
  - `current_llm_model_name` (text) - Nome do modelo atual
  - `llm_model_switching` (boolean) - Indica se está trocando de modelo
  - `llm_switch_reason` (text) - Motivo da troca (erro, timeout, etc)
  - `llm_models_attempted` (jsonb) - Array de modelos já tentados

  ## 2. Valores Padrão

  - llm_model_switching inicia como false
  - llm_models_attempted inicia como array vazio []
*/

-- Adicionar colunas de rastreamento de modelo LLM
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'processos'
    AND column_name = 'current_llm_model_id'
  ) THEN
    ALTER TABLE processos
    ADD COLUMN current_llm_model_id uuid REFERENCES admin_system_models(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'processos'
    AND column_name = 'current_llm_model_name'
  ) THEN
    ALTER TABLE processos
    ADD COLUMN current_llm_model_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'processos'
    AND column_name = 'llm_model_switching'
  ) THEN
    ALTER TABLE processos
    ADD COLUMN llm_model_switching boolean DEFAULT false NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'processos'
    AND column_name = 'llm_switch_reason'
  ) THEN
    ALTER TABLE processos
    ADD COLUMN llm_switch_reason text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'processos'
    AND column_name = 'llm_models_attempted'
  ) THEN
    ALTER TABLE processos
    ADD COLUMN llm_models_attempted jsonb DEFAULT '[]'::jsonb NOT NULL;
  END IF;
END $$;

-- Criar índice para queries por modelo
CREATE INDEX IF NOT EXISTS idx_processos_current_llm_model
ON processos(current_llm_model_id)
WHERE current_llm_model_id IS NOT NULL;

-- Criar índice para processos em troca de modelo
CREATE INDEX IF NOT EXISTS idx_processos_switching_model
ON processos(llm_model_switching, status)
WHERE llm_model_switching = true;

COMMENT ON COLUMN processos.current_llm_model_id IS
  'ID do modelo LLM atualmente sendo usado para análise';

COMMENT ON COLUMN processos.current_llm_model_name IS
  'Nome amigável do modelo atual (snapshot para exibição)';

COMMENT ON COLUMN processos.llm_model_switching IS
  'Indica se o sistema está trocando de modelo devido a falha';

COMMENT ON COLUMN processos.llm_switch_reason IS
  'Motivo da última troca de modelo (ex: api_error, timeout, rate_limit)';

COMMENT ON COLUMN processos.llm_models_attempted IS
  'Array JSON de modelos já tentados: [{"model_id": "...", "model_name": "...", "result": "failed/success", "timestamp": "..."}]';
