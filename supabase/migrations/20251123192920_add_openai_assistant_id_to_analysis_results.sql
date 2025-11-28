/*
  # Adicionar coluna openai_assistant_id em analysis_results

  1. Alterações
    - Adiciona coluna `openai_assistant_id` TEXT para armazenar ID do Assistant OpenAI específico
    - Permite que cada análise tenha seu próprio Assistant especializado
    - Sistema de 9 Assistants: um para cada tipo de análise

  2. Benefícios
    - Especialização: cada Assistant tem system prompt otimizado
    - Isolamento: falha em um Assistant não afeta outros
    - Flexibilidade: temperaturas diferentes por análise no futuro

  3. Segurança
    - Mantém RLS policies existentes
*/

-- Adicionar coluna openai_assistant_id
ALTER TABLE analysis_results
ADD COLUMN IF NOT EXISTS openai_assistant_id TEXT;

-- Criar índice para busca rápida por assistant_id
CREATE INDEX IF NOT EXISTS idx_analysis_results_openai_assistant_id
ON analysis_results(openai_assistant_id)
WHERE openai_assistant_id IS NOT NULL;

-- Adicionar comentário
COMMENT ON COLUMN analysis_results.openai_assistant_id IS
  'ID do Assistant OpenAI específico desta análise. Cada prompt tem seu Assistant especializado.';
