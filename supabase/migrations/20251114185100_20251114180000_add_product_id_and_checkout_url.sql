/*
  # Add Product ID and Checkout URL to Plans

  1. Changes
    - Add stripe_product_id column to subscription_plans
    - Add checkout_url column to subscription_plans
    - Update existing plans with correct Stripe Product IDs

  2. Data Updates
    - Essencial: prod_TCSvtM9pDVEFS9
    - Premium: prod_TCSwuloaO4vRHL
    - Pro: prod_TCSxhO2q0Ildqh
    - Elite: prod_TCSzedbK2kedbR
*/

-- Add columns to subscription_plans
ALTER TABLE subscription_plans
ADD COLUMN IF NOT EXISTS stripe_product_id text,
ADD COLUMN IF NOT EXISTS checkout_url text;

-- Update existing plans with Product IDs
UPDATE subscription_plans
SET stripe_product_id = 'prod_TCSvtM9pDVEFS9'
WHERE name = 'Essencial';

UPDATE subscription_plans
SET stripe_product_id = 'prod_TCSwuloaO4vRHL'
WHERE name = 'Premium';

UPDATE subscription_plans
SET stripe_product_id = 'prod_TCSxhO2q0Ildqh'
WHERE name = 'Pro';

UPDATE subscription_plans
SET stripe_product_id = 'prod_TCSzedbK2kedbR'
WHERE name = 'Elite';

-- Add index on stripe_product_id
CREATE INDEX IF NOT EXISTS idx_subscription_plans_product_id ON subscription_plans(stripe_product_id);
