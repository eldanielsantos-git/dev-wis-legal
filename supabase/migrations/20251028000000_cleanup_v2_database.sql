/*
  # Limpeza Completa do Banco V2.0 - Simplificação para Gemini

  ## Resumo das Mudanças

  Esta migration remove toda a complexidade relacionada a:
  - Google Cloud Storage (GCS)
  - Document AI (DocAI)
  - Sistema de transcrição em chunks
  - Análise forense modular complexa
  - Sistema de tiers de documentos

  ## 1. Tabelas Removidas

  - `analise_forense` - Análises forenses antigas
  - `forensic_prompts` - Prompts modulares antigos
  - `forensic_analysis_steps` - Steps de análise incremental
  - `transcription_queue` - Fila de transcrição DocAI
  - `admin_system_models` - Modelos DocAI configurados

  ## 2. Colunas Removidas da Tabela `processos`

  - `docai_batch_jobs` - Jobs do Document AI
  - `progress_info` - Informações detalhadas de progresso DocAI
  - `finalization_state` - Estado de finalização de transcrição
  - `finalization_progress_percent` - Percentual de finalização
  - `forensic_analysis_status` - Status de análise forense
  - `current_forensic_analysis_id` - ID da análise forense atual
  - `analysis_mode` - Modo de análise (transcription_only/forensic_analysis)
  - `processing_started_at` - Timestamp de início de processamento DocAI
  - `processing_completed_at` - Timestamp de conclusão DocAI
  - `processing_duration_seconds` - Duração do processamento DocAI
  - `tier_id` - ID do tier do documento
  - `tier_name` - Nome do tier do documento
  - `chunk_level` - Nível de chunking

  ## 3. Enum Simplificado

  Recria `processo_status` com apenas 4 valores:
  - `created` - Processo criado, aguardando análise
  - `analyzing` - Análise em andamento (Gemini)
  - `completed` - Análise concluída
  - `error` - Erro durante análise

  ## 4. Segurança

  - Mantém RLS nas tabelas existentes
  - Novas tabelas terão RLS configuradas na próxima migration
*/

-- =====================================================
-- STEP 1: DROP TABELAS OBSOLETAS
-- =====================================================

DROP TABLE IF EXISTS forensic_analysis_steps CASCADE;
DROP TABLE IF EXISTS analise_forense CASCADE;
DROP TABLE IF EXISTS forensic_prompts CASCADE;
DROP TABLE IF EXISTS transcription_queue CASCADE;
DROP TABLE IF EXISTS admin_system_models CASCADE;

-- =====================================================
-- STEP 2: REMOVER COLUNAS OBSOLETAS DA TABELA PROCESSOS
-- =====================================================

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
  DROP COLUMN IF EXISTS chunk_level;

-- =====================================================
-- STEP 3: RECRIAR ENUM processo_status SIMPLIFICADO
-- =====================================================

-- Primeiro, alterar todas as linhas existentes para status compatível
UPDATE processos
SET status = CASE
  WHEN status IN ('transcribing', 'queuing', 'processing_batch', 'finalizing', 'processing_forensic') THEN 'analyzing'
  WHEN status = 'completed' THEN 'completed'
  WHEN status = 'error' THEN 'error'
  ELSE 'created'
END;

-- Dropar o enum antigo (requer remover a coluna temporariamente)
ALTER TABLE processos ALTER COLUMN status TYPE text;
DROP TYPE IF EXISTS processo_status CASCADE;

-- Criar novo enum simplificado
CREATE TYPE processo_status AS ENUM ('created', 'analyzing', 'completed', 'error');

-- Restaurar a coluna com o novo tipo
ALTER TABLE processos
  ALTER COLUMN status TYPE processo_status USING status::processo_status,
  ALTER COLUMN status SET DEFAULT 'created';

-- =====================================================
-- STEP 4: ADICIONAR NOVAS COLUNAS PARA GEMINI
-- =====================================================

-- Adicionar colunas simples para rastreamento de análise Gemini
ALTER TABLE processos
  ADD COLUMN IF NOT EXISTS analysis_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS analysis_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS current_prompt_number integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_prompts integer DEFAULT 9;

-- Criar índices para otimização
CREATE INDEX IF NOT EXISTS idx_processos_status_analysis ON processos(status, analysis_started_at);
CREATE INDEX IF NOT EXISTS idx_processos_user_status ON processos(user_id, status);

-- =====================================================
-- STEP 5: COMENTÁRIOS PARA DOCUMENTAÇÃO
-- =====================================================

COMMENT ON COLUMN processos.status IS 'Status simplificado: created (aguardando), analyzing (em análise), completed (finalizado), error (erro)';
COMMENT ON COLUMN processos.current_prompt_number IS 'Número do prompt atual sendo executado (1-9)';
COMMENT ON COLUMN processos.total_prompts IS 'Total de prompts a serem executados (padrão: 9)';
COMMENT ON COLUMN processos.analysis_started_at IS 'Timestamp de início da análise Gemini';
COMMENT ON COLUMN processos.analysis_completed_at IS 'Timestamp de conclusão da análise Gemini';
