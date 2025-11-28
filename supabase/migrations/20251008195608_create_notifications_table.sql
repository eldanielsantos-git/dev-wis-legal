/*
  # Criar tabela de notificações

  1. Nova Tabela: `notifications`
    - `id` (uuid, chave primária) - Identificador único da notificação
    - `user_id` (uuid, referência a auth.users) - ID do usuário que recebe a notificação
    - `processo_id` (uuid, referência a processos) - ID do processo relacionado
    - `type` (text) - Tipo da notificação: 'success' ou 'error'
    - `message` (text) - Mensagem da notificação
    - `is_read` (boolean) - Se a notificação foi lida
    - `created_at` (timestamptz) - Data de criação
    - `read_at` (timestamptz, nullable) - Data em que foi marcada como lida

  2. Segurança
    - Habilitar RLS na tabela `notifications`
    - Adicionar política para usuários lerem apenas suas próprias notificações
    - Adicionar política para usuários atualizarem apenas suas próprias notificações
    - Adicionar política para service_role criar notificações

  3. Índices
    - Índice em `user_id` para busca eficiente
    - Índice em `is_read` para filtros
    - Índice em `created_at` para ordenação
*/

-- Criar tabela de notificações
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  processo_id uuid REFERENCES processos(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('success', 'error')),
  message text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  read_at timestamptz
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;

-- Habilitar RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Política para usuários lerem suas próprias notificações
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Política para usuários atualizarem suas próprias notificações
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Política para service_role criar notificações
CREATE POLICY "Service role can insert notifications"
  ON notifications FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Política para service_role ler todas notificações (para admin)
CREATE POLICY "Service role can view all notifications"
  ON notifications FOR SELECT
  TO service_role
  USING (true);

-- Função para criar notificação automaticamente quando processo muda de status
CREATE OR REPLACE FUNCTION create_notification_on_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o status mudou para 'completed', criar notificação de sucesso
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    INSERT INTO notifications (user_id, processo_id, type, message)
    VALUES (
      NEW.user_id,
      NEW.id,
      'success',
      'A análise do seu processo está pronta!'
    );
  END IF;

  -- Se o status mudou para 'error', criar notificação de erro
  IF NEW.status = 'error' AND (OLD.status IS NULL OR OLD.status != 'error') THEN
    INSERT INTO notifications (user_id, processo_id, type, message)
    VALUES (
      NEW.user_id,
      NEW.id,
      'error',
      'Houve alguma falha no processamento do seu arquivo. Exclua o item atual e tente novamente.'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger para executar a função
DROP TRIGGER IF EXISTS trigger_create_notification_on_status_change ON processos;
CREATE TRIGGER trigger_create_notification_on_status_change
  AFTER INSERT OR UPDATE OF status ON processos
  FOR EACH ROW
  EXECUTE FUNCTION create_notification_on_status_change();

-- Função para limpar notificações antigas (mais de 30 dias)
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS void AS $$
BEGIN
  DELETE FROM notifications
  WHERE created_at < NOW() - INTERVAL '30 days'
  AND is_read = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;