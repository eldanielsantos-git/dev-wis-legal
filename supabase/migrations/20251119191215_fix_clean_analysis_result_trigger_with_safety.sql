/*
  # Correção do Trigger de Limpeza com Proteção Contra Perda de Dados
  
  O trigger estava removendo todo o conteúdo de alguns resultados.
  Esta versão adiciona proteções para evitar perda de dados:
  
  1. Só limpa se houver marcadores de código presentes
  2. Nunca deixa o conteúdo vazio se havia conteúdo antes
  3. Adiciona validação de JSON após limpeza
  4. Reverte para original se a limpeza resultar em vazio
*/

-- Função melhorada com proteção contra perda de dados
CREATE OR REPLACE FUNCTION clean_analysis_result_content()
RETURNS TRIGGER AS $$
DECLARE
  original_content text;
  cleaned_content text;
BEGIN
  -- Se result_content é nulo ou vazio, não faz nada
  IF NEW.result_content IS NULL OR LENGTH(TRIM(NEW.result_content)) = 0 THEN
    RETURN NEW;
  END IF;
  
  -- Salvar conteúdo original
  original_content := NEW.result_content;
  cleaned_content := NEW.result_content;
  
  -- Só limpa se houver marcadores de código
  IF cleaned_content LIKE '%```%' THEN
    -- Remover texto introdutório comum
    cleaned_content := REGEXP_REPLACE(
      cleaned_content,
      '^(Com base na consolidação[^\n]*\n+|Com base na análise consolidada[^\n]*\n+|Você recebeu[^\n]*\n+)',
      '',
      'g'
    );
    
    -- Remover marcadores de código
    cleaned_content := REGEXP_REPLACE(cleaned_content, '^```json\s*', '', 'g');
    cleaned_content := REGEXP_REPLACE(cleaned_content, '^```\s*', '', 'g');
    cleaned_content := REGEXP_REPLACE(cleaned_content, '\s*```$', '', 'g');
    
    -- Remover espaços em branco no início e fim
    cleaned_content := TRIM(cleaned_content);
    
    -- Se ainda não começar com { ou [, tentar encontrar o primeiro JSON válido
    IF NOT (cleaned_content ~ '^\s*[\{\[]') THEN
      -- Procurar pelo primeiro { ou [ e remover tudo antes
      cleaned_content := REGEXP_REPLACE(cleaned_content, '^[^\{\[]*', '', '');
    END IF;
    
    -- Limpar novamente espaços em branco
    cleaned_content := TRIM(cleaned_content);
    
    -- PROTEÇÃO: Se após a limpeza ficou vazio, reverter para original
    IF LENGTH(cleaned_content) = 0 THEN
      RAISE WARNING 'Limpeza resultou em conteúdo vazio para analysis_result %. Revertendo para original.', NEW.id;
      NEW.result_content := original_content;
    ELSE
      -- Validar se é JSON válido
      BEGIN
        PERFORM cleaned_content::jsonb;
        -- JSON válido, pode usar
        NEW.result_content := cleaned_content;
      EXCEPTION WHEN OTHERS THEN
        -- JSON inválido após limpeza, reverter para original
        RAISE WARNING 'Limpeza resultou em JSON inválido para analysis_result %. Revertendo para original. Erro: %', NEW.id, SQLERRM;
        NEW.result_content := original_content;
      END;
    END IF;
  ELSE
    -- Sem marcadores de código, apenas trim
    cleaned_content := TRIM(cleaned_content);
    IF LENGTH(cleaned_content) > 0 THEN
      NEW.result_content := cleaned_content;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recriar trigger com a nova função
DROP TRIGGER IF EXISTS trigger_clean_analysis_result_content ON analysis_results;
CREATE TRIGGER trigger_clean_analysis_result_content
  BEFORE INSERT OR UPDATE OF result_content
  ON analysis_results
  FOR EACH ROW
  WHEN (NEW.result_content IS NOT NULL AND LENGTH(NEW.result_content) > 0)
  EXECUTE FUNCTION clean_analysis_result_content();

-- Atualizar comentários
COMMENT ON FUNCTION clean_analysis_result_content() IS 'Remove automaticamente texto introdutório e marcadores de código de result_content, com proteção contra perda de dados';
COMMENT ON TRIGGER trigger_clean_analysis_result_content ON analysis_results IS 'Limpa automaticamente o conteúdo antes de salvar, mas reverte se resultar em vazio ou JSON inválido';
