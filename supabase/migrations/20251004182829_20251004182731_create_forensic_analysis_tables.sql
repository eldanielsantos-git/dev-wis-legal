/*
  # Criação do Sistema de Análise Forense Completo

  ## 1. Nova Tabela: analise_forense

  Armazena as análises forenses completas dos processos judiciais com dados estruturados em JSON.

  **Colunas:**
  - `id` (uuid, primary key) - Identificador único da análise
  - `processo_id` (uuid, foreign key) - Referência ao processo analisado
  - `forensic_data` (jsonb) - Dados completos da análise forense em formato JSON estruturado
  - `prompt_version_used` (text) - Versão do prompt utilizado na análise
  - `confidence_score` (numeric) - Score de confiança da análise (0.0 a 1.0)
  - `total_red_flags` (integer) - Total de red flags identificados
  - `total_citations` (integer) - Total de citações/referências no documento
  - `processing_time_ms` (integer) - Tempo de processamento em milissegundos
  - `created_at` (timestamptz) - Data de criação
  - `updated_at` (timestamptz) - Data de atualização

  ## 2. Nova Tabela: forensic_prompts

  Armazena e versiona os prompts utilizados para análise forense.

  **Colunas:**
  - `id` (uuid, primary key) - Identificador único do prompt
  - `prompt_content` (text) - Conteúdo completo do prompt
  - `version` (integer) - Número da versão
  - `category` (text) - Categoria do prompt (ex: ANALISE_FORENSE_COMPLETA)
  - `expected_output_schema` (jsonb, nullable) - Schema esperado do JSON de saída
  - `is_active` (boolean) - Indica se é a versão ativa
  - `created_at` (timestamptz) - Data de criação
  - `updated_at` (timestamptz) - Data de atualização

  ## 3. Alterações na Tabela: processos

  Adiciona campos para rastreamento de análise forense:
  - `forensic_analysis_status` (text) - Status da análise: pending, processing, completed, failed
  - `current_forensic_analysis_id` (uuid, nullable) - Referência à análise forense atual
  - `analysis_mode` (text) - Modo de análise: transcription_only, forensic_analysis

  ## 4. Segurança (RLS)

  - Tabelas acessíveis para usuários autenticados
  - Service role tem acesso total para operações de sistema
*/

-- =====================================================
-- TABELA: analise_forense
-- =====================================================

CREATE TABLE IF NOT EXISTS analise_forense (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
  forensic_data jsonb NOT NULL,
  prompt_version_used text,
  confidence_score numeric,
  total_red_flags integer DEFAULT 0,
  total_citations integer DEFAULT 0,
  processing_time_ms integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices para otimização
CREATE INDEX IF NOT EXISTS idx_analise_forense_processo_id ON analise_forense(processo_id);
CREATE INDEX IF NOT EXISTS idx_analise_forense_created_at ON analise_forense(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analise_forense_confidence ON analise_forense(confidence_score DESC);

-- RLS
ALTER TABLE analise_forense ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem visualizar análises forenses"
  ON analise_forense
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role tem acesso total a análises forenses"
  ON analise_forense
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- TABELA: forensic_prompts
-- =====================================================

CREATE TABLE IF NOT EXISTS forensic_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_content text NOT NULL,
  version integer NOT NULL,
  category text NOT NULL DEFAULT 'ANALISE_FORENSE_COMPLETA',
  expected_output_schema jsonb,
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Garantir que apenas um prompt por categoria esteja ativo
CREATE UNIQUE INDEX IF NOT EXISTS idx_forensic_prompts_active_category
  ON forensic_prompts(category, is_active)
  WHERE is_active = true;

-- Índices adicionais
CREATE INDEX IF NOT EXISTS idx_forensic_prompts_category ON forensic_prompts(category);
CREATE INDEX IF NOT EXISTS idx_forensic_prompts_version ON forensic_prompts(version DESC);

-- RLS
ALTER TABLE forensic_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem visualizar prompts forenses"
  ON forensic_prompts
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role tem acesso total a prompts forenses"
  ON forensic_prompts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- ALTERAÇÕES NA TABELA: processos
-- =====================================================

-- Adicionar coluna de status de análise forense
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'processos' AND column_name = 'forensic_analysis_status'
  ) THEN
    ALTER TABLE processos ADD COLUMN forensic_analysis_status text DEFAULT 'pending';
  END IF;
END $$;

-- Adicionar coluna de referência à análise forense atual
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'processos' AND column_name = 'current_forensic_analysis_id'
  ) THEN
    ALTER TABLE processos ADD COLUMN current_forensic_analysis_id uuid REFERENCES analise_forense(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Adicionar coluna de modo de análise
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'processos' AND column_name = 'analysis_mode'
  ) THEN
    ALTER TABLE processos ADD COLUMN analysis_mode text DEFAULT 'transcription_only';
  END IF;
END $$;

-- Criar índices para as novas colunas
CREATE INDEX IF NOT EXISTS idx_processos_forensic_status ON processos(forensic_analysis_status);
CREATE INDEX IF NOT EXISTS idx_processos_forensic_analysis_id ON processos(current_forensic_analysis_id);
