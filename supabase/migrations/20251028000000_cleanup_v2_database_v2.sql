/*
  # Limpeza Completa do Banco V2.0 - Simplificação para Gemini
*/

-- DROP TABELAS OBSOLETAS
DROP TABLE IF EXISTS forensic_analysis_steps CASCADE;
DROP TABLE IF EXISTS analise_forense CASCADE;
DROP TABLE IF EXISTS forensic_prompts CASCADE;
DROP TABLE IF EXISTS transcription_queue CASCADE;
DROP TABLE IF EXISTS admin_system_models CASCADE;

-- REMOVER COLUNAS OBSOLETAS
ALTER TABLE processos
  DROP COLUMN IF EXISTS docai_batch_jobs,
  DROP COLUMN IF EXISTS progress_info,
  DROP COLUMN IF EXISTS finalization_state,
  DROP COLUMN IF EXISTS finalization_progress_percent,
  DROP COLUMN IF EXISTS forensic_analysis_status,
  DROP COLUMN IF EXISTS current_forensic_analysis_id,
  DROP COLUMN IF EXISTS analysis_mode,
  DROP COLUMN IF EXISTS processing_started_at,
  DROP COLUMN IF EXISTS processing_completed_at,
  DROP COLUMN IF EXISTS processing_duration_seconds,
  DROP COLUMN IF EXISTS tier_id,
  DROP COLUMN IF EXISTS tier_name,
  DROP COLUMN IF EXISTS chunk_level,
  DROP COLUMN IF EXISTS finalization_lock_at,
  DROP COLUMN IF EXISTS finalization_locked_by,
  DROP COLUMN IF EXISTS finalization_lock_expires_at,
  DROP COLUMN IF EXISTS processing_metadata;

-- RECRIAR ENUM SIMPLIFICADO
ALTER TABLE processos ADD COLUMN status_new text;

UPDATE processos
SET status_new = CASE
  WHEN status::text IN ('transcribing', 'queuing', 'processing_batch', 'finalizing', 'processing_forensic') THEN 'analyzing'
  WHEN status::text = 'completed' THEN 'completed'
  WHEN status::text = 'error' THEN 'error'
  ELSE 'created'
END;

ALTER TABLE processos DROP COLUMN status;
DROP TYPE IF EXISTS processo_status CASCADE;

CREATE TYPE processo_status AS ENUM ('created', 'analyzing', 'completed', 'error');

ALTER TABLE processos RENAME COLUMN status_new TO status;
ALTER TABLE processos ALTER COLUMN status TYPE processo_status USING status::processo_status;
ALTER TABLE processos ALTER COLUMN status SET DEFAULT 'created';
ALTER TABLE processos ALTER COLUMN status SET NOT NULL;

-- ADICIONAR NOVAS COLUNAS
ALTER TABLE processos
  ADD COLUMN IF NOT EXISTS analysis_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS analysis_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS current_prompt_number integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_prompts integer DEFAULT 9;

CREATE INDEX IF NOT EXISTS idx_processos_status_analysis ON processos(status, analysis_started_at);
CREATE INDEX IF NOT EXISTS idx_processos_user_status ON processos(user_id, status);
