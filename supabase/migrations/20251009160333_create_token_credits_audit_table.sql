/*
  # Create Token Credits Audit Table

  1. New Table
    - `token_credits_audit`: Tracks all attempts to credit tokens from purchases
      - `id` (bigint, primary key, auto-increment)
      - `event_id` (text) - Stripe event ID for traceability
      - `event_type` (text) - Type of Stripe event (checkout.session.completed, etc)
      - `customer_id` (text) - Stripe customer ID
      - `checkout_session_id` (text) - Stripe checkout session ID
      - `price_id` (text) - Price ID of the purchased item
      - `tokens_amount` (bigint) - Number of tokens to credit
      - `operation` (text) - Type of operation (credit_extra_tokens, credit_plan_tokens, etc)
      - `status` (text) - success, failed, skipped, pending
      - `error_message` (text) - Error details if failed
      - `subscription_found` (boolean) - Whether active subscription was found
      - `before_plan_tokens` (bigint) - Plan tokens before operation
      - `before_extra_tokens` (bigint) - Extra tokens before operation
      - `before_tokens_total` (bigint) - Total tokens before operation
      - `after_plan_tokens` (bigint) - Plan tokens after operation
      - `after_extra_tokens` (bigint) - Extra tokens after operation
      - `after_tokens_total` (bigint) - Total tokens after operation
      - `processing_time_ms` (integer) - Time taken to process in milliseconds
      - `metadata` (jsonb) - Additional metadata
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on table
    - Add policy for service role to insert/update
    - Add policy for admins to view all records
    - Add policy for authenticated users to view their own records

  3. Indexes
    - Index on event_id for quick lookup
    - Index on customer_id for customer history
    - Index on status for monitoring failed operations
    - Index on created_at for time-based queries
*/

CREATE TABLE IF NOT EXISTS token_credits_audit (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  event_id text,
  event_type text,
  customer_id text NOT NULL,
  checkout_session_id text,
  price_id text,
  tokens_amount bigint DEFAULT 0,
  operation text NOT NULL,
  status text NOT NULL,
  error_message text,
  subscription_found boolean DEFAULT false,
  before_plan_tokens bigint,
  before_extra_tokens bigint,
  before_tokens_total bigint,
  after_plan_tokens bigint,
  after_extra_tokens bigint,
  after_tokens_total bigint,
  processing_time_ms integer,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE token_credits_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can insert audit records"
  ON token_credits_audit
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update audit records"
  ON token_credits_audit
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins can view all audit records"
  ON token_credits_audit
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "Users can view their own audit records"
  ON token_credits_audit
  FOR SELECT
  TO authenticated
  USING (
    customer_id IN (
      SELECT customer_id
      FROM stripe_customers
      WHERE user_id = auth.uid()
      AND deleted_at IS NULL
    )
  );

CREATE INDEX IF NOT EXISTS idx_token_credits_audit_event_id 
  ON token_credits_audit(event_id);

CREATE INDEX IF NOT EXISTS idx_token_credits_audit_customer_id 
  ON token_credits_audit(customer_id);

CREATE INDEX IF NOT EXISTS idx_token_credits_audit_status 
  ON token_credits_audit(status);

CREATE INDEX IF NOT EXISTS idx_token_credits_audit_created_at 
  ON token_credits_audit(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_token_credits_audit_checkout_session 
  ON token_credits_audit(checkout_session_id);
