/*
  # Create LLM Provider Types Management Table

  1. New Tables
    - `llm_provider_types`
      - `id` (uuid, primary key)
      - `type_key` (text, unique) - Internal identifier (e.g., 'google-gemini')
      - `type_label` (text) - Display name (e.g., 'Google Gemini')
      - `is_active` (boolean) - Whether this type is available in dropdowns
      - `sort_order` (integer) - Display order in dropdowns
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `llm_provider_types` table
    - Admin can manage types
    - Service role can read for dropdowns

  3. Seed Data
    - Populate with existing provider types
*/

CREATE TABLE IF NOT EXISTS llm_provider_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type_key text UNIQUE NOT NULL,
  type_label text NOT NULL,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE llm_provider_types ENABLE ROW LEVEL SECURITY;

-- Policies: Anyone authenticated can read
CREATE POLICY "Anyone can read provider types"
  ON llm_provider_types
  FOR SELECT
  TO authenticated
  USING (true);

-- Admins can insert
CREATE POLICY "Admins can insert provider types"
  ON llm_provider_types
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- Admins can update
CREATE POLICY "Admins can update provider types"
  ON llm_provider_types
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

-- Admins can delete
CREATE POLICY "Admins can delete provider types"
  ON llm_provider_types
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- Service role policies
CREATE POLICY "Service role can manage provider types"
  ON llm_provider_types
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Seed with existing types
INSERT INTO llm_provider_types (type_key, type_label, sort_order) VALUES
  ('google-gemini', 'Google Gemini', 1),
  ('openai', 'OpenAI', 2),
  ('anthropic', 'Anthropic', 3),
  ('deepseek', 'Deepseek', 4),
  ('grok', 'Grok', 5),
  ('other', 'Outro', 99)
ON CONFLICT (type_key) DO NOTHING;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_llm_provider_types_active
ON llm_provider_types(is_active, sort_order);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_llm_provider_types_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER llm_provider_types_updated_at
BEFORE UPDATE ON llm_provider_types
FOR EACH ROW
EXECUTE FUNCTION update_llm_provider_types_updated_at();
