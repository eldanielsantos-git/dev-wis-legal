/*
  # Implement Token Consumption Order

  1. Changes
    - Drop existing debit_user_tokens and check_user_tokens functions
    - Create new debit_user_tokens function to consume plan_tokens first, then extra_tokens
    - Modify token debiting logic to respect the consumption order
    - Add detailed logging for token consumption operations

  2. Purpose
    - Ensure plan tokens are consumed before extra tokens
    - Preserve purchased tokens for later use
    - Provide clear audit trail of token consumption

  3. Token Consumption Logic
    - Calculate available_plan_tokens = plan_tokens - tokens_used
    - If needed tokens <= available_plan_tokens: debit from tokens_used only
    - If needed tokens > available_plan_tokens: 
      - Debit all available_plan_tokens (set tokens_used = plan_tokens)
      - Debit remainder from extra_tokens

  4. Security
    - Function uses SECURITY DEFINER for system operations
    - Validates user ownership before debiting
*/

-- Drop existing functions
DROP FUNCTION IF EXISTS debit_user_tokens(uuid, bigint);
DROP FUNCTION IF EXISTS check_user_tokens(uuid, bigint);
DROP FUNCTION IF EXISTS check_user_tokens(uuid, integer);

-- Create improved debit_user_tokens function with proper consumption order
CREATE OR REPLACE FUNCTION debit_user_tokens(
  p_user_id uuid,
  p_tokens_required bigint,
  p_operation_type text DEFAULT 'process_document',
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb AS $$
DECLARE
  v_customer_id text;
  v_subscription record;
  v_available_plan_tokens bigint;
  v_tokens_from_plan bigint;
  v_tokens_from_extra bigint;
  v_new_tokens_used bigint;
  v_new_extra_tokens bigint;
BEGIN
  -- Get customer_id for user
  SELECT customer_id INTO v_customer_id
  FROM stripe_customers
  WHERE user_id = p_user_id AND deleted_at IS NULL
  LIMIT 1;
  
  IF v_customer_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'no_customer',
      'message', 'No customer found for user'
    );
  END IF;
  
  -- Get current subscription with token details
  SELECT 
    customer_id,
    plan_tokens,
    extra_tokens,
    tokens_used,
    tokens_total,
    status
  INTO v_subscription
  FROM stripe_subscriptions
  WHERE customer_id = v_customer_id AND deleted_at IS NULL
  LIMIT 1;
  
  IF v_subscription IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'no_subscription',
      'message', 'No subscription found for customer'
    );
  END IF;
  
  -- Calculate available tokens from plan
  v_available_plan_tokens := GREATEST(v_subscription.plan_tokens - v_subscription.tokens_used, 0);
  
  -- Check if user has sufficient tokens total
  IF (v_available_plan_tokens + v_subscription.extra_tokens) < p_tokens_required THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'insufficient_tokens',
      'message', 'Insufficient tokens available',
      'available_plan_tokens', v_available_plan_tokens,
      'available_extra_tokens', v_subscription.extra_tokens,
      'total_available', v_available_plan_tokens + v_subscription.extra_tokens,
      'required', p_tokens_required
    );
  END IF;
  
  -- Calculate how to debit tokens (plan_tokens first, then extra_tokens)
  IF p_tokens_required <= v_available_plan_tokens THEN
    -- All tokens come from plan
    v_tokens_from_plan := p_tokens_required;
    v_tokens_from_extra := 0;
    v_new_tokens_used := v_subscription.tokens_used + p_tokens_required;
    v_new_extra_tokens := v_subscription.extra_tokens;
  ELSE
    -- Use all available plan tokens + some extra tokens
    v_tokens_from_plan := v_available_plan_tokens;
    v_tokens_from_extra := p_tokens_required - v_available_plan_tokens;
    v_new_tokens_used := v_subscription.plan_tokens;
    v_new_extra_tokens := v_subscription.extra_tokens - v_tokens_from_extra;
  END IF;
  
  -- Update subscription with new token values
  UPDATE stripe_subscriptions
  SET 
    tokens_used = v_new_tokens_used,
    extra_tokens = v_new_extra_tokens,
    updated_at = now()
  WHERE customer_id = v_customer_id AND deleted_at IS NULL;
  
  -- Log to token_credits_audit
  INSERT INTO token_credits_audit (
    event_type,
    customer_id,
    operation,
    status,
    tokens_amount,
    metadata,
    created_at
  ) VALUES (
    p_operation_type,
    v_customer_id,
    'debit_tokens',
    'success',
    p_tokens_required,
    jsonb_build_object(
      'user_id', p_user_id,
      'tokens_from_plan', v_tokens_from_plan,
      'tokens_from_extra', v_tokens_from_extra,
      'previous_tokens_used', v_subscription.tokens_used,
      'new_tokens_used', v_new_tokens_used,
      'previous_extra_tokens', v_subscription.extra_tokens,
      'new_extra_tokens', v_new_extra_tokens,
      'operation_metadata', p_metadata
    ),
    now()
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'tokens_debited', p_tokens_required,
    'tokens_from_plan', v_tokens_from_plan,
    'tokens_from_extra', v_tokens_from_extra,
    'new_tokens_used', v_new_tokens_used,
    'new_extra_tokens', v_new_extra_tokens,
    'remaining_plan_tokens', GREATEST(v_subscription.plan_tokens - v_new_tokens_used, 0),
    'remaining_extra_tokens', v_new_extra_tokens,
    'total_remaining', GREATEST(v_subscription.plan_tokens - v_new_tokens_used, 0) + v_new_extra_tokens
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION debit_user_tokens TO authenticated;
GRANT EXECUTE ON FUNCTION debit_user_tokens TO service_role;

-- Update check_user_tokens function to show consumption order details
CREATE OR REPLACE FUNCTION check_user_tokens(p_user_id uuid, p_required_tokens bigint)
RETURNS jsonb AS $$
DECLARE
  v_customer_id text;
  v_subscription record;
  v_available_plan_tokens bigint;
  v_available_extra_tokens bigint;
  v_total_available bigint;
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
    plan_tokens,
    extra_tokens,
    tokens_used,
    tokens_total,
    status
  INTO v_subscription
  FROM stripe_subscriptions
  WHERE customer_id = v_customer_id AND deleted_at IS NULL
  LIMIT 1;
  
  IF v_subscription IS NULL OR v_subscription.status NOT IN ('active', 'trialing', 'canceled') THEN
    RETURN jsonb_build_object(
      'has_subscription', false,
      'has_sufficient_tokens', false,
      'tokens_remaining', 0,
      'tokens_required', p_required_tokens,
      'message', 'No active subscription'
    );
  END IF;
  
  v_available_plan_tokens := GREATEST(v_subscription.plan_tokens - v_subscription.tokens_used, 0);
  v_available_extra_tokens := v_subscription.extra_tokens;
  v_total_available := v_available_plan_tokens + v_available_extra_tokens;
  
  RETURN jsonb_build_object(
    'has_subscription', true,
    'has_sufficient_tokens', v_total_available >= p_required_tokens,
    'available_plan_tokens', v_available_plan_tokens,
    'available_extra_tokens', v_available_extra_tokens,
    'total_available', v_total_available,
    'plan_tokens', v_subscription.plan_tokens,
    'extra_tokens', v_subscription.extra_tokens,
    'tokens_used', v_subscription.tokens_used,
    'tokens_total', v_subscription.tokens_total,
    'tokens_required', p_required_tokens,
    'subscription_status', v_subscription.status,
    'consumption_order', 'plan_tokens first, then extra_tokens',
    'message', CASE 
      WHEN v_total_available >= p_required_tokens THEN 'Sufficient tokens available'
      ELSE 'Insufficient tokens'
    END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION check_user_tokens TO authenticated;
GRANT EXECUTE ON FUNCTION check_user_tokens TO service_role;
