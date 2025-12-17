/*
  # Trigger para Notificação Admin quando Processo é Completado
  
  1. Nova Função
    - `notify_admin_on_process_completed`: Função que envia notificação ao Slack quando processo é completado
    - Chama a edge function send-admin-notification
    - Executa de forma assíncrona (não bloqueia o processo)
  
  2. Novo Trigger
    - `trigger_notify_admin_on_completed`: Trigger que detecta mudança de status para 'completed'
    - Envia notificação administrativa com informações do processo e usuário
  
  3. Segurança
    - Função SECURITY DEFINER para permitir chamada da edge function
    - Não falha se a edge function retornar erro (non-blocking)
*/

-- Função para enviar notificação administrativa quando processo é completado
CREATE OR REPLACE FUNCTION notify_admin_on_process_completed()
RETURNS TRIGGER AS $$
DECLARE
  v_user_email text;
  v_user_first_name text;
  v_user_last_name text;
  v_user_name text;
  v_duration_ms bigint;
  v_duration_text text;
  v_supabase_url text;
  v_service_key text;
  v_payload jsonb;
  v_response jsonb;
BEGIN
  -- Só processa se mudou para completed
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed' THEN
    
    -- Buscar dados do usuário
    SELECT email, first_name, last_name
    INTO v_user_email, v_user_first_name, v_user_last_name
    FROM user_profiles
    WHERE id = NEW.user_id;
    
    -- Construir nome completo
    v_user_name := TRIM(COALESCE(v_user_first_name, '') || ' ' || COALESCE(v_user_last_name, ''));
    IF v_user_name = '' THEN
      v_user_name := 'N/A';
    END IF;
    
    -- Calcular duração
    v_duration_ms := EXTRACT(EPOCH FROM (NEW.analysis_completed_at - NEW.created_at)) * 1000;
    
    IF v_duration_ms >= 60000 THEN
      v_duration_text := FLOOR(v_duration_ms / 60000)::text || 'm ' || 
                        FLOOR((v_duration_ms % 60000) / 1000)::text || 's';
    ELSE
      v_duration_text := FLOOR(v_duration_ms / 1000)::text || 's';
    END IF;
    
    -- Preparar payload
    v_payload := jsonb_build_object(
      'type_slug', 'analysis_completed',
      'title', 'Análise Concluída',
      'message', 'Análise de processo concluída com sucesso',
      'severity', 'success',
      'metadata', jsonb_build_object(
        'processo_id', NEW.id,
        'file_name', COALESCE(NEW.file_name, 'N/A'),
        'user_email', COALESCE(v_user_email, 'N/A'),
        'user_name', v_user_name,
        'duration', v_duration_text,
        'is_complex', COALESCE(NEW.is_chunked, false)
      ),
      'user_id', NEW.user_id,
      'processo_id', NEW.id
    );
    
    -- Enviar notificação (non-blocking)
    BEGIN
      -- Obter variáveis de ambiente
      SELECT current_setting('app.settings.supabase_url', true) INTO v_supabase_url;
      SELECT current_setting('app.settings.supabase_service_key', true) INTO v_service_key;
      
      -- Se as configurações não estão disponíveis, usar valores padrão do ambiente
      IF v_supabase_url IS NULL THEN
        v_supabase_url := current_setting('request.headers', true)::json->>'x-forwarded-host';
        IF v_supabase_url IS NOT NULL THEN
          v_supabase_url := 'https://' || v_supabase_url;
        END IF;
      END IF;
      
      -- Chamar edge function apenas se temos a URL
      IF v_supabase_url IS NOT NULL THEN
        PERFORM net.http_post(
          url := v_supabase_url || '/functions/v1/send-admin-notification',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || COALESCE(v_service_key, '')
          ),
          body := v_payload
        );
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      -- Ignora erros na notificação para não afetar o processo principal
      RAISE WARNING 'Erro ao enviar notificação admin (ignorado): %', SQLERRM;
    END;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger para processos completados
DROP TRIGGER IF EXISTS trigger_notify_admin_on_completed ON processos;

CREATE TRIGGER trigger_notify_admin_on_completed
  AFTER UPDATE ON processos
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed')
  EXECUTE FUNCTION notify_admin_on_process_completed();

-- Comentário
COMMENT ON FUNCTION notify_admin_on_process_completed() IS 
  'Envia notificação administrativa ao Slack quando um processo é completado';
