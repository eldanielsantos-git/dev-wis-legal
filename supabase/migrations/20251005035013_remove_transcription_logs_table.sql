/*
  # Remover tabela transcription_logs (não utilizada)

  ## Análise
  - **Total de registros:** 0
  - **Tamanho da tabela:** 80 kB
  - **Uso atual:** Nenhuma edge function ou serviço frontend utiliza esta tabela
  - **Dependências:** Nenhuma (sem foreign keys apontando para ela)
  - **Último uso:** Nunca utilizada no sistema atual

  ## Justificativa
  A tabela `transcription_logs` foi criada no início do projeto mas nunca foi implementada.
  Nenhum código atual (edge functions ou frontend) faz insert, update, delete ou select nesta tabela.
  
  Sistema V3 usa outras formas de logging:
  - Logs da edge function (console.log)
  - consolidation_debug_logs (para erros de parsing JSON)
  - Campos de status e metadata na tabela processos

  ## Ação
  - Remover tabela transcription_logs
  - Remover políticas RLS associadas
  - Remover índices associados

  ## Rollback
  Se necessário reverter, pode recriar com:
  
  CREATE TABLE transcription_logs (
    id BIGSERIAL PRIMARY KEY,
    processo_id UUID REFERENCES processos(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
  );
*/

-- 1. Remover políticas RLS (se existirem)
DROP POLICY IF EXISTS "Allow service_role to manage transcription_logs" ON transcription_logs;
DROP POLICY IF EXISTS "Allow public to read transcription_logs" ON transcription_logs;

-- 2. Remover índices (se existirem)
DROP INDEX IF EXISTS idx_transcription_logs_processo_id;
DROP INDEX IF EXISTS idx_transcription_logs_created_at;

-- 3. Remover a tabela
DROP TABLE IF EXISTS transcription_logs CASCADE;

-- 4. Confirmar remoção
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'transcription_logs'
  ) THEN
    RAISE NOTICE '✅ Tabela transcription_logs removida com sucesso';
  ELSE
    RAISE EXCEPTION '❌ Erro: Tabela transcription_logs ainda existe';
  END IF;
END $$;
