/*
  # Sistema Completo de Tags para Processos

  1. Nova Tabela: processo_tags
    - Armazena as tags disponíveis no sistema
    - Campos: id, name, slug, color, description, is_active, display_order, usage_count
    - Apenas admins podem criar/editar/deletar tags
    - Todos usuários autenticados podem visualizar tags ativas

  2. Nova Tabela: processo_tag_assignments
    - Relaciona processos com suas tags
    - Campos: id, processo_id, tag_id, assigned_by, assigned_at
    - Usuários podem atribuir tags aos próprios processos
    - Admins podem gerenciar tags de todos os processos

  3. Triggers e Functions
    - update_processo_tags_updated_at: atualiza timestamp ao modificar tag
    - update_tag_usage_count: atualiza contador de uso após assignment

  4. RLS Policies
    - processo_tags: leitura para autenticados, escrita apenas para admins
    - processo_tag_assignments: usuários gerenciam apenas próprios processos

  5. Dados Iniciais
    - 7 tags padrão pré-configuradas
*/

-- Criar tabela processo_tags
CREATE TABLE IF NOT EXISTS processo_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT UNIQUE NOT NULL,
  color TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  display_order INTEGER DEFAULT 0 NOT NULL,
  usage_count INTEGER DEFAULT 0 NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Criar índices para processo_tags
CREATE INDEX IF NOT EXISTS idx_processo_tags_slug ON processo_tags(slug);
CREATE INDEX IF NOT EXISTS idx_processo_tags_active ON processo_tags(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_processo_tags_display_order ON processo_tags(display_order);

-- Criar tabela processo_tag_assignments
CREATE TABLE IF NOT EXISTS processo_tag_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES processo_tags(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(processo_id, tag_id)
);

-- Criar índices para processo_tag_assignments
CREATE INDEX IF NOT EXISTS idx_tag_assignments_processo ON processo_tag_assignments(processo_id);
CREATE INDEX IF NOT EXISTS idx_tag_assignments_tag ON processo_tag_assignments(tag_id);
CREATE INDEX IF NOT EXISTS idx_tag_assignments_processo_tag ON processo_tag_assignments(processo_id, tag_id);

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_processo_tags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS trigger_update_processo_tags_updated_at ON processo_tags;
CREATE TRIGGER trigger_update_processo_tags_updated_at
  BEFORE UPDATE ON processo_tags
  FOR EACH ROW
  EXECUTE FUNCTION update_processo_tags_updated_at();

-- Função para atualizar usage_count
CREATE OR REPLACE FUNCTION update_tag_usage_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE processo_tags
    SET usage_count = usage_count + 1
    WHERE id = NEW.tag_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE processo_tags
    SET usage_count = GREATEST(usage_count - 1, 0)
    WHERE id = OLD.tag_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar usage_count
DROP TRIGGER IF EXISTS trigger_update_tag_usage_count ON processo_tag_assignments;
CREATE TRIGGER trigger_update_tag_usage_count
  AFTER INSERT OR DELETE ON processo_tag_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_tag_usage_count();

-- Habilitar RLS
ALTER TABLE processo_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE processo_tag_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies para processo_tags

-- Usuários autenticados podem ver tags ativas
DROP POLICY IF EXISTS "Authenticated users can view active tags" ON processo_tags;
CREATE POLICY "Authenticated users can view active tags"
  ON processo_tags FOR SELECT
  TO authenticated
  USING (is_active = TRUE);

-- Admins podem ver todas as tags
DROP POLICY IF EXISTS "Admins can view all tags" ON processo_tags;
CREATE POLICY "Admins can view all tags"
  ON processo_tags FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid() AND user_profiles.is_admin = TRUE
    )
  );

-- Apenas admins podem criar tags
DROP POLICY IF EXISTS "Only admins can create tags" ON processo_tags;
CREATE POLICY "Only admins can create tags"
  ON processo_tags FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid() AND user_profiles.is_admin = TRUE
    )
  );

-- Apenas admins podem atualizar tags
DROP POLICY IF EXISTS "Only admins can update tags" ON processo_tags;
CREATE POLICY "Only admins can update tags"
  ON processo_tags FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid() AND user_profiles.is_admin = TRUE
    )
  );

-- Apenas admins podem deletar tags
DROP POLICY IF EXISTS "Only admins can delete tags" ON processo_tags;
CREATE POLICY "Only admins can delete tags"
  ON processo_tags FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid() AND user_profiles.is_admin = TRUE
    )
  );

-- RLS Policies para processo_tag_assignments

-- Usuários podem ver tags de seus próprios processos ou processos compartilhados
DROP POLICY IF EXISTS "Users can view tags of own processos" ON processo_tag_assignments;
CREATE POLICY "Users can view tags of own processos"
  ON processo_tag_assignments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM processos
      WHERE processos.id = processo_tag_assignments.processo_id
      AND processos.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM workspace_shares
      WHERE workspace_shares.processo_id = processo_tag_assignments.processo_id
      AND workspace_shares.shared_with_email IN (
        SELECT email FROM user_profiles WHERE id = auth.uid()
      )
      AND workspace_shares.invitation_status = 'accepted'
    )
    OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid() AND user_profiles.is_admin = TRUE
    )
  );

-- Usuários podem atribuir tags aos próprios processos
DROP POLICY IF EXISTS "Users can assign tags to own processos" ON processo_tag_assignments;
CREATE POLICY "Users can assign tags to own processos"
  ON processo_tag_assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM processos
      WHERE processos.id = processo_tag_assignments.processo_id
      AND processos.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid() AND user_profiles.is_admin = TRUE
    )
  );

-- Usuários podem remover tags dos próprios processos
DROP POLICY IF EXISTS "Users can remove tags from own processos" ON processo_tag_assignments;
CREATE POLICY "Users can remove tags from own processos"
  ON processo_tag_assignments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM processos
      WHERE processos.id = processo_tag_assignments.processo_id
      AND processos.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid() AND user_profiles.is_admin = TRUE
    )
  );

-- Inserir tags padrão
INSERT INTO processo_tags (name, slug, color, description, display_order, created_at)
VALUES
  ('Em andamento', 'em-andamento', '#3B82F6', 'Processo em tramitação ativa', 1, NOW()),
  ('Encerrado', 'encerrado', '#6B7280', 'Processo finalizado', 2, NOW()),
  ('Ganho de causa', 'ganho-de-causa', '#10B981', 'Processo com resultado favorável', 3, NOW()),
  ('Causa perdida', 'causa-perdida', '#EF4444', 'Processo com resultado desfavorável', 4, NOW()),
  ('Risco Alto', 'risco-alto', '#DC2626', 'Processo com alto risco identificado', 5, NOW()),
  ('Risco Médio', 'risco-medio', '#F59E0B', 'Processo com risco moderado', 6, NOW()),
  ('Arquivado', 'arquivado', '#8B5CF6', 'Processo arquivado para consulta', 7, NOW())
ON CONFLICT (name) DO NOTHING;
