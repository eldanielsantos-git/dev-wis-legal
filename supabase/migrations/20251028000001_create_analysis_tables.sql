/*
  # Criação das Tabelas de Análise Gemini V2.0

  ## Resumo

  Cria as novas tabelas para gerenciar os 9 prompts sequenciais de análise
  e armazenar seus resultados.

  ## 1. Tabela: analysis_prompts

  Armazena os 9 prompts que serão executados sequencialmente pelo Gemini.
  Administradores podem editar o conteúdo dos prompts via interface.

  **Colunas:**
  - `id` (uuid, primary key) - Identificador único
  - `title` (text) - Título do prompt (ex: "Visão Geral do Processo")
  - `prompt_content` (text) - Conteúdo completo do prompt
  - `execution_order` (integer) - Ordem de execução (1-9)
  - `is_active` (boolean) - Se o prompt está ativo
  - `created_at` (timestamptz) - Data de criação
  - `updated_at` (timestamptz) - Data de atualização

  ## 2. Tabela: analysis_results

  Armazena os resultados de cada prompt executado para cada processo.

  **Colunas:**
  - `id` (uuid, primary key) - Identificador único
  - `processo_id` (uuid, foreign key) - Referência ao processo
  - `prompt_id` (uuid, foreign key) - Referência ao prompt executado
  - `prompt_title` (text) - Título do prompt (snapshot)
  - `result_content` (text) - Resultado retornado pelo Gemini
  - `execution_order` (integer) - Ordem de execução (1-9)
  - `status` (text) - Status: pending, running, completed, failed
  - `error_message` (text, nullable) - Mensagem de erro se falhou
  - `tokens_used` (integer, nullable) - Tokens utilizados
  - `execution_time_ms` (integer, nullable) - Tempo de execução
  - `created_at` (timestamptz) - Data de criação
  - `completed_at` (timestamptz, nullable) - Data de conclusão

  ## 3. Segurança (RLS)

  - Usuários autenticados podem ler seus próprios resultados
  - Apenas administradores podem editar prompts
  - Service role tem acesso total
*/

-- =====================================================
-- TABELA: analysis_prompts
-- =====================================================

CREATE TABLE IF NOT EXISTS analysis_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  prompt_content text NOT NULL,
  execution_order integer NOT NULL UNIQUE,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT check_execution_order CHECK (execution_order >= 1 AND execution_order <= 9)
);

-- Índices para otimização
CREATE INDEX IF NOT EXISTS idx_analysis_prompts_order ON analysis_prompts(execution_order) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_analysis_prompts_active ON analysis_prompts(is_active, execution_order);

-- RLS
ALTER TABLE analysis_prompts ENABLE ROW LEVEL SECURITY;

-- Todos podem ler prompts ativos
CREATE POLICY "Todos podem visualizar prompts ativos"
  ON analysis_prompts
  FOR SELECT
  USING (is_active = true);

-- Apenas admins podem editar prompts
CREATE POLICY "Apenas admins podem gerenciar prompts"
  ON analysis_prompts
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- Service role tem acesso total
CREATE POLICY "Service role tem acesso total aos prompts"
  ON analysis_prompts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- TABELA: analysis_results
-- =====================================================

CREATE TABLE IF NOT EXISTS analysis_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
  prompt_id uuid NOT NULL REFERENCES analysis_prompts(id) ON DELETE RESTRICT,
  prompt_title text NOT NULL,
  result_content text,
  execution_order integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  tokens_used integer,
  execution_time_ms integer,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,

  CONSTRAINT check_status CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  CONSTRAINT check_result_execution_order CHECK (execution_order >= 1 AND execution_order <= 9),
  UNIQUE(processo_id, execution_order)
);

-- Índices para otimização
CREATE INDEX IF NOT EXISTS idx_analysis_results_processo ON analysis_results(processo_id, execution_order);
CREATE INDEX IF NOT EXISTS idx_analysis_results_status ON analysis_results(status, created_at);
CREATE INDEX IF NOT EXISTS idx_analysis_results_completed ON analysis_results(completed_at DESC) WHERE completed_at IS NOT NULL;

-- RLS
ALTER TABLE analysis_results ENABLE ROW LEVEL SECURITY;

-- Usuários podem ver resultados de seus próprios processos
CREATE POLICY "Usuários podem visualizar seus próprios resultados"
  ON analysis_results
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM processos
      WHERE processos.id = analysis_results.processo_id
      AND processos.user_id = auth.uid()
    )
  );

-- Service role tem acesso total
CREATE POLICY "Service role tem acesso total aos resultados"
  ON analysis_results
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- TRIGGER: Atualizar updated_at automaticamente
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_analysis_prompts_updated_at
  BEFORE UPDATE ON analysis_prompts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- COMENTÁRIOS PARA DOCUMENTAÇÃO
-- =====================================================

COMMENT ON TABLE analysis_prompts IS 'Armazena os 9 prompts sequenciais que serão executados pelo Gemini para cada processo';
COMMENT ON TABLE analysis_results IS 'Armazena os resultados de cada prompt executado para cada processo';

COMMENT ON COLUMN analysis_prompts.execution_order IS 'Ordem de execução do prompt (1 a 9)';
COMMENT ON COLUMN analysis_prompts.is_active IS 'Indica se o prompt está ativo e deve ser executado';

COMMENT ON COLUMN analysis_results.status IS 'Status da execução: pending (aguardando), running (executando), completed (concluído), failed (falhou)';
COMMENT ON COLUMN analysis_results.execution_order IS 'Ordem de execução (1 a 9) - snapshot do execution_order do prompt';
COMMENT ON COLUMN analysis_results.prompt_title IS 'Título do prompt (snapshot para histórico)';
