/*
  # Adicionar CPF ao trigger de criação de perfil de usuário
  
  1. Alterações
    - Atualizar função handle_new_user() para incluir campo cpf
    - CPF vem de raw_user_meta_data durante o signup
    - Mantém todas as outras funcionalidades existentes
  
  2. Segurança
    - Função usa SECURITY DEFINER para bypass de RLS (conforme versão anterior)
    - Sem alterações de segurança
*/

-- Recriar a função com campo CPF
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.user_profiles (
    id,
    email,
    first_name,
    last_name,
    phone,
    phone_country_code,
    cpf,
    oab,
    city,
    state,
    is_admin,
    avatar_url
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'phone_country_code', '+55'),
    NEW.raw_user_meta_data->>'cpf',
    NEW.raw_user_meta_data->>'oab',
    NEW.raw_user_meta_data->>'city',
    NEW.raw_user_meta_data->>'state',
    false,
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error creating user profile for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Recriar o trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, authenticated, anon, service_role;

-- Comentário
COMMENT ON FUNCTION public.handle_new_user() IS 
  'Cria perfil de usuário automaticamente quando novo usuário é criado. Inclui CPF, nome, telefone, OAB e outros dados do cadastro.';
