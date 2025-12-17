/*
  # Adicionar Suporte para Cadastro de Pessoa Jurídica
  
  1. Mudanças
    - Adicionar coluna `type` para diferenciar Pessoa Física (PF) e Pessoa Jurídica (PJ)
    - Adicionar coluna `cnpj` para armazenar CNPJ de empresas
    - Adicionar coluna `company_name` para armazenar nome da empresa
    - Atualizar todos os registros existentes para tipo 'PF'
  
  2. Campos de Pessoa Jurídica
    - `type`: Tipo de cadastro ('PF' ou 'PJ')
    - `company_name`: Nome da empresa (obrigatório para PJ)
    - `cnpj`: CNPJ da empresa (obrigatório para PJ, formato: 09.031.011/0001-23)
  
  3. Campos mantidos para ambos os tipos
    - Email, senha (autenticação)
    - Nome e sobrenome do responsável
    - Telefone
    - OAB do responsável (opcional)
    - Seccional (estado)
    - Cidade
    - Avatar
  
  4. Segurança
    - Todos os campos mantêm as mesmas políticas RLS existentes
    - Validações de negócio serão feitas no frontend e serviços
*/

-- Adicionar coluna type com valor padrão 'PF'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'type'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN type TEXT NOT NULL DEFAULT 'PF';
    
    -- Adicionar constraint para garantir que type seja apenas 'PF' ou 'PJ'
    ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_type_check 
      CHECK (type IN ('PF', 'PJ'));
  END IF;
END $$;

-- Adicionar coluna company_name para pessoas jurídicas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'company_name'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN company_name TEXT;
  END IF;
END $$;

-- Adicionar coluna cnpj para pessoas jurídicas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'cnpj'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN cnpj TEXT;
  END IF;
END $$;

-- Atualizar todos os registros existentes para PF (caso já não estejam)
UPDATE user_profiles SET type = 'PF' WHERE type IS NULL OR type = '';

-- Criar índice para busca por tipo
CREATE INDEX IF NOT EXISTS idx_user_profiles_type ON user_profiles(type);

-- Comentários nas colunas para documentação
COMMENT ON COLUMN user_profiles.type IS 'Tipo de cadastro: PF (Pessoa Física) ou PJ (Pessoa Jurídica)';
COMMENT ON COLUMN user_profiles.company_name IS 'Nome da empresa (obrigatório para tipo PJ)';
COMMENT ON COLUMN user_profiles.cnpj IS 'CNPJ da empresa (obrigatório para tipo PJ)';
