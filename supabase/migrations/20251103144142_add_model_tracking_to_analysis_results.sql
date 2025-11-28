/*
  # Adicionar Rastreamento de Modelo em analysis_results

  ## Resumo

  Adiciona campos para rastrear qual modelo LLM está sendo usado
  ou foi usado em cada análise, incluindo informações de fallback.

  ## 1. Novas Colunas em analysis_results

  - `current_model_id` (uuid, foreign key) - Modelo atualmente em uso
  - `current_model_name` (text) - Nome do modelo atual (snapshot)
  - `attempt_count` (integer) - Número de tentativas realizadas
  - `failed_models` (jsonb) - Array de modelos que falharam
  - `model_switched_at` (timestamptz) - Última vez que modelo foi trocado

  ## 2. Índices para Performance

  - Índice em current_model_id para queries por modelo
  - Índice composto em (processo_id, status, current_model_id)

  ## 3. Valores Padrão

  - attempt_count inicia em 0
  - failed_models inicia como array vazio []
*/

-- =====================================================
-- ADICIONAR NOVAS COLUNAS
-- =====================================================

DO $$
BEGIN
  -- Adicionar coluna current_model_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'analysis_results'
    AND column_name = 'current_model_id'
  ) THEN
    ALTER TABLE analysis_results
    ADD COLUMN current_model_id uuid REFERENCES admin_system_models(id) ON DELETE SET NULL;
  END IF;

  -- Adicionar coluna current_model_name
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'analysis_results'
    AND column_name = 'current_model_name'
  ) THEN
    ALTER TABLE analysis_results
    ADD COLUMN current_model_name text;
  END IF;

  -- Adicionar coluna attempt_count
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'analysis_results'
    AND column_name = 'attempt_count'
  ) THEN
    ALTER TABLE analysis_results
    ADD COLUMN attempt_count integer DEFAULT 0 NOT NULL;
  END IF;

  -- Adicionar coluna failed_models
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'analysis_results'
    AND column_name = 'failed_models'
  ) THEN
    ALTER TABLE analysis_results
    ADD COLUMN failed_models jsonb DEFAULT '[]'::jsonb NOT NULL;
  END IF;

  -- Adicionar coluna model_switched_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'analysis_results'
    AND column_name = 'model_switched_at'
  ) THEN
    ALTER TABLE analysis_results
    ADD COLUMN model_switched_at timestamptz;
  END IF;
END $$;

-- =====================================================
-- CRIAR ÍNDICES
-- =====================================================

-- Índice para queries por modelo atual
CREATE INDEX IF NOT EXISTS idx_analysis_results_current_model
ON analysis_results(current_model_id)
WHERE current_model_id IS NOT NULL;

-- Índice composto para queries de análise por processo e modelo
CREATE INDEX IF NOT EXISTS idx_analysis_results_processo_status_model
ON analysis_results(processo_id, status, current_model_id);

-- Índice para queries de análises em andamento com modelo
CREATE INDEX IF NOT EXISTS idx_analysis_results_running_model
ON analysis_results(status, current_model_id, created_at DESC)
WHERE status = 'running';

-- =====================================================
-- COMENTÁRIOS PARA DOCUMENTAÇÃO
-- =====================================================

COMMENT ON COLUMN analysis_results.current_model_id IS
  'Modelo LLM atualmente em uso para esta análise (NULL se ainda não iniciado ou já concluído)';

COMMENT ON COLUMN analysis_results.current_model_name IS
  'Nome do modelo atual (snapshot para exibição em tempo real)';

COMMENT ON COLUMN analysis_results.attempt_count IS
  'Número de tentativas realizadas (inclui tentativas de fallback)';

COMMENT ON COLUMN analysis_results.failed_models IS
  'Array JSON de objetos contendo histórico de modelos que falharam: [{"model_id": "...", "model_name": "...", "error": "...", "timestamp": "..."}]';

COMMENT ON COLUMN analysis_results.model_switched_at IS
  'Timestamp da última troca de modelo (usado para detectar mudanças em tempo real)';
