/*
  # Limpeza Abrangente de Marcadores JSON dos Resultados de Análise

  1. Objetivo
    - Remove marcadores ```json e ``` de TODOS os resultados, independentemente da posição
    - Remove texto introdutório antes do JSON (ex: "Com certeza! Segue a análise...")
    - Garante que apenas o JSON puro seja armazenado
    - Normaliza dados para compatibilidade com AnalysisContentRenderer

  2. Operações
    - Remove todo o texto antes do primeiro marcador ```json ou ```
    - Remove marcadores ```json do conteúdo
    - Remove marcadores ``` do início e fim
    - Aplica trim para remover espaços extras

  3. Segurança
    - Operação idempotente (pode ser executada múltiplas vezes)
    - Não afeta conteúdo que já está limpo
    - Preserva JSON válido
*/

-- Remove texto introdutório e marcadores de TODOS os resultados
UPDATE analysis_results
SET result_content = TRIM(
  REGEXP_REPLACE(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        CASE 
          -- Se contém ```json, remove tudo antes dele
          WHEN result_content LIKE '%```json%' THEN 
            SUBSTRING(result_content FROM POSITION('```json' IN result_content))
          -- Se contém apenas ```, remove tudo antes dele
          WHEN result_content LIKE '%```%' THEN
            SUBSTRING(result_content FROM POSITION('```' IN result_content))
          ELSE result_content
        END,
        '^```json\n?', ''
      ),
      '^```\n?', ''
    ),
    '\n?```$', ''
  )
)
WHERE result_content IS NOT NULL;
