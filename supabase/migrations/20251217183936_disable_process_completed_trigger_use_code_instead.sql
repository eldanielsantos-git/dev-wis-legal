/*
  # Desabilita Trigger de Notificação Admin
  
  1. Remove o trigger de notificação admin
    - A lógica será movida para o código das edge functions
    - Mais confiável e fácil de debugar
    - Evita problemas com pg_net e variáveis de ambiente no banco
*/

-- Remover trigger
DROP TRIGGER IF EXISTS trigger_notify_admin_on_completed ON processos;

-- Remover função
DROP FUNCTION IF EXISTS notify_admin_on_process_completed();

COMMENT ON TRIGGER trigger_create_notification_on_status_change ON processos IS
  'Cria notificação para o usuário quando processo muda de status. Notificação admin é enviada pelas edge functions.';
