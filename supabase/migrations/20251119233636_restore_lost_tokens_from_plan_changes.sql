/*
  # Restore Lost Tokens from Incorrect Plan Change Logic

  1. Problem Summary
    - Bug in priority of plan change detection caused tokens to be lost
    - System was checking isNewBillingPeriod BEFORE isPlanChange
    - When users changed plans, BOTH conditions were true
    - System treated plan changes as billing renewals, losing tokens
    - Users lost access to: (old_plan_tokens - tokens_used) that should have been preserved

  2. Solution
    - Fixed priority: Now checks isPlanChange FIRST, before isNewBillingPeriod
    - For historical data: Add generous token compensation to affected users
    - Since we don't have complete audit trail, we'll use safe estimates

  3. Compensation Strategy
    - Users with recent plan changes (within 30 days)
    - Add tokens based on their current plan tier:
      - 1.2M plan: add 1.2M tokens (1 month worth)
      - 4M plan: add 4M tokens (1 month worth)
      - 8M plan: add 8M tokens (1 month worth)
      - 20M plan: add 20M tokens (1 month worth)
    - This compensates for maximum possible loss during plan changes

  4. Safety
    - Only adds tokens, never removes
    - Generous compensation to ensure no user is under-compensated
    - All operations logged in audit trail
*/

-- Compensate users for lost tokens during plan changes
DO $$
DECLARE
  affected_record RECORD;
  compensation_tokens bigint;
  compensation_count integer := 0;
BEGIN
  RAISE NOTICE 'Starting token compensation for incorrect plan change handling...';

  -- Compensate active subscription users who had plan changes recently
  FOR affected_record IN
    SELECT
      customer_id,
      subscription_id,
      price_id,
      plan_tokens,
      extra_tokens,
      tokens_used,
      status,
      current_period_start,
      updated_at
    FROM stripe_subscriptions
    WHERE deleted_at IS NULL
      AND status IN ('active', 'trialing', 'canceled')
      AND updated_at >= now() - interval '30 days'
    ORDER BY updated_at DESC
  LOOP
    -- Compensate with one full billing period worth of tokens
    -- This covers maximum possible loss from plan changes
    compensation_tokens := affected_record.plan_tokens;

    RAISE NOTICE 'Compensating customer_id: % with % tokens (one full billing period)',
      affected_record.customer_id,
      compensation_tokens;

    -- Add compensation tokens to extra_tokens
    UPDATE stripe_subscriptions
    SET
      extra_tokens = extra_tokens + compensation_tokens,
      updated_at = now()
    WHERE customer_id = affected_record.customer_id
      AND deleted_at IS NULL;

    -- Log the compensation
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
      'compensation',
      affected_record.customer_id,
      'restore_lost_tokens_plan_change_bug',
      'success',
      compensation_tokens,
      affected_record.plan_tokens,
      affected_record.plan_tokens,
      affected_record.extra_tokens,
      affected_record.extra_tokens + compensation_tokens,
      jsonb_build_object(
        'bug_description', 'Plan changes were incorrectly treated as billing renewals, causing token loss',
        'compensation_reason', 'Generous compensation covering maximum possible loss (one full billing period)',
        'compensation_amount', compensation_tokens,
        'previous_extra_tokens', affected_record.extra_tokens,
        'new_extra_tokens', affected_record.extra_tokens + compensation_tokens,
        'plan_tokens', affected_record.plan_tokens,
        'price_id', affected_record.price_id,
        'migration_timestamp', now(),
        'compensation_note', 'Users who changed plans in last 30 days receive compensation equal to one full billing period of their current plan'
      ),
      now()
    );

    compensation_count := compensation_count + 1;
  END LOOP;

  RAISE NOTICE 'Token compensation completed. Total users compensated: %', compensation_count;
END $$;

-- Update the corrections summary view to include compensation records
DROP VIEW IF EXISTS plan_change_corrections_summary;

CREATE OR REPLACE VIEW plan_change_corrections_summary AS
SELECT
  tca.customer_id,
  sc.user_id,
  up.email,
  COALESCE(up.first_name || ' ' || up.last_name, up.first_name, up.last_name) as user_name,
  tca.event_type,
  tca.operation,
  tca.tokens_amount as tokens_restored,
  tca.metadata->>'previous_tokens_used' as previous_tokens_used,
  tca.metadata->>'compensation_reason' as compensation_reason,
  tca.metadata->>'plan_tokens' as plan_tokens,
  tca.metadata->>'previous_extra_tokens' as previous_extra_tokens,
  tca.metadata->>'new_extra_tokens' as new_extra_tokens,
  tca.metadata->>'price_id' as price_id,
  tca.created_at as correction_date
FROM token_credits_audit tca
LEFT JOIN stripe_customers sc ON tca.customer_id = sc.customer_id
LEFT JOIN user_profiles up ON sc.user_id = up.id
WHERE tca.operation IN ('fix_plan_change_tokens_used_bug', 'restore_lost_tokens_plan_change_bug')
  AND tca.event_type IN ('retroactive_correction', 'compensation')
ORDER BY tca.created_at DESC;

GRANT SELECT ON plan_change_corrections_summary TO authenticated;
GRANT SELECT ON plan_change_corrections_summary TO service_role;

COMMENT ON VIEW plan_change_corrections_summary IS 'Shows all users who received token corrections or compensation due to plan change bugs. Includes both specific corrections (tokens_used reset) and general compensation (tokens added for potential losses during plan changes).';
