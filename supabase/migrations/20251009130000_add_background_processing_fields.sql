/*
  # Adicionar campos para processamento background e lock inteligente

  1. Novos Campos
    - `background_mode` (boolean): indica se o processo está rodando em background
    - `finalization_last_file_processed_at` (timestamptz): timestamp do último arquivo processado com sucesso
    - `finalization_attempt_count` (integer): contador de tentativas de finalização
    - `finalization_metrics` (jsonb): métricas detalhadas do processamento
    - `finalization_checkpoint_data` (jsonb): dados completos para recovery
    - `estimated_completion_time` (timestamptz): estimativa de conclusão baseada na velocidade
    - `processing_velocity_pages_per_second` (numeric): velocidade atual de processamento

  2. Alterações
    - Aumentar timeout padrão do heartbeat
    - Adicionar índices para consultas de monitoramento

  3. Notas
    - Campos são nullable para compatibilidade com processos existentes
    - Métricas serão calculadas automaticamente durante o processamento
*/

-- Adicionar novos campos para processamento background
ALTER TABLE processos ADD COLUMN IF NOT EXISTS background_mode BOOLEAN DEFAULT false;
ALTER TABLE processos ADD COLUMN IF NOT EXISTS finalization_last_file_processed_at TIMESTAMPTZ;
ALTER TABLE processos ADD COLUMN IF NOT EXISTS finalization_attempt_count INTEGER DEFAULT 0;
ALTER TABLE processos ADD COLUMN IF NOT EXISTS finalization_metrics JSONB DEFAULT '{}'::jsonb;
ALTER TABLE processos ADD COLUMN IF NOT EXISTS finalization_checkpoint_data JSONB;
ALTER TABLE processos ADD COLUMN IF NOT EXISTS estimated_completion_time TIMESTAMPTZ;
ALTER TABLE processos ADD COLUMN IF NOT EXISTS processing_velocity_pages_per_second NUMERIC(10,2);

-- Adicionar índices para monitoramento de locks travados
CREATE INDEX IF NOT EXISTS idx_processos_lock_monitoring
  ON processos(status, finalization_lock_at, finalization_locked_by)
  WHERE finalization_lock_at IS NOT NULL;

-- Adicionar índice para processos em background
CREATE INDEX IF NOT EXISTS idx_processos_background_mode
  ON processos(background_mode, status)
  WHERE background_mode = true;

-- Adicionar índice para processos que precisam de recovery
CREATE INDEX IF NOT EXISTS idx_processos_stalled_locks
  ON processos(status, finalization_last_file_processed_at)
  WHERE status = 'finalizing';

-- Comentários para documentação
COMMENT ON COLUMN processos.background_mode IS 'Indica se o processo está rodando em background sem cliente conectado';
COMMENT ON COLUMN processos.finalization_last_file_processed_at IS 'Timestamp do último arquivo processado - usado para detectar locks travados';
COMMENT ON COLUMN processos.finalization_attempt_count IS 'Número de tentativas de finalização - previne loops infinitos';
COMMENT ON COLUMN processos.finalization_metrics IS 'Métricas detalhadas: velocidade, tempo por arquivo, memória usada, etc';
COMMENT ON COLUMN processos.finalization_checkpoint_data IS 'Estado completo para recovery - permite retomar exatamente de onde parou';
COMMENT ON COLUMN processos.estimated_completion_time IS 'Estimativa de conclusão baseada na velocidade atual de processamento';
COMMENT ON COLUMN processos.processing_velocity_pages_per_second IS 'Velocidade de processamento em páginas por segundo';
