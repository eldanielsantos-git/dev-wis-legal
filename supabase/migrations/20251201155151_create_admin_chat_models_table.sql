/*
  # Criar tabela de gerenciamento de modelos LLM para Chat

  1. Nova Tabela
    - `admin_chat_models`
      - `id` (uuid, primary key)
      - `model_name` (text) - Nome amigável do modelo
      - `system_model` (text) - Identificador do modelo na API (ex: gemini-2.5-pro)
      - `provider` (text) - Provedor (gemini, openai, etc)
      - `is_active` (boolean) - Se está ativo
      - `priority` (integer) - Prioridade (menor = maior prioridade)
      - `description` (text) - Descrição do modelo
      - `max_context_length` (integer) - Tamanho máximo do contexto
      - `supports_system_instruction` (boolean) - Se suporta system instruction
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Segurança
    - Habilitar RLS
    - Políticas para admins gerenciarem
    - Políticas para service role
  
  3. Dados Iniciais
    - Inserir modelos Gemini padrão para chat
*/

-- Criar tabela
CREATE TABLE IF NOT EXISTS admin_chat_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name text NOT NULL,
  system_model text NOT NULL UNIQUE,
  provider text NOT NULL DEFAULT 'gemini',
  is_active boolean NOT NULL DEFAULT false,
  priority integer NOT NULL DEFAULT 999,
  description text,
  max_context_length integer DEFAULT 32000,
  supports_system_instruction boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE admin_chat_models ENABLE ROW LEVEL SECURITY;

-- Políticas para admins
CREATE POLICY "Admins can view all chat models"
  ON admin_chat_models
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can insert chat models"
  ON admin_chat_models
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can update chat models"
  ON admin_chat_models
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can delete chat models"
  ON admin_chat_models
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- Políticas para service role (edge functions)
CREATE POLICY "Service role can read chat models"
  ON admin_chat_models
  FOR SELECT
  TO service_role
  USING (true);

-- Inserir modelos Gemini padrão
INSERT INTO admin_chat_models (model_name, system_model, provider, is_active, priority, description, max_context_length, supports_system_instruction)
VALUES
  ('Gemini 2.5 Pro', 'gemini-2.5-pro', 'gemini', true, 1, 'Modelo mais avançado para chat com alta capacidade de raciocínio', 1000000, true),
  ('Gemini 2.5 Flash', 'gemini-2.5-flash', 'gemini', true, 2, 'Modelo rápido e eficiente para chat', 1000000, true),
  ('Gemini 2.0 Flash', 'gemini-2.0-flash-exp', 'gemini', true, 3, 'Modelo experimental rápido', 32000, true)
ON CONFLICT (system_model) DO NOTHING;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_admin_chat_models_active_priority ON admin_chat_models(is_active, priority);
CREATE INDEX IF NOT EXISTS idx_admin_chat_models_provider ON admin_chat_models(provider);