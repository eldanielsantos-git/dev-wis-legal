/*
  # Adicionar colunas de análise à tabela processos
  
  1. Novas Colunas
    - `visao_geral_processo` (jsonb): Resultado da análise "Visão Geral do Processo"
    - `resumo_estrategico` (jsonb): Resultado da análise "Resumo Estratégico"
    - `comunicacoes_prazos` (jsonb): Resultado da análise "Comunicações e Prazos"
    - `admissibilidade_recursal` (jsonb): Resultado da análise "Admissibilidade Recursal"
    - `estrategias_juridicas` (jsonb): Resultado da análise "Estratégias Jurídicas Recomendadas"
    - `riscos_alertas` (jsonb): Resultado da análise "Riscos e Alertas Processuais"
    - `balanco_financeiro` (jsonb): Resultado da análise "Balanço Financeiro e Créditos Processuais"
    - `mapa_preclusoes` (jsonb): Resultado da análise "Mapa de Preclusões Processuais"
    - `conclusoes_perspectivas` (jsonb): Resultado da análise "Conclusões e Perspectivas Processuais"
  
  2. Índices
    - Adicionar índices GIN para busca eficiente nos campos JSONB
  
  3. Função Trigger
    - Criar função para atualizar automaticamente as colunas quando um analysis_result for inserido/atualizado
*/

-- Adicionar colunas para cada tipo de análise
ALTER TABLE processos 
ADD COLUMN IF NOT EXISTS visao_geral_processo jsonb,
ADD COLUMN IF NOT EXISTS resumo_estrategico jsonb,
ADD COLUMN IF NOT EXISTS comunicacoes_prazos jsonb,
ADD COLUMN IF NOT EXISTS admissibilidade_recursal jsonb,
ADD COLUMN IF NOT EXISTS estrategias_juridicas jsonb,
ADD COLUMN IF NOT EXISTS riscos_alertas jsonb,
ADD COLUMN IF NOT EXISTS balanco_financeiro jsonb,
ADD COLUMN IF NOT EXISTS mapa_preclusoes jsonb,
ADD COLUMN IF NOT EXISTS conclusoes_perspectivas jsonb;

-- Criar índices GIN para busca eficiente
CREATE INDEX IF NOT EXISTS idx_processos_visao_geral ON processos USING GIN (visao_geral_processo);
CREATE INDEX IF NOT EXISTS idx_processos_resumo_estrategico ON processos USING GIN (resumo_estrategico);
CREATE INDEX IF NOT EXISTS idx_processos_comunicacoes_prazos ON processos USING GIN (comunicacoes_prazos);
CREATE INDEX IF NOT EXISTS idx_processos_admissibilidade_recursal ON processos USING GIN (admissibilidade_recursal);
CREATE INDEX IF NOT EXISTS idx_processos_estrategias_juridicas ON processos USING GIN (estrategias_juridicas);
CREATE INDEX IF NOT EXISTS idx_processos_riscos_alertas ON processos USING GIN (riscos_alertas);
CREATE INDEX IF NOT EXISTS idx_processos_balanco_financeiro ON processos USING GIN (balanco_financeiro);
CREATE INDEX IF NOT EXISTS idx_processos_mapa_preclusoes ON processos USING GIN (mapa_preclusoes);
CREATE INDEX IF NOT EXISTS idx_processos_conclusoes_perspectivas ON processos USING GIN (conclusoes_perspectivas);

-- Função para atualizar as colunas de análise automaticamente
CREATE OR REPLACE FUNCTION sync_analysis_to_processo_columns()
RETURNS TRIGGER AS $$
DECLARE
  parsed_content jsonb;
  column_to_update text;
BEGIN
  -- Apenas processar se o status for 'completed' e houver conteúdo
  IF NEW.status != 'completed' OR NEW.result_content IS NULL THEN
    RETURN NEW;
  END IF;

  -- Tentar fazer parse do result_content para JSONB
  BEGIN
    -- Remover markdown code blocks se existirem
    parsed_content := (
      regexp_replace(
        regexp_replace(NEW.result_content, '^```json\s*', ''),
        '\s*```$', ''
      )
    )::jsonb;
  EXCEPTION WHEN OTHERS THEN
    -- Se falhar o parse, armazenar como objeto com campo "raw"
    parsed_content := jsonb_build_object('raw', NEW.result_content);
  END;

  -- Determinar qual coluna atualizar baseado no título ou ordem
  column_to_update := NULL;
  
  IF NEW.prompt_title ILIKE '%Visão Geral do Processo%' OR NEW.execution_order = 1 THEN
    column_to_update := 'visao_geral_processo';
  ELSIF NEW.prompt_title ILIKE '%Resumo Estratégico%' OR NEW.execution_order = 2 THEN
    column_to_update := 'resumo_estrategico';
  ELSIF NEW.prompt_title ILIKE '%Comunicações e Prazos%' OR NEW.execution_order = 3 THEN
    column_to_update := 'comunicacoes_prazos';
  ELSIF NEW.prompt_title ILIKE '%Admissibilidade Recursal%' OR NEW.execution_order = 4 THEN
    column_to_update := 'admissibilidade_recursal';
  ELSIF NEW.prompt_title ILIKE '%Estratégias Jurídicas%' OR NEW.execution_order = 5 THEN
    column_to_update := 'estrategias_juridicas';
  ELSIF NEW.prompt_title ILIKE '%Riscos e Alertas%' OR NEW.execution_order = 6 THEN
    column_to_update := 'riscos_alertas';
  ELSIF NEW.prompt_title ILIKE '%Balanço Financeiro%' OR NEW.prompt_title ILIKE '%Créditos Processuais%' OR NEW.execution_order = 7 THEN
    column_to_update := 'balanco_financeiro';
  ELSIF NEW.prompt_title ILIKE '%Mapa de Preclusões%' OR NEW.execution_order = 8 THEN
    column_to_update := 'mapa_preclusoes';
  ELSIF NEW.prompt_title ILIKE '%Conclusões%' OR NEW.prompt_title ILIKE '%Perspectivas%' OR NEW.execution_order = 9 THEN
    column_to_update := 'conclusoes_perspectivas';
  END IF;

  -- Executar update usando SQL dinâmico
  IF column_to_update IS NOT NULL THEN
    EXECUTE format('UPDATE processos SET %I = $1 WHERE id = $2', column_to_update)
    USING parsed_content, NEW.processo_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger para atualizar automaticamente
DROP TRIGGER IF EXISTS trigger_sync_analysis_to_processo ON analysis_results;
CREATE TRIGGER trigger_sync_analysis_to_processo
  AFTER INSERT OR UPDATE OF result_content, status
  ON analysis_results
  FOR EACH ROW
  EXECUTE FUNCTION sync_analysis_to_processo_columns();
