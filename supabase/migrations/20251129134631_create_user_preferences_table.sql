/*
  # Criar Tabela de Preferências do Usuário

  ## Resumo
  Cria a tabela user_preferences para armazenar todas as preferências do usuário
  incluindo notificações, tema, e comunicações por email.

  ## Mudanças
  
  1. Nova Tabela: `user_preferences`
    - `id` (uuid, PK) - Identificador único
    - `user_id` (uuid, FK → auth.users, UNIQUE) - ID do usuário
    - `notify_process_completed` (boolean) - Alertas de processos concluídos
    - `notify_invites` (boolean) - Alertas de convites
    - `sound_enabled` (boolean) - Alertas sonoros
    - `theme_preference` (text) - Tema visual (dark/light)
    - `email_launches` (boolean) - Emails sobre lançamentos
    - `email_offers` (boolean) - Emails de ofertas
    - `created_at` (timestamptz) - Data de criação
    - `updated_at` (timestamptz) - Data de atualização

  2. Índices
    - Índice único em user_id para busca rápida
    - Índice em theme_preference para queries de tema

  3. Segurança
    - RLS habilitado
    - Usuários podem ler e atualizar apenas suas próprias preferências
    - Service role tem acesso completo

  4. Triggers
    - Trigger para atualizar updated_at automaticamente
    - Trigger para criar preferências padrão em novo usuário
*/

-- =====================================================
-- 1. CRIAR TABELA USER_PREFERENCES
-- =====================================================

CREATE TABLE IF NOT EXISTS user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notify_process_completed boolean NOT NULL DEFAULT true,
  notify_invites boolean NOT NULL DEFAULT true,
  sound_enabled boolean NOT NULL DEFAULT true,
  theme_preference text NOT NULL DEFAULT 'dark' CHECK (theme_preference IN ('dark', 'light')),
  email_launches boolean NOT NULL DEFAULT false,
  email_offers boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_preferences_user_id_unique UNIQUE (user_id)
);

-- =====================================================
-- 2. CRIAR ÍNDICES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id 
ON user_preferences(user_id);

CREATE INDEX IF NOT EXISTS idx_user_preferences_theme 
ON user_preferences(theme_preference);

-- =====================================================
-- 3. HABILITAR RLS
-- =====================================================

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 4. CRIAR POLÍTICAS RLS
-- =====================================================

-- Usuários podem ler suas próprias preferências
CREATE POLICY "Users can view own preferences"
  ON user_preferences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Usuários podem inserir suas próprias preferências
CREATE POLICY "Users can insert own preferences"
  ON user_preferences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Usuários podem atualizar suas próprias preferências
CREATE POLICY "Users can update own preferences"
  ON user_preferences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role pode fazer tudo
CREATE POLICY "Service role can manage all preferences"
  ON user_preferences FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- 5. FUNÇÃO PARA ATUALIZAR UPDATED_AT
-- =====================================================

CREATE OR REPLACE FUNCTION update_user_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. TRIGGER PARA UPDATED_AT
-- =====================================================

DROP TRIGGER IF EXISTS trigger_update_user_preferences_updated_at ON user_preferences;

CREATE TRIGGER trigger_update_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_user_preferences_updated_at();

-- =====================================================
-- 7. FUNÇÃO PARA CRIAR PREFERÊNCIAS PADRÃO
-- =====================================================

CREATE OR REPLACE FUNCTION create_default_user_preferences()
RETURNS TRIGGER AS $$
BEGIN
  -- Criar preferências padrão para novo usuário
  INSERT INTO user_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 8. TRIGGER PARA CRIAR PREFERÊNCIAS EM NOVO USUÁRIO
-- =====================================================

DROP TRIGGER IF EXISTS trigger_create_default_user_preferences ON auth.users;

CREATE TRIGGER trigger_create_default_user_preferences
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_user_preferences();

-- =====================================================
-- 9. POPULAR PREFERÊNCIAS PARA USUÁRIOS EXISTENTES
-- =====================================================

-- Inserir preferências padrão para usuários que ainda não têm
INSERT INTO user_preferences (user_id)
SELECT id 
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM user_preferences)
ON CONFLICT (user_id) DO NOTHING;

-- =====================================================
-- 10. COMENTÁRIOS DA TABELA
-- =====================================================

COMMENT ON TABLE user_preferences IS 
'Armazena preferências do usuário incluindo notificações, tema e emails';

COMMENT ON COLUMN user_preferences.notify_process_completed IS 
'Se o usuário quer receber alertas quando processos forem concluídos';

COMMENT ON COLUMN user_preferences.notify_invites IS 
'Se o usuário quer receber alertas de convites para workspaces';

COMMENT ON COLUMN user_preferences.sound_enabled IS 
'Se os alertas devem ser sonoros';

COMMENT ON COLUMN user_preferences.theme_preference IS 
'Tema visual do usuário (dark ou light)';

COMMENT ON COLUMN user_preferences.email_launches IS 
'Se o usuário quer receber emails sobre novos lançamentos';

COMMENT ON COLUMN user_preferences.email_offers IS 
'Se o usuário aceita receber ofertas da Wis Legal e parceiros';

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================

DO $$
DECLARE
  prefs_count INTEGER;
  users_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO prefs_count FROM user_preferences;
  SELECT COUNT(*) INTO users_count FROM auth.users;
  
  RAISE NOTICE '✓ Tabela user_preferences criada com sucesso';
  RAISE NOTICE '✓ % usuário(s) com preferências criadas', prefs_count;
  RAISE NOTICE '✓ Total de usuários no sistema: %', users_count;
END $$;
