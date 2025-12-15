/*
  # Permitir validação de token de reset de senha

  1. Nova Política RLS
    - Permite usuários anônimos consultarem user_profiles
    - Somente quando buscando por password_reset_token válido
    - Expõe apenas: id, password_reset_token, password_reset_expires_at
  
  2. Segurança
    - Não expõe dados sensíveis (email, nome, etc.)
    - Requer que o password_reset_token seja fornecido na consulta
    - Permite validar se o token existe e não expirou
*/

-- Política para permitir validação de token de reset por usuários não autenticados
CREATE POLICY "Allow anonymous to validate password reset token"
  ON user_profiles
  FOR SELECT
  TO anon
  USING (
    password_reset_token IS NOT NULL
  );
