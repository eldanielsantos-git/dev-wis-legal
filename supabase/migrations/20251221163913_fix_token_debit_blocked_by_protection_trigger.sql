/*
  # Correção Crítica: Débito de Tokens Bloqueado por Trigger de Proteção

  ## Problema Identificado
  A função `debit_user_tokens` não define o contexto `app.token_operation` antes de 
  fazer UPDATE em `stripe_subscriptions`, causando o bloqueio silencioso do trigger
  `prevent_extra_tokens_loss`. Resultado: tokens são consumidos mas não debitados.

  ## Exemplo do Bug
  - Usuário daniel+wis processou 669 páginas (3.679.500 tokens)
  - Campo `tokens_consumed` no processo: 3.679.500 ✓
  - Campo `tokens_used` na subscription: 0 ✗ (deveria ser 3.679.500)
  - Saldo disponível: 720.500 ✗ (deveria ser NEGATIVO!)

  ## Solução
  Modificar `debit_user_tokens` para definir `app.token_operation = 'token_consumption'`
  antes do UPDATE, permitindo que o trigger de proteção autorize o débito legítimo.

  ## Impacto
  - Corrige débito de tokens em todos os processos futuros
  - Não afeta retroativamente processos já concluídos (precisará de ajuste manual)
*/

-- Recriar função debit_user_tokens com contexto correto
CREATE OR REPLACE FUNCTION debit_user_tokens(
  p_user_id uuid,
  p_tokens_required bigint,
  p_operation_type text DEFAULT 'tokens_consumed',
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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

  -- 🔥 CRITICAL FIX: Define contexto para autorizar débito pelo trigger de proteção
  PERFORM set_config('app.token_operation', 'token_consumption', true);

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
$$;

-- Corrigir o saldo do usuário daniel+wis manualmente
DO $$
DECLARE
  v_user_id uuid;
  v_customer_id text;
  v_total_tokens_consumed bigint;
  v_current_tokens_used bigint;
  v_correct_tokens_used bigint;
BEGIN
  -- Buscar dados do usuário
  SELECT id INTO v_user_id
  FROM user_profiles
  WHERE email = 'daniel+wis@dmzdigital.com.br';

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'Usuário daniel+wis não encontrado';
    RETURN;
  END IF;

  -- Buscar customer_id
  SELECT customer_id INTO v_customer_id
  FROM stripe_customers
  WHERE user_id = v_user_id AND deleted_at IS NULL;

  IF v_customer_id IS NULL THEN
    RAISE NOTICE 'Customer não encontrado para daniel+wis';
    RETURN;
  END IF;

  -- Calcular total de tokens realmente consumidos
  SELECT COALESCE(SUM(tokens_consumed), 0) INTO v_total_tokens_consumed
  FROM processos
  WHERE user_id = v_user_id AND status = 'completed';

  -- Buscar tokens_used atual
  SELECT tokens_used INTO v_current_tokens_used
  FROM stripe_subscriptions
  WHERE customer_id = v_customer_id AND deleted_at IS NULL;

  RAISE NOTICE 'Usuário: daniel+wis@dmzdigital.com.br';
  RAISE NOTICE 'Tokens consumidos pelos processos: %', v_total_tokens_consumed;
  RAISE NOTICE 'Tokens_used atual na subscription: %', v_current_tokens_used;
  RAISE NOTICE 'Diferença (tokens não debitados): %', v_total_tokens_consumed - v_current_tokens_used;

  -- Corrigir se necessário
  IF v_total_tokens_consumed != v_current_tokens_used THEN
    -- Definir contexto para bypass do trigger
    PERFORM set_config('app.token_operation', 'admin_adjustment', false);

    -- Corrigir tokens_used
    UPDATE stripe_subscriptions
    SET 
      tokens_used = v_total_tokens_consumed,
      updated_at = now()
    WHERE customer_id = v_customer_id AND deleted_at IS NULL;

    -- Registrar auditoria
    INSERT INTO token_credits_audit (
      event_id,
      event_type,
      customer_id,
      operation,
      status,
      before_extra_tokens,
      after_extra_tokens,
      tokens_amount,
      metadata
    ) VALUES (
      'fix_missing_debit_' || NOW()::text,
      'correction',
      v_customer_id,
      'fix_blocked_token_debit',
      'success',
      v_current_tokens_used,
      v_total_tokens_consumed,
      v_total_tokens_consumed - v_current_tokens_used,
      jsonb_build_object(
        'reason', 'Tokens were consumed but not debited due to trigger blocking',
        'bug_description', 'debit_user_tokens was not setting app.token_operation context',
        'user_email', 'daniel+wis@dmzdigital.com.br',
        'correction_date', NOW()
      )
    );

    RAISE NOTICE '✅ Correção aplicada! tokens_used atualizado de % para %', 
      v_current_tokens_used, v_total_tokens_consumed;
  ELSE
    RAISE NOTICE '✅ Saldo já está correto!';
  END IF;
END $$;

-- Adicionar comentário na função
COMMENT ON FUNCTION debit_user_tokens IS 
'Debita tokens do usuário. CRÍTICO: Define app.token_operation para autorizar débito pelo trigger de proteção prevent_extra_tokens_loss.';
