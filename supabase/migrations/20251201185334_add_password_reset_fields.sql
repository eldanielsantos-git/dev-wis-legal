/*
  # Adicionar campos para reset de senha

  1. Alterações
    - Adiciona `password_reset_token` para armazenar token único
    - Adiciona `password_reset_expires_at` para controlar expiração

  2. Segurança
    - Campos nullable para não quebrar registros existentes
    - Token expira em 1 hora
*/

-- Adicionar campos para reset de senha
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS password_reset_token TEXT,
ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMPTZ;

-- Criar índice para busca rápida por token
CREATE INDEX IF NOT EXISTS idx_user_profiles_password_reset_token
ON user_profiles(password_reset_token)
WHERE password_reset_token IS NOT NULL;
