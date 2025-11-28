/*
# Criação da tabela transcription_queue

1. Nova Tabela
   - `transcription_queue` para gerenciar fila de tarefas de transcrição

2. Colunas
   - id (bigint, primary key)
   - processo_id (uuid, foreign key)
   - start_page (integer)
   - end_page (integer)
   - status (text, default 'pending')
   - created_at (timestamptz)
   - updated_at (timestamptz)

3. Segurança
   - Enable RLS
   - Apenas service_role pode acessar
*/

CREATE TABLE IF NOT EXISTS transcription_queue (
  id bigserial PRIMARY KEY,
  processo_id uuid NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
  start_page integer NOT NULL,
  end_page integer NOT NULL,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índice para otimizar consultas por processo_id e status
CREATE INDEX idx_transcription_queue_processo_status ON transcription_queue(processo_id, status);
CREATE INDEX idx_transcription_queue_status_created ON transcription_queue(status, created_at) WHERE status = 'pending';

ALTER TABLE transcription_queue ENABLE ROW LEVEL SECURITY;

-- Apenas service_role pode acessar a fila
CREATE POLICY "Apenas service_role pode acessar fila"
  ON transcription_queue
  FOR ALL
  TO service_role
  USING (true);