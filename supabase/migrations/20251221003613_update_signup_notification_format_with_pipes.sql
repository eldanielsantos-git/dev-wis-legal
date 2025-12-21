/*
  # Atualizar Formato de Notificação de Signup para Pipes
  
  ## Objetivo
  Modificar o trigger de notificação de signup para enviar mensagem no formato:
  "Novo usuário | Nome | Email | Type"
  
  Isso garante:
  1. Preview mobile otimizado (texto curto e informativo)
  2. Consistência com notificação de análise concluída
  3. Melhor experiência em push notifications
  
  ## Formato Anterior
  - message: "Novo usuário cadastrado: Daniel Santos"
  - metadata: { email, first_name, last_name, type, city, state, created_at }
  
  ## Novo Formato
  - message: "Daniel Santos | daniel@example.com | PF"
  - metadata mantém todos os dados detalhados
  
  ## Preview Mobile Esperado
  ✅ Novo Usuário | Daniel Santos | daniel@example.com | PF
*/

CREATE OR REPLACE FUNCTION notify_slack_on_user_signup()
RETURNS TRIGGER AS $$
DECLARE
  v_supabase_url TEXT;
  v_service_key TEXT;
  v_payload JSONB;
  v_user_name TEXT;
  v_user_email TEXT;
  v_user_type TEXT;
  v_message TEXT;
BEGIN
  -- Usar configurações hardcoded do projeto Supabase
  v_supabase_url := 'https://rslpleprodloodfsaext.supabase.co';
  v_service_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzbHBsZXByb2Rsb29kZnNhZXh0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDI0MjM1NSwiZXhwIjoyMDc5ODE4MzU1fQ.kXjZIGa1SxitKo6axtg5kc4xI8mek3cP5d9LpaLuhHg';
  
  -- Construir nome do usuário
  v_user_name := TRIM(COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, ''));
  IF v_user_name = '' OR v_user_name IS NULL THEN
    v_user_name := 'Usuário sem nome';
  END IF;
  
  -- Email do usuário
  v_user_email := COALESCE(NEW.email, 'N/A');
  
  -- Tipo do usuário (PF ou PJ)
  v_user_type := COALESCE(NEW.type, 'PF');
  
  -- Montar mensagem no formato: Nome | Email | Type
  v_message := v_user_name || ' | ' || v_user_email || ' | ' || v_user_type;
  
  -- Preparar payload no formato correto para send-admin-notification
  v_payload := jsonb_build_object(
    'type_slug', 'user_signup',
    'title', 'Novo Usuário',
    'message', v_message,
    'severity', 'success',
    'user_id', NEW.id::text,
    'metadata', jsonb_build_object(
      'email', NEW.email,
      'first_name', NEW.first_name,
      'last_name', NEW.last_name,
      'type', NEW.type,
      'city', NEW.city,
      'state', NEW.state,
      'cpf', NEW.cpf,
      'cnpj', NEW.cnpj,
      'company_name', NEW.company_name,
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
    
    RAISE LOG '[notify_slack_on_user_signup] Notification dispatched: %', v_message;
  EXCEPTION WHEN OTHERS THEN
    -- Log error mas não falha a transação
    RAISE WARNING '[notify_slack_on_user_signup] Failed to send notification for user %: % - %', NEW.id, SQLSTATE, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION notify_slack_on_user_signup() IS 
'Envia notificação administrativa quando um novo usuário se cadastra.
Formato da mensagem: Nome | Email | Type
Preview mobile: ✅ Novo Usuário | Nome | Email | Type';
