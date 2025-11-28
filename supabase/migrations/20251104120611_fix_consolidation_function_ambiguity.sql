/*
  # Correção: Ambiguidade na função trigger_consolidation_for_process

  Corrige erro de ambiguidade entre variáveis e colunas com mesmo nome.
*/

DROP FUNCTION IF EXISTS trigger_consolidation_for_process(UUID);

CREATE OR REPLACE FUNCTION trigger_consolidation_for_process(p_processo_id UUID)
RETURNS TABLE(
  prompt_title TEXT,
  chunks_found INTEGER,
  result_status TEXT,
  message TEXT
) AS $$
DECLARE
  v_prompt RECORD;
  v_chunk RECORD;
  v_combined_content TEXT;
  v_chunk_count INTEGER;
  v_pending_count INTEGER;
BEGIN
  -- Para cada prompt do processo
  FOR v_prompt IN
    SELECT DISTINCT
      ar.id as analysis_result_id,
      ar.prompt_id,
      ar.prompt_title,
      ar.execution_order
    FROM analysis_results ar
    WHERE ar.processo_id = p_processo_id
      AND ar.status IN ('pending', 'running')
    ORDER BY ar.execution_order
  LOOP
    -- Contar quantos chunks foram processados para este prompt
    SELECT COUNT(*) INTO v_chunk_count
    FROM processing_queue pq
    WHERE pq.processo_id = p_processo_id
      AND pq.prompt_id = v_prompt.prompt_id
      AND pq.status = 'completed'
      AND pq.result_data IS NOT NULL;

    -- Se não há chunks processados, pular
    IF v_chunk_count = 0 THEN
      RETURN QUERY SELECT
        v_prompt.prompt_title,
        0,
        'skipped'::TEXT,
        'Nenhum chunk processado'::TEXT;
      CONTINUE;
    END IF;

    -- Combinar conteúdo de todos os chunks
    v_combined_content := '';
    
    FOR v_chunk IN
      SELECT
        pc.chunk_index,
        pq.result_data
      FROM processing_queue pq
      JOIN process_chunks pc ON pq.chunk_id = pc.id
      WHERE pq.processo_id = p_processo_id
        AND pq.prompt_id = v_prompt.prompt_id
        AND pq.status = 'completed'
        AND pq.result_data IS NOT NULL
      ORDER BY pc.chunk_index
    LOOP
      v_combined_content := v_combined_content || 
        E'\n\n=== CHUNK ' || (v_chunk.chunk_index + 1) || E' ===\n\n' ||
        COALESCE((v_chunk.result_data->>'content')::TEXT, (v_chunk.result_data->>'text')::TEXT, v_chunk.result_data::TEXT);
    END LOOP;

    -- Atualizar analysis_results com conteúdo combinado
    UPDATE analysis_results
    SET
      result_content = v_combined_content,
      status = 'completed',
      completed_at = NOW(),
      execution_time_ms = 0
    WHERE id = v_prompt.analysis_result_id;

    -- Retornar resultado
    RETURN QUERY SELECT
      v_prompt.prompt_title,
      v_chunk_count,
      'consolidated'::TEXT,
      format('%s chunks combinados', v_chunk_count)::TEXT;

  END LOOP;

  -- Verificar se todos os prompts foram consolidados
  SELECT COUNT(*) INTO v_pending_count
  FROM analysis_results ar
  WHERE ar.processo_id = p_processo_id
    AND ar.status IN ('pending', 'running');

  -- Se não há mais prompts pendentes, marcar processo como completo
  IF v_pending_count = 0 THEN
    UPDATE processos
    SET
      status = 'completed',
      analysis_completed_at = NOW()
    WHERE id = p_processo_id;

    UPDATE complex_processing_status
    SET
      current_phase = 'completed',
      overall_progress_percent = 100,
      last_heartbeat = NOW()
    WHERE processo_id = p_processo_id;

    RETURN QUERY SELECT
      'PROCESSO COMPLETO'::TEXT,
      0,
      'completed'::TEXT,
      'Processo marcado como completo'::TEXT;
  END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;