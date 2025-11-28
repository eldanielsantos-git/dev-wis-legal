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

CREATE INDEX IF NOT EXISTS idx_analysis_prompts_order ON analysis_prompts(execution_order) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_analysis_prompts_active ON analysis_prompts(is_active, execution_order);

ALTER TABLE analysis_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos podem visualizar prompts ativos" ON analysis_prompts FOR SELECT USING (is_active = true);
CREATE POLICY "Apenas admins podem gerenciar prompts" ON analysis_prompts FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.is_admin = true)
) WITH CHECK (
  EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.is_admin = true)
);
CREATE POLICY "Service role tem acesso total aos prompts" ON analysis_prompts FOR ALL TO service_role USING (true) WITH CHECK (true);

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

CREATE INDEX IF NOT EXISTS idx_analysis_results_processo ON analysis_results(processo_id, execution_order);
CREATE INDEX IF NOT EXISTS idx_analysis_results_status ON analysis_results(status, created_at);
CREATE INDEX IF NOT EXISTS idx_analysis_results_completed ON analysis_results(completed_at DESC) WHERE completed_at IS NOT NULL;

ALTER TABLE analysis_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem visualizar seus próprios resultados" ON analysis_results FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM processos WHERE processos.id = analysis_results.processo_id AND processos.user_id = auth.uid())
);
CREATE POLICY "Service role tem acesso total aos resultados" ON analysis_results FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_analysis_prompts_updated_at BEFORE UPDATE ON analysis_prompts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();