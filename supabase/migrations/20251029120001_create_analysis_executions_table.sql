/*
  # Criar Tabela de Rastreamento de Execuções de Análise

  ## Resumo

  Cria tabela para registrar cada tentativa de execução de análise,
  incluindo histórico de modelos utilizados e fallbacks realizados.

  ## 1. Nova Tabela: analysis_executions

  Registra cada tentativa de execução de análise com informações
  detalhadas sobre o modelo utilizado e resultado da execução.

  **Colunas:**
  - `id` (uuid, primary key) - Identificador único da execução
  - `processo_id` (uuid, foreign key) - Processo sendo analisado
  - `analysis_result_id` (uuid, foreign key) - Resultado da análise associado
  - `model_id` (uuid, foreign key) - Modelo LLM utilizado
  - `model_name` (text) - Snapshot do nome do modelo
  - `attempt_number` (integer) - Número da tentativa (1, 2, 3...)
  - `status` (text) - Status: success, failed, timeout, api_error
  - `error_message` (text, nullable) - Mensagem de erro se falhou
  - `error_code` (text, nullable) - Código do erro da API
  - `execution_time_ms` (integer, nullable) - Tempo de execução
  - `tokens_used` (integer, nullable) - Tokens utilizados
  - `started_at` (timestamptz) - Início da execução
  - `completed_at` (timestamptz, nullable) - Fim da execução

  ## 2. Índices para Performance

  - Índice em processo_id para queries por processo
  - Índice composto em (analysis_result_id, attempt_number)
  - Índice em model_id para análise por modelo
  - Índice em status para filtros de estado

  ## 3. Segurança (RLS)

  - Usuários podem visualizar execuções de seus próprios processos
  - Service role tem acesso total
*/

-- =====================================================
-- CRIAR TABELA analysis_executions
-- =====================================================

CREATE TABLE IF NOT EXISTS analysis_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
  analysis_result_id uuid NOT NULL REFERENCES analysis_results(id) ON DELETE CASCADE,
  model_id uuid NOT NULL REFERENCES admin_system_models(id) ON DELETE RESTRICT,
  model_name text NOT NULL,
  attempt_number integer NOT NULL DEFAULT 1,
  status text NOT NULL,
  error_message text,
  error_code text,
  execution_time_ms integer,
  tokens_used integer,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,

  CONSTRAINT check_execution_status CHECK (
    status IN ('success', 'failed', 'timeout', 'api_error', 'rate_limit', 'quota_exceeded')
  ),
  CONSTRAINT check_attempt_number CHECK (attempt_number > 0)
);

-- =====================================================
-- CRIAR ÍNDICES
-- =====================================================

-- Índice para queries por processo
CREATE INDEX IF NOT EXISTS idx_analysis_executions_processo
ON analysis_executions(processo_id, started_at DESC);

-- Índice composto para análise de tentativas por resultado
CREATE INDEX IF NOT EXISTS idx_analysis_executions_result_attempt
ON analysis_executions(analysis_result_id, attempt_number);

-- Índice para análise por modelo
CREATE INDEX IF NOT EXISTS idx_analysis_executions_model
ON analysis_executions(model_id, status, started_at DESC);

-- Índice para filtros por status
CREATE INDEX IF NOT EXISTS idx_analysis_executions_status
ON analysis_executions(status, started_at DESC);

-- Índice para queries de execuções bem-sucedidas
CREATE INDEX IF NOT EXISTS idx_analysis_executions_success
ON analysis_executions(completed_at DESC)
WHERE status = 'success';

-- =====================================================
-- CONFIGURAR RLS
-- =====================================================

ALTER TABLE analysis_executions ENABLE ROW LEVEL SECURITY;

-- Usuários podem visualizar execuções de seus próprios processos
CREATE POLICY "Usuários podem visualizar suas próprias execuções"
  ON analysis_executions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM processos
      WHERE processos.id = analysis_executions.processo_id
      AND processos.user_id = auth.uid()
    )
  );

-- Admins podem visualizar todas as execuções
CREATE POLICY "Admins podem visualizar todas as execuções"
  ON analysis_executions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- Service role tem acesso total
CREATE POLICY "Service role tem acesso total às execuções"
  ON analysis_executions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- COMENTÁRIOS PARA DOCUMENTAÇÃO
-- =====================================================

COMMENT ON TABLE analysis_executions IS
  'Registra cada tentativa de execução de análise com modelo LLM, incluindo tentativas de fallback';

COMMENT ON COLUMN analysis_executions.attempt_number IS
  'Número sequencial da tentativa (1 = primeira tentativa, 2+ = tentativas de fallback)';

COMMENT ON COLUMN analysis_executions.status IS
  'Status da execução: success (sucesso), failed (falha genérica), timeout (tempo esgotado), api_error (erro da API), rate_limit (limite de taxa), quota_exceeded (cota excedida)';

COMMENT ON COLUMN analysis_executions.model_name IS
  'Snapshot do nome do modelo no momento da execução (para histórico)';

COMMENT ON COLUMN analysis_executions.error_code IS
  'Código de erro retornado pela API do modelo LLM';
