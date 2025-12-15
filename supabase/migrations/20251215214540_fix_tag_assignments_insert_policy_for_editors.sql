/*
  # Adicionar política INSERT para tags em processos compartilhados

  1. Nova Política RLS
    - Permite editores de workspace inserirem tags nos processos compartilhados
    - Usuários com permissão 'editor' podem gerenciar tags
    - Donos de processos continuam podendo gerenciar tags
  
  2. Segurança
    - Valida que o usuário tem permissão de editor no workspace_shares
    - Valida que o convite foi aceito (invitation_status = 'accepted')
    - Mantém permissões existentes para donos e admins
*/

-- Adicionar política de INSERT para processo_tag_assignments
CREATE POLICY "Users can assign tags to shared processos as editor"
  ON processo_tag_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Dono do processo
    EXISTS (
      SELECT 1 FROM processos
      WHERE processos.id = processo_tag_assignments.processo_id
      AND processos.user_id = auth.uid()
    )
    OR
    -- Editor do workspace
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
      AND user_profiles.is_admin = true
    )
  );
