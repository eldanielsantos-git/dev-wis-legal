/*
  # Criar tabela tier_usage_stats

  1. Nova Tabela
    - `tier_usage_stats` - Estatísticas de uso por nível para monitoramento

  2. Segurança
    - RLS habilitado
    - Admins podem visualizar
    - Service role pode gerenciar

  3. Índices
    - tier_name + date para queries rápidas
    - date para queries de período
*/

-- =====================================================
-- 1. Criar tabela tier_usage_stats
-- =====================================================
CREATE TABLE IF NOT EXISTS tier_usage_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_name text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  total_processes integer DEFAULT 0,
  completed_processes integer DEFAULT 0,
  failed_processes integer DEFAULT 0,
  avg_duration_minutes numeric(10,2),
  total_pages_processed bigint DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tier_name, date)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_tier_usage_stats_tier_date ON tier_usage_stats(tier_name, date DESC);
CREATE INDEX IF NOT EXISTS idx_tier_usage_stats_date ON tier_usage_stats(date DESC);

ALTER TABLE tier_usage_stats ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 2. Políticas RLS
-- =====================================================
DROP POLICY IF EXISTS "Admins can view tier usage stats" ON tier_usage_stats;
CREATE POLICY "Admins can view tier usage stats"
  ON tier_usage_stats FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

DROP POLICY IF EXISTS "Service role can manage tier usage stats" ON tier_usage_stats;
CREATE POLICY "Service role can manage tier usage stats"
  ON tier_usage_stats FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);