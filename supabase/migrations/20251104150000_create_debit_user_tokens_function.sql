/*
  # Criar função para debitar tokens de usuários (Chat)

  ## 1. Descrição
    - Função para debitar tokens diretamente do saldo do usuário
    - Usado pelo chat que cobra 2 tokens por caractere de resposta
    - Atualiza stripe_subscriptions.tokens_used

  ## 2. Segurança
    - SECURITY DEFINER para permitir atualização na tabela stripe_subscriptions
    - Validação de saldo disponível
    - Proteção contra débito negativo
*/

CREATE OR REPLACE FUNCTION debit_user_tokens(
  p_user_id uuid,
  p_tokens_amount integer
)
RETURNS boolean AS $$
DECLARE
  v_customer_id text;
  v_tokens_total integer;
  v_tokens_used integer;
  v_tokens_available integer;
BEGIN
  -- Validar entrada
  IF p_tokens_amount <= 0 THEN
    RAISE EXCEPTION 'Token amount must be positive';
  END IF;

  -- Buscar customer_id
  SELECT customer_id INTO v_customer_id
  FROM stripe_customers
  WHERE user_id = p_user_id
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Customer not found for user';
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
    RAISE EXCEPTION 'Active subscription not found';
  END IF;

  v_tokens_available := v_tokens_total - v_tokens_used;

  -- Verificar se há saldo suficiente
  IF v_tokens_available < p_tokens_amount THEN
    RAISE EXCEPTION 'Insufficient token balance';
  END IF;

  -- Debitar tokens
  UPDATE stripe_subscriptions
  SET
    tokens_used = tokens_used + p_tokens_amount,
    updated_at = now()
  WHERE customer_id = v_customer_id
    AND deleted_at IS NULL
    AND status IN ('active', 'trialing');

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grants
GRANT EXECUTE ON FUNCTION debit_user_tokens TO authenticated;
GRANT EXECUTE ON FUNCTION debit_user_tokens TO service_role;
