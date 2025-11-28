/*
  # Restructure Benefits to be Plan-Specific

  1. Changes
    - Drop old subscription_plan_benefits table
    - Create new subscription_plan_benefits table with plan_id foreign key
    - Each benefit is now tied to a specific plan
    - Allows independent benefit management per plan

  2. Data Migration
    - Populate benefits for all 4 plans with the correct benefit list:
      1. Análise com IA de processos completos
      2. Mapeamento dos pontos-chave
      3. Sumário contextual do processo
      4. Insights para estratégia processual
      5. Sugestões de teses e fundamentos
      6. Indicação de precedentes relevantes
      7. Análise de riscos e viabilidade
      8. Identificação de recursos viáveis
      9. Histórico seguro de análises

  3. Security
    - RLS policies remain the same structure
    - Admin can manage all benefits
    - Authenticated users can read active benefits
*/

-- Drop old table and recreate with plan relationship
DROP TABLE IF EXISTS subscription_plan_benefits CASCADE;

-- Create new structure with plan_id
CREATE TABLE subscription_plan_benefits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
  benefit_text text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_plan_benefits_plan_id ON subscription_plan_benefits(plan_id);
CREATE INDEX idx_plan_benefits_active ON subscription_plan_benefits(is_active);
CREATE INDEX idx_plan_benefits_order ON subscription_plan_benefits(display_order);

-- Enable RLS
ALTER TABLE subscription_plan_benefits ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Service role can do anything
CREATE POLICY "Service role can manage benefits"
  ON subscription_plan_benefits
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users can read active benefits
CREATE POLICY "Authenticated users can read active benefits"
  ON subscription_plan_benefits
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Admin users can read all benefits
CREATE POLICY "Admin users can read all benefits"
  ON subscription_plan_benefits
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- Admin users can insert benefits
CREATE POLICY "Admin users can insert benefits"
  ON subscription_plan_benefits
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- Admin users can update benefits
CREATE POLICY "Admin users can update benefits"
  ON subscription_plan_benefits
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- Admin users can delete benefits
CREATE POLICY "Admin users can delete benefits"
  ON subscription_plan_benefits
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE subscription_plan_benefits;

-- Populate benefits for all plans
DO $$
DECLARE
  v_plan_id uuid;
  v_benefit_texts text[] := ARRAY[
    'Análise com IA de processos completos',
    'Mapeamento dos pontos-chave',
    'Sumário contextual do processo',
    'Insights para estratégia processual',
    'Sugestões de teses e fundamentos',
    'Indicação de precedentes relevantes',
    'Análise de riscos e viabilidade',
    'Identificação de recursos viáveis',
    'Histórico seguro de análises'
  ];
  v_benefit text;
  v_order int;
BEGIN
  -- For each plan
  FOR v_plan_id IN
    SELECT id FROM subscription_plans ORDER BY display_order
  LOOP
    -- Insert all benefits
    v_order := 1;
    FOREACH v_benefit IN ARRAY v_benefit_texts
    LOOP
      INSERT INTO subscription_plan_benefits (plan_id, benefit_text, is_active, display_order)
      VALUES (v_plan_id, v_benefit, true, v_order);
      v_order := v_order + 1;
    END LOOP;
  END LOOP;
END $$;
