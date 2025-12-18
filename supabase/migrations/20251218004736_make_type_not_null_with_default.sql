/*
  # Tornar campo type obrigatório com valor padrão

  1. Alterações na tabela user_profiles
    - Adicionar valor padrão 'PF' ao campo type
    - Tornar o campo type NOT NULL
    - Atualizar qualquer registro com type NULL para 'PF' (já existem 0)

  2. Segurança
    - Garante que nenhum registro terá type NULL
    - Define 'PF' como padrão para novos registros
    - O CHECK constraint existente já valida apenas 'PF' ou 'PJ'

  ## Notas importantes:
  - O CHECK constraint já existe validando ('PF', 'PJ')
  - Esta migration adiciona NOT NULL e DEFAULT
  - 'PF' é o valor padrão por ser mais comum
*/

-- Primeiro, garantir que não há registros com type NULL (já verificado: 0)
UPDATE user_profiles
SET type = 'PF'
WHERE type IS NULL;

-- Adicionar valor padrão 'PF' ao campo type
ALTER TABLE user_profiles
ALTER COLUMN type SET DEFAULT 'PF';

-- Tornar o campo type NOT NULL
ALTER TABLE user_profiles
ALTER COLUMN type SET NOT NULL;

-- Criar índice para melhorar performance (se não existir)
CREATE INDEX IF NOT EXISTS idx_user_profiles_type ON user_profiles(type);