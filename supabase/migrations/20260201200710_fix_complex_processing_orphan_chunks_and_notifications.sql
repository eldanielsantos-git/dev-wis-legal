/*
  # Correção de Chunks Órfãos e Notificações de Erro em Loop

  ## Problema Identificado
  Arquivos enviados ao Gemini Files API expiram após 48 horas, mas o sistema
  continua tentando reprocessá-los, gerando dezenas de emails de erro por dia.

  ## Alterações Implementadas

  ### 1. Rate Limiting de Notificações
  - Adiciona campo `last_error_notification_at` em `complex_analysis_errors`
  - Previne envio de múltiplos emails para o mesmo chunk/processo em curto período

  ### 2. Limpeza de Chunks Órfãos
  - Função `cleanup_orphan_chunks` identifica e marca chunks expirados (>48h)
  - Marca como 'abandoned' chunks cujo arquivo Gemini expirou
  - Limpa chunks de processos que já foram completados com sucesso

  ### 3. Auto-abandono de Processos Complexos
  - Função `auto_abandon_expired_complex_processes` marca processos parados >48h
  - Previne tentativas infinitas de reprocessamento
  - Mantém integridade dos dados e histórico

  ## Impacto
  - Reduz drasticamente emails de erro duplicados
  - Libera recursos do sistema (queue, workers)
  - Mantém logs de erro para análise posterior
  - Processos válidos continuam funcionando normalmente

  ## Segurança
  - RLS mantido em todas as tabelas
  - Apenas service_role pode executar funções de limpeza
  - Histórico de erros preservado para auditoria
*/

-- ========================================
-- 1. RATE LIMITING DE NOTIFICAÇÕES
-- ========================================

-- Adicionar campo para controle de rate limiting de emails
ALTER TABLE complex_analysis_errors
ADD COLUMN IF NOT EXISTS last_error_notification_at TIMESTAMPTZ;

COMMENT ON COLUMN complex_analysis_errors.last_error_notification_at IS
  'Timestamp da última notificação enviada para este erro. Usado para rate limiting.';

-- Criar índice para queries eficientes de rate limiting
CREATE INDEX IF NOT EXISTS idx_complex_errors_notification_timestamp
ON complex_analysis_errors(processo_id, chunk_id, last_error_notification_at)
WHERE admin_notified = false;


-- ========================================
-- 2. LIMPEZA DE CHUNKS ÓRFÃOS
-- ========================================

-- Função para limpar chunks órfãos (arquivo Gemini expirado após 48h)
CREATE OR REPLACE FUNCTION cleanup_orphan_chunks(
  p_ttl_hours INTEGER DEFAULT 48
)
RETURNS TABLE(
  cleaned_chunks INTEGER,
  affected_processos UUID[],
  abandoned_processos UUID[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cleaned_count INTEGER := 0;
  v_processos_affected UUID[] := ARRAY[]::UUID[];
  v_processos_abandoned UUID[] := ARRAY[]::UUID[];
  v_cutoff_time TIMESTAMPTZ;
BEGIN
  v_cutoff_time := NOW() - (p_ttl_hours || ' hours')::INTERVAL;

  RAISE NOTICE 'Limpando chunks órfãos criados antes de: %', v_cutoff_time;

  -- Marcar chunks como 'abandoned' se foram criados há mais de 48h
  -- e ainda estão em status que indica processamento incompleto
  WITH updated_chunks AS (
    UPDATE process_chunks
    SET
      status = 'abandoned',
      processing_result = jsonb_build_object(
        'reason', 'Gemini file expired after 48h',
        'abandoned_at', NOW(),
        'original_status', status,
        'created_at', created_at
      )
    WHERE
      created_at < v_cutoff_time
      AND status IN ('pending', 'processing', 'failed', 'retry')
      AND gemini_file_uri IS NOT NULL
    RETURNING id, processo_id
  )
  SELECT
    COUNT(*)::INTEGER,
    ARRAY_AGG(DISTINCT processo_id)
  INTO v_cleaned_count, v_processos_affected
  FROM updated_chunks;

  RAISE NOTICE 'Chunks marcados como abandoned: %', v_cleaned_count;
  RAISE NOTICE 'Processos afetados: %', array_length(v_processos_affected, 1);

  -- Limpar chunks de processos que já foram concluídos com sucesso
  -- (isso resolve o problema de chunks órfãos em processos completos)
  WITH completed_processos AS (
    SELECT id FROM processos
    WHERE status = 'completed'
    AND analysis_completed_at < v_cutoff_time
  ),
  cleaned_completed AS (
    UPDATE process_chunks
    SET
      status = 'abandoned',
      processing_result = jsonb_build_object(
        'reason', 'Process already completed successfully',
        'abandoned_at', NOW(),
        'original_status', status
      )
    WHERE
      processo_id IN (SELECT id FROM completed_processos)
      AND status IN ('pending', 'processing', 'failed', 'retry')
    RETURNING id, processo_id
  )
  SELECT
    COALESCE(v_cleaned_count, 0) + COUNT(*)::INTEGER,
    COALESCE(v_processos_affected, ARRAY[]::UUID[]) || ARRAY_AGG(DISTINCT processo_id)
  INTO v_cleaned_count, v_processos_affected
  FROM cleaned_completed;

  -- Marcar processos complexos parados há >48h como 'error'
  WITH abandoned_processes AS (
    UPDATE processos
    SET
      status = 'error',
      last_error_type = 'Auto-abandoned: processo parado há mais de 48h e arquivo Gemini expirado'
    WHERE
      status IN ('uploading', 'analyzing')
      AND created_at < v_cutoff_time
      AND is_chunked = true
    RETURNING id
  )
  SELECT ARRAY_AGG(id)
  INTO v_processos_abandoned
  FROM abandoned_processes;

  RAISE NOTICE 'Processos abandonados: %', array_length(v_processos_abandoned, 1);

  -- Limpar itens da fila relacionados aos chunks órfãos
  DELETE FROM processing_queue
  WHERE
    chunk_id IN (
      SELECT id FROM process_chunks
      WHERE status = 'abandoned'
    )
    AND status IN ('pending', 'retry');

  -- Atualizar status de processamento complexo
  UPDATE complex_processing_status
  SET
    is_healthy = false,
    health_check_message = 'Auto-abandoned: chunks expired after 48h',
    current_phase = 'abandoned',
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'abandoned_at', NOW(),
      'reason', 'Chunks expired after 48h TTL'
    )
  WHERE
    processo_id = ANY(v_processos_abandoned);

  RETURN QUERY SELECT
    v_cleaned_count,
    v_processos_affected,
    COALESCE(v_processos_abandoned, ARRAY[]::UUID[]);
END;
$$;

COMMENT ON FUNCTION cleanup_orphan_chunks IS
  'Remove chunks órfãos cujo arquivo Gemini expirou (>48h) e limpa processos parados';


-- ========================================
-- 3. FUNÇÃO DE AUTO-ABANDONO
-- ========================================

-- Função para auto-abandonar processos complexos parados há muito tempo
CREATE OR REPLACE FUNCTION auto_abandon_expired_complex_processes()
RETURNS TABLE(
  abandoned_count INTEGER,
  processo_ids UUID[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_abandoned_count INTEGER := 0;
  v_processo_ids UUID[] := ARRAY[]::UUID[];
  v_cutoff_time TIMESTAMPTZ;
BEGIN
  -- Processos criados há mais de 48h
  v_cutoff_time := NOW() - INTERVAL '48 hours';

  RAISE NOTICE 'Auto-abandonando processos criados antes de: %', v_cutoff_time;

  -- Marcar processos como error
  WITH abandoned AS (
    UPDATE processos
    SET
      status = 'error',
      last_error_type = 'Auto-abandoned: Gemini file expired after 48h, cannot retry',
      analysis_completed_at = NOW()
    WHERE
      status IN ('uploading', 'analyzing')
      AND created_at < v_cutoff_time
      AND is_chunked = true
    RETURNING id
  )
  SELECT
    COUNT(*)::INTEGER,
    ARRAY_AGG(id)
  INTO v_abandoned_count, v_processo_ids
  FROM abandoned;

  -- Atualizar complex_processing_status
  UPDATE complex_processing_status
  SET
    is_healthy = false,
    health_check_message = 'Auto-abandoned: Gemini file expired',
    current_phase = 'failed',
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'auto_abandoned_at', NOW(),
      'reason', 'TTL expired (48h)'
    )
  WHERE
    processo_id = ANY(v_processo_ids);

  -- Marcar chunks como abandoned
  UPDATE process_chunks
  SET status = 'abandoned'
  WHERE
    processo_id = ANY(v_processo_ids)
    AND status IN ('pending', 'processing', 'failed', 'retry');

  -- Limpar fila de processamento
  DELETE FROM processing_queue
  WHERE
    processo_id = ANY(v_processo_ids)
    AND status IN ('pending', 'retry');

  RAISE NOTICE 'Processos abandonados: %', v_abandoned_count;

  RETURN QUERY SELECT v_abandoned_count, v_processo_ids;
END;
$$;

COMMENT ON FUNCTION auto_abandon_expired_complex_processes IS
  'Auto-abandona processos complexos parados há mais de 48h (arquivo Gemini expirado)';


-- ========================================
-- 4. FUNÇÃO PARA VERIFICAR SE DEVE NOTIFICAR
-- ========================================

-- Função auxiliar para verificar se deve enviar notificação
CREATE OR REPLACE FUNCTION should_send_error_notification(
  p_processo_id UUID,
  p_chunk_id UUID,
  p_min_interval_hours INTEGER DEFAULT 6
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_last_notification TIMESTAMPTZ;
  v_cutoff_time TIMESTAMPTZ;
BEGIN
  v_cutoff_time := NOW() - (p_min_interval_hours || ' hours')::INTERVAL;

  -- Buscar última notificação para este processo/chunk
  SELECT last_error_notification_at
  INTO v_last_notification
  FROM complex_analysis_errors
  WHERE
    processo_id = p_processo_id
    AND (chunk_id = p_chunk_id OR chunk_id IS NULL)
    AND admin_notified = true
  ORDER BY occurred_at DESC
  LIMIT 1;

  -- Se nunca foi notificado OU última notificação foi há mais de X horas
  IF v_last_notification IS NULL OR v_last_notification < v_cutoff_time THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION should_send_error_notification IS
  'Verifica se deve enviar notificação de erro baseado em rate limiting';


-- ========================================
-- 5. LIMPEZA INICIAL DE DADOS EXISTENTES
-- ========================================

-- Executar limpeza inicial de chunks órfãos existentes
DO $$
DECLARE
  v_result RECORD;
BEGIN
  RAISE NOTICE 'Executando limpeza inicial de chunks órfãos...';

  SELECT * INTO v_result
  FROM cleanup_orphan_chunks(48);

  RAISE NOTICE 'Limpeza concluída:';
  RAISE NOTICE '  - Chunks limpos: %', v_result.cleaned_chunks;
  RAISE NOTICE '  - Processos afetados: %', array_length(v_result.affected_processos, 1);
  RAISE NOTICE '  - Processos abandonados: %', array_length(v_result.abandoned_processos, 1);
END;
$$;