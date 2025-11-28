/*
  # Remover coluna max_tokens

  1. Alterações
    - Remove coluna `max_tokens` da tabela admin_system_models
    - LLM gerenciará automaticamente os limites de tokens
    - Não há necessidade de limitar manualmente

  2. Segurança
    - Mantém RLS policies existentes
    - Não afeta funcionamento dos modelos
*/

-- Remover constraint relacionado (se existir)
ALTER TABLE admin_system_models
DROP CONSTRAINT IF EXISTS admin_system_models_max_tokens_check;

-- Remover coluna max_tokens
ALTER TABLE admin_system_models
DROP COLUMN IF EXISTS max_tokens;
