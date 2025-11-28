/*
  # Limpeza de Marcadores JSON dos Resultados de Análise

  1. Objetivo
    - Remove marcadores ```json e ``` dos resultados de análise existentes
    - Garante que todo conteúdo JSON seja armazenado sem formatação markdown
    - Normaliza dados históricos para compatibilidade com AnalysisContentRenderer

  2. Operações
    - Atualiza todos os registros da tabela analysis_results
    - Remove ```json do início do conteúdo
    - Remove ``` do início e fim do conteúdo
    - Aplica trim para remover espaços extras

  3. Segurança
    - Operação idempotente (pode ser executada múltiplas vezes)
    - Não afeta conteúdo que já está limpo
    - Usa CASE para preservar dados que não têm marcadores
*/

-- Remove marcadores ```json e ``` de todos os resultados existentes
UPDATE analysis_results
SET result_content = TRIM(
  REGEXP_REPLACE(
    REGEXP_REPLACE(
      REGEXP_REPLACE(result_content, '^```json\n?', ''),
      '^```\n?', ''
    ),
    '\n?```$', ''
  )
)
WHERE 
  result_content IS NOT NULL 
  AND (
    result_content LIKE '```json%' 
    OR result_content LIKE '```%'
  );
