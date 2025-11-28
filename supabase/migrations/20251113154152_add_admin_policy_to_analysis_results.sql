/*
  # Adicionar Política de Administrador para Analysis Results

  1. Mudanças de Segurança
    - Adiciona política para permitir que administradores visualizem todos os resultados de análise
    - Mantém política existente para usuários regulares visualizarem apenas seus próprios resultados
    - Service role mantém acesso total

  2. Estrutura de Políticas
    - SELECT: Usuários veem apenas resultados de seus processos, administradores veem todos
    - INSERT/UPDATE/DELETE: Mantém apenas service role (sem mudanças)

  3. Notas
    - A verificação de administrador é feita via user_profiles.is_admin
    - Política usa OR para permitir tanto usuários quanto admins
*/

-- Remove a política existente de SELECT
DROP POLICY IF EXISTS "Usuários podem visualizar seus próprios resultados" ON analysis_results;

-- Recria a política de SELECT com suporte para administradores
CREATE POLICY "Usuários podem visualizar seus próprios resultados" 
  ON analysis_results 
  FOR SELECT 
  TO authenticated 
  USING (
    -- Usuários regulares veem apenas seus próprios resultados
    EXISTS (
      SELECT 1 FROM processos 
      WHERE processos.id = analysis_results.processo_id 
      AND processos.user_id = auth.uid()
    )
    OR
    -- Administradores veem todos os resultados
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.is_admin = true
    )
  );
