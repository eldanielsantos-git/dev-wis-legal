/*
  # Expand Token Audit Logging

  1. Changes
    - Add index for efficient querying by event_type and operation
    - Add comments to token_credits_audit columns
    - Create view for easier audit analysis

  2. Purpose
    - Facilitate debugging and troubleshooting of token operations
    - Provide detailed audit trail for all token-related changes
    - Enable analysis of token usage patterns

  3. Audit Event Types
    - plan_change: User upgraded or downgraded subscription plan
    - billing_period_renewed: New billing period started
    - subscription_canceled: User canceled subscription
    - subscription_reactivated: User reactivated canceled subscription
    - checkout.session.completed: Token package purchased
    - debit_tokens: Tokens consumed by user

  4. Security
    - Audit data is protected by RLS policies
    - Only service role and admins can insert audit records
*/

-- Add indexes for efficient audit queries
CREATE INDEX IF NOT EXISTS idx_token_credits_audit_event_type
ON token_credits_audit(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_token_credits_audit_operation
ON token_credits_audit(operation, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_token_credits_audit_customer_event
ON token_credits_audit(customer_id, event_type, created_at DESC);

-- Add comments to audit columns for clarity
COMMENT ON TABLE token_credits_audit IS 'Comprehensive audit log for all token-related operations including purchases, plan changes, and consumption';

COMMENT ON COLUMN token_credits_audit.event_type IS 'Type of event: plan_change, billing_period_renewed, subscription_canceled, checkout.session.completed, debit_tokens, etc';

COMMENT ON COLUMN token_credits_audit.operation IS 'Specific operation: preserve_remaining_tokens, reset_tokens_used, credit_tokens, debit_tokens, etc';

COMMENT ON COLUMN token_credits_audit.tokens_amount IS 'Number of tokens involved in the operation (positive for credits, can be positive for debits)';

COMMENT ON COLUMN token_credits_audit.metadata IS 'JSON object with operation-specific details: old/new values, price IDs, user IDs, etc';

-- Create view for easier audit analysis
CREATE OR REPLACE VIEW token_audit_summary AS
SELECT
  tca.id,
  tca.event_type,
  tca.operation,
  tca.customer_id,
  sc.user_id,
  up.email,
  COALESCE(up.first_name || ' ' || up.last_name, up.first_name, up.last_name) as user_name,
  tca.status,
  tca.tokens_amount,
  tca.before_extra_tokens,
  tca.after_extra_tokens,
  COALESCE(tca.after_extra_tokens, 0) - COALESCE(tca.before_extra_tokens, 0) as extra_tokens_change,
  tca.before_plan_tokens,
  tca.after_plan_tokens,
  tca.before_tokens_total,
  tca.after_tokens_total,
  tca.error_message,
  tca.metadata,
  tca.processing_time_ms,
  tca.created_at
FROM token_credits_audit tca
LEFT JOIN stripe_customers sc ON tca.customer_id = sc.customer_id
LEFT JOIN user_profiles up ON sc.user_id = up.id
ORDER BY tca.created_at DESC;

-- Grant access to the view
GRANT SELECT ON token_audit_summary TO authenticated;
GRANT SELECT ON token_audit_summary TO service_role;

-- Create summary statistics view
CREATE OR REPLACE VIEW token_operations_stats AS
SELECT
  event_type,
  operation,
  status,
  COUNT(*) as operation_count,
  SUM(tokens_amount) as total_tokens,
  AVG(tokens_amount) as avg_tokens,
  MIN(tokens_amount) as min_tokens,
  MAX(tokens_amount) as max_tokens,
  AVG(processing_time_ms) as avg_processing_time_ms,
  COUNT(CASE WHEN error_message IS NOT NULL THEN 1 END) as error_count,
  MAX(created_at) as last_occurrence
FROM token_credits_audit
GROUP BY event_type, operation, status
ORDER BY operation_count DESC;

-- Grant access to stats view
GRANT SELECT ON token_operations_stats TO authenticated;
GRANT SELECT ON token_operations_stats TO service_role;
