/*
  # Fix debit_tokens_for_process - Remove metadata reference

  ## Problem
  The function references NEW.metadata but the processos table doesn't have this column.

  ## Solution
  Remove the metadata/reservation_id check since it doesn't exist.

  ## Security
  - No RLS changes
  - No data loss
*/

CREATE OR REPLACE FUNCTION debit_tokens_for_process()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_customer_id text;
  v_tokens_to_debit integer;
  v_usage_history_id bigint;
  v_pages_to_use integer;
  v_debit_result jsonb;
BEGIN
  v_pages_to_use := COALESCE(NEW.pages_processed_successfully, 0);
  
  IF v_pages_to_use = 0 THEN
    v_pages_to_use := COALESCE(
      NEW.total_pages,
      (NEW.transcricao->>'totalPages')::int,
      0
    );
  END IF;

  IF (NEW.status = 'completed' AND 
      OLD.status != 'completed' AND
      v_pages_to_use > 0 AND
      NEW.token_transaction_id IS NULL) THEN

    IF NEW.tokens_consumed > 0 THEN
      v_tokens_to_debit := NEW.tokens_consumed;
    ELSE
      v_tokens_to_debit := calculate_tokens_from_pages(v_pages_to_use);
    END IF;

    RAISE NOTICE '[DEBIT] Processo % mudou para completed. Pages: %, Tokens a debitar: %',
      NEW.id, v_pages_to_use, v_tokens_to_debit;

    SELECT customer_id INTO v_customer_id
    FROM stripe_customers
    WHERE user_id = NEW.user_id AND deleted_at IS NULL
    LIMIT 1;

    IF v_customer_id IS NOT NULL THEN
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
        v_pages_to_use, 
        'process_analysis', 
        'Tokens debitados apos conclusao de analise'
      )
      RETURNING id INTO v_usage_history_id;

      SELECT debit_user_tokens(
        NEW.user_id,
        v_tokens_to_debit::bigint,
        'process_analysis',
        jsonb_build_object(
          'processo_id', NEW.id,
          'file_name', NEW.file_name,
          'pages', v_pages_to_use
        )
      ) INTO v_debit_result;

      IF (v_debit_result->>'success')::boolean = true THEN
        NEW.tokens_consumed := v_tokens_to_debit;
        NEW.token_transaction_id := v_usage_history_id;

        RAISE NOTICE '[DEBIT] Tokens debitados com sucesso: % para processo %', 
          v_tokens_to_debit, NEW.id;
      ELSE
        RAISE WARNING '[DEBIT] Falha ao debitar tokens: %', v_debit_result->>'error';
      END IF;
    ELSE
      RAISE WARNING '[DEBIT] Customer nao encontrado para user_id: %. Tokens nao foram debitados.', NEW.user_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
