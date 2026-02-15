/*
  # WIS WhatsApp Integration Tables

  1. Summary
    This migration creates the infrastructure for WhatsApp notifications via Z-API
    for users who submit files through the WIS API integration.

  2. New Tables
    - `wis_whatsapp_config`
      - `id` (uuid, primary key)
      - `is_enabled` (boolean) - Global toggle for WhatsApp notifications
      - `created_at`, `updated_at` (timestamps)

    - `wis_whatsapp_messages`
      - `id` (uuid, primary key)
      - `message_key` (text, unique) - Identifier for the message template
      - `message_type` (text) - "success" or "error"
      - `message_text` (text) - Message content with placeholders like {nome}
      - `send_via_whatsapp` (boolean) - Whether to send this message via WhatsApp
      - `created_at`, `updated_at` (timestamps)

    - `wis_whatsapp_logs`
      - `id` (uuid, primary key)
      - `processo_id` (uuid, nullable) - Reference to processo if applicable
      - `user_id` (uuid) - Reference to user_profiles
      - `phone_number` (text) - Phone number the message was sent to
      - `message_key` (text) - Which message template was used
      - `message_type` (text) - Type of WhatsApp message: text, document, link
      - `message_sent` (text) - Actual message content sent
      - `zapi_response` (jsonb) - Response from Z-API
      - `success` (boolean) - Whether the message was sent successfully
      - `error_message` (text, nullable) - Error details if failed
      - `retry_count` (integer) - Number of retry attempts
      - `created_at` (timestamp)

  3. Modified Tables
    - `wis_api_logs` - Added `processo_id` column to link API logs with created processes

  4. Security
    - RLS enabled on all new tables
    - Admin-only access policies for configuration and logs

  5. Seed Data
    - Default WhatsApp message templates for success and error scenarios
    - Initial config with WhatsApp enabled
*/

-- Create wis_whatsapp_config table
CREATE TABLE IF NOT EXISTS wis_whatsapp_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create wis_whatsapp_messages table
CREATE TABLE IF NOT EXISTS wis_whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_key text UNIQUE NOT NULL,
  message_type text NOT NULL CHECK (message_type IN ('success', 'error')),
  message_text text NOT NULL,
  send_via_whatsapp boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create wis_whatsapp_logs table
CREATE TABLE IF NOT EXISTS wis_whatsapp_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid REFERENCES processos(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  message_key text NOT NULL,
  message_type text NOT NULL CHECK (message_type IN ('text', 'document', 'link')),
  message_sent text NOT NULL,
  zapi_response jsonb,
  success boolean NOT NULL DEFAULT false,
  error_message text,
  retry_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Add processo_id to wis_api_logs if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wis_api_logs' AND column_name = 'processo_id'
  ) THEN
    ALTER TABLE wis_api_logs ADD COLUMN processo_id uuid REFERENCES processos(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_wis_whatsapp_logs_processo_id ON wis_whatsapp_logs(processo_id);
CREATE INDEX IF NOT EXISTS idx_wis_whatsapp_logs_user_id ON wis_whatsapp_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_wis_whatsapp_logs_created_at ON wis_whatsapp_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wis_whatsapp_logs_success ON wis_whatsapp_logs(success);
CREATE INDEX IF NOT EXISTS idx_wis_whatsapp_messages_key ON wis_whatsapp_messages(message_key);
CREATE INDEX IF NOT EXISTS idx_wis_api_logs_processo_id ON wis_api_logs(processo_id);

-- Enable RLS
ALTER TABLE wis_whatsapp_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE wis_whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE wis_whatsapp_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for wis_whatsapp_config (admin only)
CREATE POLICY "Admins can read WhatsApp config"
  ON wis_whatsapp_config FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can update WhatsApp config"
  ON wis_whatsapp_config FOR UPDATE
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

-- RLS Policies for wis_whatsapp_messages (admin only)
CREATE POLICY "Admins can read WhatsApp messages"
  ON wis_whatsapp_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can insert WhatsApp messages"
  ON wis_whatsapp_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can update WhatsApp messages"
  ON wis_whatsapp_messages FOR UPDATE
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

CREATE POLICY "Admins can delete WhatsApp messages"
  ON wis_whatsapp_messages FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- RLS Policies for wis_whatsapp_logs (admin only)
CREATE POLICY "Admins can read WhatsApp logs"
  ON wis_whatsapp_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can insert WhatsApp logs"
  ON wis_whatsapp_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- Insert default configuration (single row)
INSERT INTO wis_whatsapp_config (is_enabled)
VALUES (true)
ON CONFLICT DO NOTHING;

-- Insert default success messages
INSERT INTO wis_whatsapp_messages (message_key, message_type, message_text, send_via_whatsapp) VALUES
  ('file_received', 'success', 'Ola {nome}, seu arquivo foi recebido com sucesso e vamos iniciar sua analise.', true),
  ('analysis_started', 'success', '{nome}, seu arquivo esta sendo analisado neste momento.', true),
  ('analysis_completed', 'success', 'Sua analise esta concluida, aqui tem o PDF da sua analise.', true),
  ('chat_link', 'success', 'Se voce quiser conversar em nosso chat, tirar duvidas ou montar pecas para o processo basta acessar o Wis Legal Chat: {chat_url}', true),
  ('detail_link', 'success', 'Se desejar ver todos os detalhes de sua analise e gerenciar compartilhamento: {detail_url}', true)
ON CONFLICT (message_key) DO NOTHING;

-- Insert error messages (migrate from existing pattern)
INSERT INTO wis_whatsapp_messages (message_key, message_type, message_text, send_via_whatsapp) VALUES
  ('analysis_start_failed', 'error', 'Arquivo recebido, mas analise nao pode ser iniciada. Tente novamente.', true),
  ('download_failed', 'error', 'Erro ao baixar arquivo da URL fornecida. Verifique se a URL esta acessivel.', true),
  ('file_too_large', 'error', 'Arquivo muito grande. Tamanho maximo permitido: 100MB.', true),
  ('invalid_file_format', 'error', 'Formato de arquivo invalido. Apenas arquivos PDF sao aceitos.', true),
  ('invalid_request', 'error', 'Requisicao invalida. Parametros obrigatorios: phone, fileName e (documentUrl ou base64).', true),
  ('no_active_subscription', 'error', 'Usuario sem assinatura ativa. Assine um plano para continuar analisando processos. Saiba mais em https://wislegal.io/', true),
  ('partner_not_authorized', 'error', 'Parceiro nao autorizado. Entre em contato com o suporte em contato@wislegal.io', true),
  ('upload_failed', 'error', 'Erro ao processar upload do arquivo. Tente novamente em alguns instantes.', true),
  ('user_not_found', 'error', 'Usuario nao encontrado. Certifique-se de que o telefone {phone} esta cadastrado.', true)
ON CONFLICT (message_key) DO NOTHING;

-- Create trigger for updated_at on wis_whatsapp_config
CREATE OR REPLACE FUNCTION update_wis_whatsapp_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_wis_whatsapp_config_updated_at ON wis_whatsapp_config;
CREATE TRIGGER update_wis_whatsapp_config_updated_at
  BEFORE UPDATE ON wis_whatsapp_config
  FOR EACH ROW
  EXECUTE FUNCTION update_wis_whatsapp_config_updated_at();

-- Create trigger for updated_at on wis_whatsapp_messages
CREATE OR REPLACE FUNCTION update_wis_whatsapp_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_wis_whatsapp_messages_updated_at ON wis_whatsapp_messages;
CREATE TRIGGER update_wis_whatsapp_messages_updated_at
  BEFORE UPDATE ON wis_whatsapp_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_wis_whatsapp_messages_updated_at();