/*
  # Sistema de Notificação de Limite de Tokens

  1. Nova Tabela
    - `token_limit_notifications`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `notification_type` (text) - Tipo: '75_percent', '90_percent', '100_percent'
      - `tokens_total` (integer) - Total de tokens quando notificado
      - `tokens_used` (integer) - Tokens usados quando notificado
      - `percentage_used` (numeric) - Porcentagem exata usada
      - `email_sent` (boolean) - Se o email foi enviado com sucesso
      - `email_sent_at` (timestamptz) - Quando o email foi enviado
      - `created_at` (timestamptz)

  2. Segurança
    - Enable RLS
    - Apenas admins podem ver todas as notificações
    - Usuários podem ver apenas suas próprias notificações

  3. Índices
    - Índice em user_id para consultas rápidas
    - Índice em notification_type para filtros
    - Índice composto em (user_id, notification_type, created_at) para evitar duplicatas
*/

-- Criar tabela de notificações de limite de tokens
CREATE TABLE IF NOT EXISTS token_limit_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type text NOT NULL CHECK (notification_type IN ('75_percent', '90_percent', '100_percent')),
  tokens_total integer NOT NULL DEFAULT 0,
  tokens_used integer NOT NULL DEFAULT 0,
  percentage_used numeric(5,2) NOT NULL DEFAULT 0,
  email_sent boolean NOT NULL DEFAULT false,
  email_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_token_notifications_user_id 
  ON token_limit_notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_token_notifications_type 
  ON token_limit_notifications(notification_type);

CREATE INDEX IF NOT EXISTS idx_token_notifications_user_type_date 
  ON token_limit_notifications(user_id, notification_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_token_notifications_email_sent 
  ON token_limit_notifications(email_sent, email_sent_at) 
  WHERE email_sent = false;

-- Enable RLS
ALTER TABLE token_limit_notifications ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Usuários podem ver suas próprias notificações"
  ON token_limit_notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Sistema pode inserir notificações"
  ON token_limit_notifications
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Sistema pode atualizar notificações"
  ON token_limit_notifications
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Admins podem ver todas as notificações
CREATE POLICY "Admins podem ver todas as notificações"
  ON token_limit_notifications
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Função para verificar se já foi enviada notificação recente (últimas 7 dias)
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
    AND created_at > NOW() - INTERVAL '7 days';
  
  RETURN v_recent_count > 0;
END;
$$;

-- Comentários para documentação
COMMENT ON TABLE token_limit_notifications IS 'Registra notificações de limite de tokens enviadas aos usuários';
COMMENT ON COLUMN token_limit_notifications.notification_type IS 'Tipo de notificação: 75_percent, 90_percent, 100_percent';
COMMENT ON COLUMN token_limit_notifications.percentage_used IS 'Porcentagem exata de tokens usados no momento da notificação';
COMMENT ON FUNCTION check_recent_token_notification IS 'Verifica se já foi enviada notificação nos últimos 7 dias para evitar spam';
