/*
  # Corrigir trigger de criação de perfil - Conflito de CPF
  
  1. Problema
    - Quando um CPF duplicado é usado no signup, o trigger falha silenciosamente
    - O usuário é criado sem perfil, causando tela preta na aplicação
  
  2. Solução
    - Verificar se CPF já existe antes de inserir
    - Se CPF existe, inserir perfil com CPF = NULL
    - Usuário pode atualizar CPF único posteriormente no perfil
  
  3. Segurança
    - Mantém SECURITY DEFINER para bypass de RLS
    - Log detalhado de erros
*/

-- Recriar função com tratamento de CPF duplicado
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_cpf TEXT;
  v_cpf_exists BOOLEAN;
BEGIN
  -- Obter CPF dos metadados
  v_cpf := NEW.raw_user_meta_data->>'cpf';
  
  -- Verificar se CPF já existe (se fornecido)
  IF v_cpf IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM public.user_profiles WHERE cpf = v_cpf
    ) INTO v_cpf_exists;
    
    -- Se CPF já existe, usar NULL
    IF v_cpf_exists THEN
      RAISE WARNING 'CPF % já existe. Criando perfil sem CPF para usuário %', v_cpf, NEW.id;
      v_cpf := NULL;
    END IF;
  END IF;
  
  -- Inserir perfil
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
    v_cpf,
    NEW.raw_user_meta_data->>'oab',
    NEW.raw_user_meta_data->>'city',
    NEW.raw_user_meta_data->>'state',
    false,
    NEW.raw_user_meta_data->>'avatar_url'
  );
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Erro ao criar perfil para usuário %: %', NEW.id, SQLERRM;
    -- Tentar criar perfil mínimo sem campos opcionais
    BEGIN
      INSERT INTO public.user_profiles (id, email, first_name, last_name, is_admin)
      VALUES (NEW.id, NEW.email, 'Usuário', '', false);
      RAISE WARNING 'Perfil mínimo criado para usuário %', NEW.id;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Falha ao criar perfil mínimo para usuário %: %', NEW.id, SQLERRM;
    END;
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
  'Cria perfil de usuário automaticamente quando novo usuário é criado. Trata conflitos de CPF duplicado inserindo NULL.';
