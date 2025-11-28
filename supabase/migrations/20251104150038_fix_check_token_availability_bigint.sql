/*
  # Fix check_token_availability function to use bigint
  
  1. Changes
    - Drop and recreate check_token_availability function with bigint parameters
    - This fixes "integer out of range" error for users with large token balances
  
  2. Security
    - Maintain existing permissions
*/

-- Drop existing function
DROP FUNCTION IF EXISTS check_token_availability(uuid, integer);

-- Recreate with bigint
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
  -- Buscar customer_id
  SELECT customer_id INTO v_customer_id
  FROM stripe_customers
  WHERE user_id = p_user_id
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    RETURN false;
  END IF;

  -- Buscar tokens disponíveis
  SELECT 
    COALESCE(tokens_total, 0),
    COALESCE(tokens_used, 0)
  INTO v_tokens_total, v_tokens_used
  FROM stripe_subscriptions
  WHERE customer_id = v_customer_id
    AND deleted_at IS NULL
    AND status IN ('active', 'trialing')
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
