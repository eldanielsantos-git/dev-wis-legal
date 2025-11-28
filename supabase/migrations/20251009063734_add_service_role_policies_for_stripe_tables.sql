/*
  # Add Service Role Policies for Stripe Tables

  1. Changes
    - Add service_role policies for INSERT on stripe_customers
    - Add service_role policies for UPDATE on stripe_customers
    - Add service_role policies for INSERT on stripe_subscriptions
    - Add service_role policies for UPDATE on stripe_subscriptions
    - Add service_role policies for INSERT on stripe_orders
    - Add service_role policies for UPDATE on stripe_orders
  
  2. Security
    - These policies allow the service_role (used by Edge Functions) to write data
    - Service role bypasses RLS by default, but explicit policies ensure clear permissions
    - These policies are critical for webhook processing to work correctly
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Service role can insert stripe_customers" ON stripe_customers;
DROP POLICY IF EXISTS "Service role can update stripe_customers" ON stripe_customers;
DROP POLICY IF EXISTS "Service role can insert stripe_subscriptions" ON stripe_subscriptions;
DROP POLICY IF EXISTS "Service role can update stripe_subscriptions" ON stripe_subscriptions;
DROP POLICY IF EXISTS "Service role can insert stripe_orders" ON stripe_orders;
DROP POLICY IF EXISTS "Service role can update stripe_orders" ON stripe_orders;

-- Service role policies for stripe_customers
CREATE POLICY "Service role can insert stripe_customers"
  ON stripe_customers
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update stripe_customers"
  ON stripe_customers
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Service role policies for stripe_subscriptions
CREATE POLICY "Service role can insert stripe_subscriptions"
  ON stripe_subscriptions
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update stripe_subscriptions"
  ON stripe_subscriptions
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Service role policies for stripe_orders
CREATE POLICY "Service role can insert stripe_orders"
  ON stripe_orders
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update stripe_orders"
  ON stripe_orders
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);
