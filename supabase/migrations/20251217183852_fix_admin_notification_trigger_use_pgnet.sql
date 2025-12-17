/*
  # Corrige Trigger de Notificação Admin para usar pg_net corretamente
  
  1. Atualiza a função notify_admin_on_process_completed
    - Usa extensions.http_post do pg_net corretamente
    - Adiciona tratamento robusto de erros
    - Usa variáveis de ambiente do Supabase
*/

-- Função corrigida para enviar notificação administrativa
CREATE OR REPLACE FUNCTION notify_admin_on_process_completed()
RETURNS TRIGGER AS $$
DECLARE
  v_user_email text;
  v_user_first_name text;
  v_user_last_name text;
  v_user_name text;
  v_duration_ms bigint;
  v_duration_text text;
  v_payload jsonb;
  v_supabase_url text := current_setting('request.headers', true)::json->>'host';
BEGIN
  -- Só processa se mudou para completed
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed' THEN
    
    BEGIN
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
          'is_complex', COALESCE(NEW.is_chunked, false),
          'total_pages', COALESCE(NEW.total_pages, 0)
        ),
        'user_id', NEW.user_id,
        'processo_id', NEW.id
      );
      
      -- Obter URL do Supabase
      IF v_supabase_url IS NULL THEN
        -- Fallback: tentar pegar do ambiente
        v_supabase_url := current_setting('app.supabase_url', true);
      END IF;
      
      -- Se ainda não tem URL, não envia
      IF v_supabase_url IS NOT NULL THEN
        -- Adicionar https:// se necessário
        IF v_supabase_url NOT LIKE 'http%' THEN
          v_supabase_url := 'https://' || v_supabase_url;
        END IF;
        
        -- Chamar edge function usando pg_net (assíncrono)
        PERFORM net.http_post(
          url := v_supabase_url || '/functions/v1/send-admin-notification',
          headers := jsonb_build_object(
            'Content-Type', 'application/json'
          ),
          body := v_payload,
          timeout_milliseconds := 5000
        );
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      -- Log do erro mas não falha o trigger
      RAISE WARNING 'Erro ao enviar notificação admin (ignorado): % - %', SQLSTATE, SQLERRM;
    END;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentário
COMMENT ON FUNCTION notify_admin_on_process_completed() IS 
  'Envia notificação administrativa ao Slack quando um processo é completado usando pg_net';
