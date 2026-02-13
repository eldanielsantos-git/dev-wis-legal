/*
  # Wis API Integration Tables
  
  Creates the infrastructure for external API integrations (WhatsApp via Z-API and future providers).
  
  1. New Tables
    - `wis_api_partners`
      - `id` (uuid, primary key) - Unique identifier
      - `partner_name` (text) - Display name of the partner (e.g., "Z-API")
      - `api_url_pattern` (text) - URL pattern for validation (e.g., "api.z-api.io/instances/%")
      - `is_active` (boolean) - Whether the partner is currently active
      - `created_at` (timestamptz) - Creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp
    
    - `wis_api_error_messages`
      - `id` (uuid, primary key) - Unique identifier
      - `error_key` (text, unique) - Error identifier key (e.g., "user_not_found")
      - `message_text` (text) - Configurable error message text
      - `created_at` (timestamptz) - Creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp
    
    - `wis_api_logs`
      - `id` (uuid, primary key) - Unique identifier
      - `partner_id` (uuid) - Reference to wis_api_partners
      - `phone_number` (text) - Phone number from the request
      - `user_id` (uuid, nullable) - User ID if found
      - `success` (boolean) - Whether the request was successful
      - `error_key` (text, nullable) - Error key if failed
      - `request_payload` (jsonb) - Full request data for auditing
      - `response_sent` (jsonb) - Response sent back
      - `created_at` (timestamptz) - Creation timestamp
  
  2. Indexes
    - Index on wis_api_logs(partner_id) for filtering by partner
    - Index on wis_api_logs(created_at) for time-based queries
    - Index on wis_api_logs(phone_number) for phone lookups
    - Index on user_profiles(phone) for faster phone searches
  
  3. Security
    - RLS enabled on all tables
    - Only admins can read/write partners and error_messages
    - Only admins can read logs
  
  4. Seed Data
    - Initial error messages for common scenarios
    - Z-API as first partner
*/

-- Create wis_api_partners table
CREATE TABLE IF NOT EXISTS wis_api_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_name text NOT NULL,
  api_url_pattern text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create wis_api_error_messages table
CREATE TABLE IF NOT EXISTS wis_api_error_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  error_key text UNIQUE NOT NULL,
  message_text text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create wis_api_logs table
CREATE TABLE IF NOT EXISTS wis_api_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid REFERENCES wis_api_partners(id) ON DELETE SET NULL,
  phone_number text NOT NULL,
  user_id uuid,
  success boolean NOT NULL DEFAULT false,
  error_key text,
  request_payload jsonb,
  response_sent jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for wis_api_logs
CREATE INDEX IF NOT EXISTS idx_wis_api_logs_partner_id ON wis_api_logs(partner_id);
CREATE INDEX IF NOT EXISTS idx_wis_api_logs_created_at ON wis_api_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wis_api_logs_phone_number ON wis_api_logs(phone_number);
CREATE INDEX IF NOT EXISTS idx_wis_api_logs_success ON wis_api_logs(success);

-- Create index on user_profiles(phone) for faster lookups (if not exists)
CREATE INDEX IF NOT EXISTS idx_user_profiles_phone ON user_profiles(phone);

-- Enable RLS on all tables
ALTER TABLE wis_api_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE wis_api_error_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE wis_api_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for wis_api_partners (admin only)
CREATE POLICY "Admins can read wis_api_partners"
  ON wis_api_partners FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can insert wis_api_partners"
  ON wis_api_partners FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can update wis_api_partners"
  ON wis_api_partners FOR UPDATE
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

CREATE POLICY "Admins can delete wis_api_partners"
  ON wis_api_partners FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- RLS Policies for wis_api_error_messages (admin only)
CREATE POLICY "Admins can read wis_api_error_messages"
  ON wis_api_error_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can insert wis_api_error_messages"
  ON wis_api_error_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can update wis_api_error_messages"
  ON wis_api_error_messages FOR UPDATE
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

CREATE POLICY "Admins can delete wis_api_error_messages"
  ON wis_api_error_messages FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- RLS Policies for wis_api_logs (admin read only)
CREATE POLICY "Admins can read wis_api_logs"
  ON wis_api_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- Service role can insert logs (from edge function)
CREATE POLICY "Service role can insert wis_api_logs"
  ON wis_api_logs FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Insert seed data for error messages
INSERT INTO wis_api_error_messages (error_key, message_text) VALUES
  ('user_not_found', 'Usuario nao encontrado. Certifique-se de que o telefone {phone} esta cadastrado.'),
  ('no_active_subscription', 'Usuario sem assinatura ativa. Assine um plano para continuar analisando processos.'),
  ('invalid_file_format', 'Formato de arquivo invalido. Apenas arquivos PDF sao aceitos.'),
  ('file_too_large', 'Arquivo muito grande. Tamanho maximo permitido: 100MB.'),
  ('partner_not_authorized', 'Parceiro nao autorizado. Entre em contato com o suporte.'),
  ('upload_failed', 'Erro ao processar upload do arquivo. Tente novamente em alguns instantes.'),
  ('analysis_start_failed', 'Arquivo recebido mas analise nao pode ser iniciada. Tente novamente.'),
  ('download_failed', 'Erro ao baixar arquivo da URL fornecida. Verifique se a URL esta acessivel.'),
  ('invalid_request', 'Requisicao invalida. Parametros obrigatorios: phone, fileName e (documentUrl ou base64).')
ON CONFLICT (error_key) DO NOTHING;

-- Insert Z-API as first partner
INSERT INTO wis_api_partners (partner_name, api_url_pattern, is_active) VALUES
  ('Z-API', 'api.z-api.io%', true)
ON CONFLICT DO NOTHING;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_wis_api_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS trigger_wis_api_partners_updated_at ON wis_api_partners;
CREATE TRIGGER trigger_wis_api_partners_updated_at
  BEFORE UPDATE ON wis_api_partners
  FOR EACH ROW
  EXECUTE FUNCTION update_wis_api_updated_at();

DROP TRIGGER IF EXISTS trigger_wis_api_error_messages_updated_at ON wis_api_error_messages;
CREATE TRIGGER trigger_wis_api_error_messages_updated_at
  BEFORE UPDATE ON wis_api_error_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_wis_api_updated_at();