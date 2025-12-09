/*
  # Corrigir Extração de Dados OAuth (Google e Microsoft)

  1. Problema
    - Cadastros via Google e Microsoft OAuth não estão extraindo nome e avatar
    - Função handle_new_user() busca apenas first_name/last_name/avatar_url
    - Provedores OAuth retornam dados em campos diferentes:
      - Google: 'name' ou 'full_name' + 'picture'
      - Microsoft: 'full_name' + 'picture'
    - Resultado: first_name, last_name e avatar_url ficam vazios

  2. Solução
    - Atualizar handle_new_user() para buscar dados de múltiplas fontes
    - Ordem de prioridade para nome:
      1. first_name + last_name (signup email/password)
      2. full_name (OAuth - divide em primeiro e último nome)
      3. name (OAuth - divide em primeiro e último nome)
      4. display_name (OAuth - divide em primeiro e último nome)
    - Ordem de prioridade para avatar:
      1. avatar_url (signup manual)
      2. picture (Google/Microsoft OAuth)
      3. avatar (alternativo)
    - Manter lógica de verificação de CPF duplicado
    - Manter exception handling e perfil mínimo de fallback

  3. Migração de Dados
    - Atualizar usuários existentes com campos vazios
    - Extrair dados de auth.users.raw_user_meta_data
    - Aplicar mesma lógica multi-provider

  4. Segurança
    - Mantém SECURITY DEFINER para bypass de RLS
    - Mantém SET search_path = public
    - Mantém tratamento de exceções
*/

-- Recriar função com extração OAuth multi-provider
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
  v_first_name TEXT;
  v_last_name TEXT;
  v_full_name TEXT;
  v_avatar_url TEXT;
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

  -- Extrair primeiro nome e sobrenome
  -- Tentar obter de campos separados primeiro (signup email/password)
  v_first_name := NEW.raw_user_meta_data->>'first_name';
  v_last_name := NEW.raw_user_meta_data->>'last_name';

  -- Se não encontrado, tentar extrair de full_name (OAuth)
  IF (v_first_name IS NULL OR v_first_name = '') AND (v_last_name IS NULL OR v_last_name = '') THEN
    -- Tentar múltiplas fontes de nome completo
    v_full_name := COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'display_name',
      ''
    );

    -- Se temos um nome completo, dividir inteligentemente
    IF v_full_name IS NOT NULL AND v_full_name != '' THEN
      -- Remover espaços extras e trimmar
      v_full_name := TRIM(regexp_replace(v_full_name, '\s+', ' ', 'g'));

      -- Verificar se há múltiplas palavras
      IF position(' ' IN v_full_name) > 0 THEN
        -- Primeira palavra = primeiro nome, resto = sobrenome
        v_first_name := split_part(v_full_name, ' ', 1);
        v_last_name := TRIM(substring(v_full_name from position(' ' in v_full_name) + 1));
      ELSE
        -- Uma palavra apenas: usar como primeiro nome
        v_first_name := v_full_name;
        v_last_name := '';
      END IF;
    ELSE
      -- Nenhum nome encontrado, usar strings vazias
      v_first_name := '';
      v_last_name := '';
    END IF;
  END IF;

  -- Extrair avatar URL de múltiplas fontes
  v_avatar_url := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture',
    NEW.raw_user_meta_data->>'avatar',
    NULL
  );

  -- Inserir perfil com dados extraídos
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
    COALESCE(v_first_name, ''),
    COALESCE(v_last_name, ''),
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'phone_country_code', '+55'),
    v_cpf,
    NEW.raw_user_meta_data->>'oab',
    NEW.raw_user_meta_data->>'city',
    NEW.raw_user_meta_data->>'state',
    false,
    v_avatar_url
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
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, authenticated, anon, service_role;

-- Comentário atualizado
COMMENT ON FUNCTION public.handle_new_user() IS
  'Cria perfil de usuário automaticamente quando novo usuário é criado. Extrai dados de múltiplas fontes OAuth (Google, Microsoft). Trata conflitos de CPF duplicado.';

/*
  # Migração de Dados - Corrigir Usuários OAuth Existentes

  Atualiza perfis existentes que têm campos vazios,
  extraindo dados de auth.users.raw_user_meta_data
*/

DO $$
DECLARE
  v_user_record RECORD;
  v_full_name TEXT;
  v_first_name TEXT;
  v_last_name TEXT;
  v_avatar_url TEXT;
  v_updated_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Iniciando migração de dados OAuth...';

  -- Buscar todos os perfis com nome ou avatar vazio
  FOR v_user_record IN
    SELECT
      up.id,
      up.first_name,
      up.last_name,
      up.avatar_url,
      au.raw_user_meta_data
    FROM public.user_profiles up
    INNER JOIN auth.users au ON up.id = au.id
    WHERE
      (up.first_name IS NULL OR up.first_name = '' OR up.first_name = 'EMPTY')
      OR (up.last_name IS NULL OR up.last_name = '' OR up.last_name = 'EMPTY')
      OR up.avatar_url IS NULL
  LOOP
    -- Tentar obter first_name e last_name diretamente
    v_first_name := v_user_record.raw_user_meta_data->>'first_name';
    v_last_name := v_user_record.raw_user_meta_data->>'last_name';

    -- Se não encontrado, tentar extrair de full_name
    IF (v_first_name IS NULL OR v_first_name = '') AND (v_last_name IS NULL OR v_last_name = '') THEN
      v_full_name := COALESCE(
        v_user_record.raw_user_meta_data->>'full_name',
        v_user_record.raw_user_meta_data->>'name',
        v_user_record.raw_user_meta_data->>'display_name',
        ''
      );

      IF v_full_name IS NOT NULL AND v_full_name != '' THEN
        -- Remover espaços extras
        v_full_name := TRIM(regexp_replace(v_full_name, '\s+', ' ', 'g'));

        -- Dividir nome
        IF position(' ' IN v_full_name) > 0 THEN
          v_first_name := split_part(v_full_name, ' ', 1);
          v_last_name := TRIM(substring(v_full_name from position(' ' in v_full_name) + 1));
        ELSE
          v_first_name := v_full_name;
          v_last_name := '';
        END IF;
      ELSE
        v_first_name := v_user_record.first_name; -- manter existente
        v_last_name := v_user_record.last_name; -- manter existente
      END IF;
    END IF;

    -- Extrair avatar se estiver vazio
    IF v_user_record.avatar_url IS NULL THEN
      v_avatar_url := COALESCE(
        v_user_record.raw_user_meta_data->>'avatar_url',
        v_user_record.raw_user_meta_data->>'picture',
        v_user_record.raw_user_meta_data->>'avatar'
      );
    ELSE
      v_avatar_url := v_user_record.avatar_url; -- manter existente
    END IF;

    -- Atualizar perfil
    UPDATE public.user_profiles
    SET
      first_name = COALESCE(v_first_name, first_name, ''),
      last_name = COALESCE(v_last_name, last_name, ''),
      avatar_url = COALESCE(v_avatar_url, avatar_url),
      updated_at = now()
    WHERE id = v_user_record.id;

    v_updated_count := v_updated_count + 1;

    RAISE NOTICE 'Atualizado usuário %: nome=% %, avatar=%',
      v_user_record.id,
      COALESCE(v_first_name, '(vazio)'),
      COALESCE(v_last_name, '(vazio)'),
      CASE WHEN v_avatar_url IS NOT NULL THEN 'sim' ELSE 'não' END;
  END LOOP;

  RAISE NOTICE 'Migração concluída: % perfis atualizados', v_updated_count;
END $$;