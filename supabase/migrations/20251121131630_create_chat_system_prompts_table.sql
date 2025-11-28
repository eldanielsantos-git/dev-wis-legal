/*
  # Criação da Tabela de Prompts do Sistema de Chat

  ## Resumo

  Cria a tabela para gerenciar os system prompts utilizados pela funcionalidade de chat.
  Os prompts são dinâmicos e gerenciados via admin, suportando 3 tipos diferentes de
  arquivos: pequenos, grandes com chunks, e grandes com análises consolidadas.

  ## 1. Tabela: chat_system_prompts

  Armazena os system prompts que definem o comportamento do assistente de chat
  para diferentes cenários de tamanho de arquivo.

  **Colunas:**
  - `id` (uuid, primary key) - Identificador único
  - `prompt_type` (text) - Tipo do prompt: 'small_file', 'large_file_chunks', 'large_file_analysis'
  - `system_prompt` (text, NOT NULL) - Conteúdo do system prompt usado pelo LLM
  - `description` (text) - Descrição do propósito deste prompt
  - `is_active` (boolean) - Se este prompt está ativo e deve ser usado
  - `priority` (integer) - Prioridade de seleção (menor número = maior prioridade)
  - `max_pages` (integer, nullable) - Limite máximo de páginas para este prompt
  - `max_chunks` (integer, nullable) - Limite máximo de chunks para este prompt
  - `created_at` (timestamptz) - Data de criação
  - `updated_at` (timestamptz) - Data de última atualização

  ## 2. Tipos de Prompts

  - **small_file**: Para processos com PDF completo em base64 (< 1000 páginas)
  - **large_file_chunks**: Para processos grandes divididos em chunks (até 10 chunks)
  - **large_file_analysis**: Para processos muito grandes usando análises consolidadas (> 10 chunks)

  ## 3. Índices

  - Índice composto em (prompt_type, is_active, priority) para queries otimizadas
  - Índice em created_at para ordenação temporal

  ## 4. Segurança (RLS)

  - Todos os usuários autenticados podem ler prompts ativos
  - Apenas administradores podem criar, editar ou excluir prompts
  - Service role tem acesso total

  ## 5. Constraints

  - prompt_type deve ser um dos 3 valores permitidos
  - Apenas um prompt ativo por tipo (garantido via constraint única)
  - system_prompt não pode estar vazio
  - priority deve ser positivo
*/

-- =====================================================
-- TABELA: chat_system_prompts
-- =====================================================

CREATE TABLE IF NOT EXISTS chat_system_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_type text NOT NULL,
  system_prompt text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  priority integer DEFAULT 1,
  max_pages integer,
  max_chunks integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Constraint para validar tipos de prompts permitidos
  CONSTRAINT check_prompt_type CHECK (
    prompt_type IN ('small_file', 'large_file_chunks', 'large_file_analysis')
  ),

  -- System prompt não pode estar vazio
  CONSTRAINT check_system_prompt_not_empty CHECK (
    length(trim(system_prompt)) > 0
  ),

  -- Priority deve ser positivo
  CONSTRAINT check_priority_positive CHECK (priority >= 1)
);

-- Constraint única: Apenas um prompt ativo por tipo
-- Isso garante que não haverá conflito ao buscar o prompt ativo
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_system_prompts_unique_active_type
  ON chat_system_prompts(prompt_type, is_active)
  WHERE is_active = true;

-- Índice para otimizar busca por tipo e status ativo
CREATE INDEX IF NOT EXISTS idx_chat_system_prompts_type_active_priority
  ON chat_system_prompts(prompt_type, is_active, priority);

-- Índice para ordenação temporal
CREATE INDEX IF NOT EXISTS idx_chat_system_prompts_created_at
  ON chat_system_prompts(created_at DESC);

-- =====================================================
-- RLS (Row Level Security)
-- =====================================================

ALTER TABLE chat_system_prompts ENABLE ROW LEVEL SECURITY;

-- Todos os usuários autenticados podem visualizar prompts ativos
CREATE POLICY "Usuários autenticados podem visualizar prompts ativos do chat"
  ON chat_system_prompts
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Apenas administradores podem gerenciar prompts
CREATE POLICY "Apenas admins podem gerenciar prompts do chat"
  ON chat_system_prompts
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
CREATE POLICY "Service role tem acesso total aos prompts do chat"
  ON chat_system_prompts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- TRIGGER: Atualizar updated_at automaticamente
-- =====================================================

CREATE TRIGGER update_chat_system_prompts_updated_at
  BEFORE UPDATE ON chat_system_prompts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- COMENTÁRIOS PARA DOCUMENTAÇÃO
-- =====================================================

COMMENT ON TABLE chat_system_prompts IS 'Armazena os system prompts utilizados pela funcionalidade de chat para diferentes cenários de arquivo';
COMMENT ON COLUMN chat_system_prompts.prompt_type IS 'Tipo do prompt: small_file (< 1000 pgs), large_file_chunks (até 10 chunks), large_file_analysis (> 10 chunks)';
COMMENT ON COLUMN chat_system_prompts.system_prompt IS 'Conteúdo completo do system prompt enviado ao LLM. Suporta variáveis: {processo_name}, {total_pages}, {chunks_count}';
COMMENT ON COLUMN chat_system_prompts.description IS 'Descrição do propósito e contexto de uso deste prompt';
COMMENT ON COLUMN chat_system_prompts.is_active IS 'Indica se este prompt está ativo. Apenas um prompt ativo por tipo é permitido';
COMMENT ON COLUMN chat_system_prompts.priority IS 'Prioridade de seleção quando múltiplos prompts existem (menor número = maior prioridade)';
COMMENT ON COLUMN chat_system_prompts.max_pages IS 'Limite máximo de páginas para aplicação deste prompt (informativo)';
COMMENT ON COLUMN chat_system_prompts.max_chunks IS 'Limite máximo de chunks para aplicação deste prompt (informativo)';
