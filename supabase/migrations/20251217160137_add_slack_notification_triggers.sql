/*
  # Triggers para Notificações Slack

  1. Nova Função
    - `notify_slack_on_user_signup` - Envia notificação ao Slack quando um novo usuário se cadastra

  2. Triggers
    - Trigger para executar a função após inserção na tabela `user_profiles`

  3. Observações
    - Usa pg_net extension para fazer requisições HTTP assíncronas
    - Busca apenas configurações ativas que incluem o tipo 'user_signup'
    - Envia notificações em background sem bloquear a transação
*/

-- Habilitar extensão pg_net se ainda não estiver habilitada
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Função para enviar notificação ao Slack quando um novo usuário se cadastra
CREATE OR REPLACE FUNCTION notify_slack_on_user_signup()
RETURNS TRIGGER AS $$
DECLARE
  webhook_config RECORD;
  payload JSON;
  supabase_url TEXT;
  service_key TEXT;
BEGIN
  -- Obter configurações do ambiente
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_key := current_setting('app.settings.service_role_key', true);
  
  -- Se as configurações não estiverem disponíveis, tentar valores padrão
  IF supabase_url IS NULL THEN
    supabase_url := 'https://your-project.supabase.co';
  END IF;
  
  -- Preparar payload com dados do usuário
  payload := json_build_object(
    'type', 'user_signup',
    'data', json_build_object(
      'first_name', NEW.first_name,
      'last_name', NEW.last_name,
      'email', NEW.email,
      'city', NEW.city,
      'state', NEW.state,
      'created_at', NEW.created_at
    )
  );
  
  -- Enviar notificação para cada webhook configurado de forma assíncrona
  FOR webhook_config IN 
    SELECT webhook_url 
    FROM slack_notifications 
    WHERE is_active = true 
    AND 'user_signup' = ANY(notification_types)
  LOOP
    BEGIN
      -- Fazer requisição HTTP assíncrona usando pg_net
      PERFORM net.http_post(
        url := supabase_url || '/functions/v1/send-slack-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || COALESCE(service_key, '')
        ),
        body := payload::jsonb
      );
    EXCEPTION WHEN OTHERS THEN
      -- Log error mas não falha a transação
      RAISE WARNING 'Failed to send Slack notification for user signup: %', SQLERRM;
    END;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para enviar notificação após inserção de novo usuário
DROP TRIGGER IF EXISTS trigger_notify_slack_on_user_signup ON user_profiles;
CREATE TRIGGER trigger_notify_slack_on_user_signup
  AFTER INSERT ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION notify_slack_on_user_signup();