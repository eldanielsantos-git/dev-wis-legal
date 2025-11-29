/*
  # Migrar Theme Preference para User Preferences

  ## Resumo
  Migra os dados de theme_preference da tabela user_profiles para a nova
  tabela user_preferences. Mantém compatibilidade retroativa.

  ## Mudanças
  
  1. Copiar theme_preference de user_profiles para user_preferences
  2. Atualizar registros existentes que ainda não têm preferências
  3. Criar função de sincronização temporária
  4. Manter coluna antiga temporariamente para compatibilidade

  ## Notas
  - user_profiles.id = user_preferences.user_id (ambos referenciam auth.users.id)
  - Dados são copiados, não movidos (coluna antiga mantida)
  - Preferências futuras devem usar user_preferences
  - user_profiles.theme_preference pode ser depreciado futuramente
*/

-- =====================================================
-- 1. MIGRAR DADOS DE THEME_PREFERENCE
-- =====================================================

-- Atualizar user_preferences com theme_preference de user_profiles
UPDATE user_preferences up
SET theme_preference = COALESCE(
  (SELECT theme_preference 
   FROM user_profiles prof 
   WHERE prof.id = up.user_id),
  'dark'
)
WHERE EXISTS (
  SELECT 1 
  FROM user_profiles prof 
  WHERE prof.id = up.user_id
  AND prof.theme_preference IS NOT NULL
);

-- =====================================================
-- 2. CRIAR FUNÇÃO DE SINCRONIZAÇÃO (TEMPORÁRIA)
-- =====================================================

-- Função para sincronizar mudanças de tema entre as duas tabelas
-- (mantém compatibilidade durante período de transição)
CREATE OR REPLACE FUNCTION sync_theme_preference_to_profiles()
RETURNS TRIGGER AS $$
BEGIN
  -- Quando user_preferences é atualizado, atualiza user_profiles também
  UPDATE user_profiles
  SET theme_preference = NEW.theme_preference
  WHERE id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 3. TRIGGER DE SINCRONIZAÇÃO (TEMPORÁRIO)
-- =====================================================

-- Trigger para manter sincronização temporária
DROP TRIGGER IF EXISTS trigger_sync_theme_to_profiles ON user_preferences;

CREATE TRIGGER trigger_sync_theme_to_profiles
  AFTER UPDATE OF theme_preference ON user_preferences
  FOR EACH ROW
  WHEN (OLD.theme_preference IS DISTINCT FROM NEW.theme_preference)
  EXECUTE FUNCTION sync_theme_preference_to_profiles();

-- =====================================================
-- 4. COMENTÁRIOS
-- =====================================================

COMMENT ON TRIGGER trigger_sync_theme_to_profiles ON user_preferences IS
'Sincronização temporária: atualiza user_profiles quando tema muda em user_preferences. Pode ser removido no futuro.';

COMMENT ON FUNCTION sync_theme_preference_to_profiles() IS
'Função temporária de sincronização entre user_preferences e user_profiles. Será depreciada.';

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================

DO $$
DECLARE
  synced_count INTEGER;
  prefs_count INTEGER;
  profiles_count INTEGER;
  dark_count INTEGER;
  light_count INTEGER;
BEGIN
  -- Contar registros sincronizados
  SELECT COUNT(*) INTO synced_count
  FROM user_preferences up
  INNER JOIN user_profiles prof ON up.user_id = prof.id
  WHERE up.theme_preference = prof.theme_preference;
  
  SELECT COUNT(*) INTO prefs_count FROM user_preferences;
  SELECT COUNT(*) INTO profiles_count FROM user_profiles;
  
  SELECT COUNT(*) INTO dark_count 
  FROM user_preferences WHERE theme_preference = 'dark';
  
  SELECT COUNT(*) INTO light_count 
  FROM user_preferences WHERE theme_preference = 'light';
  
  RAISE NOTICE '✓ Migração de theme_preference concluída';
  RAISE NOTICE '✓ % registro(s) em user_preferences', prefs_count;
  RAISE NOTICE '✓ % registro(s) em user_profiles', profiles_count;
  RAISE NOTICE '✓ % registro(s) com tema sincronizado', synced_count;
  RAISE NOTICE '✓ Tema escuro: %, Tema claro: %', dark_count, light_count;
END $$;
