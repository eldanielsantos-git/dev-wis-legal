/*
  # Update stripe_user_subscriptions View to Include Token Columns

  1. Changes
    - Drop existing stripe_user_subscriptions view
    - Recreate with token columns: plan_tokens, extra_tokens, tokens_total, tokens_used
    - Add last_token_reset_at for additional context
    
  2. Purpose
    - Enable TokenBreakdownCard to display extra tokens purchased by users
    - Show complete token information in user-facing views
    
  3. Security
    - Maintains security_invoker to ensure RLS is applied
    - Only shows data for authenticated user (auth.uid())
*/

-- Drop the existing view
DROP VIEW IF EXISTS stripe_user_subscriptions;

-- Recreate the view with token columns
CREATE VIEW stripe_user_subscriptions WITH (security_invoker = true) AS
SELECT
    c.customer_id,
    s.subscription_id,
    s.status as subscription_status,
    s.price_id,
    s.current_period_start,
    s.current_period_end,
    s.cancel_at_period_end,
    s.payment_method_brand,
    s.payment_method_last4,
    s.plan_tokens,
    s.extra_tokens,
    s.tokens_total,
    s.tokens_used,
    s.last_token_reset_at
FROM stripe_customers c
LEFT JOIN stripe_subscriptions s ON c.customer_id = s.customer_id
WHERE c.user_id = auth.uid()
AND c.deleted_at IS NULL
AND s.deleted_at IS NULL;

-- Grant select permission to authenticated users
GRANT SELECT ON stripe_user_subscriptions TO authenticated;
