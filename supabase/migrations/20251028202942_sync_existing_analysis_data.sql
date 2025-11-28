/*
  # Sincronizar dados existentes de análise para as colunas JSONB
  
  1. Objetivo
    - Migrar dados existentes de analysis_results para as novas colunas em processos
    - Tratar erros de parse JSON de forma segura
  
  2. Estratégia
    - Tentar fazer parse JSON
    - Se falhar, armazenar como texto no campo "raw"
*/

-- Função helper para parse seguro de JSON
CREATE OR REPLACE FUNCTION safe_parse_json(content text)
RETURNS jsonb AS $$
BEGIN
  -- Tentar remover markdown e fazer parse
  RETURN (
    regexp_replace(
      regexp_replace(content, '^```json\s*', ''),
      '\s*```$', ''
    )
  )::jsonb;
EXCEPTION WHEN OTHERS THEN
  -- Se falhar, retornar como objeto com campo raw
  RETURN jsonb_build_object('raw', content);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Sincronizar análise 1: Visão Geral do Processo
UPDATE processos p
SET visao_geral_processo = (
  SELECT safe_parse_json(ar.result_content)
  FROM analysis_results ar
  WHERE ar.processo_id = p.id 
    AND ar.status = 'completed' 
    AND ar.execution_order = 1
    AND ar.result_content IS NOT NULL
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1 FROM analysis_results ar
  WHERE ar.processo_id = p.id 
    AND ar.status = 'completed' 
    AND ar.execution_order = 1
    AND ar.result_content IS NOT NULL
);

-- Sincronizar análise 2: Resumo Estratégico
UPDATE processos p
SET resumo_estrategico = (
  SELECT safe_parse_json(ar.result_content)
  FROM analysis_results ar
  WHERE ar.processo_id = p.id 
    AND ar.status = 'completed' 
    AND ar.execution_order = 2
    AND ar.result_content IS NOT NULL
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1 FROM analysis_results ar
  WHERE ar.processo_id = p.id 
    AND ar.status = 'completed' 
    AND ar.execution_order = 2
    AND ar.result_content IS NOT NULL
);

-- Sincronizar análise 3: Comunicações e Prazos
UPDATE processos p
SET comunicacoes_prazos = (
  SELECT safe_parse_json(ar.result_content)
  FROM analysis_results ar
  WHERE ar.processo_id = p.id 
    AND ar.status = 'completed' 
    AND ar.execution_order = 3
    AND ar.result_content IS NOT NULL
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1 FROM analysis_results ar
  WHERE ar.processo_id = p.id 
    AND ar.status = 'completed' 
    AND ar.execution_order = 3
    AND ar.result_content IS NOT NULL
);

-- Sincronizar análise 4: Admissibilidade Recursal
UPDATE processos p
SET admissibilidade_recursal = (
  SELECT safe_parse_json(ar.result_content)
  FROM analysis_results ar
  WHERE ar.processo_id = p.id 
    AND ar.status = 'completed' 
    AND ar.execution_order = 4
    AND ar.result_content IS NOT NULL
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1 FROM analysis_results ar
  WHERE ar.processo_id = p.id 
    AND ar.status = 'completed' 
    AND ar.execution_order = 4
    AND ar.result_content IS NOT NULL
);

-- Sincronizar análise 5: Estratégias Jurídicas
UPDATE processos p
SET estrategias_juridicas = (
  SELECT safe_parse_json(ar.result_content)
  FROM analysis_results ar
  WHERE ar.processo_id = p.id 
    AND ar.status = 'completed' 
    AND ar.execution_order = 5
    AND ar.result_content IS NOT NULL
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1 FROM analysis_results ar
  WHERE ar.processo_id = p.id 
    AND ar.status = 'completed' 
    AND ar.execution_order = 5
    AND ar.result_content IS NOT NULL
);

-- Sincronizar análise 6: Riscos e Alertas
UPDATE processos p
SET riscos_alertas = (
  SELECT safe_parse_json(ar.result_content)
  FROM analysis_results ar
  WHERE ar.processo_id = p.id 
    AND ar.status = 'completed' 
    AND ar.execution_order = 6
    AND ar.result_content IS NOT NULL
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1 FROM analysis_results ar
  WHERE ar.processo_id = p.id 
    AND ar.status = 'completed' 
    AND ar.execution_order = 6
    AND ar.result_content IS NOT NULL
);

-- Sincronizar análise 7: Balanço Financeiro
UPDATE processos p
SET balanco_financeiro = (
  SELECT safe_parse_json(ar.result_content)
  FROM analysis_results ar
  WHERE ar.processo_id = p.id 
    AND ar.status = 'completed' 
    AND ar.execution_order = 7
    AND ar.result_content IS NOT NULL
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1 FROM analysis_results ar
  WHERE ar.processo_id = p.id 
    AND ar.status = 'completed' 
    AND ar.execution_order = 7
    AND ar.result_content IS NOT NULL
);

-- Sincronizar análise 8: Mapa de Preclusões
UPDATE processos p
SET mapa_preclusoes = (
  SELECT safe_parse_json(ar.result_content)
  FROM analysis_results ar
  WHERE ar.processo_id = p.id 
    AND ar.status = 'completed' 
    AND ar.execution_order = 8
    AND ar.result_content IS NOT NULL
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1 FROM analysis_results ar
  WHERE ar.processo_id = p.id 
    AND ar.status = 'completed' 
    AND ar.execution_order = 8
    AND ar.result_content IS NOT NULL
);

-- Sincronizar análise 9: Conclusões e Perspectivas
UPDATE processos p
SET conclusoes_perspectivas = (
  SELECT safe_parse_json(ar.result_content)
  FROM analysis_results ar
  WHERE ar.processo_id = p.id 
    AND ar.status = 'completed' 
    AND ar.execution_order = 9
    AND ar.result_content IS NOT NULL
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1 FROM analysis_results ar
  WHERE ar.processo_id = p.id 
    AND ar.status = 'completed' 
    AND ar.execution_order = 9
    AND ar.result_content IS NOT NULL
);
