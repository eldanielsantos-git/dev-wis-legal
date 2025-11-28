/*
  # Fix Admin Permissions for All Tables

  1. Problemas Identificados
    - Processos: Usa auth.jwt() ->> 'user_role' que NÃO EXISTE (deve usar is_admin da user_profiles)
    - Chat_messages: Admin pode VER mas não pode DELETAR mensagens de outros usuários
    - Paginas: Tem policies conflitantes (Anyone can read + Users can view own)
    - Process_chunks: Admin pode ver e atualizar mas não pode DELETAR chunks de outros usuários

  2. Solução
    - Processos: Corrigir para usar is_admin() ao invés de auth.jwt()
    - Chat_messages: Adicionar policy de DELETE para admins
    - Paginas: Remover policies conflitantes e deixar apenas admin + owner
    - Process_chunks: Adicionar policy de DELETE para admins

  3. Segurança
    - Mantém isolamento entre usuários normais
    - Admin tem acesso total para suporte e manutenção
    - Service role mantém acesso total
*/

-- ========================================
-- 1. CORRIGIR PROCESSOS
-- ========================================

-- Remover policies antigas que usam auth.jwt() incorretamente
DROP POLICY IF EXISTS "Allow users to delete own processos or admins to delete all" ON processos;
DROP POLICY IF EXISTS "Allow users to view own processos or admins to view all" ON processos;
DROP POLICY IF EXISTS "Allow users to update own processos or admins to update all" ON processos;

-- Recriar policies com verificação correta de admin
CREATE POLICY "Users can delete own processos or admins can delete all"
  ON processos
  FOR DELETE
  TO authenticated
  USING (
    (auth.uid() = user_id) 
    OR 
    (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true))
  );

CREATE POLICY "Users can view own processos or admins can view all"
  ON processos
  FOR SELECT
  TO authenticated
  USING (
    (auth.uid() = user_id) 
    OR 
    (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true))
  );

CREATE POLICY "Users can update own processos or admins can update all"
  ON processos
  FOR UPDATE
  TO authenticated
  USING (
    (auth.uid() = user_id) 
    OR 
    (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true))
  )
  WITH CHECK (
    (auth.uid() = user_id) 
    OR 
    (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true))
  );

-- ========================================
-- 2. ADICIONAR DELETE PARA ADMINS EM CHAT_MESSAGES
-- ========================================

CREATE POLICY "Admins can delete all chat messages"
  ON chat_messages
  FOR DELETE
  TO authenticated
  USING (is_admin_user());

-- ========================================
-- 3. LIMPAR PAGINAS (REMOVER POLICIES CONFLITANTES)
-- ========================================

-- Remover policies conflitantes
DROP POLICY IF EXISTS "Anyone can read pages" ON paginas;
DROP POLICY IF EXISTS "Authenticated users can read pages" ON paginas;

-- Criar policy correta: apenas owner ou admin podem ver
CREATE POLICY "Users can view own paginas or admins can view all"
  ON paginas
  FOR SELECT
  TO authenticated
  USING (
    (EXISTS (SELECT 1 FROM processos p WHERE p.id = paginas.processo_id AND p.user_id = auth.uid()))
    OR
    (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true))
  );

-- ========================================
-- 4. ADICIONAR DELETE PARA ADMINS EM PROCESS_CHUNKS
-- ========================================

CREATE POLICY "Admins can delete all chunks"
  ON process_chunks
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
  );
