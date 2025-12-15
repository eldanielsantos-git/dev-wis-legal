/*
  # Permitir que usuários convidados gerenciem tags

  1. Changes
    - Atualizar política de INSERT em processo_tag_assignments
      - Adicionar verificação para usuários com permissão 'editor' via workspace_shares
    - Atualizar política de DELETE em processo_tag_assignments
      - Adicionar verificação para usuários com permissão 'editor' via workspace_shares

  2. Rationale
    - Usuários convidados com permissão 'editor' devem poder gerenciar tags
    - Usuários com 'read_only' continuam sem poder modificar tags
    - Mantém a segurança permitindo apenas edição autorizada
*/

-- Drop políticas antigas
DROP POLICY IF EXISTS "Users can assign tags to own processos" ON processo_tag_assignments;
DROP POLICY IF EXISTS "Users can remove tags from own processos" ON processo_tag_assignments;

-- Nova política de INSERT: permite donos, admins e editores via workspace
CREATE POLICY "Users can assign tags to own processos"
  ON processo_tag_assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Dono do processo
    EXISTS (
      SELECT 1 FROM processos
      WHERE processos.id = processo_tag_assignments.processo_id
      AND processos.user_id = auth.uid()
    )
    OR
    -- Usuário convidado com permissão 'editor'
    EXISTS (
      SELECT 1 FROM workspace_shares
      WHERE workspace_shares.processo_id = processo_tag_assignments.processo_id
      AND workspace_shares.shared_with_user_id = auth.uid()
      AND workspace_shares.invitation_status = 'accepted'
      AND workspace_shares.permission_level = 'editor'
    )
    OR
    -- Admin
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.is_admin = TRUE
    )
  );

-- Nova política de DELETE: permite donos, admins e editores via workspace
CREATE POLICY "Users can remove tags from own processos"
  ON processo_tag_assignments FOR DELETE
  TO authenticated
  USING (
    -- Dono do processo
    EXISTS (
      SELECT 1 FROM processos
      WHERE processos.id = processo_tag_assignments.processo_id
      AND processos.user_id = auth.uid()
    )
    OR
    -- Usuário convidado com permissão 'editor'
    EXISTS (
      SELECT 1 FROM workspace_shares
      WHERE workspace_shares.processo_id = processo_tag_assignments.processo_id
      AND workspace_shares.shared_with_user_id = auth.uid()
      AND workspace_shares.invitation_status = 'accepted'
      AND workspace_shares.permission_level = 'editor'
    )
    OR
    -- Admin
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.is_admin = TRUE
    )
  );
