/*
  # Add Extra Tokens Tracking to Subscriptions
  
  1. Changes
    - Add `extra_tokens` column to `stripe_subscriptions` table
      - Tracks tokens purchased separately from the subscription plan
      - Default value: 0
      - Type: bigint
    - Add `plan_tokens` column to `stripe_subscriptions` table
      - Tracks base tokens from the subscription plan
      - Default value: 0
      - Type: bigint
  
  2. Purpose
    - Separate plan tokens from purchased token packages
    - Enable clear visualization: "Plan: X tokens + Extra: Y tokens"
    - Maintain accurate token accounting
  
  3. Notes
    - `tokens_total` will be calculated as plan_tokens + extra_tokens
    - Existing subscriptions will have their current tokens_total moved to plan_tokens
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stripe_subscriptions' AND column_name = 'extra_tokens'
  ) THEN
    ALTER TABLE stripe_subscriptions ADD COLUMN extra_tokens bigint DEFAULT 0 NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stripe_subscriptions' AND column_name = 'plan_tokens'
  ) THEN
    ALTER TABLE stripe_subscriptions ADD COLUMN plan_tokens bigint DEFAULT 0 NOT NULL;
  END IF;
END $$;

UPDATE stripe_subscriptions
SET plan_tokens = tokens_total,
    extra_tokens = 0
WHERE plan_tokens = 0 AND deleted_at IS NULL;
