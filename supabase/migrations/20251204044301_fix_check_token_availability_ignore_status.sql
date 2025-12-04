/*
  # Fix check_token_availability - Ignore Subscription Status

  ## Problem
  The function `check_token_availability` only returns TRUE for users with 
  'active' or 'trialing' subscription status, blocking users who have tokens
  but no active subscription (e.g., status: incomplete, past_due, canceled, etc).

  ## Solution
  Remove status check - what matters is having tokens available (tokens_total - tokens_used > 0),
  NOT having an active subscription.

  ## Impact
  - Users with extra_tokens can use chat and analysis
  - Users with purchased tokens can use features
  - Users with canceled subscriptions but remaining tokens can continue
  - Users with incomplete/past_due status can use their tokens
*/

-- Drop existing function
DROP FUNCTION IF EXISTS check_token_availability(uuid, bigint);

-- Recreate without status validation
CREATE OR REPLACE FUNCTION check_token_availability(
  p_user_id uuid,
  p_tokens_needed bigint
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_customer_id text;
  v_tokens_total bigint;
  v_tokens_used bigint;
  v_tokens_available bigint;
BEGIN
  -- Get customer_id
  SELECT customer_id INTO v_customer_id
  FROM stripe_customers
  WHERE user_id = p_user_id
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    RETURN false;
  END IF;

  -- Get available tokens
  -- IMPORTANT: Do NOT check subscription status!
  -- Users can have extra_tokens (purchased or transferred) even without active subscription.
  -- What matters is if they have available tokens (tokens_total - tokens_used > 0).
  SELECT 
    COALESCE(tokens_total, 0),
    COALESCE(tokens_used, 0)
  INTO v_tokens_total, v_tokens_used
  FROM stripe_subscriptions
  WHERE customer_id = v_customer_id
    AND deleted_at IS NULL
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  v_tokens_available := v_tokens_total - v_tokens_used;

  RETURN v_tokens_available >= p_tokens_needed;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION check_token_availability(uuid, bigint) TO anon;
GRANT EXECUTE ON FUNCTION check_token_availability(uuid, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION check_token_availability(uuid, bigint) TO service_role;
