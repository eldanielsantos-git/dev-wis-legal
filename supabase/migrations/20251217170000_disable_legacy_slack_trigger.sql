/*
  # Desabilitar Trigger Legado do Slack

  1. Alterações
    - Remove trigger `trigger_notify_slack_on_user_signup`
    - Remove função `notify_slack_on_user_signup()`
    - Sistema agora usa send-admin-notification com configuração dinâmica

  2. Observações
    - O sistema antigo de notificações Slack foi substituído pelo sistema moderno de admin notifications
    - Edge function `send-slack-notification` foi removida
    - Todas as notificações agora passam por `send-admin-notification`
*/

-- Remove trigger se existir
DROP TRIGGER IF EXISTS trigger_notify_slack_on_user_signup ON user_profiles;

-- Remove função se existir
DROP FUNCTION IF EXISTS notify_slack_on_user_signup();

-- Comentário explicativo
COMMENT ON TABLE slack_notifications IS 'LEGACY: Tabela do sistema antigo de notificações Slack. Use admin_notification_config para novas configurações.';
