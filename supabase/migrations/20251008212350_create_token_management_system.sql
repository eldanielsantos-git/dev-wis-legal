/*
  # Token Management System for Subscription Plans

  1. New Columns in stripe_subscriptions
    - `tokens_total` (bigint): Total tokens allocated for the subscription plan
    - `tokens_used` (bigint): Tokens consumed by the user
    - `tokens_remaining` (bigint): Computed column (tokens_total - tokens_used)
    - `last_token_reset_at` (timestamptz): When tokens were last reset (billing period start)

  2. New Table: token_usage_history
    - Tracks detailed token consumption per process
    - Includes processo_id, tokens_consumed, pages_processed, created_at
    - Enables auditing and usage reports

  3. New Columns in processos
    - `pages_processed_successfully` (integer): Count of successfully processed pages
    - `tokens_consumed` (integer): Tokens consumed by this process
    - `token_transaction_id` (bigint): References token_usage_history

  4. Triggers
    - Auto-update tokens_used when process completes successfully
    - Auto-calculate tokens_remaining
    - Log token consumption to history table

  5. Security
    - Enable RLS on token_usage_history
    - Policies for users to view their own token usage
    - Service role policies for backend operations
*/

-- Add token management columns to stripe_subscriptions
ALTER TABLE stripe_subscriptions 
ADD COLUMN IF NOT EXISTS tokens_total bigint DEFAULT 0,
ADD COLUMN IF NOT EXISTS tokens_used bigint DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_token_reset_at timestamptz DEFAULT now();

-- Create computed column for tokens_remaining (via function)
CREATE OR REPLACE FUNCTION get_tokens_remaining(tokens_total bigint, tokens_used bigint)
RETURNS bigint AS $$
BEGIN
  RETURN GREATEST(tokens_total - tokens_used, 0);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create token_usage_history table
CREATE TABLE IF NOT EXISTS token_usage_history (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  processo_id uuid REFERENCES processos(id) ON DELETE SET NULL,
  tokens_consumed integer NOT NULL DEFAULT 0,
  pages_processed integer NOT NULL DEFAULT 0,
  operation_type text NOT NULL DEFAULT 'process_document',
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_token_usage_user_id ON token_usage_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_usage_processo_id ON token_usage_history(processo_id);

ALTER TABLE token_usage_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own token usage history"
  ON token_usage_history
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage token usage history"
  ON token_usage_history
  FOR ALL
  TO service_role
  USING (true);

-- Add token tracking columns to processos table
ALTER TABLE processos
ADD COLUMN IF NOT EXISTS pages_processed_successfully integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS tokens_consumed integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS token_transaction_id bigint REFERENCES token_usage_history(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_processos_tokens ON processos(user_id, tokens_consumed) WHERE tokens_consumed > 0;

-- Function to calculate tokens from pages (approximately 5,500 tokens per page based on requirements)
CREATE OR REPLACE FUNCTION calculate_tokens_from_pages(page_count integer)
RETURNS integer AS $$
BEGIN
  -- Based on plan limits:
  -- Essencial: 1.2M tokens ≈ 220 pages → 5,454 tokens/page
  -- Premium: 4M tokens ≈ 750 pages → 5,333 tokens/page
  -- Pro: 8M tokens ≈ 1,500 pages → 5,333 tokens/page
  -- Elite: 20M tokens ≈ 3,700 pages → 5,405 tokens/page
  -- Average: ~5,500 tokens per page
  RETURN page_count * 5500;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to debit tokens from user's subscription
CREATE OR REPLACE FUNCTION debit_tokens_for_process()
RETURNS TRIGGER AS $$
DECLARE
  v_customer_id text;
  v_tokens_to_debit integer;
  v_usage_history_id bigint;
BEGIN
  -- Only debit tokens when status changes to 'completed' or 'processing_forensic'
  IF (NEW.status IN ('completed', 'processing_forensic') AND 
      OLD.status NOT IN ('completed', 'processing_forensic') AND
      NEW.pages_processed_successfully > 0 AND
      NEW.tokens_consumed = 0) THEN
    
    -- Calculate tokens to debit
    v_tokens_to_debit := calculate_tokens_from_pages(NEW.pages_processed_successfully);
    
    -- Get customer_id for this user
    SELECT customer_id INTO v_customer_id
    FROM stripe_customers
    WHERE user_id = NEW.user_id AND deleted_at IS NULL
    LIMIT 1;
    
    IF v_customer_id IS NOT NULL THEN
      -- Record token usage in history
      INSERT INTO token_usage_history (
        user_id, 
        processo_id, 
        tokens_consumed, 
        pages_processed, 
        operation_type, 
        notes
      )
      VALUES (
        NEW.user_id,
        NEW.id,
        v_tokens_to_debit,
        NEW.pages_processed_successfully,
        'process_document',
        'Automatic token debit for process: ' || NEW.file_name
      )
      RETURNING id INTO v_usage_history_id;
      
      -- Update subscription tokens_used
      UPDATE stripe_subscriptions
      SET tokens_used = tokens_used + v_tokens_to_debit,
          updated_at = now()
      WHERE customer_id = v_customer_id AND deleted_at IS NULL;
      
      -- Update processo with token info
      NEW.tokens_consumed := v_tokens_to_debit;
      NEW.token_transaction_id := v_usage_history_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-debit tokens
DROP TRIGGER IF EXISTS trigger_debit_tokens ON processos;
CREATE TRIGGER trigger_debit_tokens
  BEFORE UPDATE ON processos
  FOR EACH ROW
  EXECUTE FUNCTION debit_tokens_for_process();

-- Function to check if user has sufficient tokens
CREATE OR REPLACE FUNCTION check_user_tokens(p_user_id uuid, p_required_tokens integer)
RETURNS jsonb AS $$
DECLARE
  v_customer_id text;
  v_subscription record;
  v_tokens_remaining bigint;
BEGIN
  -- Get customer_id for user
  SELECT customer_id INTO v_customer_id
  FROM stripe_customers
  WHERE user_id = p_user_id AND deleted_at IS NULL
  LIMIT 1;
  
  IF v_customer_id IS NULL THEN
    RETURN jsonb_build_object(
      'has_subscription', false,
      'has_sufficient_tokens', false,
      'tokens_remaining', 0,
      'tokens_required', p_required_tokens,
      'message', 'No active subscription found'
    );
  END IF;
  
  -- Get subscription details
  SELECT 
    tokens_total,
    tokens_used,
    get_tokens_remaining(tokens_total, tokens_used) as tokens_remaining,
    status
  INTO v_subscription
  FROM stripe_subscriptions
  WHERE customer_id = v_customer_id AND deleted_at IS NULL
  LIMIT 1;
  
  IF v_subscription IS NULL OR v_subscription.status NOT IN ('active', 'trialing') THEN
    RETURN jsonb_build_object(
      'has_subscription', false,
      'has_sufficient_tokens', false,
      'tokens_remaining', 0,
      'tokens_required', p_required_tokens,
      'message', 'No active subscription'
    );
  END IF;
  
  v_tokens_remaining := v_subscription.tokens_remaining;
  
  RETURN jsonb_build_object(
    'has_subscription', true,
    'has_sufficient_tokens', v_tokens_remaining >= p_required_tokens,
    'tokens_remaining', v_tokens_remaining,
    'tokens_total', v_subscription.tokens_total,
    'tokens_used', v_subscription.tokens_used,
    'tokens_required', p_required_tokens,
    'message', CASE 
      WHEN v_tokens_remaining >= p_required_tokens THEN 'Sufficient tokens available'
      ELSE 'Insufficient tokens'
    END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION check_user_tokens TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_tokens_from_pages TO authenticated;
GRANT EXECUTE ON FUNCTION get_tokens_remaining TO authenticated;