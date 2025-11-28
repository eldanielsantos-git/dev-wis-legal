/*
  # Transformar usage_context em array

  1. Alterações
    - Converte `usage_context` de TEXT para TEXT[] (array)
    - Permite que um modelo seja usado em múltiplos contextos
    - Exemplo: ['file_processing', 'chat'] para usar o mesmo modelo em ambos

  2. Migração de Dados
    - Converte valores existentes em arrays de 1 elemento
    - Exemplo: 'file_processing' → ['file_processing']

  3. Segurança
    - Mantém RLS policies existentes
*/

-- Criar coluna temporária do tipo array
ALTER TABLE admin_system_models
ADD COLUMN usage_contexts TEXT[];

-- Migrar dados existentes: converter texto em array de 1 elemento
UPDATE admin_system_models
SET usage_contexts = ARRAY[usage_context]
WHERE usage_context IS NOT NULL;

-- Remover coluna antiga
ALTER TABLE admin_system_models
DROP COLUMN usage_context;

-- Renomear nova coluna
ALTER TABLE admin_system_models
RENAME COLUMN usage_contexts TO usage_context;

-- Adicionar constraint para valores válidos
ALTER TABLE admin_system_models
ADD CONSTRAINT valid_usage_contexts CHECK (
  usage_context IS NULL OR 
  (
    usage_context <@ ARRAY['file_processing', 'chat', 'consolidation', 'audio']::TEXT[] AND
    array_length(usage_context, 1) > 0
  )
);

-- Criar índice GIN para busca eficiente em arrays
CREATE INDEX IF NOT EXISTS idx_admin_system_models_usage_context
ON admin_system_models USING GIN (usage_context);

-- Adicionar comentário
COMMENT ON COLUMN admin_system_models.usage_context IS
  'Array de contextos de uso. Ex: [''file_processing'', ''chat'']. Valores: file_processing, chat, consolidation, audio';
