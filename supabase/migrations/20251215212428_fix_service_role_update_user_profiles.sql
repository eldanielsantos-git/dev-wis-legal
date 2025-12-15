/*
  # Adicionar política para service_role atualizar user_profiles

  1. Changes
    - Adicionar política para permitir service_role fazer UPDATE em user_profiles
    - Necessário para edge functions de reset de senha e atualização de senha por admin
  
  2. Security
    - Apenas service_role pode usar esta política
    - Permite atualização de todos os campos incluindo password_reset_token e password_reset_expires_at
*/

-- Política para service_role fazer UPDATE em user_profiles
CREATE POLICY "Service role can update user profiles"
  ON user_profiles FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);
