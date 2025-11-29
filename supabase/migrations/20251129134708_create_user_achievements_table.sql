/*
  # Criar Tabela de Conquistas do Usuário

  ## Resumo
  Cria sistema de gamificação com conquistas baseadas no número de processos
  analisados. As conquistas são desbloqueadas automaticamente.

  ## Mudanças
  
  1. Nova Tabela: `user_achievements`
    - `id` (uuid, PK) - Identificador único
    - `user_id` (uuid, FK → auth.users) - ID do usuário
    - `achievement_type` (text) - Tipo da conquista
    - `unlocked_at` (timestamptz) - Quando foi desbloqueada
    - `created_at` (timestamptz) - Data de criação

  2. Tipos de Conquistas (achievement_type)
    - `first_process` - 1 processo analisado
    - `three_processes` - 3 processos analisados
    - `ten_processes` - 10 processos analisados
    - `fifty_processes` - 50 processos analisados
    - `hundred_processes` - 100 processos analisados

  3. Constraints
    - Unique em (user_id, achievement_type) - Uma conquista por usuário
    - Check constraint nos tipos de conquista permitidos

  4. Índices
    - Índice em user_id para busca rápida
    - Índice em unlocked_at para ordenação

  5. Segurança
    - RLS habilitado
    - Usuários podem ler apenas suas próprias conquistas
    - Service role pode inserir e ler todas
*/

-- =====================================================
-- 1. CRIAR TABELA USER_ACHIEVEMENTS
-- =====================================================

CREATE TABLE IF NOT EXISTS user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_type text NOT NULL CHECK (
    achievement_type IN (
      'first_process',
      'three_processes',
      'ten_processes',
      'fifty_processes',
      'hundred_processes'
    )
  ),
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_achievements_unique UNIQUE (user_id, achievement_type)
);

-- =====================================================
-- 2. CRIAR ÍNDICES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id 
ON user_achievements(user_id);

CREATE INDEX IF NOT EXISTS idx_user_achievements_unlocked_at 
ON user_achievements(unlocked_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_achievements_type 
ON user_achievements(achievement_type);

-- =====================================================
-- 3. HABILITAR RLS
-- =====================================================

ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 4. CRIAR POLÍTICAS RLS
-- =====================================================

-- Usuários podem ler suas próprias conquistas
CREATE POLICY "Users can view own achievements"
  ON user_achievements FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role pode inserir conquistas
CREATE POLICY "Service role can insert achievements"
  ON user_achievements FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Service role pode ler todas as conquistas
CREATE POLICY "Service role can view all achievements"
  ON user_achievements FOR SELECT
  TO service_role
  USING (true);

-- Service role pode deletar conquistas (para testes/correções)
CREATE POLICY "Service role can delete achievements"
  ON user_achievements FOR DELETE
  TO service_role
  USING (true);

-- =====================================================
-- 5. FUNÇÃO PARA CONTAR PROCESSOS COMPLETADOS
-- =====================================================

CREATE OR REPLACE FUNCTION count_completed_processes(p_user_id uuid)
RETURNS integer AS $$
DECLARE
  completed_count integer;
BEGIN
  SELECT COUNT(*)
  INTO completed_count
  FROM processos
  WHERE user_id = p_user_id
    AND status = 'completed';
  
  RETURN completed_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. FUNÇÃO PARA DESBLOQUEAR CONQUISTAS
-- =====================================================

CREATE OR REPLACE FUNCTION unlock_achievement_if_eligible(
  p_user_id uuid,
  p_completed_count integer
)
RETURNS void AS $$
BEGIN
  -- 1 processo = first_process
  IF p_completed_count >= 1 THEN
    INSERT INTO user_achievements (user_id, achievement_type)
    VALUES (p_user_id, 'first_process')
    ON CONFLICT (user_id, achievement_type) DO NOTHING;
  END IF;

  -- 3 processos = three_processes
  IF p_completed_count >= 3 THEN
    INSERT INTO user_achievements (user_id, achievement_type)
    VALUES (p_user_id, 'three_processes')
    ON CONFLICT (user_id, achievement_type) DO NOTHING;
  END IF;

  -- 10 processos = ten_processes
  IF p_completed_count >= 10 THEN
    INSERT INTO user_achievements (user_id, achievement_type)
    VALUES (p_user_id, 'ten_processes')
    ON CONFLICT (user_id, achievement_type) DO NOTHING;
  END IF;

  -- 50 processos = fifty_processes
  IF p_completed_count >= 50 THEN
    INSERT INTO user_achievements (user_id, achievement_type)
    VALUES (p_user_id, 'fifty_processes')
    ON CONFLICT (user_id, achievement_type) DO NOTHING;
  END IF;

  -- 100 processos = hundred_processes
  IF p_completed_count >= 100 THEN
    INSERT INTO user_achievements (user_id, achievement_type)
    VALUES (p_user_id, 'hundred_processes')
    ON CONFLICT (user_id, achievement_type) DO NOTHING;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 7. TRIGGER PARA DESBLOQUEAR AUTOMATICAMENTE
-- =====================================================

CREATE OR REPLACE FUNCTION check_and_unlock_achievements()
RETURNS TRIGGER AS $$
DECLARE
  completed_count integer;
BEGIN
  -- Só processar se o status mudou para 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Contar processos completados do usuário
    completed_count := count_completed_processes(NEW.user_id);
    
    -- Desbloquear conquistas elegíveis
    PERFORM unlock_achievement_if_eligible(NEW.user_id, completed_count);
    
    RAISE NOTICE 'Usuário % tem % processos completados', NEW.user_id, completed_count;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger na tabela processos
DROP TRIGGER IF EXISTS trigger_check_achievements ON processos;

CREATE TRIGGER trigger_check_achievements
  AFTER INSERT OR UPDATE OF status ON processos
  FOR EACH ROW
  EXECUTE FUNCTION check_and_unlock_achievements();

-- =====================================================
-- 8. POPULAR CONQUISTAS RETROATIVAMENTE
-- =====================================================

-- Popular conquistas para usuários existentes baseado em processos já completados
DO $$
DECLARE
  user_record RECORD;
  completed_count integer;
  achievements_created integer := 0;
BEGIN
  -- Para cada usuário no sistema
  FOR user_record IN 
    SELECT DISTINCT user_id 
    FROM processos 
    WHERE status = 'completed'
  LOOP
    -- Contar processos completados
    completed_count := count_completed_processes(user_record.user_id);
    
    -- Desbloquear conquistas apropriadas
    PERFORM unlock_achievement_if_eligible(user_record.user_id, completed_count);
    
    achievements_created := achievements_created + 1;
  END LOOP;
  
  RAISE NOTICE '✓ Conquistas retroativas processadas para % usuário(s)', achievements_created;
END $$;

-- =====================================================
-- 9. COMENTÁRIOS DA TABELA
-- =====================================================

COMMENT ON TABLE user_achievements IS 
'Sistema de gamificação com conquistas baseadas em processos analisados';

COMMENT ON COLUMN user_achievements.achievement_type IS 
'Tipo da conquista: first_process (1), three_processes (3), ten_processes (10), fifty_processes (50), hundred_processes (100)';

COMMENT ON COLUMN user_achievements.unlocked_at IS 
'Data e hora em que a conquista foi desbloqueada';

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================

DO $$
DECLARE
  achievements_count INTEGER;
  users_with_achievements INTEGER;
BEGIN
  SELECT COUNT(*) INTO achievements_count FROM user_achievements;
  SELECT COUNT(DISTINCT user_id) INTO users_with_achievements FROM user_achievements;
  
  RAISE NOTICE '✓ Tabela user_achievements criada com sucesso';
  RAISE NOTICE '✓ % conquista(s) desbloqueada(s) no total', achievements_count;
  RAISE NOTICE '✓ % usuário(s) com conquistas', users_with_achievements;
END $$;
