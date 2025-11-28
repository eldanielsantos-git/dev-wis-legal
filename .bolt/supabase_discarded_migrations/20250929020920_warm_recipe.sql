/*
# Criação da tabela processos

1. Nova Tabela
   - `processos` para armazenar informações dos processos jurídicos
   
2. Colunas
   - id (uuid, primary key)
   - file_name (text)
   - file_path (text)  
   - file_url (text)
   - file_size (int8)
   - transcricao (jsonb)
   - resumo_estruturado (text)
   - mapeamento_pecas (text)
   - sintese_argumentos (text)
   - status (processo_status)
   - created_at (timestamptz)
   - updated_at (timestamptz)

3. Segurança
   - Enable RLS
   - Política para leitura pública (demo)
   - Política para inserção autenticada
*/

CREATE TABLE IF NOT EXISTS processos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_url text NOT NULL,
  file_size bigint NOT NULL,
  transcricao jsonb DEFAULT '{"pages": [], "totalPages": 0}'::jsonb,
  resumo_estruturado text,
  mapeamento_pecas text,
  sintese_argumentos text,
  status processo_status DEFAULT 'created',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE processos ENABLE ROW LEVEL SECURITY;

-- Política para leitura pública (demo)
CREATE POLICY "Processos são públicos para leitura"
  ON processos
  FOR SELECT
  TO public
  USING (true);

-- Política para inserção (qualquer usuário pode criar processos)
CREATE POLICY "Qualquer usuário pode criar processos"
  ON processos
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Política para atualização (apenas service_role)
CREATE POLICY "Apenas service_role pode atualizar processos"
  ON processos
  FOR UPDATE
  TO service_role
  USING (true);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_processos_updated_at
  BEFORE UPDATE ON processos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();