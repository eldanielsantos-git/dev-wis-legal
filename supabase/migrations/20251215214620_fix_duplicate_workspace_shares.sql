/*
  # Corrigir compartilhamentos duplicados

  1. Limpeza de Dados
    - Remove todos os compartilhamentos duplicados para o mesmo processo e email
    - Mantém apenas o registro mais recente (última permissão válida)
    - Corrige casos onde foram criados múltiplos registros em vez de atualizar
  
  2. Índice Único
    - Adiciona constraint para prevenir duplicações futuras
    - Permite apenas um compartilhamento por processo+email
*/

-- Remove all duplicates except the most recent one
DELETE FROM workspace_shares
WHERE id IN (
  SELECT ws.id
  FROM workspace_shares ws
  INNER JOIN (
    SELECT 
      processo_id,
      shared_with_email,
      MAX(created_at) as max_created_at
    FROM workspace_shares
    GROUP BY processo_id, shared_with_email
    HAVING COUNT(*) > 1
  ) duplicates ON 
    ws.processo_id = duplicates.processo_id 
    AND ws.shared_with_email = duplicates.shared_with_email
    AND ws.created_at < duplicates.max_created_at
);

-- Add unique constraint to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS unique_workspace_share_per_email_processo 
  ON workspace_shares(processo_id, shared_with_email);
