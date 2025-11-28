/*
  # Fix user_token_balance View JOIN (Correct)

  ## Problem
  The view `user_token_balance` has an incorrect JOIN condition.
  The user_profiles table primary key is `id`, not `user_id`.

  ## Solution
  Recreate the view with the correct JOIN: `sc.user_id = up.id`
*/

DROP VIEW IF EXISTS user_token_balance;

CREATE VIEW user_token_balance
WITH (security_invoker = on)
AS
SELECT 
  sc.user_id,
  up.email,
  COALESCE(up.first_name || ' ' || up.last_name, up.first_name, up.last_name) AS name,
  ss.customer_id,
  ss.subscription_id,
  ss.status AS subscription_status,
  ss.price_id,
  ss.plan_tokens,
  ss.extra_tokens,
  ss.tokens_used,
  ss.tokens_total,
  GREATEST(ss.plan_tokens - ss.tokens_used, 0) AS available_plan_tokens,
  ss.extra_tokens AS available_extra_tokens,
  GREATEST(ss.plan_tokens - ss.tokens_used, 0) + ss.extra_tokens AS total_available_tokens,
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