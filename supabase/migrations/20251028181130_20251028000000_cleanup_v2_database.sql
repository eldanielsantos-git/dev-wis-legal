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
-- Drop trigger dependente antes
DROP TRIGGER IF EXISTS trigger_create_notification_on_status_change ON processos;

ALTER TABLE processos ADD COLUMN status_new text;

UPDATE processos
SET status_new = CASE
  WHEN status::text IN ('transcribing', 'queuing', 'processing_batch', 'finalizing', 'processing_forensic') THEN 'analyzing'
  WHEN status::text = 'completed' THEN 'completed'
  WHEN status::text = 'error' THEN 'error'
  ELSE 'created'
END;

ALTER TABLE processos DROP COLUMN status CASCADE;
DROP TYPE IF EXISTS processo_status CASCADE;

CREATE TYPE processo_status AS ENUM ('created', 'analyzing', 'completed', 'error');

ALTER TABLE processos RENAME COLUMN status_new TO status;
ALTER TABLE processos ALTER COLUMN status TYPE processo_status USING status::processo_status;
ALTER TABLE processos ALTER COLUMN status SET DEFAULT 'created';
ALTER TABLE processos ALTER COLUMN status SET NOT NULL;

-- Recriar trigger simplificado
CREATE OR REPLACE FUNCTION create_notification_on_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'completed' THEN
      INSERT INTO notifications (user_id, title, message, type, processo_id, is_read)
      VALUES (
        NEW.user_id,
        'Análise Concluída',
        'A análise do processo "' || NEW.file_name || '" foi concluída com sucesso.',
        'success',
        NEW.id,
        false
      );
    ELSIF NEW.status = 'error' THEN
      INSERT INTO notifications (user_id, title, message, type, processo_id, is_read)
      VALUES (
        NEW.user_id,
        'Erro na Análise',
        'Ocorreu um erro na análise do processo "' || NEW.file_name || '".',
        'error',
        NEW.id,
        false
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_notification_on_status_change
  AFTER UPDATE ON processos
  FOR EACH ROW
  EXECUTE FUNCTION create_notification_on_status_change();

-- ADICIONAR NOVAS COLUNAS
ALTER TABLE processos
  ADD COLUMN IF NOT EXISTS analysis_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS analysis_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS current_prompt_number integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_prompts integer DEFAULT 9;

CREATE INDEX IF NOT EXISTS idx_processos_status_analysis ON processos(status, analysis_started_at);
CREATE INDEX IF NOT EXISTS idx_processos_user_status ON processos(user_id, status);