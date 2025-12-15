/*
  # Adicionar coluna total_pages para contagem de páginas no upload

  ## Contexto

  O sistema atualmente salva o total de páginas apenas em `transcricao.totalPages` (JSONB).
  Diversas edge functions e código do frontend precisam acessar essa informação diretamente
  via `processo.total_pages` para:

  - Emails de confirmação (Resend)
  - Chat com variáveis {total_pages}
  - Validações de tokens
  - UI de progresso

  A coluna `pages_processed_successfully` é usada para tracking de progresso durante análise,
  mas não armazena o total conhecido no momento do upload.

  ## Mudanças

  1. Nova Coluna
     - `total_pages` (INTEGER) - Total de páginas conhecido no momento do upload

  2. População de Dados
     - Popula a partir de `transcricao->>'totalPages'`
     - Fallback para `pages_processed_successfully`
     - Fallback para `tier_info->>'pageCount'`

  3. Trigger de Sincronização
     - Mantém `total_pages` atualizado automaticamente quando `transcricao` é modificado

  4. Índice
     - Cria índice condicional para otimizar queries
*/

-- 1. Adicionar coluna total_pages
ALTER TABLE processos
  ADD COLUMN IF NOT EXISTS total_pages INTEGER;

-- 2. Adicionar constraint para valores válidos
ALTER TABLE processos
  ADD CONSTRAINT check_total_pages_positive
  CHECK (total_pages IS NULL OR total_pages >= 0);

-- 3. Popular dados existentes (múltiplas fontes, em ordem de prioridade)

-- Fonte 1: transcricao.totalPages (mais confiável)
UPDATE processos
SET total_pages = (transcricao->>'totalPages')::integer
WHERE transcricao IS NOT NULL
  AND transcricao ? 'totalPages'
  AND transcricao->>'totalPages' IS NOT NULL
  AND transcricao->>'totalPages' ~ '^[0-9]+$'
  AND total_pages IS NULL;

-- Fonte 2: pages_processed_successfully (fallback)
UPDATE processos
SET total_pages = pages_processed_successfully
WHERE total_pages IS NULL
  AND pages_processed_successfully > 0;

-- Fonte 3: tier_info.pageCount (segundo fallback)
UPDATE processos
SET total_pages = (tier_info->>'pageCount')::integer
WHERE total_pages IS NULL
  AND tier_info IS NOT NULL
  AND tier_info ? 'pageCount'
  AND tier_info->>'pageCount' IS NOT NULL
  AND tier_info->>'pageCount' ~ '^[0-9]+$';

-- 4. Criar função para sincronizar total_pages automaticamente
CREATE OR REPLACE FUNCTION sync_total_pages_from_transcricao()
RETURNS TRIGGER AS $$
BEGIN
  -- Só atualizar se transcricao.totalPages estiver presente e for válido
  IF NEW.transcricao IS NOT NULL
     AND NEW.transcricao ? 'totalPages'
     AND NEW.transcricao->>'totalPages' IS NOT NULL
     AND NEW.transcricao->>'totalPages' ~ '^[0-9]+$' THEN
    NEW.total_pages := (NEW.transcricao->>'totalPages')::integer;
  -- Se total_pages ainda for NULL, tentar pages_processed_successfully
  ELSIF NEW.total_pages IS NULL AND NEW.pages_processed_successfully > 0 THEN
    NEW.total_pages := NEW.pages_processed_successfully;
  -- Se ainda for NULL, tentar tier_info.pageCount
  ELSIF NEW.total_pages IS NULL
        AND NEW.tier_info IS NOT NULL
        AND NEW.tier_info ? 'pageCount'
        AND NEW.tier_info->>'pageCount' IS NOT NULL
        AND NEW.tier_info->>'pageCount' ~ '^[0-9]+$' THEN
    NEW.total_pages := (NEW.tier_info->>'pageCount')::integer;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Criar trigger para manter sincronizado
DROP TRIGGER IF EXISTS trigger_sync_total_pages ON processos;

CREATE TRIGGER trigger_sync_total_pages
  BEFORE INSERT OR UPDATE OF transcricao, pages_processed_successfully, tier_info
  ON processos
  FOR EACH ROW
  EXECUTE FUNCTION sync_total_pages_from_transcricao();

-- 6. Criar índice condicional para otimizar queries
CREATE INDEX IF NOT EXISTS idx_processos_total_pages
  ON processos(total_pages)
  WHERE total_pages IS NOT NULL;

-- 7. Adicionar comentário explicativo
COMMENT ON COLUMN processos.total_pages IS
  'Total de páginas do PDF conhecido no momento do upload. Sincronizado automaticamente com transcricao.totalPages. Use este campo para contagens e validações.';

-- 8. Atualizar estatísticas da tabela
ANALYZE processos;
