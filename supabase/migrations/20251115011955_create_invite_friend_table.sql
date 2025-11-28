/*
  # Sistema de Convite de Amigos

  1. Novas Tabelas
    - `invite_friend`
      - `id` (uuid, primary key) - Identificador único do convite
      - `inviter_user_id` (uuid, foreign key) - ID do usuário que enviou o convite
      - `invited_name` (text) - Nome do convidado
      - `invited_email` (text) - Email do convidado
      - `status` (text) - Status do convite (pending, accepted, expired)
      - `created_at` (timestamptz) - Data de criação do convite
      - `updated_at` (timestamptz) - Data de última atualização

  2. Segurança
    - Habilitar RLS na tabela `invite_friend`
    - Usuários autenticados podem inserir seus próprios convites
    - Usuários autenticados podem visualizar apenas seus próprios convites
    - Admins podem visualizar todos os convites

  3. Índices
    - Índice em `inviter_user_id` para otimizar busca de convites por usuário
    - Índice em `invited_email` para verificar duplicatas
    - Índice em `status` para filtrar convites por status

  4. Notas Importantes
    - Validação de email é feita no frontend e edge function
    - Status inicial é sempre 'pending'
    - Timestamps são gerenciados automaticamente
*/

-- Criar tabela invite_friend
CREATE TABLE IF NOT EXISTS invite_friend (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_name text NOT NULL,
  invited_email text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE invite_friend ENABLE ROW LEVEL SECURITY;

-- Política: Usuários autenticados podem inserir seus próprios convites
CREATE POLICY "Users can insert own invites"
  ON invite_friend FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = inviter_user_id);

-- Política: Usuários autenticados podem visualizar apenas seus próprios convites
CREATE POLICY "Users can view own invites"
  ON invite_friend FOR SELECT
  TO authenticated
  USING (auth.uid() = inviter_user_id);

-- Política: Admins podem visualizar todos os convites
CREATE POLICY "Admins can view all invites"
  ON invite_friend FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- Política: Usuários podem atualizar seus próprios convites
CREATE POLICY "Users can update own invites"
  ON invite_friend FOR UPDATE
  TO authenticated
  USING (auth.uid() = inviter_user_id)
  WITH CHECK (auth.uid() = inviter_user_id);

-- Criar índices para otimizar consultas
CREATE INDEX IF NOT EXISTS idx_invite_friend_inviter_user_id ON invite_friend(inviter_user_id);
CREATE INDEX IF NOT EXISTS idx_invite_friend_invited_email ON invite_friend(invited_email);
CREATE INDEX IF NOT EXISTS idx_invite_friend_status ON invite_friend(status);
CREATE INDEX IF NOT EXISTS idx_invite_friend_created_at ON invite_friend(created_at DESC);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_invite_friend_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at
CREATE TRIGGER trigger_update_invite_friend_updated_at
  BEFORE UPDATE ON invite_friend
  FOR EACH ROW
  EXECUTE FUNCTION update_invite_friend_updated_at();

-- Comentários nas colunas para documentação
COMMENT ON TABLE invite_friend IS 'Armazena convites enviados por usuários para amigos conhecerem a plataforma Wis Legal';
COMMENT ON COLUMN invite_friend.id IS 'Identificador único do convite';
COMMENT ON COLUMN invite_friend.inviter_user_id IS 'ID do usuário que enviou o convite';
COMMENT ON COLUMN invite_friend.invited_name IS 'Nome completo do convidado';
COMMENT ON COLUMN invite_friend.invited_email IS 'Email do convidado';
COMMENT ON COLUMN invite_friend.status IS 'Status do convite: pending, accepted, expired';
COMMENT ON COLUMN invite_friend.created_at IS 'Data e hora de criação do convite';
COMMENT ON COLUMN invite_friend.updated_at IS 'Data e hora da última atualização do convite';
