/*
  # Fix Token Debit for Completed Processes

  1. Problem
    - Processes completed before the fix were not debiting tokens
    - The field `pages_processed_successfully` was not being set
    - Tokens were not being consumed from user subscriptions

  2. Solution
    - Update all completed processes to set `pages_processed_successfully` from `transcricao.totalPages`
    - Manually trigger token debit for these processes
    - Ensure future processes will automatically debit tokens via trigger

  3. Changes
    - Set `pages_processed_successfully` for completed processes with 0 tokens consumed
    - Calculate and debit tokens based on pages
    - Record token usage in history table
    - Update subscription tokens_used

  4. Notes
    - Only processes with `status = 'completed'` and `tokens_consumed = 0` are affected
    - Uses the existing `calculate_tokens_from_pages` function (5,500 tokens/page)
    - Creates audit trail in `token_usage_history` table
*/

-- Fix pages_processed_successfully for completed processes
UPDATE processos
SET pages_processed_successfully = (transcricao->>'totalPages')::integer
WHERE status = 'completed'
  AND tokens_consumed = 0
  AND transcricao->>'totalPages' IS NOT NULL
  AND (transcricao->>'totalPages')::integer > 0
  AND pages_processed_successfully = 0;

-- Debit tokens for completed processes that haven't been charged
DO $$
DECLARE
  v_processo RECORD;
  v_customer_id text;
  v_tokens_to_debit integer;
  v_usage_history_id bigint;
BEGIN
  -- Loop through all completed processes without token debit
  FOR v_processo IN
    SELECT 
      id, 
      user_id, 
      file_name,
      pages_processed_successfully
    FROM processos
    WHERE status = 'completed'
      AND tokens_consumed = 0
      AND pages_processed_successfully > 0
  LOOP
    -- Calculate tokens to debit
    v_tokens_to_debit := calculate_tokens_from_pages(v_processo.pages_processed_successfully);
    
    -- Get customer_id for this user
    SELECT customer_id INTO v_customer_id
    FROM stripe_customers
    WHERE user_id = v_processo.user_id AND deleted_at IS NULL
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
        v_processo.user_id,
        v_processo.id,
        v_tokens_to_debit,
        v_processo.pages_processed_successfully,
        'process_document',
        'Retroactive token debit for process: ' || v_processo.file_name
      )
      RETURNING id INTO v_usage_history_id;
      
      -- Update subscription tokens_used
      UPDATE stripe_subscriptions
      SET tokens_used = tokens_used + v_tokens_to_debit,
          updated_at = now()
      WHERE customer_id = v_customer_id AND deleted_at IS NULL;
      
      -- Update processo with token info
      UPDATE processos
      SET tokens_consumed = v_tokens_to_debit,
          token_transaction_id = v_usage_history_id
      WHERE id = v_processo.id;
      
      RAISE NOTICE 'Debited % tokens for processo % (% pages)', 
        v_tokens_to_debit, v_processo.file_name, v_processo.pages_processed_successfully;
    ELSE
      RAISE NOTICE 'No customer found for user %, skipping processo %', 
        v_processo.user_id, v_processo.file_name;
    END IF;
  END LOOP;
END $$;
