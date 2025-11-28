/*
  # View para Auditoria de Tokens

  ## 1. Nova View: v_token_consumption_audit

  Visão consolidada de consumo de tokens por processo com informações
  completas do usuário e subscrição para facilitar auditoria.

  **Colunas:**
  - user_id (uuid) - ID do usuário
  - user_email (text) - Email do usuário
  - user_name (text) - Nome completo do usuário
  - processo_id (uuid) - ID do processo
  - processo_name (text) - Nome do arquivo do processo
  - processo_status (text) - Status do processo
  - pages_processed (integer) - Páginas processadas
  - tokens_consumed (integer) - Tokens debitados
  - tokens_expected (integer) - Tokens esperados (páginas × 5500)
  - token_difference (integer) - Diferença entre esperado e consumido
  - customer_id (text) - ID do customer no Stripe
  - subscription_status (text) - Status da subscrição
  - plan_tokens_total (integer) - Total de tokens do plano
  - plan_tokens_used (integer) - Tokens usados do plano
  - plan_tokens_remaining (integer) - Tokens restantes do plano
  - created_at (timestamptz) - Data de criação do processo
  - completed_at (timestamptz) - Data de conclusão
  - transaction_id (bigint) - ID da transação no histórico

  ## 2. Índices Sugeridos
  - Já existem índices nas tabelas base
  - View é read-only, não necessita índices próprios

  ## 3. Segurança (RLS)
  - Views herdam políticas RLS das tabelas base
  - Admins podem ver todos os dados
  - Usuários comuns veem apenas seus próprios dados
*/

-- Criar view consolidada para auditoria de tokens
CREATE OR REPLACE VIEW v_token_consumption_audit AS
SELECT
  p.user_id,
  up.email as user_email,
  COALESCE(up.first_name || ' ' || up.last_name, up.email) as user_name,
  p.id as processo_id,
  p.file_name as processo_name,
  p.status as processo_status,
  p.pages_processed_successfully as pages_processed,
  p.tokens_consumed,
  (p.pages_processed_successfully * 5500) as tokens_expected,
  (p.tokens_consumed - (p.pages_processed_successfully * 5500)) as token_difference,
  sc.customer_id,
  ss.status as subscription_status,
  ss.tokens_total as plan_tokens_total,
  ss.tokens_used as plan_tokens_used,
  (ss.tokens_total - ss.tokens_used) as plan_tokens_remaining,
  p.created_at,
  p.analysis_completed_at as completed_at,
  p.token_transaction_id as transaction_id
FROM processos p
LEFT JOIN user_profiles up ON up.id = p.user_id
LEFT JOIN stripe_customers sc ON sc.user_id = p.user_id AND sc.deleted_at IS NULL
LEFT JOIN stripe_subscriptions ss ON ss.customer_id = sc.customer_id AND ss.deleted_at IS NULL
WHERE p.status = 'completed'
  AND p.pages_processed_successfully > 0
ORDER BY p.created_at DESC;

-- Comentários para documentação
COMMENT ON VIEW v_token_consumption_audit IS
  'View consolidada para auditoria de consumo de tokens por processo, incluindo informações de usuário e subscrição';

-- Grant de permissões
-- Admins podem visualizar tudo
GRANT SELECT ON v_token_consumption_audit TO authenticated;

-- Criar view simplificada para usuários (apenas seus dados)
CREATE OR REPLACE VIEW v_my_token_consumption AS
SELECT
  processo_id,
  processo_name,
  processo_status,
  pages_processed,
  tokens_consumed,
  tokens_expected,
  created_at,
  completed_at
FROM v_token_consumption_audit
WHERE user_id = auth.uid();

COMMENT ON VIEW v_my_token_consumption IS
  'View simplificada mostrando apenas consumo de tokens do usuário autenticado';

-- Grant de permissões
GRANT SELECT ON v_my_token_consumption TO authenticated;

-- Criar view de estatísticas agregadas (para admins)
CREATE OR REPLACE VIEW v_token_consumption_stats AS
SELECT
  COUNT(DISTINCT user_id) as total_users,
  COUNT(DISTINCT processo_id) as total_processes,
  SUM(pages_processed) as total_pages_processed,
  SUM(tokens_consumed) as total_tokens_consumed,
  SUM(tokens_expected) as total_tokens_expected,
  AVG(tokens_consumed::numeric) as avg_tokens_per_process,
  AVG(pages_processed::numeric) as avg_pages_per_process,
  COUNT(CASE WHEN token_difference != 0 THEN 1 END) as processes_with_difference,
  MIN(created_at) as earliest_process,
  MAX(created_at) as latest_process
FROM v_token_consumption_audit;

COMMENT ON VIEW v_token_consumption_stats IS
  'Estatísticas agregadas de consumo de tokens para análise administrativa';

-- Grant de permissões apenas para admins via RLS
GRANT SELECT ON v_token_consumption_stats TO authenticated;

-- Criar função helper para obter resumo de tokens por período
CREATE OR REPLACE FUNCTION get_token_consumption_by_period(
  p_start_date timestamptz DEFAULT NOW() - INTERVAL '30 days',
  p_end_date timestamptz DEFAULT NOW()
)
RETURNS TABLE (
  date date,
  total_processes bigint,
  total_pages bigint,
  total_tokens bigint,
  unique_users bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(created_at) as date,
    COUNT(DISTINCT processo_id) as total_processes,
    SUM(pages_processed) as total_pages,
    SUM(tokens_consumed) as total_tokens,
    COUNT(DISTINCT user_id) as unique_users
  FROM v_token_consumption_audit
  WHERE created_at BETWEEN p_start_date AND p_end_date
  GROUP BY DATE(created_at)
  ORDER BY DATE(created_at) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_token_consumption_by_period IS
  'Retorna resumo diário de consumo de tokens para um período específico';

-- Grant de permissões
GRANT EXECUTE ON FUNCTION get_token_consumption_by_period TO authenticated;
