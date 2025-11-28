/*
  # Populate Subscription Tokens for Existing Users

  1. Purpose
    - Update existing subscriptions with correct token allocations based on price_id
    - Recalculate tokens_used based on successfully processed pages
    - Populate token_usage_history with historical data from completed processes

  2. Changes
    - Update tokens_total for all active subscriptions based on their plan
    - Calculate tokens_used from pages_processed_successfully in processos table
    - Create historical token usage records for tracking

  3. Token Allocations by Plan
    - Essencial (price_1SG3zEJrr43cGTt4oUj89h9u): 1,200,000 tokens
    - Premium (price_1SG40ZJrr43cGTt4SGCX0JUZ): 4,000,000 tokens
    - Pro (price_1SG41xJrr43cGTt4MQwqdEiv): 8,000,000 tokens
    - Elite (price_1SG43JJrr43cGTt4URQn0TxZ): 20,000,000 tokens

  4. Token Calculation
    - 5,500 tokens per successfully processed page
*/

DO $$
DECLARE
  v_sub record;
  v_processo record;
  v_tokens_total bigint;
  v_tokens_used bigint;
BEGIN
  FOR v_sub IN
    SELECT
      customer_id,
      price_id,
      status
    FROM stripe_subscriptions
    WHERE deleted_at IS NULL
      AND status IN ('active', 'trialing')
  LOOP
    v_tokens_total := CASE v_sub.price_id
      WHEN 'price_1SG3zEJrr43cGTt4oUj89h9u' THEN 1200000
      WHEN 'price_1SG40ZJrr43cGTt4SGCX0JUZ' THEN 4000000
      WHEN 'price_1SG41xJrr43cGTt4MQwqdEiv' THEN 8000000
      WHEN 'price_1SG43JJrr43cGTt4URQn0TxZ' THEN 20000000
      ELSE 0
    END;

    SELECT COALESCE(SUM(tokens_consumed), 0)
    INTO v_tokens_used
    FROM processos p
    INNER JOIN stripe_customers sc ON p.user_id = sc.user_id
    WHERE sc.customer_id = v_sub.customer_id
      AND sc.deleted_at IS NULL
      AND p.status IN ('completed', 'processing_forensic')
      AND p.tokens_consumed > 0;

    UPDATE stripe_subscriptions
    SET
      tokens_total = v_tokens_total,
      tokens_used = v_tokens_used,
      last_token_reset_at = COALESCE(last_token_reset_at, now()),
      updated_at = now()
    WHERE customer_id = v_sub.customer_id
      AND deleted_at IS NULL;

    RAISE NOTICE 'Updated subscription for customer %: tokens_total=%, tokens_used=%',
      v_sub.customer_id, v_tokens_total, v_tokens_used;
  END LOOP;

  FOR v_processo IN
    SELECT
      p.id as processo_id,
      p.user_id,
      p.file_name,
      p.pages_processed_successfully,
      p.tokens_consumed,
      p.token_transaction_id,
      p.created_at
    FROM processos p
    WHERE p.status IN ('completed', 'processing_forensic')
      AND p.pages_processed_successfully > 0
      AND p.token_transaction_id IS NULL
  LOOP
    INSERT INTO token_usage_history (
      user_id,
      processo_id,
      tokens_consumed,
      pages_processed,
      operation_type,
      notes,
      created_at
    )
    VALUES (
      v_processo.user_id,
      v_processo.processo_id,
      COALESCE(v_processo.tokens_consumed, v_processo.pages_processed_successfully * 5500),
      v_processo.pages_processed_successfully,
      'process_document',
      'Historical data migration for: ' || v_processo.file_name,
      v_processo.created_at
    )
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Created token usage history for processo %', v_processo.processo_id;
  END LOOP;

  RAISE NOTICE 'Token migration completed successfully';
END $$;
