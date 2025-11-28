/*
  # Update plan_tokens to Match subscription_plans Table

  1. Problem Summary
    - Edge functions had hardcoded token values (1.2M, 4M, 8M, 20M)
    - Admin updated subscription_plans to new values (4.4M, 12M, 24M, 60M)
    - Users' stripe_subscriptions.plan_tokens still have old values
    - Banner shows incorrect token count

  2. Solution
    - Update getPlanTokensFromPriceId() functions to fetch from subscription_plans table
    - Migrate existing users' plan_tokens to match current subscription_plans values

  3. Changes
    - Update all active subscriptions to use tokens_included from subscription_plans
    - Preserve extra_tokens (purchased + carried forward)
    - Recalculate tokens_total automatically via trigger

  4. Safety
    - Only updates plan_tokens, never removes tokens
    - extra_tokens remain untouched
    - tokens_used reset if they exceed new plan_tokens (prevents negative balances)
    - Audit log records all changes
*/

-- Update plan_tokens for all active subscriptions based on subscription_plans
DO $$
DECLARE
  sub_record RECORD;
  new_plan_tokens bigint;
  old_plan_tokens bigint;
  tokens_difference bigint;
  updated_count integer := 0;
BEGIN
  RAISE NOTICE 'Starting plan_tokens update from subscription_plans table...';

  -- Loop through all active subscriptions
  FOR sub_record IN
    SELECT 
      ss.id,
      ss.customer_id,
      ss.subscription_id,
      ss.price_id,
      ss.plan_tokens as current_plan_tokens,
      ss.extra_tokens,
      ss.tokens_used,
      ss.tokens_total,
      sp.tokens_included as correct_plan_tokens
    FROM stripe_subscriptions ss
    LEFT JOIN subscription_plans sp ON ss.price_id = sp.stripe_price_id
    WHERE ss.deleted_at IS NULL
      AND ss.status IN ('active', 'trialing')
      AND sp.is_active = true
      AND ss.plan_tokens != sp.tokens_included
    ORDER BY ss.updated_at DESC
  LOOP
    old_plan_tokens := sub_record.current_plan_tokens;
    new_plan_tokens := sub_record.correct_plan_tokens;
    tokens_difference := new_plan_tokens - old_plan_tokens;

    RAISE NOTICE 'Updating customer_id: % from % to % tokens (difference: %)',
      sub_record.customer_id,
      old_plan_tokens,
      new_plan_tokens,
      tokens_difference;

    -- Update plan_tokens
    -- If tokens_used exceeds new plan_tokens, reset it to avoid negative balances
    UPDATE stripe_subscriptions
    SET
      plan_tokens = new_plan_tokens,
      tokens_used = CASE 
        WHEN tokens_used > new_plan_tokens THEN 0
        ELSE tokens_used
      END,
      updated_at = now()
    WHERE id = sub_record.id;

    -- Log the update in audit
    INSERT INTO token_credits_audit (
      event_type,
      customer_id,
      operation,
      status,
      tokens_amount,
      before_plan_tokens,
      after_plan_tokens,
      before_extra_tokens,
      after_extra_tokens,
      metadata,
      created_at
    ) VALUES (
      'admin_plan_update',
      sub_record.customer_id,
      'sync_plan_tokens_from_subscription_plans',
      'success',
      tokens_difference,
      old_plan_tokens,
      new_plan_tokens,
      sub_record.extra_tokens,
      sub_record.extra_tokens,
      jsonb_build_object(
        'reason', 'Admin updated subscription_plans tokens, syncing to stripe_subscriptions',
        'old_plan_tokens', old_plan_tokens,
        'new_plan_tokens', new_plan_tokens,
        'tokens_difference', tokens_difference,
        'price_id', sub_record.price_id,
        'subscription_id', sub_record.subscription_id,
        'migration_timestamp', now(),
        'tokens_used_before', sub_record.tokens_used,
        'tokens_used_after', CASE WHEN sub_record.tokens_used > new_plan_tokens THEN 0 ELSE sub_record.tokens_used END
      ),
      now()
    );

    updated_count := updated_count + 1;
  END LOOP;

  RAISE NOTICE 'Plan tokens update completed. Total subscriptions updated: %', updated_count;
END $$;

-- Create a view to see current plan tokens status
CREATE OR REPLACE VIEW user_plan_tokens_status AS
SELECT
  ss.customer_id,
  sc.user_id,
  up.email,
  COALESCE(up.first_name || ' ' || up.last_name, up.first_name, up.last_name) as user_name,
  ss.price_id,
  sp.name as plan_name,
  ss.plan_tokens as current_plan_tokens,
  sp.tokens_included as correct_plan_tokens,
  ss.extra_tokens,
  ss.tokens_used,
  ss.tokens_total,
  (ss.tokens_total - ss.tokens_used) as tokens_available,
  ss.status,
  CASE 
    WHEN ss.plan_tokens = sp.tokens_included THEN 'Synced'
    WHEN ss.plan_tokens < sp.tokens_included THEN 'Outdated (user has less)'
    ELSE 'Mismatch'
  END as sync_status
FROM stripe_subscriptions ss
LEFT JOIN stripe_customers sc ON ss.customer_id = sc.customer_id
LEFT JOIN user_profiles up ON sc.user_id = up.id
LEFT JOIN subscription_plans sp ON ss.price_id = sp.stripe_price_id
WHERE ss.deleted_at IS NULL
  AND ss.status IN ('active', 'trialing', 'canceled')
ORDER BY ss.updated_at DESC;

GRANT SELECT ON user_plan_tokens_status TO authenticated;
GRANT SELECT ON user_plan_tokens_status TO service_role;

COMMENT ON VIEW user_plan_tokens_status IS 'Shows current plan_tokens status comparing stripe_subscriptions with subscription_plans table. Helps identify users with outdated token values.';
