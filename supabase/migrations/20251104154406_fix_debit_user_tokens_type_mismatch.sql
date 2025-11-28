/*
  # Corrigir Tipo de Variável na Função debit_user_tokens
  
  1. Problema
    - A variável v_subscription_id está declarada como text
    - O campo stripe_subscriptions.id é do tipo bigint
    - Isso causa erro: "operator does not exist: bigint = text"
    - Os tokens não são debitados e o erro é silencioso
    
  2. Solução
    - Alterar v_subscription_id de text para bigint
    - Garantir que o débito funcione corretamente
*/

-- Dropar função existente
DROP FUNCTION IF EXISTS debit_user_tokens(uuid, bigint);

-- Recriar função com tipo correto
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
  v_subscription_id bigint;  -- CORRIGIDO: de text para bigint
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

COMMENT ON FUNCTION debit_user_tokens IS 'Debita tokens da assinatura do usuário e registra na auditoria';
