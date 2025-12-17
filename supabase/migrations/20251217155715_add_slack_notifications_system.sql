/*
  # Sistema de Notificações Slack

  1. Nova Tabela
    - `slack_notifications`
      - `id` (uuid, primary key) - Identificador único
      - `webhook_url` (text) - URL do webhook Slack
      - `channel_name` (text) - Nome do canal/configuração
      - `is_active` (boolean) - Se a notificação está ativa
      - `notification_types` (text[]) - Tipos de eventos que serão notificados
      - `created_at` (timestamptz) - Data de criação
      - `updated_at` (timestamptz) - Data de atualização

  2. Tipos de Notificação Suportados
    - user_signup: Novo usuário cadastrado
    - subscription_created: Nova assinatura criada
    - subscription_cancelled: Assinatura cancelada
    - subscription_upgraded: Assinatura upgradada
    - subscription_downgraded: Assinatura downgraded
    - token_purchase: Compra de tokens avulsos
    - analysis_completed: Análise de processo concluída
    - analysis_failed: Análise de processo falhou

  3. Segurança
    - Habilita RLS na tabela `slack_notifications`
    - Apenas administradores podem gerenciar configurações
    - Policies restritivas para leitura, inserção, atualização e exclusão

  4. Observações
    - Usa DEFAULT gen_random_uuid() para gerar IDs
    - Campo notification_types é um array para permitir múltiplos tipos por config
    - Timestamps automáticos com now() e trigger de atualização
*/

-- Criar tabela de configurações de notificações Slack
CREATE TABLE IF NOT EXISTS slack_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_url text NOT NULL,
  channel_name text NOT NULL,
  is_active boolean DEFAULT true,
  notification_types text[] DEFAULT ARRAY[]::text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE slack_notifications ENABLE ROW LEVEL SECURITY;

-- Políticas para administradores apenas
CREATE POLICY "Admin can view slack notifications"
  ON slack_notifications FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "Admin can insert slack notifications"
  ON slack_notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "Admin can update slack notifications"
  ON slack_notifications FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "Admin can delete slack notifications"
  ON slack_notifications FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_slack_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER slack_notifications_updated_at
  BEFORE UPDATE ON slack_notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_slack_notifications_updated_at();