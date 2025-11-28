/*
  # Create Subscription Management Tables

  1. New Tables
    - `subscription_plans`
      - Stores subscription plan configurations (Essencial, Premium, Pro, Elite)
      - Includes price, tokens, Stripe Price ID, and active status

    - `subscription_plan_benefits`
      - Stores benefits that are displayed across all plans
      - Allows dynamic management of feature lists

    - `token_packages`
      - Stores token packages available for one-time purchase
      - Includes price, tokens, Stripe Price ID, and active status

    - `plan_configuration_audit`
      - Audit trail for all changes to plans, benefits, and packages
      - Tracks who changed what and when

  2. Security
    - Enable RLS on all tables
    - Service role has full access for edge functions
    - Admin users can read and manage all data
    - Authenticated users can read active plans and benefits

  3. Important Notes
    - Stripe Price IDs should never be modified after creation
    - All price changes should be made through new Stripe prices
    - The is_active flag controls visibility without deleting data
*/

-- Create subscription_plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  stripe_price_id text NOT NULL UNIQUE,
  price_brl numeric(10, 2) NOT NULL CHECK (price_brl > 0),
  tokens_included bigint NOT NULL CHECK (tokens_included > 0),
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create subscription_plan_benefits table
CREATE TABLE IF NOT EXISTS subscription_plan_benefits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  benefit_text text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create token_packages table
CREATE TABLE IF NOT EXISTS token_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  stripe_price_id text NOT NULL UNIQUE,
  price_brl numeric(10, 2) NOT NULL CHECK (price_brl > 0),
  tokens_amount bigint NOT NULL CHECK (tokens_amount > 0),
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create plan_configuration_audit table
CREATE TABLE IF NOT EXISTS plan_configuration_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_values jsonb,
  new_values jsonb,
  changed_by uuid REFERENCES auth.users(id),
  changed_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON subscription_plans(is_active);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_order ON subscription_plans(display_order);
CREATE INDEX IF NOT EXISTS idx_plan_benefits_active ON subscription_plan_benefits(is_active);
CREATE INDEX IF NOT EXISTS idx_plan_benefits_order ON subscription_plan_benefits(display_order);
CREATE INDEX IF NOT EXISTS idx_token_packages_active ON token_packages(is_active);
CREATE INDEX IF NOT EXISTS idx_token_packages_order ON token_packages(display_order);
CREATE INDEX IF NOT EXISTS idx_audit_table_name ON plan_configuration_audit(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_changed_at ON plan_configuration_audit(changed_at);

-- Enable RLS
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plan_benefits ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_configuration_audit ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscription_plans

-- Service role can do anything
CREATE POLICY "Service role can manage subscription_plans"
  ON subscription_plans
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users can read active plans
CREATE POLICY "Authenticated users can read active plans"
  ON subscription_plans
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Admin users can read all plans
CREATE POLICY "Admin users can read all plans"
  ON subscription_plans
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- Admin users can update plans
CREATE POLICY "Admin users can update plans"
  ON subscription_plans
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

-- RLS Policies for subscription_plan_benefits

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

-- RLS Policies for token_packages

-- Service role can do anything
CREATE POLICY "Service role can manage token_packages"
  ON token_packages
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users can read active packages
CREATE POLICY "Authenticated users can read active packages"
  ON token_packages
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Admin users can read all packages
CREATE POLICY "Admin users can read all packages"
  ON token_packages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- Admin users can update packages
CREATE POLICY "Admin users can update packages"
  ON token_packages
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

-- RLS Policies for plan_configuration_audit

-- Service role can do anything
CREATE POLICY "Service role can manage audit"
  ON plan_configuration_audit
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Admin users can read audit logs
CREATE POLICY "Admin users can read audit logs"
  ON plan_configuration_audit
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- Enable realtime for subscription tables
ALTER PUBLICATION supabase_realtime ADD TABLE subscription_plans;
ALTER PUBLICATION supabase_realtime ADD TABLE subscription_plan_benefits;
ALTER PUBLICATION supabase_realtime ADD TABLE token_packages;
