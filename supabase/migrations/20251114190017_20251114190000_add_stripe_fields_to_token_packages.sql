/*
  # Add Stripe Fields to Token Packages

  1. Changes
    - Add stripe_product_id column to token_packages
    - Add checkout_url column to token_packages
    - Update existing packages with correct Product IDs

  2. Data Updates
    - Update packages with their respective Stripe Product IDs from stripe-config.ts
*/

-- Add columns to token_packages
ALTER TABLE token_packages
ADD COLUMN IF NOT EXISTS stripe_product_id text,
ADD COLUMN IF NOT EXISTS checkout_url text;

-- Update existing token packages with Product IDs and Checkout URLs from stripe-config.ts
UPDATE token_packages
SET
  stripe_product_id = 'prod_TCZYC41p0xOw3O',
  checkout_url = 'https://buy.stripe.com/14A9AU7EE4HedohczU7Re09'
WHERE stripe_price_id = 'price_1SGAPJJrr43cGTt4r7k4qYZe';

UPDATE token_packages
SET
  stripe_product_id = 'prod_TCZZzd2SrGSDlD',
  checkout_url = 'https://buy.stripe.com/28E14o2kk0qY5VP2Zk7Re0a'
WHERE stripe_price_id = 'price_1SGAQHJrr43cGTt4dKkvB9lD';

-- Add index on stripe_product_id
CREATE INDEX IF NOT EXISTS idx_token_packages_product_id ON token_packages(stripe_product_id);
