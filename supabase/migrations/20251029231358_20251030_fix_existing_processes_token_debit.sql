/*
  # Corrigir Processos Existentes Sem Débito de Tokens
  
  ## 1. Problema
    - Processos com status='completed' que não tiveram tokens debitados
    - Campo tokens_consumed está zerado ou nulo
    - Usuários não foram cobrados pelos tokens consumidos
    
  ## 2. Solução
    - Identificar processos completed sem débito
    - Calcular tokens baseado em páginas (5.500 tokens/página)
    - Extrair totalPages do campo transcricao (JSONB)
    - Debitar tokens das subscriptions
    - Registrar no histórico (token_usage_history)
    - Atualizar campo tokens_consumed nos processos
    
  ## 3. Segurança
    - Apenas processos com status='completed'
    - Apenas com transcricao->totalPages > 0
    - Apenas com tokens_consumed = 0 ou NULL
    - Log completo de auditoria
*/

DO $$
DECLARE
  v_processo RECORD;
  v_customer_id text;
  v_tokens_to_debit integer;
  v_usage_history_id bigint;
  v_total_pages integer;
  v_total_fixed integer := 0;
  v_total_tokens_debited bigint := 0;
  v_skipped_no_pages integer := 0;
  v_skipped_no_customer integer := 0;
  v_skipped_no_subscription integer := 0;
BEGIN
  RAISE NOTICE '=== Iniciando correção de processos sem débito de tokens ===';
  RAISE NOTICE 'Data/Hora: %', NOW();

  -- Loop através de todos os processos completed sem tokens debitados
  FOR v_processo IN
    SELECT
      id,
      user_id,
      file_name,
      transcricao,
      created_at,
      analysis_completed_at
    FROM processos
    WHERE status = 'completed'
      AND COALESCE(tokens_consumed, 0) = 0
      AND transcricao IS NOT NULL
      AND transcricao->>'totalPages' IS NOT NULL
    ORDER BY analysis_completed_at ASC NULLS LAST, created_at ASC
  LOOP
    -- Extrair total de páginas do JSON
    BEGIN
      v_total_pages := (v_processo.transcricao->>'totalPages')::integer;
    EXCEPTION WHEN OTHERS THEN
      v_total_pages := 0;
    END;
    
    -- Validar páginas
    IF v_total_pages IS NULL OR v_total_pages <= 0 THEN
      RAISE NOTICE 'Pulando processo % - sem informação válida de páginas', v_processo.file_name;
      v_skipped_no_pages := v_skipped_no_pages + 1;
      CONTINUE;
    END IF;
    
    -- Calcular tokens (5.500 por página)
    v_tokens_to_debit := v_total_pages * 5500;
    
    -- Buscar customer_id
    SELECT customer_id INTO v_customer_id
    FROM stripe_customers
    WHERE user_id = v_processo.user_id
      AND deleted_at IS NULL
    LIMIT 1;
    
    IF v_customer_id IS NULL THEN
      RAISE NOTICE 'Pulando processo % - usuário sem customer_id', v_processo.file_name;
      v_skipped_no_customer := v_skipped_no_customer + 1;
      CONTINUE;
    END IF;
    
    -- Verificar se usuário tem subscrição ativa
    IF NOT EXISTS (
      SELECT 1
      FROM stripe_subscriptions
      WHERE customer_id = v_customer_id
        AND deleted_at IS NULL
        AND status IN ('active', 'trialing')
    ) THEN
      RAISE NOTICE 'Pulando processo % - usuário sem subscrição ativa', v_processo.file_name;
      v_skipped_no_subscription := v_skipped_no_subscription + 1;
      CONTINUE;
    END IF;
    
    -- Registrar uso no histórico
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
      v_total_pages,
      'process_document',
      'CORREÇÃO RETROATIVA: ' || v_processo.file_name || 
      ' (' || v_total_pages || ' pág × 5.500 tokens) - ' ||
      'Concluído em ' || COALESCE(v_processo.analysis_completed_at::text, 'data desconhecida')
    )
    RETURNING id INTO v_usage_history_id;
    
    -- Debitar tokens da subscrição
    UPDATE stripe_subscriptions
    SET tokens_used = tokens_used + v_tokens_to_debit,
        updated_at = NOW()
    WHERE customer_id = v_customer_id
      AND deleted_at IS NULL;
    
    -- Atualizar processo
    UPDATE processos
    SET tokens_consumed = v_tokens_to_debit,
        token_transaction_id = v_usage_history_id,
        pages_processed_successfully = v_total_pages,
        updated_at = NOW()
    WHERE id = v_processo.id;
    
    -- Contadores
    v_total_fixed := v_total_fixed + 1;
    v_total_tokens_debited := v_total_tokens_debited + v_tokens_to_debit;
    
    RAISE NOTICE '✓ Corrigido: % (% pág, % tokens)',
      v_processo.file_name,
      v_total_pages,
      v_tokens_to_debit;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '=== Correção concluída ===';
  RAISE NOTICE 'Processos corrigidos: %', v_total_fixed;
  RAISE NOTICE 'Total de tokens debitados: %', v_total_tokens_debited;
  RAISE NOTICE '';
  RAISE NOTICE 'Processos pulados:';
  RAISE NOTICE '  - Sem páginas válidas: %', v_skipped_no_pages;
  RAISE NOTICE '  - Sem customer_id: %', v_skipped_no_customer;
  RAISE NOTICE '  - Sem subscrição ativa: %', v_skipped_no_subscription;
  
  IF v_total_fixed = 0 THEN
    RAISE NOTICE '';
    RAISE NOTICE '✓ Nenhum processo necessitava correção!';
  END IF;
END $$;
