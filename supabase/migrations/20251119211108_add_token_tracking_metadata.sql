/*
  # Add Token Tracking Metadata

  1. Changes
    - Add `tokens_carried_forward` column to track tokens transferred from previous plans
    - Add `last_plan_change_at` column to track when the last plan change occurred
    - Add indexes for better query performance on token-related operations
    - Add comments to columns explaining the token management logic

  2. Purpose
    - Enable better auditing and tracking of token transfers between plans
    - Provide transparency on where extra tokens came from
    - Facilitate debugging and customer support for token-related issues

  3. Notes
    - tokens_carried_forward is informational only, doesn't affect calculations
    - Helps explain why a user might have more extra_tokens than expected
*/

-- Add tokens_carried_forward column to track tokens transferred from previous plans
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stripe_subscriptions' AND column_name = 'tokens_carried_forward'
  ) THEN
    ALTER TABLE stripe_subscriptions ADD COLUMN tokens_carried_forward bigint DEFAULT 0 NOT NULL;
    COMMENT ON COLUMN stripe_subscriptions.tokens_carried_forward IS 'Tokens transferred from previous plan when user changed subscription. These are added to extra_tokens for preservation.';
  END IF;
END $$;

-- Add last_plan_change_at column to track plan changes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stripe_subscriptions' AND column_name = 'last_plan_change_at'
  ) THEN
    ALTER TABLE stripe_subscriptions ADD COLUMN last_plan_change_at timestamptz DEFAULT NULL;
    COMMENT ON COLUMN stripe_subscriptions.last_plan_change_at IS 'Timestamp of the last plan change (upgrade/downgrade). Used to differentiate from billing period renewals.';
  END IF;
END $$;

-- Add comments to existing columns for clarity
COMMENT ON COLUMN stripe_subscriptions.plan_tokens IS 'Base tokens allocated by the current subscription plan. Resets on billing period renewal.';
COMMENT ON COLUMN stripe_subscriptions.extra_tokens IS 'Additional tokens: purchased token packages + tokens carried forward from plan changes. Never expire, accumulate indefinitely.';
COMMENT ON COLUMN stripe_subscriptions.tokens_used IS 'Tokens consumed from plan_tokens in current billing period. Resets to 0 on billing period renewal. Consumption order: plan_tokens first, then extra_tokens.';
COMMENT ON COLUMN stripe_subscriptions.tokens_total IS 'Auto-calculated as plan_tokens + extra_tokens. Total tokens available to user.';

-- Create index for efficient token balance queries
CREATE INDEX IF NOT EXISTS idx_stripe_subscriptions_tokens_balance
ON stripe_subscriptions(customer_id, status)
WHERE deleted_at IS NULL AND status IN ('active', 'trialing', 'canceled');

-- Create index for plan change tracking
CREATE INDEX IF NOT EXISTS idx_stripe_subscriptions_plan_changes
ON stripe_subscriptions(last_plan_change_at DESC)
WHERE last_plan_change_at IS NOT NULL AND deleted_at IS NULL;

-- Create view for easy token balance visualization
CREATE OR REPLACE VIEW user_token_balance AS
SELECT
  sc.user_id,
  up.email,
  COALESCE(up.first_name || ' ' || up.last_name, up.first_name, up.last_name) as name,
  ss.customer_id,
  ss.subscription_id,
  ss.status as subscription_status,
  ss.price_id,
  ss.plan_tokens,
  ss.extra_tokens,
  ss.tokens_used,
  ss.tokens_total,
  GREATEST(ss.plan_tokens - ss.tokens_used, 0) as available_plan_tokens,
  ss.extra_tokens as available_extra_tokens,
  GREATEST(ss.plan_tokens - ss.tokens_used, 0) + ss.extra_tokens as total_available_tokens,
  ss.tokens_carried_forward,
  ss.current_period_start,
  ss.current_period_end,
  ss.last_plan_change_at,
  ss.cancel_at_period_end,
  ss.updated_at
FROM stripe_subscriptions ss
JOIN stripe_customers sc ON ss.customer_id = sc.customer_id
LEFT JOIN user_profiles up ON sc.user_id = up.id
WHERE ss.deleted_at IS NULL
ORDER BY ss.updated_at DESC;

-- Grant access to the view
GRANT SELECT ON user_token_balance TO authenticated;
GRANT SELECT ON user_token_balance TO service_role;
