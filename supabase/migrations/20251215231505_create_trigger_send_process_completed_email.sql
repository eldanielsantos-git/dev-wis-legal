/*
  # Create Trigger to Send Process Completed Email

  ## Resumo
  Cria um trigger que automaticamente chama a edge function 'send-email-process-completed'
  quando um processo é marcado como 'completed'.

  ## Problema Resolvido
  - Processos pequenos/normais não recebem email de conclusão
  - Apenas processos complexos (que passam pelo consolidation-worker) recebem email
  - Este trigger garante que TODOS os processos disparem o email ao completar

  ## Mudanças

  1. Nova Função: `trigger_send_process_completed_email()`
     - Dispara quando processo muda status para 'completed'
     - Verifica se usuário quer receber email (user_preferences.notify_process_completed)
     - Faz requisição HTTP para edge function send-email-process-completed
     - Usa pg_net para fazer requisição assíncrona

  2. Novo Trigger: `trigger_processo_completed_send_email`
     - Dispara AFTER UPDATE em processos
     - Executa apenas quando status muda de != 'completed' para 'completed'

  ## Segurança
  - Usa SECURITY DEFINER para ter permissões de service role
  - Verifica preferências do usuário antes de enviar
*/

-- =====================================================
-- 1. CRIAR FUNÇÃO PARA DISPARAR EMAIL
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_send_process_completed_email()
RETURNS TRIGGER AS $$
DECLARE
  v_supabase_url TEXT;
  v_supabase_service_key TEXT;
  v_notify_enabled BOOLEAN;
  v_request_id INT;
BEGIN
  -- Apenas executar se o status mudou para 'completed'
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed' THEN

    -- Obter configurações do sistema
    SELECT value INTO v_supabase_url
    FROM system_config
    WHERE key = 'supabase_url'
    LIMIT 1;

    SELECT value INTO v_supabase_service_key
    FROM system_config
    WHERE key = 'supabase_service_role_key'
    LIMIT 1;

    -- Se não encontrou na tabela, usar variáveis de ambiente (fallback)
    IF v_supabase_url IS NULL THEN
      v_supabase_url := current_setting('app.settings.supabase_url', true);
      IF v_supabase_url IS NULL THEN
        v_supabase_url := 'https://mfybgfqowdnfzgfdgfvt.supabase.co';
      END IF;
    END IF;

    IF v_supabase_service_key IS NULL THEN
      v_supabase_service_key := current_setting('app.settings.supabase_service_key', true);
    END IF;

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

    -- Disparar edge function de forma assíncrona usando pg_net
    -- Nota: pg_net.http_post é não-bloqueante e retorna imediatamente
    BEGIN
      SELECT net.http_post(
        url := v_supabase_url || '/functions/v1/send-email-process-completed',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_supabase_service_key
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
-- 2. CRIAR TRIGGER
-- =====================================================

DROP TRIGGER IF EXISTS trigger_processo_completed_send_email ON processos;

CREATE TRIGGER trigger_processo_completed_send_email
  AFTER UPDATE ON processos
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed')
  EXECUTE FUNCTION trigger_send_process_completed_email();

-- =====================================================
-- 3. COMENTÁRIOS
-- =====================================================

COMMENT ON FUNCTION trigger_send_process_completed_email() IS
  'Dispara edge function send-email-process-completed quando processo é marcado como completed';

COMMENT ON TRIGGER trigger_processo_completed_send_email ON processos IS
  'Envia email de processo concluído automaticamente via edge function';

-- =====================================================
-- 4. VERIFICAÇÃO
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✓ Trigger de email de processo concluído criado com sucesso';
  RAISE NOTICE '✓ Emails serão enviados automaticamente quando processos forem marcados como completed';
  RAISE NOTICE '✓ Trigger respeita preferências do usuário em user_preferences.notify_process_completed';
END $$;
