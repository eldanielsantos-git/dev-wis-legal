/*
  # Corrigir Política de INSERT em Notificações

  1. Problema
    - Usuários autenticados não podem criar notificações
    - Apenas service_role tem permissão
    - Frontend precisa criar notificações

  2. Solução
    - Adicionar política para usuários autenticados criarem suas próprias notificações
    - Garantir que só podem criar notificações para eles mesmos
*/

-- Adicionar política para usuários autenticados criarem suas próprias notificações
CREATE POLICY "Users can insert own notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
