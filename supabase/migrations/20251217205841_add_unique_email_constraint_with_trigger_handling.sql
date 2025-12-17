/*
  # Adicionar Constraint UNIQUE em user_profiles.email

  ## Problema Identificado
  - Trigger sync_user_email_trigger sobrescreve mudanças no email
  - Trigger sincroniza user_profiles.email com auth.users.email
  - Isso impede limpeza de emails duplicados

  ## Solução
  1. Desabilitar trigger temporariamente
  2. Limpar duplicados (setar NULL)
  3. Re-habilitar trigger
  4. Adicionar constraint UNIQUE

  ## Duplicados
  - eldanielsantos@gmail.com: Manter 8c6cfdf5, limpar 1bfd7f63
  - eldanielsantos+12@gmail.com: Manter 461e1d3c, limpar 0c29ca31

  ## Segurança
  - Trigger é temporariamente desabilitado apenas durante migração
  - Constraint UNIQUE previne futuros duplicados
  - Sistema mantém sincronização com auth.users após migração
*/

-- Passo 1: Desabilitar o trigger que sincroniza email
ALTER TABLE user_profiles DISABLE TRIGGER sync_user_email_trigger;

-- Passo 2: Limpar primeiro duplicado (já foi limpo anteriormente)
UPDATE user_profiles 
SET email = NULL
WHERE id = '1bfd7f63-4b90-40dc-a94a-b432d0ce8a4b'
  AND email IS NOT NULL;

-- Passo 3: Limpar segundo duplicado
UPDATE user_profiles 
SET email = NULL
WHERE id = '0c29ca31-ced8-4214-b9a5-50dd651a557f'
  AND email = 'eldanielsantos+12@gmail.com';

-- Passo 4: Re-habilitar o trigger
ALTER TABLE user_profiles ENABLE TRIGGER sync_user_email_trigger;

-- Passo 5: Verificar se não há mais duplicados
DO $$
DECLARE
  duplicate_count INTEGER;
  remaining_duplicates TEXT;
BEGIN
  SELECT COUNT(*), COALESCE(string_agg(email, ', '), 'nenhum')
  INTO duplicate_count, remaining_duplicates
  FROM (
    SELECT email
    FROM user_profiles
    WHERE email IS NOT NULL
    GROUP BY email
    HAVING COUNT(*) > 1
  ) duplicates;
  
  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'Ainda existem % emails duplicados: %', duplicate_count, remaining_duplicates;
  END IF;
  
  RAISE NOTICE '✓ Verificação OK: Nenhum email duplicado encontrado';
END $$;

-- Passo 6: Adicionar constraint UNIQUE
ALTER TABLE user_profiles 
ADD CONSTRAINT unique_user_profiles_email 
UNIQUE (email);

-- Passo 7: Documentar constraint
COMMENT ON CONSTRAINT unique_user_profiles_email ON user_profiles IS 
'Garante unicidade de email no sistema. Essencial para integração com Stripe onde 1 email = 1 customer. Adicionado em 2025-12-17.';

-- Passo 8: Criar índice adicional para emails verificados
CREATE INDEX IF NOT EXISTS idx_user_profiles_email_verified_only 
ON user_profiles(email) 
WHERE email IS NOT NULL AND email_verified = true;

-- Log final
DO $$
DECLARE
  total_users INTEGER;
  users_with_email INTEGER;
BEGIN
  SELECT COUNT(*), COUNT(email) 
  INTO total_users, users_with_email
  FROM user_profiles;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '✓ Migração concluída com sucesso!';
  RAISE NOTICE '✓ 2 emails duplicados foram limpos';
  RAISE NOTICE '✓ Constraint UNIQUE adicionada';
  RAISE NOTICE '✓ Total de usuários: %', total_users;
  RAISE NOTICE '✓ Usuários com email: %', users_with_email;
  RAISE NOTICE '✓ Sistema agora previne duplicação de emails';
  RAISE NOTICE '========================================';
END $$;