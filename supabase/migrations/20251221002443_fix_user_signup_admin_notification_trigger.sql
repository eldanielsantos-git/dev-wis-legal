/*
  # Corrigir Trigger de Notificação de Signup
  
  ## Problema Identificado
  O trigger `trigger_notify_slack_on_user_signup` está chamando o endpoint incorreto:
  - ❌ Chama: `/functions/v1/send-slack-notification` (não existe)
  - ✅ Deveria chamar: `/functions/v1/send-admin-notification`
  
  ## Solução
  Recriar a função `notify_slack_on_user_signup` para:
  1. Chamar o endpoint correto: `send-admin-notification`
  2. Usar o formato de payload correto: `{ type_slug, title, message, metadata, user_id }`
  3. Integrar com o sistema de admin_notifications
  
  ## Comportamento Esperado
  Quando um novo usuário se cadastra:
  1. Trigger dispara após INSERT em `user_profiles`
  2. Função chama `send-admin-notification` com type_slug='user_signup'
  3. Edge function cria registro em `admin_notifications`
  4. Edge function envia para Slack se configurado
  5. Admin vê a notificação no painel
*/

-- Recriar função de notificação com endpoint correto
CREATE OR REPLACE FUNCTION notify_slack_on_user_signup()
RETURNS TRIGGER AS $$
DECLARE
  v_supabase_url TEXT;
  v_service_key TEXT;
  v_payload JSONB;
  v_user_name TEXT;
BEGIN
  -- Obter configurações do ambiente
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  v_service_key := current_setting('app.settings.service_role_key', true);
  
  -- Se as configurações não estiverem disponíveis, retornar sem erro
  IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
    RAISE WARNING '[notify_slack_on_user_signup] Supabase URL not configured';
    RETURN NEW;
  END IF;
  
  IF v_service_key IS NULL OR v_service_key = '' THEN
    RAISE WARNING '[notify_slack_on_user_signup] Service key not configured';
    RETURN NEW;
  END IF;
  
  -- Construir nome do usuário
  v_user_name := TRIM(COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, ''));
  IF v_user_name = '' THEN
    v_user_name := COALESCE(NEW.email, 'Usuário sem nome');
  END IF;
  
  -- Preparar payload no formato correto para send-admin-notification
  v_payload := jsonb_build_object(
    'type_slug', 'user_signup',
    'title', 'Novo Usuário',
    'message', 'Novo usuário cadastrado: ' || v_user_name,
    'severity', 'success',
    'user_id', NEW.id::text,
    'metadata', jsonb_build_object(
      'email', NEW.email,
      'first_name', NEW.first_name,
      'last_name', NEW.last_name,
      'type', NEW.type,
      'city', NEW.city,
      'state', NEW.state,
      'created_at', NEW.created_at
    )
  );
  
  -- Enviar notificação de forma assíncrona usando pg_net
  BEGIN
    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/send-admin-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_key
      ),
      body := v_payload
    );
    
    RAISE LOG '[notify_slack_on_user_signup] Notification dispatched for user: %', NEW.id;
  EXCEPTION WHEN OTHERS THEN
    -- Log error mas não falha a transação
    RAISE WARNING '[notify_slack_on_user_signup] Failed to send notification: % - %', SQLSTATE, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Garantir que o trigger existe (caso tenha sido removido)
DROP TRIGGER IF EXISTS trigger_notify_slack_on_user_signup ON user_profiles;

CREATE TRIGGER trigger_notify_slack_on_user_signup
  AFTER INSERT ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION notify_slack_on_user_signup();

-- Adicionar comentários para documentação
COMMENT ON FUNCTION notify_slack_on_user_signup() IS 
'Envia notificação administrativa quando um novo usuário se cadastra.
Chama a edge function send-admin-notification que cria registro em admin_notifications e envia para Slack.';

COMMENT ON TRIGGER trigger_notify_slack_on_user_signup ON user_profiles IS
'Dispara notificação administrativa após criação de novo perfil de usuário';
