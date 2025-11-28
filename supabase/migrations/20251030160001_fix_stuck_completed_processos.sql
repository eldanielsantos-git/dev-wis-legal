/*
  # Fix Stuck Completed Processos

  Esta migration corrige processos que estão com todos os prompts concluídos
  mas não foram marcados como 'completed' devido a falhas na edge function
  ou problemas de conexão.

  1. Identificação
    - Busca processos com status 'analyzing'
    - Verifica se todos os analysis_results estão com status 'completed'

  2. Correção
    - Atualiza o status para 'completed'
    - Define analysis_completed_at com a data do último prompt concluído
*/

-- Update processos that have all prompts completed but are still 'analyzing'
WITH processos_para_completar AS (
  SELECT
    p.id as processo_id,
    COUNT(ar.id) as total_prompts,
    COUNT(CASE WHEN ar.status = 'completed' THEN 1 END) as completed_prompts,
    MAX(ar.completed_at) as last_completed_at
  FROM processos p
  INNER JOIN analysis_results ar ON p.id = ar.processo_id
  WHERE p.status = 'analyzing'
  GROUP BY p.id
  HAVING COUNT(ar.id) > 0
    AND COUNT(ar.id) = COUNT(CASE WHEN ar.status = 'completed' THEN 1 END)
)
UPDATE processos
SET
  status = 'completed',
  analysis_completed_at = processos_para_completar.last_completed_at
FROM processos_para_completar
WHERE processos.id = processos_para_completar.processo_id;

-- Log the results
DO $$
DECLARE
  v_updated_count INT;
BEGIN
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE '✅ Corrigidos % processos que estavam travados com 100%% de conclusão', v_updated_count;
END $$;
