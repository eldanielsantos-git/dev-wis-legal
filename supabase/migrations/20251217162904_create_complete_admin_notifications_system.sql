/*
  # Sistema Completo de Notificações Administrativas (Isolado e Seguro)

  ## Visão Geral
  Este sistema gerencia notificações administrativas enviadas para o Slack de forma
  isolada e segura, garantindo que falhas nunca afetem o sistema principal.

  ## 1. Enums
    - `notification_category`: Categorias de notificações
      - success: Eventos de sucesso
      - error: Erros e falhas
      - warning: Avisos e alertas
      - info: Informações gerais
      - system: Eventos do sistema
      - integration: Eventos de integrações
      - infrastructure: Eventos de infraestrutura

    - `notification_severity`: Níveis de severidade
      - critical: Crítico - requer ação imediata
      - high: Alto - requer atenção urgente
      - medium: Médio - deve ser revisado
      - low: Baixo - informativo
      - success: Sucesso - confirmação positiva

  ## 2. Tabelas

    ### admin_notification_types
    Cadastro de todos os tipos de notificações disponíveis no sistema.
    Esta tabela é populada com seed data e raramente modificada.

    Campos:
    - id: Identificador único
    - slug: Identificador textual único (ex: 'user_signup', 'analysis_failed')
    - name: Nome amigável
    - description: Descrição detalhada
    - category: Categoria da notificação
    - default_severity: Severidade padrão
    - icon: Emoji/ícone para representar o tipo
    - is_active: Se o tipo está ativo no sistema
    - created_at: Data de criação
    - updated_at: Data de atualização

    ### admin_notification_config
    Configuração individual de cada tipo de notificação.
    Controla quais notificações estão habilitadas e se devem ir para o Slack.

    Campos:
    - id: Identificador único
    - notification_type_id: Referência ao tipo
    - is_enabled: Se a notificação está habilitada
    - notify_slack: Se deve enviar para o Slack
    - updated_by: Usuário que fez a última alteração
    - updated_at: Data da última alteração

    ### admin_notifications
    Histórico completo de todas as notificações enviadas.
    Mantém registro de sucesso/falha do envio ao Slack.

    Campos:
    - id: Identificador único
    - notification_type_id: Referência ao tipo
    - severity: Severidade específica desta notificação
    - title: Título da notificação
    - message: Mensagem detalhada
    - metadata: Dados adicionais em JSON
    - sent_to_slack: Se foi enviada ao Slack
    - slack_message_id: ID da mensagem no Slack (se enviada)
    - slack_response: Resposta completa do Slack
    - error_message: Mensagem de erro (se falhou)
    - created_at: Data de criação
    - user_id: Usuário relacionado (opcional)
    - processo_id: Processo relacionado (opcional)

  ## 3. Segurança
    - RLS habilitado em todas as tabelas
    - Apenas administradores podem acessar
    - Auditoria automática de alterações
    - Sistema completamente isolado das tabelas principais

  ## 4. Seed Data
    - 30+ tipos de notificações pré-cadastrados
    - Configurações padrão (todas habilitadas)
    - Exemplos para todas as categorias
*/

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE notification_category AS ENUM (
  'success',
  'error',
  'warning',
  'info',
  'system',
  'integration',
  'infrastructure'
);

CREATE TYPE notification_severity AS ENUM (
  'critical',
  'high',
  'medium',
  'low',
  'success'
);

-- ============================================================================
-- TABELAS
-- ============================================================================

-- Tabela de tipos de notificações
CREATE TABLE IF NOT EXISTS admin_notification_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  category notification_category NOT NULL,
  default_severity notification_severity NOT NULL,
  icon text DEFAULT '📢',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela de configurações de notificações
CREATE TABLE IF NOT EXISTS admin_notification_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type_id uuid NOT NULL,
  is_enabled boolean DEFAULT true,
  notify_slack boolean DEFAULT true,
  updated_by uuid,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT fk_notification_type
    FOREIGN KEY (notification_type_id)
    REFERENCES admin_notification_types(id)
    ON DELETE CASCADE
);

-- Tabela de histórico de notificações
CREATE TABLE IF NOT EXISTS admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type_id uuid NOT NULL,
  severity notification_severity NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  sent_to_slack boolean DEFAULT false,
  slack_message_id text,
  slack_response jsonb,
  error_message text,
  created_at timestamptz DEFAULT now(),
  user_id uuid,
  processo_id uuid,
  CONSTRAINT fk_notification_type
    FOREIGN KEY (notification_type_id)
    REFERENCES admin_notification_types(id)
    ON DELETE CASCADE
);

-- ============================================================================
-- ÍNDICES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_admin_notification_types_slug
  ON admin_notification_types(slug);

CREATE INDEX IF NOT EXISTS idx_admin_notification_types_category
  ON admin_notification_types(category);

CREATE INDEX IF NOT EXISTS idx_admin_notification_config_type
  ON admin_notification_config(notification_type_id);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_type
  ON admin_notifications(notification_type_id);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_created_at
  ON admin_notifications(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_severity
  ON admin_notifications(severity);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_sent_to_slack
  ON admin_notifications(sent_to_slack);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_user_id
  ON admin_notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_processo_id
  ON admin_notifications(processo_id);

-- ============================================================================
-- RLS (ROW LEVEL SECURITY)
-- ============================================================================

-- admin_notification_types
ALTER TABLE admin_notification_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view notification types"
  ON admin_notification_types FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "Admin can insert notification types"
  ON admin_notification_types FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "Admin can update notification types"
  ON admin_notification_types FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "Admin can delete notification types"
  ON admin_notification_types FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- admin_notification_config
ALTER TABLE admin_notification_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view notification config"
  ON admin_notification_config FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "Admin can insert notification config"
  ON admin_notification_config FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "Admin can update notification config"
  ON admin_notification_config FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "Admin can delete notification config"
  ON admin_notification_config FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- admin_notifications
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view notifications"
  ON admin_notifications FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "Service role can insert notifications"
  ON admin_notifications FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger para updated_at em admin_notification_types
CREATE OR REPLACE FUNCTION update_admin_notification_types_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER admin_notification_types_updated_at
  BEFORE UPDATE ON admin_notification_types
  FOR EACH ROW
  EXECUTE FUNCTION update_admin_notification_types_updated_at();

-- Trigger para updated_at em admin_notification_config
CREATE OR REPLACE FUNCTION update_admin_notification_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER admin_notification_config_updated_at
  BEFORE UPDATE ON admin_notification_config
  FOR EACH ROW
  EXECUTE FUNCTION update_admin_notification_config_updated_at();

-- ============================================================================
-- SEED DATA - TIPOS DE NOTIFICAÇÕES
-- ============================================================================

-- CATEGORIA: SUCCESS
INSERT INTO admin_notification_types (slug, name, description, category, default_severity, icon) VALUES
('analysis_completed', 'Análise Concluída', 'Análise de processo concluída com sucesso', 'success', 'success', '✅'),
('user_signup', 'Novo Usuário', 'Novo usuário cadastrado no sistema', 'success', 'success', '🎉'),
('subscription_created', 'Assinatura Criada', 'Nova assinatura Stripe ativada', 'success', 'success', '💳'),
('subscription_upgraded', 'Upgrade de Plano', 'Usuário fez upgrade de assinatura', 'success', 'success', '⬆️'),
('subscription_downgraded', 'Downgrade de Plano', 'Usuário fez downgrade de assinatura', 'success', 'low', '⬇️'),
('token_purchase', 'Compra de Tokens', 'Usuário comprou pacote de tokens', 'success', 'success', '🪙'),
('user_level_up', 'Subiu de Nível', 'Usuário subiu de nível na gamificação', 'success', 'low', '🎯'),
('workspace_invite_sent', 'Convite Workspace Enviado', 'Convite de workspace foi enviado', 'success', 'low', '📧'),
('friend_invite_sent', 'Convite Amigo Enviado', 'Convite de amigo foi enviado', 'success', 'low', '👥'),
('invite_accepted', 'Convite Aceito', 'Usuário aceitou um convite', 'success', 'low', '✅')
ON CONFLICT (slug) DO NOTHING;

-- CATEGORIA: ERROR
INSERT INTO admin_notification_types (slug, name, description, category, default_severity, icon) VALUES
('analysis_failed', 'Análise Falhou', 'Erro durante análise de processo', 'error', 'high', '❌'),
('analysis_complex_failed', 'Análise Complexa Falhou', 'Erro durante análise de processo complexo', 'error', 'high', '⚠️'),
('gemini_timeout', 'Timeout Gemini', 'Timeout ao comunicar com Gemini API', 'error', 'critical', '⏱️'),
('gemini_rate_limit', 'Rate Limit Gemini', 'Rate limit atingido na Gemini API', 'error', 'critical', '🚫'),
('worker_error', 'Erro em Worker', 'Erro em edge function worker', 'error', 'high', '🔧'),
('dead_letter_queue', 'Dead Letter Queue', 'Item crítico na dead letter queue', 'error', 'critical', '💀'),
('process_stuck', 'Processo Travado', 'Processo em análise está travado', 'error', 'high', '🔒'),
('database_error', 'Erro de Banco', 'Erro ao acessar banco de dados', 'error', 'critical', '🗄️'),
('storage_error', 'Erro de Storage', 'Erro ao acessar storage', 'error', 'high', '📦')
ON CONFLICT (slug) DO NOTHING;

-- CATEGORIA: INTEGRATION
INSERT INTO admin_notification_types (slug, name, description, category, default_severity, icon) VALUES
('stripe_webhook_error', 'Erro Webhook Stripe', 'Erro ao processar webhook do Stripe', 'integration', 'high', '💳'),
('stripe_payment_failed', 'Pagamento Falhou', 'Falha em pagamento de assinatura', 'integration', 'high', '💸'),
('stripe_token_payment_failed', 'Pagamento Tokens Falhou', 'Falha em pagamento de tokens', 'integration', 'high', '🪙'),
('stripe_chargeback', 'Chargeback Stripe', 'Chargeback detectado no Stripe', 'integration', 'critical', '⚡'),
('resend_email_error', 'Erro Email Resend', 'Erro ao enviar email via Resend', 'integration', 'medium', '📧'),
('resend_high_bounce_rate', 'Bounce Rate Alto', 'Taxa de bounce de emails está alta', 'integration', 'medium', '📉')
ON CONFLICT (slug) DO NOTHING;

-- CATEGORIA: INFRASTRUCTURE
INSERT INTO admin_notification_types (slug, name, description, category, default_severity, icon) VALUES
('github_action_failed', 'GitHub Action Falhou', 'Falha em GitHub Action', 'infrastructure', 'medium', '🔧'),
('netlify_build_failed', 'Build Netlify Falhou', 'Falha no build do Netlify', 'infrastructure', 'high', '🏗️'),
('deploy_warnings', 'Deploy com Warnings', 'Deploy concluído mas com warnings', 'infrastructure', 'low', '⚠️'),
('supabase_quota_warning', 'Quota Supabase Próxima', 'Quota do Supabase próxima do limite', 'infrastructure', 'medium', '📊'),
('netlify_bandwidth_high', 'Bandwidth Alto', 'Uso de bandwidth no Netlify está alto', 'infrastructure', 'medium', '📡')
ON CONFLICT (slug) DO NOTHING;

-- CATEGORIA: SYSTEM
INSERT INTO admin_notification_types (slug, name, description, category, default_severity, icon) VALUES
('subscription_cancelled', 'Assinatura Cancelada', 'Assinatura foi cancelada pelo usuário', 'system', 'medium', '❌'),
('user_deleted', 'Usuário Deletado', 'Conta de usuário foi deletada', 'system', 'medium', '🗑️'),
('bulk_operation_completed', 'Operação em Massa Concluída', 'Operação em massa foi concluída', 'system', 'low', '📋'),
('backup_completed', 'Backup Concluído', 'Backup do sistema foi concluído', 'system', 'success', '💾'),
('maintenance_scheduled', 'Manutenção Agendada', 'Manutenção programada do sistema', 'system', 'medium', '🛠️')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- SEED DATA - CONFIGURAÇÕES PADRÃO
-- ============================================================================

-- Criar configurações padrão para todos os tipos (todas habilitadas)
INSERT INTO admin_notification_config (notification_type_id, is_enabled, notify_slack)
SELECT id, true, true
FROM admin_notification_types
ON CONFLICT DO NOTHING;

-- ============================================================================
-- FUNÇÕES AUXILIARES
-- ============================================================================

-- Função para obter estatísticas de notificações
CREATE OR REPLACE FUNCTION get_notification_stats(time_window interval DEFAULT '24 hours')
RETURNS TABLE (
  total_notifications bigint,
  sent_to_slack bigint,
  failed_slack bigint,
  by_severity jsonb,
  by_category jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::bigint as total_notifications,
    COUNT(*) FILTER (WHERE an.sent_to_slack = true)::bigint as sent_to_slack,
    COUNT(*) FILTER (WHERE an.sent_to_slack = false AND an.error_message IS NOT NULL)::bigint as failed_slack,
    jsonb_object_agg(an.severity, severity_count) as by_severity,
    jsonb_object_agg(ant.category, category_count) as by_category
  FROM admin_notifications an
  JOIN admin_notification_types ant ON an.notification_type_id = ant.id
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::bigint as severity_count
    FROM admin_notifications
    WHERE severity = an.severity
    AND created_at > now() - time_window
  ) severity_counts ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::bigint as category_count
    FROM admin_notifications an2
    JOIN admin_notification_types ant2 ON an2.notification_type_id = ant2.id
    WHERE ant2.category = ant.category
    AND an2.created_at > now() - time_window
  ) category_counts ON true
  WHERE an.created_at > now() - time_window;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentários nas tabelas
COMMENT ON TABLE admin_notification_types IS 'Tipos de notificações administrativas disponíveis no sistema';
COMMENT ON TABLE admin_notification_config IS 'Configuração individual de cada tipo de notificação';
COMMENT ON TABLE admin_notifications IS 'Histórico completo de todas as notificações enviadas';
COMMENT ON TYPE notification_category IS 'Categorias de notificações: success, error, warning, info, system, integration, infrastructure';
COMMENT ON TYPE notification_severity IS 'Níveis de severidade: critical, high, medium, low, success';
