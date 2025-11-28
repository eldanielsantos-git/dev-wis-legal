/*
  # Fix Plan Change tokens_used Bug - Diagnose and Correct Historical Data

  1. Problem Identified
    - Bug in sync-stripe-subscription and stripe-webhook functions
    - When users changed plans (upgrade/downgrade), tokens_used was incorrectly preserved
    - This caused users to lose access to tokens from their new plan
    - Example: User had 1.2M tokens, used 500K, upgraded to 4M plan
      - INCORRECT: 4M - 500K = 3.5M available (lost 500K from new plan)
      - CORRECT: 4M - 0 = 4M available + 700K preserved in extra_tokens

  2. Solution
    - Identify users with last_plan_change_at set who have tokens_used > 0
    - These users likely experienced the bug
    - Reset tokens_used to 0 for these users
    - Log all corrections in token_credits_audit for transparency

  3. Affected Users
    - Users who changed plans (upgrade or downgrade) mid-billing period
    - Users who have last_plan_change_at timestamp set
    - Users who have tokens_used > 0 after plan change

  4. Correction Strategy
    - For each affected user:
      - Reset tokens_used to 0 (new plan should start fresh)
      - Tokens remain preserved in extra_tokens (already correct)
      - Log the correction in token_credits_audit
      - Create audit trail for customer support

  5. Safety
    - This migration only ADDS tokens back to users (never removes)
    - Users who were affected will regain access to their full plan tokens
    - All operations are logged for audit purposes
*/

-- Create a temporary function to diagnose and fix affected users
DO $$
DECLARE
  affected_record RECORD;
  tokens_restored bigint;
  correction_count integer := 0;
BEGIN
  -- Log start of correction process
  RAISE NOTICE 'Starting plan change tokens_used bug correction process...';

  -- Find all users affected by the bug
  -- These are users who have a recent plan change and tokens_used > 0
  FOR affected_record IN
    SELECT
      customer_id,
      subscription_id,
      plan_tokens,
      extra_tokens,
      tokens_used,
      tokens_carried_forward,
      last_plan_change_at,
      price_id,
      status,
      updated_at
    FROM stripe_subscriptions
    WHERE deleted_at IS NULL
      AND last_plan_change_at IS NOT NULL
      AND tokens_used > 0
      AND status IN ('active', 'trialing', 'canceled')
    ORDER BY last_plan_change_at DESC
  LOOP
    -- Calculate tokens being restored (tokens_used that should have been 0)
    tokens_restored := affected_record.tokens_used;

    RAISE NOTICE 'Correcting customer_id: %, restoring % tokens',
      affected_record.customer_id,
      tokens_restored;

    -- Reset tokens_used to 0 (correct behavior for plan change)
    UPDATE stripe_subscriptions
    SET
      tokens_used = 0,
      updated_at = now()
    WHERE customer_id = affected_record.customer_id
      AND deleted_at IS NULL;

    -- Log the correction in token_credits_audit
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
      'retroactive_correction',
      affected_record.customer_id,
      'fix_plan_change_tokens_used_bug',
      'success',
      tokens_restored,
      affected_record.plan_tokens,
      affected_record.plan_tokens,
      affected_record.extra_tokens,
      affected_record.extra_tokens,
      jsonb_build_object(
        'bug_description', 'tokens_used was incorrectly preserved during plan change',
        'correction_type', 'reset_tokens_used_to_zero',
        'tokens_restored', tokens_restored,
        'previous_tokens_used', affected_record.tokens_used,
        'new_tokens_used', 0,
        'plan_tokens', affected_record.plan_tokens,
        'extra_tokens', affected_record.extra_tokens,
        'tokens_carried_forward', affected_record.tokens_carried_forward,
        'last_plan_change_at', affected_record.last_plan_change_at,
        'price_id', affected_record.price_id,
        'migration_timestamp', now(),
        'impact', format('User regained access to %s tokens from their current plan', tokens_restored)
      ),
      now()
    );

    correction_count := correction_count + 1;
  END LOOP;

  -- Log completion
  RAISE NOTICE 'Plan change bug correction completed. Total users corrected: %', correction_count;
END $$;

-- Create a view to show the corrections made
CREATE OR REPLACE VIEW plan_change_corrections_summary AS
SELECT
  tca.customer_id,
  sc.user_id,
  up.email,
  COALESCE(up.first_name || ' ' || up.last_name, up.first_name, up.last_name) as user_name,
  tca.tokens_amount as tokens_restored,
  tca.metadata->>'previous_tokens_used' as previous_tokens_used,
  tca.metadata->>'plan_tokens' as plan_tokens,
  tca.metadata->>'extra_tokens' as extra_tokens,
  tca.metadata->>'last_plan_change_at' as last_plan_change_at,
  tca.metadata->>'price_id' as price_id,
  tca.created_at as correction_date
FROM token_credits_audit tca
LEFT JOIN stripe_customers sc ON tca.customer_id = sc.customer_id
LEFT JOIN user_profiles up ON sc.user_id = up.id
WHERE tca.operation = 'fix_plan_change_tokens_used_bug'
  AND tca.event_type = 'retroactive_correction'
ORDER BY tca.created_at DESC;

-- Grant access to the view
GRANT SELECT ON plan_change_corrections_summary TO authenticated;
GRANT SELECT ON plan_change_corrections_summary TO service_role;

-- Add comment to explain the correction
COMMENT ON VIEW plan_change_corrections_summary IS 'Shows all users who were affected by the plan change tokens_used bug and had their tokens restored. Users listed here had tokens_used incorrectly preserved during plan changes, causing them to lose access to tokens from their new plan. The correction reset tokens_used to 0, giving users full access to their current plan tokens.';
