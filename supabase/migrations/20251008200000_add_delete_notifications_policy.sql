/*
  # Adicionar política de DELETE para notificações

  1. Políticas
    - Permitir que usuários deletem suas próprias notificações
*/

-- Política para usuários deletarem suas próprias notificações
CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
