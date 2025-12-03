/*
  # Tabela de Erros de Análise Complexa (Arquivos >1000 páginas)

  1. Nova Tabela
    - `complex_analysis_errors` - Registra erros específicos de processamento complexo
    - Campos adicionais para tracking de chunks, workers, e recovery

  2. Relacionamentos
    - processo_id → processos
    - user_id → user_profiles
    - chunk_id → process_chunks
    - analysis_result_id → analysis_results

  3. Security
    - Enable RLS
    - Admins podem ver todos os erros
    - Service role pode inserir
*/

CREATE TABLE IF NOT EXISTS complex_analysis_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relacionamentos
  processo_id uuid NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  chunk_id uuid REFERENCES process_chunks(id) ON DELETE SET NULL,
  analysis_result_id uuid REFERENCES analysis_results(id) ON DELETE SET NULL,
  
  -- Informações do Erro
  error_type text NOT NULL,
  error_category text NOT NULL,
  error_message text NOT NULL,
  error_details jsonb DEFAULT '{}'::jsonb,
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  stack_trace text,
  
  -- Contexto do Processamento Complexo
  current_phase text,                    -- 'processing', 'consolidation', 'finalization'
  prompt_title text,
  execution_order integer,
  
  -- Informações do Chunk com Falha
  failed_chunk_index integer,
  chunk_start_page integer,
  chunk_end_page integer,
  chunk_pages_count integer,
  estimated_tokens integer,
  token_validation_status text,
  
  -- Informações de Progresso
  total_chunks integer,
  chunks_completed integer,
  chunks_succeeded integer,
  chunks_failed integer,
  progress_percent numeric(5,2),
  
  -- Informações Técnicas
  worker_id text,
  model_used text,
  retry_attempt integer DEFAULT 0,
  max_retries integer DEFAULT 3,
  gemini_file_uri text,
  
  -- Recovery e Notificação
  recovery_attempted boolean DEFAULT false,
  recovery_successful boolean DEFAULT false,
  recovery_details jsonb DEFAULT '{}'::jsonb,
  chunk_subdivision_triggered boolean DEFAULT false,
  auto_recovery_enabled boolean DEFAULT true,
  next_retry_at timestamptz,
  
  admin_notified boolean DEFAULT false,
  admin_notified_at timestamptz,
  admin_email_id text,
  
  -- Timestamps
  occurred_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  
  -- Processamento duration (segundos)
  processing_duration integer
);

-- RLS Policies
ALTER TABLE complex_analysis_errors ENABLE ROW LEVEL SECURITY;

-- Admins podem ver todos os erros
CREATE POLICY "Admins can view all complex analysis errors"
  ON complex_analysis_errors FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- Service role pode inserir
CREATE POLICY "Service role can insert complex analysis errors"
  ON complex_analysis_errors FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Service role pode atualizar
CREATE POLICY "Service role can update complex analysis errors"
  ON complex_analysis_errors FOR UPDATE
  TO service_role
  USING (true);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_complex_errors_processo 
  ON complex_analysis_errors(processo_id);

CREATE INDEX IF NOT EXISTS idx_complex_errors_user 
  ON complex_analysis_errors(user_id);

CREATE INDEX IF NOT EXISTS idx_complex_errors_chunk 
  ON complex_analysis_errors(chunk_id);

CREATE INDEX IF NOT EXISTS idx_complex_errors_severity 
  ON complex_analysis_errors(severity);

CREATE INDEX IF NOT EXISTS idx_complex_errors_notified 
  ON complex_analysis_errors(admin_notified, occurred_at) 
  WHERE admin_notified = false;

CREATE INDEX IF NOT EXISTS idx_complex_errors_retry 
  ON complex_analysis_errors(next_retry_at) 
  WHERE next_retry_at IS NOT NULL AND resolved_at IS NULL;

-- Comentários
COMMENT ON TABLE complex_analysis_errors IS 'Erros específicos de processamento de arquivos grandes (>1000 páginas) em modo complexo';
COMMENT ON COLUMN complex_analysis_errors.chunk_subdivision_triggered IS 'Se true, o sistema tentará subdividir o chunk que falhou';
COMMENT ON COLUMN complex_analysis_errors.processing_duration IS 'Tempo de processamento em segundos antes da falha';
