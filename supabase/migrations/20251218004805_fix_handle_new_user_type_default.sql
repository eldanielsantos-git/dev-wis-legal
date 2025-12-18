/*
  # Corrigir função handle_new_user para garantir type NOT NULL

  1. Mudanças
    - Garantir que v_type sempre tenha valor 'PF' como padrão
    - Atualizar INSERT de fallback para incluir type com valor padrão
    - Prevenir erros de constraint violation

  2. Segurança
    - Garante que nenhum registro será criado com type NULL
    - Define 'PF' como padrão quando não fornecido nos metadados
    - Mantém compatibilidade com OAuth e cadastro manual
*/

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_cpf TEXT;
  v_cpf_exists BOOLEAN;
  v_first_name TEXT;
  v_last_name TEXT;
  v_full_name TEXT;
  v_avatar_url TEXT;
  v_type TEXT;
  v_company_name TEXT;
  v_cnpj TEXT;
BEGIN
  -- Obter tipo do usuário (PF ou PJ) com default 'PF'
  v_type := COALESCE(NEW.raw_user_meta_data->>'type', 'PF');
  
  -- Validar que type é 'PF' ou 'PJ'
  IF v_type NOT IN ('PF', 'PJ') THEN
    v_type := 'PF';
  END IF;
  
  -- Obter campos de PJ
  v_company_name := NEW.raw_user_meta_data->>'company_name';
  v_cnpj := NEW.raw_user_meta_data->>'cnpj';
  
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
  v_first_name := NEW.raw_user_meta_data->>'first_name';
  v_last_name := NEW.raw_user_meta_data->>'last_name';

  -- Se não encontrado, tentar extrair de full_name (OAuth)
  IF (v_first_name IS NULL OR v_first_name = '') AND (v_last_name IS NULL OR v_last_name = '') THEN
    v_full_name := COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'display_name',
      ''
    );

    IF v_full_name IS NOT NULL AND v_full_name != '' THEN
      v_full_name := TRIM(regexp_replace(v_full_name, '\s+', ' ', 'g'));

      IF position(' ' IN v_full_name) > 0 THEN
        v_first_name := split_part(v_full_name, ' ', 1);
        v_last_name := TRIM(substring(v_full_name from position(' ' in v_full_name) + 1));
      ELSE
        v_first_name := v_full_name;
        v_last_name := '';
      END IF;
    ELSE
      v_first_name := '';
      v_last_name := '';
    END IF;
  END IF;

  -- Extrair avatar URL
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
    type,
    first_name,
    last_name,
    company_name,
    phone,
    phone_country_code,
    cpf,
    cnpj,
    oab,
    city,
    state,
    is_admin,
    avatar_url
  )
  VALUES (
    NEW.id,
    NEW.email,
    v_type,
    COALESCE(v_first_name, ''),
    COALESCE(v_last_name, ''),
    v_company_name,
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'phone_country_code', '+55'),
    v_cpf,
    v_cnpj,
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
    -- Tentar criar perfil mínimo com type padrão
    BEGIN
      INSERT INTO public.user_profiles (id, email, type, first_name, last_name, is_admin)
      VALUES (NEW.id, NEW.email, 'PF', 'Usuário', '', false);
      RAISE WARNING 'Perfil mínimo criado para usuário %', NEW.id;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Falha ao criar perfil mínimo para usuário %: %', NEW.id, SQLERRM;
    END;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;