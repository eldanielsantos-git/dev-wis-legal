/*
  # Adicionar feedback aos chat messages
  
  1. Alterações
    - Adicionar coluna `feedback_chat` à tabela `chat_messages`
    - Tipo: text com valores permitidos: 'like', 'dislike', ou NULL
    - Usado para rastrear feedback do usuário sobre respostas do assistente
  
  2. Notas
    - Apenas mensagens de assistente devem ter feedback
    - NULL significa que ainda não foi dado feedback
*/

-- Adicionar coluna feedback_chat
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_messages' AND column_name = 'feedback_chat'
  ) THEN
    ALTER TABLE chat_messages ADD COLUMN feedback_chat text CHECK (feedback_chat IN ('like', 'dislike'));
  END IF;
END $$;

-- Criar índice para análise de feedback
CREATE INDEX IF NOT EXISTS idx_chat_messages_feedback ON chat_messages(feedback_chat) WHERE feedback_chat IS NOT NULL;
