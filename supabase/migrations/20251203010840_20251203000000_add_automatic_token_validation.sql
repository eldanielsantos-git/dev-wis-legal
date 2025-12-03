/*
  # Validação Automática de Tokens para Chunks

  1. Problema Resolvido
    - Chunks criados sem estimated_tokens calculado
    - Validação de tokens nunca executada
    - Chunks gigantes enviados para LLM causando erro 400

  2. Solução
    - Trigger automático que calcula estimated_tokens ao criar/atualizar chunk
    - Valida automaticamente se chunk excede limite (850k tokens seguros)
    - Marca chunk como 'exceeded' se ultrapassar limite
    - Marca chunk como 'valid' se dentro do limite

  3. Cálculo
    - Base: 1500 tokens por página (inclui contexto e overhead)
    - Limite seguro: 850.000 tokens (81% do max 1.048.576)
    - Se estimated_tokens > 850000 → 'exceeded'
    - Se estimated_tokens <= 850000 → 'valid'

  4. Segurança
    - Trigger executa ANTES do insert/update
    - Nunca permite chunk sem validação
    - Sistema automaticamente subdivide chunks 'exceeded'
*/

-- Função para calcular e validar tokens automaticamente
CREATE OR REPLACE FUNCTION calculate_and_validate_chunk_tokens()
RETURNS TRIGGER AS $$
DECLARE
  v_estimated_tokens INTEGER;
  v_validation_status VARCHAR;
  v_safe_token_limit INTEGER := 850000; -- 81% do limite do Gemini (1.048.576)
  v_tokens_per_page INTEGER := 1500;    -- Inclui contexto e overhead
BEGIN
  -- Calcular estimated_tokens baseado em pages_count
  v_estimated_tokens := NEW.pages_count * v_tokens_per_page;
  
  -- Validar se está dentro do limite seguro
  IF v_estimated_tokens > v_safe_token_limit THEN
    v_validation_status := 'exceeded';
    RAISE NOTICE 'Chunk % excede limite: % tokens (limite: %)', 
                 NEW.id, v_estimated_tokens, v_safe_token_limit;
  ELSE
    v_validation_status := 'valid';
  END IF;
  
  -- Atualizar valores no registro
  NEW.estimated_tokens := v_estimated_tokens;
  NEW.token_validation_status := v_validation_status;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remover trigger antigo se existir
DROP TRIGGER IF EXISTS trigger_calculate_chunk_tokens ON process_chunks;

-- Criar trigger para executar ANTES de insert ou update
CREATE TRIGGER trigger_calculate_chunk_tokens
  BEFORE INSERT OR UPDATE OF pages_count ON process_chunks
  FOR EACH ROW
  EXECUTE FUNCTION calculate_and_validate_chunk_tokens();

-- Atualizar chunks existentes que não têm estimated_tokens
UPDATE process_chunks
SET 
  estimated_tokens = pages_count * 1500,
  token_validation_status = CASE
    WHEN (pages_count * 1500) > 850000 THEN 'exceeded'
    ELSE 'valid'
  END
WHERE estimated_tokens IS NULL OR token_validation_status IS NULL;

-- Criar índice para consultas rápidas de chunks com problema
CREATE INDEX IF NOT EXISTS idx_chunks_token_validation 
  ON process_chunks(token_validation_status, status) 
  WHERE token_validation_status = 'exceeded';

-- Log da migration
DO $$
BEGIN
  RAISE NOTICE '✅ Token validation automático ativado';
  RAISE NOTICE '   - Trigger: calculate_and_validate_chunk_tokens';
  RAISE NOTICE '   - Limite seguro: 850.000 tokens (~566 páginas)';
  RAISE NOTICE '   - Chunks atualizados: % registros', 
               (SELECT COUNT(*) FROM process_chunks WHERE estimated_tokens IS NOT NULL);
END $$;
