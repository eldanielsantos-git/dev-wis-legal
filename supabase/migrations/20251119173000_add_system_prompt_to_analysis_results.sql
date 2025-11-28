/*
  # Adicionar System Prompt à Tabela analysis_results

  1. Alteração
    - Adiciona coluna `system_prompt` (TEXT) à tabela `analysis_results`
    - Esta coluna armazenará uma cópia do system_prompt do prompt original
    - Necessário para que as edge functions enviem o system_prompt ao Gemini

  2. Contexto
    - System prompts foram adicionados à tabela analysis_prompts (20251104140407)
    - Tentativa anterior de usar system_prompt foi revertida (20251104153130)
    - Agora implementamos corretamente copiando o valor para analysis_results

  3. Uso
    - start-analysis copiará system_prompt de analysis_prompts para analysis_results
    - process-next-prompt usará este valor como systemInstruction no Gemini
    - consolidation-worker também usará para manter consistência
*/

-- Adicionar coluna system_prompt à tabela analysis_results
ALTER TABLE analysis_results
ADD COLUMN IF NOT EXISTS system_prompt TEXT;

-- Comentário explicativo
COMMENT ON COLUMN analysis_results.system_prompt IS
'Cópia do system_prompt do analysis_prompt original. Enviado como systemInstruction para a LLM durante o processamento.';

-- Criar índice para análises que têm system_prompt
CREATE INDEX IF NOT EXISTS idx_analysis_results_has_system_prompt
ON analysis_results(processo_id)
WHERE system_prompt IS NOT NULL;