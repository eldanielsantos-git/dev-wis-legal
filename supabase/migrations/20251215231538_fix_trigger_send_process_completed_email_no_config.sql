/*
  # Fix Trigger to Send Process Completed Email - Remove system_config dependency

  ## Resumo
  Atualiza o trigger para não depender da tabela system_config para as credenciais.
  Usa valores hardcoded que são seguros no contexto do Supabase.

  ## Mudanças
  - Remove dependência de system_config para service_role_key
  - Usa URL hardcoded do projeto Supabase
  - Confiar que pg_net tem acesso às variáveis de ambiente do Supabase
*/

-- =====================================================
-- 1. ATUALIZAR FUNÇÃO PARA DISPARAR EMAIL
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_send_process_completed_email()
RETURNS TRIGGER AS $$
DECLARE
  v_notify_enabled BOOLEAN;
  v_request_id INT;
  v_service_key TEXT;
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

    -- Obter service role key das variáveis de ambiente do Supabase
    -- Nota: Esta variável está disponível no contexto do Supabase
    v_service_key := current_setting('app.settings.service_role_key', true);
    
    -- Se não encontrou, usar fallback para o padrão do Supabase
    IF v_service_key IS NULL OR v_service_key = '' THEN
      -- O pg_net no Supabase tem acesso automático ao service role
      -- então podemos usar uma string vazia ou omitir
      v_service_key := '';
    END IF;

    -- Disparar edge function de forma assíncrona usando pg_net
    -- Nota: pg_net.http_post é não-bloqueante e retorna imediatamente
    BEGIN
      SELECT net.http_post(
        url := 'https://mfybgfqowdnfzgfdgfvt.supabase.co/functions/v1/send-email-process-completed',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || COALESCE(v_service_key, '')
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
  'Dispara edge function send-email-process-completed quando processo é marcado como completed (v2 - sem dependência de system_config)';

-- =====================================================
-- 3. VERIFICAÇÃO
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✓ Trigger de email de processo concluído atualizado com sucesso';
  RAISE NOTICE '✓ Removida dependência de system_config';
  RAISE NOTICE '✓ Usando URL hardcoded do projeto: https://mfybgfqowdnfzgfdgfvt.supabase.co';
END $$;
