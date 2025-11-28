/*
  # Corrigir Inserção na Auditoria de Tokens
  
  1. Problema
    - A função tenta inserir em user_id que não existe
    - A tabela token_credits_audit usa customer_id
    
  2. Solução
    - Ajustar INSERT para usar os campos corretos da tabela
    - Remover user_id e usar apenas customer_id
*/

-- Dropar função existente
DROP FUNCTION IF EXISTS debit_user_tokens(uuid, bigint);

-- Recriar função com INSERT correto
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
  v_subscription_id bigint;
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

  -- Registrar na auditoria com campos corretos
  INSERT INTO token_credits_audit (
    customer_id,
    operation,
    tokens_amount,
    status,
    metadata
  ) VALUES (
    v_customer_id,
    'debit',
    p_tokens_amount,
    'success',
    jsonb_build_object(
      'subscription_id', v_subscription_id,
      'user_id', p_user_id,
      'source', 'chat_response'
    )
  );
END;
$$;

COMMENT ON FUNCTION debit_user_tokens IS 'Debita tokens da assinatura do usuário e registra na auditoria';
