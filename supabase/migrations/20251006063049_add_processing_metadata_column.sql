/*
  # Adiciona coluna processing_metadata

  1. Changes
    - Adiciona coluna `processing_metadata` tipo JSONB na tabela `processos`
    - Armazena metadados de processamento como categorias de documentos, tempos médios, etc.
  
  2. Notes
    - Coluna nullable para compatibilidade com processos existentes
    - JSONB permite estrutura flexível de metadados
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'processos' AND column_name = 'processing_metadata'
  ) THEN
    ALTER TABLE processos ADD COLUMN processing_metadata JSONB;
  END IF;
END $$;