/*
  # Corrigir condição do trigger de débito de tokens
  
  1. Problema
    - O trigger verifica se NEW.tokens_consumed = 0, mas os processos já são salvos com tokens_consumed preenchido
    - Resultado: tokens nunca são debitados porque a condição sempre é falsa
  
  2. Solução
    - Verificar se token_transaction_id é NULL ao invés de tokens_consumed = 0
    - Isso garante que só debitamos se ainda não foi debitado
*/

-- Atualizar função para verificar token_transaction_id ao invés de tokens_consumed
CREATE OR REPLACE FUNCTION debit_tokens_for_process()
RETURNS TRIGGER AS $$
DECLARE
  v_customer_id text;
  v_tokens_to_debit integer;
  v_usage_history_id bigint;
BEGIN
  -- Only debit tokens when status changes to 'completed' and hasn't been debited yet
  IF (NEW.status = 'completed' AND 
      OLD.status != 'completed' AND
      NEW.pages_processed_successfully > 0 AND
      NEW.token_transaction_id IS NULL) THEN
    
    -- Use tokens_consumed if already calculated, otherwise calculate from pages
    IF NEW.tokens_consumed > 0 THEN
      v_tokens_to_debit := NEW.tokens_consumed;
    ELSE
      v_tokens_to_debit := calculate_tokens_from_pages(NEW.pages_processed_successfully);
    END IF;
    
    -- Get customer_id for this user
    SELECT customer_id INTO v_customer_id
    FROM stripe_customers
    WHERE user_id = NEW.user_id AND deleted_at IS NULL
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
        NEW.user_id,
        NEW.id,
        v_tokens_to_debit,
        NEW.pages_processed_successfully,
        'process_document',
        'Automatic token debit for process: ' || NEW.file_name
      )
      RETURNING id INTO v_usage_history_id;
      
      -- Update subscription tokens_used
      UPDATE stripe_subscriptions
      SET tokens_used = tokens_used + v_tokens_to_debit,
          updated_at = now()
      WHERE customer_id = v_customer_id AND deleted_at IS NULL;
      
      -- Update processo with token info
      NEW.tokens_consumed := v_tokens_to_debit;
      NEW.token_transaction_id := v_usage_history_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
