/*
  # Atualizar Proteção de Spam para 1x ao Dia
  
  1. Alterações
    - Mudar verificação de 7 dias para 1 dia (24 horas)
    - Isso permite que usuários recebam notificações diárias se continuarem no limite
    
  2. Motivo
    - Alertar usuários de forma mais frequente quando estão sem tokens
    - Manter proteção contra spam (não mais que 1x por dia)
*/

-- Atualizar função para verificar apenas últimas 24 horas (1 dia)
CREATE OR REPLACE FUNCTION check_recent_token_notification(
  p_user_id uuid,
  p_notification_type text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_recent_count integer;
BEGIN
  SELECT COUNT(*)
  INTO v_recent_count
  FROM token_limit_notifications
  WHERE user_id = p_user_id
    AND notification_type = p_notification_type
    AND email_sent = true
    AND created_at > NOW() - INTERVAL '1 day';
  
  RETURN v_recent_count > 0;
END;
$$;

-- Atualizar comentário
COMMENT ON FUNCTION check_recent_token_notification IS 'Verifica se já foi enviada notificação nas últimas 24 horas para evitar spam';
