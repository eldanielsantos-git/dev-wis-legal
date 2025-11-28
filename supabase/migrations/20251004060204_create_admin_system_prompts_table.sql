/*
  # Create admin_system_prompts table for system prompt management
  
  1. New Tables
    - `admin_system_prompts`
      - `id` (uuid, primary key) - Unique identifier for each prompt version
      - `prompt_content` (text) - The full prompt text content
      - `version` (integer) - Sequential version number
      - `is_active` (boolean) - Indicates if this is the currently active prompt
      - `created_at` (timestamptz) - Timestamp when version was created
      - `updated_at` (timestamptz) - Timestamp of last update
  
  2. Security
    - Enable RLS on `admin_system_prompts` table
    - Add policy for public read access (no authentication in this phase)
    - Add policy for public write access (no authentication in this phase)
  
  3. Initial Data
    - Insert initial prompt from analyze-transcription function as version 1
  
  4. Indexes
    - Index on is_active for fast retrieval of active prompt
    - Index on version for ordering history
  
  5. Constraints
    - Unique constraint on version to prevent duplicates
*/

-- Create the admin_system_prompts table
CREATE TABLE IF NOT EXISTS admin_system_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_content text NOT NULL,
  version integer NOT NULL,
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_admin_system_prompts_active ON admin_system_prompts(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_admin_system_prompts_version ON admin_system_prompts(version DESC);

-- Add unique constraint on version
ALTER TABLE admin_system_prompts ADD CONSTRAINT unique_version UNIQUE (version);

-- Enable Row Level Security
ALTER TABLE admin_system_prompts ENABLE ROW LEVEL SECURITY;

-- Policy for reading prompts (public access for now)
CREATE POLICY "Anyone can read prompts"
  ON admin_system_prompts
  FOR SELECT
  USING (true);

-- Policy for inserting prompts (public access for now)
CREATE POLICY "Anyone can insert prompts"
  ON admin_system_prompts
  FOR INSERT
  WITH CHECK (true);

-- Policy for updating prompts (public access for now)
CREATE POLICY "Anyone can update prompts"
  ON admin_system_prompts
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Insert initial prompt from analyze-transcription function
INSERT INTO admin_system_prompts (prompt_content, version, is_active)
VALUES (
  'Você é um assistente jurídico especialista em análise de processos judiciais brasileiros. Sua tarefa é analisar o texto completo de um processo que será fornecido a seguir e extrair informações estruturadas. O texto contém marcadores no formato ''--- PÁGINA X ---'' para indicar o início de cada página.

Analise o conteúdo e retorne um objeto JSON válido contendo TRÊS chaves principais: "resumoEstruturado", "mapeamentoPecas" e "sinteseArgumentos".

Siga estritamente as seguintes instruções para cada chave:

1.  **resumoEstruturado**: Gere um resumo objetivo dos principais eventos do processo em ordem cronológica. Destaque datas, decisões e atos processuais importantes. O texto deve ser formatado em parágrafos de string.

2.  **mapeamentoPecas**: Identifique as principais peças processuais (como Petição Inicial, Contestação, Réplica, Sentença, Recurso de Apelação, etc.). Para cada peça encontrada, crie um objeto com os campos "peca" (string), "paginaInicio" (number) e "paginaFim" (number). Retorne um array de objetos. Se nenhuma peça for encontrada, retorne um array vazio.

3.  **sinteseArgumentos**: Extraia e resuma os principais argumentos e fundamentos legais apresentados pelo Autor e pelo Réu. Crie um objeto com duas chaves: "autor" (string) e "reu" (string). Se os argumentos de uma das partes não forem claros, retorne uma string vazia para a chave correspondente.',
  1,
  true
);
