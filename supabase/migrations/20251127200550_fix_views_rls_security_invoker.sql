/*
  # Fix Views Security with Security Invoker

  ## Problem
  Database views like `user_token_balance` don't have proper security settings,
  causing data to not load for authenticated users.

  ## Solution
  Use `security_invoker = on` option which makes views execute with the privileges
  of the user calling them, enabling RLS checks on underlying tables.

  ## Changes
  - Drop and recreate views with security_invoker option
  - This will respect the RLS policies on underlying tables
*/

-- Drop existing view
DROP VIEW IF EXISTS user_token_balance;

-- Recreate with security_invoker
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

-- Recreate stripe_user_subscriptions with security_invoker
DROP VIEW IF EXISTS stripe_user_subscriptions;

CREATE VIEW stripe_user_subscriptions
WITH (security_invoker = on)
AS
SELECT 
  c.customer_id,
  s.subscription_id,
  s.status AS subscription_status,
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

-- Recreate stripe_user_orders with security_invoker
DROP VIEW IF EXISTS stripe_user_orders;

CREATE VIEW stripe_user_orders
WITH (security_invoker = on)
AS
SELECT 
  c.customer_id,
  o.id AS order_id,
  o.checkout_session_id,
  o.payment_intent_id,
  o.amount_subtotal,
  o.amount_total,
  o.currency,
  o.payment_status,
  o.status AS order_status,
  o.created_at AS order_date
FROM stripe_customers c
LEFT JOIN stripe_orders o ON c.customer_id = o.customer_id
WHERE c.user_id = auth.uid()
  AND c.deleted_at IS NULL
  AND o.deleted_at IS NULL;
