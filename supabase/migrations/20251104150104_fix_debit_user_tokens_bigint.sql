/*
  # Fix debit_user_tokens function to use bigint
  
  1. Changes
    - Drop and recreate debit_user_tokens function with bigint parameter
    - This fixes "integer out of range" error for large token amounts
  
  2. Security
    - Maintain existing permissions
*/

-- Drop existing function
DROP FUNCTION IF EXISTS debit_user_tokens(uuid, integer);

-- Recreate with bigint
CREATE OR REPLACE FUNCTION debit_user_tokens(
  p_user_id uuid,
  p_tokens_amount bigint
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_customer_id text;
  v_subscription_id text;
BEGIN
  -- Buscar customer_id
  SELECT customer_id INTO v_customer_id
  FROM stripe_customers
  WHERE user_id = p_user_id
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Customer not found for user_id: %', p_user_id;
  END IF;

  -- Buscar subscription_id
  SELECT id INTO v_subscription_id
  FROM stripe_subscriptions
  WHERE customer_id = v_customer_id
    AND deleted_at IS NULL
    AND status IN ('active', 'trialing')
  LIMIT 1;

  IF v_subscription_id IS NULL THEN
    RAISE EXCEPTION 'Active subscription not found for customer_id: %', v_customer_id;
  END IF;

  -- Debitar tokens
  UPDATE stripe_subscriptions
  SET 
    tokens_used = tokens_used + p_tokens_amount,
    updated_at = now()
  WHERE id = v_subscription_id;

  -- Registrar na auditoria
  INSERT INTO token_credits_audit (
    user_id,
    operation,
    tokens_amount,
    metadata
  ) VALUES (
    p_user_id,
    'debit',
    p_tokens_amount,
    jsonb_build_object(
      'subscription_id', v_subscription_id,
      'customer_id', v_customer_id
    )
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION debit_user_tokens(uuid, bigint) TO anon;
GRANT EXECUTE ON FUNCTION debit_user_tokens(uuid, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION debit_user_tokens(uuid, bigint) TO service_role;
