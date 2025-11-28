/*
  # Corrigir políticas RLS da tabela forensic_prompts

  1. Políticas Atualizadas
    - Permitir INSERT para usuários autenticados e anônimos
    - Permitir UPDATE para usuários autenticados e anônimos
    - Permitir DELETE para usuários autenticados e anônimos (para gerenciamento)
  
  2. Segurança
    - Como não há sistema de autenticação de usuários, permitimos acesso público
    - Em produção, isso seria restrito a admins autenticados
*/

-- Remover políticas duplicadas/antigas
DROP POLICY IF EXISTS "Service role can insert forensic prompts" ON forensic_prompts;
DROP POLICY IF EXISTS "Service role can update forensic prompts" ON forensic_prompts;
DROP POLICY IF EXISTS "Anyone can read forensic prompts" ON forensic_prompts;
DROP POLICY IF EXISTS "Usuários autenticados podem visualizar prompts forenses" ON forensic_prompts;

-- Política de SELECT: qualquer um pode ler
CREATE POLICY "Qualquer um pode ler prompts forenses"
  ON forensic_prompts
  FOR SELECT
  USING (true);

-- Política de INSERT: qualquer um pode inserir (frontend usa anon key)
CREATE POLICY "Qualquer um pode inserir prompts forenses"
  ON forensic_prompts
  FOR INSERT
  WITH CHECK (true);

-- Política de UPDATE: qualquer um pode atualizar
CREATE POLICY "Qualquer um pode atualizar prompts forenses"
  ON forensic_prompts
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Política de DELETE: qualquer um pode deletar (para gerenciamento)
CREATE POLICY "Qualquer um pode deletar prompts forenses"
  ON forensic_prompts
  FOR DELETE
  USING (true);
