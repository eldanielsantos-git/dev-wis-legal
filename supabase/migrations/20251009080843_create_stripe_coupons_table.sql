/*
  # Create Stripe Coupons Table

  1. New Tables
    - `stripe_coupons`
      - `id` (text, primary key) - Stripe coupon ID
      - `name` (text) - Coupon display name
      - `percent_off` (numeric) - Percentage discount (if applicable)
      - `amount_off` (numeric) - Fixed amount discount (if applicable)
      - `currency` (text) - Currency code (BRL, USD, etc)
      - `duration` (text) - Duration type (once, repeating, forever)
      - `duration_in_months` (integer) - Number of months if duration is repeating
      - `times_redeemed` (integer) - How many times this coupon has been used
      - `max_redemptions` (integer) - Maximum number of redemptions allowed
      - `valid` (boolean) - Whether the coupon is currently valid
      - `created_at` (timestamptz) - When the coupon was created
      - `updated_at` (timestamptz) - When the coupon was last updated

  2. Security
    - Enable RLS on `stripe_coupons` table
    - Add policy for service role to manage coupons
    - Add policy for admins to view coupons
*/

CREATE TABLE IF NOT EXISTS stripe_coupons (
  id text PRIMARY KEY,
  name text,
  percent_off numeric,
  amount_off numeric,
  currency text DEFAULT 'brl',
  duration text NOT NULL,
  duration_in_months integer,
  times_redeemed integer DEFAULT 0,
  max_redemptions integer,
  valid boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE stripe_coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage stripe coupons"
  ON stripe_coupons
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins can view stripe coupons"
  ON stripe_coupons
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE INDEX IF NOT EXISTS idx_stripe_coupons_valid ON stripe_coupons(valid);
CREATE INDEX IF NOT EXISTS idx_stripe_coupons_created_at ON stripe_coupons(created_at DESC);