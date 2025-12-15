/*
  # Fix Trigger - Correct Supabase URL

  ## Problema
  O trigger estava usando URL incorreta: https://mfybgfqowdnfzgfdgfvt.supabase.co
  Erro: "Couldn't resolve host name"

  ## Solução
  Atualizar para a URL correta do projeto atual que está na system_config
*/

-- =====================================================
-- 1. ATUALIZAR FUNÇÃO COM URL CORRETA
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_send_process_completed_email()
RETURNS TRIGGER AS $$
DECLARE
  v_notify_enabled BOOLEAN;
  v_request_id INT;
  v_supabase_url TEXT;
BEGIN
  -- Apenas executar se o status mudou para 'completed'
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed' THEN

    -- Verificar se o usuário quer receber notificação por email
    SELECT COALESCE(notify_process_completed, true) INTO v_notify_enabled
    FROM user_preferences
    WHERE user_id = NEW.user_id;

    -- Se não encontrou preferências, assumir que quer receber (padrão é true)
    IF v_notify_enabled IS NULL THEN
      v_notify_enabled := true;
    END IF;

    -- Se o usuário NÃO quer receber, não enviar email
    IF NOT v_notify_enabled THEN
      RAISE NOTICE '⏭️ Usuário % optou por não receber emails de processo concluído. Ignorando envio.', NEW.user_id;
      RETURN NEW;
    END IF;

    -- Obter URL correta do sistema
    SELECT value INTO v_supabase_url
    FROM system_config
    WHERE key = 'supabase_url'
    LIMIT 1;

    -- Se não encontrou, usar fallback
    IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
      v_supabase_url := 'https://rslpleprodloodfsaext.supabase.co';
    END IF;

    -- Disparar edge function de forma assíncrona usando pg_net
    BEGIN
      SELECT net.http_post(
        url := v_supabase_url || '/functions/v1/send-email-process-completed',
        headers := jsonb_build_object(
          'Content-Type', 'application/json'
        ),
        body := jsonb_build_object(
          'processo_id', NEW.id::text
        ),
        timeout_milliseconds := 30000
      ) INTO v_request_id;

      RAISE NOTICE '📧 Email de processo concluído disparado para processo % (request_id: %)', NEW.id, v_request_id;
    EXCEPTION
      WHEN OTHERS THEN
        -- Log erro mas não falhar o trigger
        RAISE WARNING '❌ Erro ao disparar email para processo %: %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 2. COMENTÁRIO
-- =====================================================

COMMENT ON FUNCTION trigger_send_process_completed_email() IS
  'Dispara edge function send-email-process-completed quando processo é marcado como completed (v3 - URL correta)';

-- =====================================================
-- 3. VERIFICAÇÃO
-- =====================================================

DO $$
DECLARE
  v_url TEXT;
BEGIN
  SELECT value INTO v_url FROM system_config WHERE key = 'supabase_url';
  RAISE NOTICE '✓ Trigger atualizado com URL correta: %', v_url;
END $$;
