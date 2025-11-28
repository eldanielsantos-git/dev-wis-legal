/*
  # Remoção das Colunas Antigas de Análise Simplificada

  ## Descrição

  Remove as colunas da tabela `processos` que armazenavam a análise simplificada,
  pois agora todo o sistema utilizará exclusivamente a análise forense completa
  armazenada na tabela `analise_forense`.

  ## Colunas Removidas

  - `resumo_estruturado` (text) - Resumo em texto simples do processo
  - `mapeamento_pecas` (jsonb) - Array de peças processuais mapeadas
  - `sintese_argumentos` (jsonb) - Objeto com argumentos do autor e réu

  ## Impacto

  Após esta migração, qualquer código que referencie estas colunas irá falhar.
  Todo o frontend e backend devem ser atualizados para usar a tabela `analise_forense`.
*/

-- Remover coluna resumo_estruturado se existir
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'processos' AND column_name = 'resumo_estruturado'
  ) THEN
    ALTER TABLE processos DROP COLUMN resumo_estruturado;
  END IF;
END $$;

-- Remover coluna mapeamento_pecas se existir
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'processos' AND column_name = 'mapeamento_pecas'
  ) THEN
    ALTER TABLE processos DROP COLUMN mapeamento_pecas;
  END IF;
END $$;

-- Remover coluna sintese_argumentos se existir
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'processos' AND column_name = 'sintese_argumentos'
  ) THEN
    ALTER TABLE processos DROP COLUMN sintese_argumentos;
  END IF;
END $$;
