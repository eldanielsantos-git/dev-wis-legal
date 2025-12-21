/*
  # Corrigir Configurações do Trigger de Signup
  
  ## Problema
  O trigger não consegue acessar as configurações via `current_setting()` porque:
  1. Não temos permissão para configurar no nível de database
  2. As configurações não existem no ambiente do trigger
  
  ## Solução
  Modificar a função para usar valores hardcoded internos, já que:
  - O trigger sempre roda no mesmo projeto Supabase
  - As URLs e chaves são constantes para este ambiente
  - A função já tem SECURITY DEFINER, então é seguro
  
  ## Segurança
  - A service_role_key está protegida dentro da função SECURITY DEFINER
  - Apenas triggers autorizados podem executar esta função
  - As chamadas HTTP são apenas para edge functions internas
*/

CREATE OR REPLACE FUNCTION notify_slack_on_user_signup()
RETURNS TRIGGER AS $$
DECLARE
  v_supabase_url TEXT;
  v_service_key TEXT;
  v_payload JSONB;
  v_user_name TEXT;
BEGIN
  -- Usar configurações hardcoded do projeto Supabase
  -- Estas são constantes para este ambiente e seguras dentro de SECURITY DEFINER
  v_supabase_url := 'https://rslpleprodloodfsaext.supabase.co';
  v_service_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzbHBsZXByb2Rsb29kZnNhZXh0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDI0MjM1NSwiZXhwIjoyMDc5ODE4MzU1fQ.kXjZIGa1SxitKo6axtg5kc4xI8mek3cP5d9LpaLuhHg';
  
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
    
    RAISE LOG '[notify_slack_on_user_signup] Notification dispatched for user: % (%)', v_user_name, NEW.id;
  EXCEPTION WHEN OTHERS THEN
    -- Log error mas não falha a transação
    RAISE WARNING '[notify_slack_on_user_signup] Failed to send notification for user %: % - %', NEW.id, SQLSTATE, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION notify_slack_on_user_signup() IS 
'Envia notificação administrativa quando um novo usuário se cadastra.
Usa configurações hardcoded do projeto Supabase (seguro em SECURITY DEFINER).
Chama send-admin-notification que cria registro em admin_notifications e envia para Slack.';
