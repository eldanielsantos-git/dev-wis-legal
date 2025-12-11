/*
  # Create Token Limits Configuration System

  1. New Table
    - `token_limits_config`
      - `id` (uuid, primary key)
      - `context_key` (text, unique) - Unique identifier for the context
      - `context_name` (text) - Friendly name
      - `context_description` (text) - Description of use
      - `max_output_tokens` (integer) - Token output limit
      - `default_value` (integer) - Default fallback value
      - `min_allowed` (integer) - Minimum allowed limit
      - `max_allowed` (integer) - Maximum allowed limit
      - `is_active` (boolean) - Whether it's active
      - `display_order` (integer) - Display order in UI
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `token_limits_config` table
    - Add policies for admins to manage
    - Add policy for service role to read

  3. Seed Data
    - Insert initial token limit configurations for all contexts
*/

-- Create token_limits_config table
CREATE TABLE IF NOT EXISTS token_limits_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  context_key text UNIQUE NOT NULL,
  context_name text NOT NULL,
  context_description text NOT NULL,
  max_output_tokens integer NOT NULL,
  default_value integer NOT NULL,
  min_allowed integer NOT NULL DEFAULT 1024,
  max_allowed integer NOT NULL DEFAULT 100000,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_token_limits_context_key
  ON token_limits_config(context_key) WHERE is_active = true;

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_token_limits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER token_limits_config_updated_at
  BEFORE UPDATE ON token_limits_config
  FOR EACH ROW
  EXECUTE FUNCTION update_token_limits_updated_at();

-- Enable RLS
ALTER TABLE token_limits_config ENABLE ROW LEVEL SECURITY;

-- Policy for service role to read (for edge functions)
CREATE POLICY "Service role can read token limits"
  ON token_limits_config
  FOR SELECT
  TO service_role
  USING (true);

-- Policy for admins to read
CREATE POLICY "Admins can read token limits"
  ON token_limits_config
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- Policy for admins to update
CREATE POLICY "Admins can update token limits"
  ON token_limits_config
  FOR UPDATE
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

-- Insert initial token limit configurations
INSERT INTO token_limits_config (
  context_key,
  context_name,
  context_description,
  max_output_tokens,
  default_value,
  min_allowed,
  max_allowed,
  display_order
) VALUES
  -- Analysis contexts
  (
    'analysis_small_files',
    'Análise de Arquivos Pequenos',
    'Limite de tokens para análise de arquivos com menos de 1000 páginas. Usado no processamento sequencial de prompts.',
    30000,
    8192,
    4096,
    60000,
    1
  ),
  (
    'analysis_complex_files',
    'Análise de Arquivos Complexos',
    'Limite de tokens para análise de arquivos com 1000 páginas ou mais. Usado no processamento paralelo com chunks.',
    60000,
    60000,
    30000,
    100000,
    2
  ),
  (
    'analysis_consolidation',
    'Consolidação de Análises',
    'Limite de tokens para consolidação de resultados de múltiplos chunks em uma análise unificada.',
    60000,
    60000,
    30000,
    100000,
    3
  ),
  -- Chat contexts
  (
    'chat_intro',
    'Chat - Prompts de Introdução',
    'Limite de tokens para prompts de introdução ao iniciar uma conversa com o processo.',
    8192,
    8192,
    2048,
    16384,
    4
  ),
  (
    'chat_standard',
    'Chat Padrão',
    'Limite de tokens para conversas padrão com o processo. Usado quando o contexto é simples.',
    8192,
    8192,
    4096,
    32000,
    5
  ),
  (
    'chat_complex_files',
    'Chat - Arquivos Complexos',
    'Limite de tokens para chat quando o processo contém arquivos muito grandes ou complexos.',
    16384,
    16384,
    8192,
    60000,
    6
  ),
  (
    'chat_audio',
    'Chat - Processamento de Áudio',
    'Limite de tokens para processamento e resposta de mensagens de áudio transcritas.',
    8192,
    8192,
    4096,
    16384,
    7
  );

-- Create audit log table for token limit changes
CREATE TABLE IF NOT EXISTS token_limits_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_limit_id uuid REFERENCES token_limits_config(id) ON DELETE CASCADE,
  context_key text NOT NULL,
  old_value integer,
  new_value integer,
  changed_by uuid REFERENCES auth.users(id),
  changed_at timestamptz DEFAULT now(),
  change_reason text
);

-- Enable RLS on audit table
ALTER TABLE token_limits_audit ENABLE ROW LEVEL SECURITY;

-- Policy for admins to read audit logs
CREATE POLICY "Admins can read token limits audit"
  ON token_limits_audit
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- Create trigger to log changes
CREATE OR REPLACE FUNCTION log_token_limit_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.max_output_tokens != NEW.max_output_tokens THEN
    INSERT INTO token_limits_audit (
      token_limit_id,
      context_key,
      old_value,
      new_value,
      changed_by
    ) VALUES (
      NEW.id,
      NEW.context_key,
      OLD.max_output_tokens,
      NEW.max_output_tokens,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER token_limits_audit_trigger
  AFTER UPDATE ON token_limits_config
  FOR EACH ROW
  EXECUTE FUNCTION log_token_limit_changes();
