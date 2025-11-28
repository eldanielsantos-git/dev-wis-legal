/*
  # Criação da Tabela de Prompts de Introdução do Chat

  ## Resumo

  Cria a tabela para gerenciar os prompts de introdução exibidos aos usuários
  quando iniciam uma conversa no chat. Estes prompts aparecem como sugestões
  clicáveis tanto na tela inicial do chat quanto no modal de "Dicas de Prompts".

  ## 1. Tabela: chat_intro_prompts

  Armazena os prompts de introdução que serão exibidos aos usuários.
  Administradores podem criar, editar, excluir e reordenar estes prompts.

  **Colunas:**
  - `id` (uuid, primary key) - Identificador único
  - `prompt_text` (text) - Texto completo do prompt
  - `display_order` (integer) - Ordem de exibição (números menores aparecem primeiro)
  - `is_active` (boolean) - Se o prompt está ativo e deve ser exibido
  - `created_at` (timestamptz) - Data de criação
  - `updated_at` (timestamptz) - Data de última atualização

  ## 2. Índices

  - Índice composto em (is_active, display_order) para queries otimizadas
  - Índice em display_order para ordenação rápida

  ## 3. Segurança (RLS)

  - Todos os usuários autenticados podem ler prompts ativos
  - Apenas administradores podem criar, editar ou excluir prompts
  - Service role tem acesso total para operações de sistema

  ## 4. Constraints

  - display_order deve ser positivo (>= 1)
  - Cada display_order deve ser único entre prompts ativos

  ## 5. Triggers

  - Trigger para atualizar automaticamente o campo updated_at
*/

-- =====================================================
-- TABELA: chat_intro_prompts
-- =====================================================

CREATE TABLE IF NOT EXISTS chat_intro_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_text text NOT NULL,
  display_order integer NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT check_display_order_positive CHECK (display_order >= 1)
);

-- Índices para otimização de queries
CREATE INDEX IF NOT EXISTS idx_chat_intro_prompts_active_order 
  ON chat_intro_prompts(is_active, display_order) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_chat_intro_prompts_display_order 
  ON chat_intro_prompts(display_order);

CREATE INDEX IF NOT EXISTS idx_chat_intro_prompts_created_at 
  ON chat_intro_prompts(created_at DESC);

-- =====================================================
-- RLS (Row Level Security)
-- =====================================================

ALTER TABLE chat_intro_prompts ENABLE ROW LEVEL SECURITY;

-- Todos os usuários autenticados podem visualizar prompts ativos
CREATE POLICY "Usuários autenticados podem visualizar prompts ativos"
  ON chat_intro_prompts
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Apenas administradores podem gerenciar prompts
CREATE POLICY "Apenas admins podem gerenciar prompts de chat"
  ON chat_intro_prompts
  FOR ALL
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

-- Service role tem acesso total
CREATE POLICY "Service role tem acesso total aos prompts de chat"
  ON chat_intro_prompts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- TRIGGER: Atualizar updated_at automaticamente
-- =====================================================

CREATE TRIGGER update_chat_intro_prompts_updated_at
  BEFORE UPDATE ON chat_intro_prompts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- COMENTÁRIOS PARA DOCUMENTAÇÃO
-- =====================================================

COMMENT ON TABLE chat_intro_prompts IS 'Armazena os prompts de introdução exibidos aos usuários na interface do chat';
COMMENT ON COLUMN chat_intro_prompts.prompt_text IS 'Texto completo do prompt que será exibido ao usuário';
COMMENT ON COLUMN chat_intro_prompts.display_order IS 'Ordem de exibição (números menores aparecem primeiro)';
COMMENT ON COLUMN chat_intro_prompts.is_active IS 'Indica se o prompt está ativo e deve ser exibido aos usuários';
