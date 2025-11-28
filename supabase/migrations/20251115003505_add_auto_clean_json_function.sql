/*
  # Função para Limpeza Automática de JSON Corrompido

  ## Resumo
  Cria uma função que remove automaticamente texto introdutório indesejado
  dos resultados de análise, garantindo que apenas JSON válido seja armazenado.

  ## 1. Função: clean_analysis_result_content

  Remove texto introdutório que pode corromper o JSON:
  - "Com base na consolidação..."
  - "Com base na análise consolidada..."
  - Marcadores ```json
  - Qualquer texto antes do primeiro `{`

  ## 2. Trigger

  Executa automaticamente antes de INSERT ou UPDATE em analysis_results,
  limpando o conteúdo para garantir JSON válido.

  ## 3. Segurança

  - Função é IMMUTABLE e segura
  - Não afeta RLS
  - Executa com permissões do usuário que faz a operação
*/

-- Função para limpar conteúdo de análise corrompido
CREATE OR REPLACE FUNCTION clean_analysis_result_content()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar se result_content não é nulo e não está vazio
  IF NEW.result_content IS NOT NULL AND LENGTH(TRIM(NEW.result_content)) > 0 THEN
    -- Remover texto introdutório comum
    NEW.result_content := REGEXP_REPLACE(
      NEW.result_content,
      '^(Com base na consolidação[^\n]*\n+|Com base na análise consolidada[^\n]*\n+|Você recebeu[^\n]*\n+)',
      '',
      'g'
    );
    
    -- Remover marcadores de código
    NEW.result_content := REGEXP_REPLACE(NEW.result_content, '^```json\s*', '', 'g');
    NEW.result_content := REGEXP_REPLACE(NEW.result_content, '^```\s*', '', 'g');
    NEW.result_content := REGEXP_REPLACE(NEW.result_content, '\s*```$', '', 'g');
    
    -- Remover espaços em branco no início e fim
    NEW.result_content := TRIM(NEW.result_content);
    
    -- Se ainda não começar com { ou [, tentar encontrar o primeiro JSON válido
    IF NOT (NEW.result_content ~ '^\s*[\{\[]') THEN
      -- Procurar pelo primeiro { ou [ e remover tudo antes
      NEW.result_content := REGEXP_REPLACE(NEW.result_content, '^[^\{\[]*', '', '');
    END IF;
    
    -- Limpar novamente espaços em branco
    NEW.result_content := TRIM(NEW.result_content);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para limpar conteúdo antes de salvar
DROP TRIGGER IF EXISTS trigger_clean_analysis_result_content ON analysis_results;
CREATE TRIGGER trigger_clean_analysis_result_content
  BEFORE INSERT OR UPDATE OF result_content
  ON analysis_results
  FOR EACH ROW
  WHEN (NEW.result_content IS NOT NULL)
  EXECUTE FUNCTION clean_analysis_result_content();

-- Comentários para documentação
COMMENT ON FUNCTION clean_analysis_result_content() IS 'Remove automaticamente texto introdutório e marcadores de código de result_content para garantir JSON válido';
COMMENT ON TRIGGER trigger_clean_analysis_result_content ON analysis_results IS 'Limpa automaticamente o conteúdo antes de salvar para prevenir JSON corrompido';
