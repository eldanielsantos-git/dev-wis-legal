/*
  # Corrigir Processos Sem Débito de Tokens

  ## 1. Problema
    - Processos com status='completed' que não tiveram tokens debitados
    - Campo `tokens_consumed` está zerado mesmo após conclusão
    - Usuários não foram cobrados pelos tokens consumidos

  ## 2. Solução
    - Identificar todos os processos completed com tokens_consumed=0
    - Calcular tokens baseado em páginas processadas (5.500 tokens/página)
    - Debitar tokens das subscrições dos usuários
    - Registrar no histórico de uso (token_usage_history)
    - Marcar processos como corrigidos

  ## 3. Segurança
    - Apenas processos com status='completed' são afetados
    - Apenas se pages_processed_successfully > 0
    - Apenas se tokens_consumed = 0
    - Registra auditoria completa
*/

-- Função auxiliar para calcular tokens (já existe, mas garantir que está disponível)
CREATE OR REPLACE FUNCTION calculate_tokens_from_pages(page_count integer)
RETURNS integer AS $$
BEGIN
  RETURN page_count * 5500;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Script para corrigir processos sem débito de tokens
DO $$
DECLARE
  v_processo RECORD;
  v_customer_id text;
  v_tokens_to_debit integer;
  v_usage_history_id bigint;
  v_total_fixed integer := 0;
  v_total_tokens_debited integer := 0;
BEGIN
  RAISE NOTICE '=== Iniciando correção de processos sem débito de tokens ===';

  -- Loop através de todos os processos completed sem tokens debitados
  FOR v_processo IN
    SELECT
      id,
      user_id,
      file_name,
      pages_processed_successfully,
      created_at,
      analysis_completed_at
    FROM processos
    WHERE status = 'completed'
      AND tokens_consumed = 0
      AND pages_processed_successfully > 0
    ORDER BY created_at ASC
  LOOP
    -- Calcular tokens a debitar
    v_tokens_to_debit := calculate_tokens_from_pages(v_processo.pages_processed_successfully);

    -- Buscar customer_id para este usuário
    SELECT customer_id INTO v_customer_id
    FROM stripe_customers
    WHERE user_id = v_processo.user_id
      AND deleted_at IS NULL
    LIMIT 1;

    IF v_customer_id IS NOT NULL THEN
      -- Verificar se usuário tem subscrição ativa
      IF EXISTS (
        SELECT 1
        FROM stripe_subscriptions
        WHERE customer_id = v_customer_id
          AND deleted_at IS NULL
          AND status IN ('active', 'trialing')
      ) THEN

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
          v_processo.pages_processed_successfully,
          'process_document',
          'Correção retroativa de débito - processo concluído em ' || v_processo.analysis_completed_at::text
        )
        RETURNING id INTO v_usage_history_id;

        -- Debitar tokens da subscrição
        UPDATE stripe_subscriptions
        SET tokens_used = tokens_used + v_tokens_to_debit,
            updated_at = now()
        WHERE customer_id = v_customer_id
          AND deleted_at IS NULL;

        -- Atualizar processo com informação de tokens
        UPDATE processos
        SET tokens_consumed = v_tokens_to_debit,
            token_transaction_id = v_usage_history_id,
            updated_at = now()
        WHERE id = v_processo.id;

        -- Contadores
        v_total_fixed := v_total_fixed + 1;
        v_total_tokens_debited := v_total_tokens_debited + v_tokens_to_debit;

        RAISE NOTICE 'Corrigido: % (% páginas, % tokens)',
          v_processo.file_name,
          v_processo.pages_processed_successfully,
          v_tokens_to_debit;
      ELSE
        RAISE NOTICE 'Usuário sem subscrição ativa - ignorando processo: %', v_processo.file_name;
      END IF;
    ELSE
      RAISE NOTICE 'Customer não encontrado para user_id: % - ignorando processo: %',
        v_processo.user_id,
        v_processo.file_name;
    END IF;
  END LOOP;

  RAISE NOTICE '=== Correção concluída ===';
  RAISE NOTICE 'Total de processos corrigidos: %', v_total_fixed;
  RAISE NOTICE 'Total de tokens debitados: %', v_total_tokens_debited;

  -- Se nenhum processo foi corrigido, informar
  IF v_total_fixed = 0 THEN
    RAISE NOTICE 'Nenhum processo necessitava correção!';
  END IF;
END $$;

-- Grant de permissões para funções
GRANT EXECUTE ON FUNCTION calculate_tokens_from_pages TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_tokens_from_pages TO service_role;
