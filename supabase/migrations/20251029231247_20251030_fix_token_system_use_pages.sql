/*
  # Corrigir Sistema de Tokens - Usar Páginas ao invés de API Gemini
  
  ## 1. Problema
    - Sistema estava tentando usar tokens da API do Gemini
    - Não estava debitando corretamente 5.500 tokens por página
    - Campo pages_processed_successfully não estava sendo populado
    
  ## 2. Solução
    - Garantir que pages_processed_successfully seja atualizado corretamente
    - Trigger deve usar apenas pages_processed_successfully * 5500
    - Verificar saldo de tokens ANTES de iniciar análise
    - Debitar tokens APENAS quando status = 'completed'
    
  ## 3. Cálculo de Tokens
    - 5.500 tokens por página processada
    - Exemplo: PDF de 10 páginas = 55.000 tokens
    - Débito ocorre apenas quando processo é concluído com sucesso
*/

-- Garantir que a função de cálculo existe e está correta
CREATE OR REPLACE FUNCTION calculate_tokens_from_pages(page_count integer)
RETURNS integer AS $$
BEGIN
  -- 5.500 tokens por página
  RETURN page_count * 5500;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Criar função para verificar disponibilidade de tokens antes do upload
CREATE OR REPLACE FUNCTION check_token_availability(
  p_user_id uuid,
  p_tokens_needed integer
)
RETURNS boolean AS $$
DECLARE
  v_customer_id text;
  v_tokens_total integer;
  v_tokens_used integer;
  v_tokens_available integer;
BEGIN
  -- Buscar customer_id
  SELECT customer_id INTO v_customer_id
  FROM stripe_customers
  WHERE user_id = p_user_id
    AND deleted_at IS NULL
  LIMIT 1;
  
  IF v_customer_id IS NULL THEN
    RETURN false;
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
    RETURN false;
  END IF;
  
  v_tokens_available := v_tokens_total - v_tokens_used;
  
  RETURN v_tokens_available >= p_tokens_needed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recriar trigger de débito de tokens (mais robusto)
CREATE OR REPLACE FUNCTION debit_tokens_for_process()
RETURNS TRIGGER AS $$
DECLARE
  v_customer_id text;
  v_tokens_to_debit integer;
  v_usage_history_id bigint;
  v_total_pages integer;
BEGIN
  -- Só debitar quando:
  -- 1. Status muda para 'completed'
  -- 2. Não era 'completed' antes
  -- 3. Ainda não foi debitado (tokens_consumed = 0)
  IF (NEW.status = 'completed' AND 
      (OLD.status IS NULL OR OLD.status != 'completed') AND
      COALESCE(NEW.tokens_consumed, 0) = 0) THEN
    
    -- Extrair total de páginas do JSON transcricao
    v_total_pages := (NEW.transcricao->>'totalPages')::integer;
    
    -- Se não tiver totalPages, tentar usar pages_processed_successfully
    IF v_total_pages IS NULL OR v_total_pages = 0 THEN
      v_total_pages := NEW.pages_processed_successfully;
    END IF;
    
    -- Se ainda não tiver páginas, não debitar
    IF v_total_pages IS NULL OR v_total_pages = 0 THEN
      RAISE NOTICE 'Processo % sem informação de páginas, débito não realizado', NEW.id;
      RETURN NEW;
    END IF;
    
    -- Calcular tokens (5.500 por página)
    v_tokens_to_debit := calculate_tokens_from_pages(v_total_pages);
    
    RAISE NOTICE 'Debitando % tokens para % páginas do processo %', 
      v_tokens_to_debit, v_total_pages, NEW.id;
    
    -- Buscar customer_id
    SELECT customer_id INTO v_customer_id
    FROM stripe_customers
    WHERE user_id = NEW.user_id AND deleted_at IS NULL
    LIMIT 1;
    
    IF v_customer_id IS NOT NULL THEN
      -- Registrar no histórico de uso de tokens
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
        v_total_pages,
        'process_document',
        'Débito automático: ' || NEW.file_name || ' (' || v_total_pages || ' páginas × 5.500 tokens)'
      )
      RETURNING id INTO v_usage_history_id;
      
      -- Debitar tokens da subscription
      UPDATE stripe_subscriptions
      SET tokens_used = tokens_used + v_tokens_to_debit,
          updated_at = now()
      WHERE customer_id = v_customer_id 
        AND deleted_at IS NULL;
      
      -- Atualizar processo com informações de tokens
      NEW.tokens_consumed := v_tokens_to_debit;
      NEW.token_transaction_id := v_usage_history_id;
      NEW.pages_processed_successfully := v_total_pages;
      
      RAISE NOTICE 'Débito concluído: % tokens para processo %', v_tokens_to_debit, NEW.id;
    ELSE
      RAISE WARNING 'Customer não encontrado para user_id %, débito não realizado', NEW.user_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remover trigger antigo se existir
DROP TRIGGER IF EXISTS debit_tokens_trigger ON processos;

-- Criar novo trigger
CREATE TRIGGER debit_tokens_trigger
  BEFORE UPDATE ON processos
  FOR EACH ROW
  EXECUTE FUNCTION debit_tokens_for_process();

-- Grants
GRANT EXECUTE ON FUNCTION calculate_tokens_from_pages TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_tokens_from_pages TO service_role;
GRANT EXECUTE ON FUNCTION check_token_availability TO authenticated;
GRANT EXECUTE ON FUNCTION check_token_availability TO service_role;
