/*
  # Correcao Critica: Race Condition no Debito de Tokens

  ## Problema Identificado
  O trigger `check_and_complete_processo` (em analysis_results) marca o processo como
  'completed' SEM definir `pages_processed_successfully`. Isso causa uma race condition
  onde o trigger de debito `debit_tokens_for_process` nao consegue debitar porque:
  
  1. Primeiro UPDATE: status -> 'completed' (pages_processed_successfully ainda e 0)
     - Trigger de debito verifica pages_processed_successfully > 0 -> FALHA
  2. Segundo UPDATE: pages_processed_successfully -> N
     - Trigger de debito verifica OLD.status != 'completed' -> FALHA (ja e completed)

  ## Solucao Implementada

  ### 1. Modificar check_and_complete_processo
  - Agora inclui `pages_processed_successfully` no UPDATE
  - Obtem o valor de `transcricao->>'totalPages'` ou `total_pages`

  ### 2. Remover triggers duplicados
  - Manter apenas `trigger_debit_tokens_on_completion`
  - Remover `debit_tokens_trigger` e `trigger_debit_tokens` (duplicatas)

  ### 3. Melhorar debit_tokens_for_process
  - Adicionar logs detalhados para debug
  - Garantir que o debito aconteca mesmo se pages vem de fonte alternativa

  ## Seguranca
  - Nenhuma alteracao em RLS
  - Nenhuma perda de dados
  - Compativel com sistema existente
*/

-- 1. Atualizar funcao check_and_complete_processo para incluir pages_processed_successfully
CREATE OR REPLACE FUNCTION check_and_complete_processo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_total_prompts INT;
  v_completed_prompts INT;
  v_processo_status TEXT;
  v_total_pages INT;
BEGIN
  IF NEW.status = 'completed' THEN
    SELECT status INTO v_processo_status
    FROM processos
    WHERE id = NEW.processo_id;

    IF v_processo_status != 'completed' THEN
      SELECT COUNT(*) INTO v_total_prompts
      FROM analysis_results
      WHERE processo_id = NEW.processo_id;

      SELECT COUNT(*) INTO v_completed_prompts
      FROM analysis_results
      WHERE processo_id = NEW.processo_id
        AND status = 'completed';

      IF v_total_prompts > 0 AND v_total_prompts = v_completed_prompts THEN
        SELECT COALESCE(
          total_pages,
          (transcricao->>'totalPages')::int,
          0
        ) INTO v_total_pages
        FROM processos
        WHERE id = NEW.processo_id;

        UPDATE processos
        SET
          status = 'completed',
          pages_processed_successfully = v_total_pages,
          analysis_completed_at = NOW()
        WHERE id = NEW.processo_id
          AND status != 'completed';

        RAISE NOTICE '✅ Processo % automaticamente marcado como completed (% de % prompts, % paginas)',
          NEW.processo_id, v_completed_prompts, v_total_prompts, v_total_pages;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 2. Remover triggers duplicados de debito (manter apenas um)
DROP TRIGGER IF EXISTS debit_tokens_trigger ON processos;
DROP TRIGGER IF EXISTS trigger_debit_tokens ON processos;

-- 3. Atualizar funcao debit_tokens_for_process com melhor logging e fallback
CREATE OR REPLACE FUNCTION debit_tokens_for_process()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_customer_id text;
  v_tokens_to_debit integer;
  v_usage_history_id bigint;
  v_reservation_id uuid;
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

        RAISE NOTICE '[DEBIT] ✅ Tokens debitados com sucesso: % para processo %', 
          v_tokens_to_debit, NEW.id;
      ELSE
        RAISE WARNING '[DEBIT] ❌ Falha ao debitar tokens: %', v_debit_result->>'error';
      END IF;

      IF NEW.metadata IS NOT NULL AND NEW.metadata ? 'reservation_id' THEN
        v_reservation_id := (NEW.metadata->>'reservation_id')::uuid;

        IF v_reservation_id IS NOT NULL THEN
          PERFORM consume_reservation(v_reservation_id);
          RAISE NOTICE '[DEBIT] Reserva % consumida para processo %', v_reservation_id, NEW.id;
        END IF;
      END IF;
    ELSE
      RAISE WARNING '[DEBIT] Customer nao encontrado para user_id: %. Tokens nao foram debitados.', NEW.user_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 4. Garantir que existe apenas um trigger de debito
DROP TRIGGER IF EXISTS trigger_debit_tokens_on_completion ON processos;
CREATE TRIGGER trigger_debit_tokens_on_completion
  BEFORE UPDATE ON processos
  FOR EACH ROW
  EXECUTE FUNCTION debit_tokens_for_process();

-- 5. Adicionar comentarios para documentacao
COMMENT ON FUNCTION check_and_complete_processo() IS 
'Marca processo como completed automaticamente quando todos analysis_results estao completos. Inclui pages_processed_successfully.';

COMMENT ON FUNCTION debit_tokens_for_process() IS
'Debita tokens quando processo muda para completed. Usa 5.500 tokens por pagina. Trigger BEFORE UPDATE em processos.';

COMMENT ON TRIGGER trigger_debit_tokens_on_completion ON processos IS
'Unico trigger de debito de tokens. Executa debit_tokens_for_process() quando status muda para completed.';
