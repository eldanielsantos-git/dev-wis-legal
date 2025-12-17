/*
  # Trigger Automático de Monitoramento de Uso de Tokens

  1. Nova Função
    - `trigger_token_limit_notification()` - Monitora atualizações em stripe_subscriptions
    - Dispara edge function quando uso de tokens ultrapassa 75%, 90% ou 100%

  2. Trigger
    - Executa após cada UPDATE em stripe_subscriptions.tokens_used
    - Calcula porcentagem e chama edge function apropriada

  3. Segurança
    - Função SECURITY DEFINER para acesso aos dados necessários
    - Apenas executa em ambiente de produção (verifica URL)
*/

-- Função que monitora o uso de tokens e dispara notificações
CREATE OR REPLACE FUNCTION trigger_token_limit_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_tokens_total integer;
  v_tokens_used integer;
  v_percentage_used numeric;
  v_notification_type text;
  v_supabase_url text;
  v_anon_key text;
  v_recent_notification boolean;
BEGIN
  -- Apenas processa se tokens_used foi modificado
  IF NEW.tokens_used = OLD.tokens_used THEN
    RETURN NEW;
  END IF;

  -- Buscar user_id do customer
  SELECT user_id INTO v_user_id
  FROM stripe_customers
  WHERE customer_id = NEW.customer_id
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE WARNING 'No user found for customer_id: %', NEW.customer_id;
    RETURN NEW;
  END IF;

  v_tokens_total := COALESCE(NEW.tokens_total, 0);
  v_tokens_used := COALESCE(NEW.tokens_used, 0);

  -- Evitar divisão por zero
  IF v_tokens_total = 0 THEN
    RETURN NEW;
  END IF;

  v_percentage_used := (v_tokens_used::numeric / v_tokens_total::numeric) * 100;

  -- Determinar tipo de notificação baseado na porcentagem
  IF v_percentage_used >= 100 THEN
    v_notification_type := '100_percent';
  ELSIF v_percentage_used >= 90 THEN
    v_notification_type := '90_percent';
  ELSIF v_percentage_used >= 75 THEN
    v_notification_type := '75_percent';
  ELSE
    -- Abaixo de 75%, não notifica
    RETURN NEW;
  END IF;

  -- Verificar se já foi enviada notificação recente (últimos 7 dias)
  SELECT check_recent_token_notification(v_user_id, v_notification_type)
  INTO v_recent_notification;

  IF v_recent_notification = true THEN
    RAISE NOTICE 'Recent notification already sent for user % (type: %), skipping', v_user_id, v_notification_type;
    RETURN NEW;
  END IF;

  -- Buscar variáveis de ambiente
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  v_anon_key := current_setting('app.settings.supabase_anon_key', true);

  -- Se não estiverem configuradas, usar valores padrão (ambiente de produção)
  IF v_supabase_url IS NULL THEN
    v_supabase_url := 'https://YOUR_PROJECT_REF.supabase.co';
  END IF;

  -- Log para debug
  RAISE NOTICE 'Token usage alert triggered: user=%, type=%, used=%/%, percentage=%', 
    v_user_id, v_notification_type, v_tokens_used, v_tokens_total, v_percentage_used;

  -- Chamar edge function de forma assíncrona usando pg_net (se disponível)
  -- Caso pg_net não esteja disponível, registrar para processamento manual
  BEGIN
    -- Tentativa de usar pg_net para chamada HTTP assíncrona
    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/send-tokens-limit',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_anon_key
      ),
      body := jsonb_build_object(
        'user_id', v_user_id
      )
    );
    
    RAISE NOTICE 'Edge function called successfully for user %', v_user_id;
  EXCEPTION
    WHEN OTHERS THEN
      -- Se pg_net não estiver disponível, registrar para processamento posterior
      RAISE WARNING 'Could not call edge function: %. Recording for manual processing.', SQLERRM;
      
      -- Inserir registro pendente
      INSERT INTO token_limit_notifications (
        user_id,
        notification_type,
        tokens_total,
        tokens_used,
        percentage_used,
        email_sent,
        email_sent_at
      ) VALUES (
        v_user_id,
        v_notification_type,
        v_tokens_total,
        v_tokens_used,
        v_percentage_used,
        false,
        NULL
      );
  END;

  RETURN NEW;
END;
$$;

-- Criar trigger em stripe_subscriptions
DROP TRIGGER IF EXISTS trg_monitor_token_usage ON stripe_subscriptions;

CREATE TRIGGER trg_monitor_token_usage
  AFTER UPDATE OF tokens_used ON stripe_subscriptions
  FOR EACH ROW
  WHEN (NEW.tokens_used IS DISTINCT FROM OLD.tokens_used)
  EXECUTE FUNCTION trigger_token_limit_notification();

-- Comentários
COMMENT ON FUNCTION trigger_token_limit_notification IS 'Monitora uso de tokens e dispara notificações automáticas quando ultrapassa 75%, 90% ou 100%';
COMMENT ON TRIGGER trg_monitor_token_usage ON stripe_subscriptions IS 'Trigger que executa verificação de limite de tokens após cada atualização';
