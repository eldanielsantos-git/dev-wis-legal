/*
  # Proteção Crítica Contra Perda de Tokens e Restauração de Tokens Perdidos
  
  ## Problema Identificado
  Bug crítico nas edge functions de sincronização que causou perda de tokens extras pagos.
  Usuário Daniel (cus_TCUkMn9DfvpxgC) perdeu 56.566.056.000 tokens extras.
  
  ## Mudanças Implementadas
  
  ### 1. Função de Validação
  - `validate_extra_tokens_change()` - Impede redução não autorizada de extra_tokens
  - Registra tentativas de redução suspeitas
  - Permite apenas operações explícitas de débito
  
  ### 2. Trigger de Proteção
  - `prevent_extra_tokens_loss` - Valida toda mudança em extra_tokens
  - Bloqueia reduções não autorizadas ANTES de aplicar UPDATE
  
  ### 3. Auditoria Automática
  - Registra todas as mudanças de tokens em token_credits_audit
  - Inclui valores before/after e metadados completos
  
  ### 4. Restauração de Tokens
  - Restaura 56.566.056.000 tokens extras para o usuário Daniel
  - Registra a compensação na tabela de auditoria
  
  ## Segurança
  - Extra tokens NUNCA podem diminuir exceto por operações de consumo explícitas
  - Todas as mudanças são auditadas automaticamente
  - Sistema de bypass apenas para operações administrativas autorizadas
*/

-- 1. Criar função de validação que protege contra perda de extra_tokens
CREATE OR REPLACE FUNCTION validate_extra_tokens_change()
RETURNS TRIGGER AS $$
DECLARE
  v_old_extra_tokens BIGINT;
  v_new_extra_tokens BIGINT;
  v_difference BIGINT;
  v_operation TEXT;
BEGIN
  -- Capturar valores
  v_old_extra_tokens := COALESCE(OLD.extra_tokens, 0);
  v_new_extra_tokens := COALESCE(NEW.extra_tokens, 0);
  v_difference := v_new_extra_tokens - v_old_extra_tokens;
  
  -- Se extra_tokens está diminuindo
  IF v_new_extra_tokens < v_old_extra_tokens THEN
    -- Verificar se há justificativa explícita nos metadados da operação
    -- Permitir apenas se vier de operações de consumo explícito
    v_operation := current_setting('app.token_operation', true);
    
    IF v_operation IS NULL OR v_operation NOT IN ('token_consumption', 'admin_adjustment', 'refund') THEN
      -- BLOQUEAR a operação
      RAISE WARNING 'BLOCKED: Attempt to decrease extra_tokens from % to % (difference: %) without authorization. Operation: %',
        v_old_extra_tokens, v_new_extra_tokens, v_difference, COALESCE(v_operation, 'unknown');
      
      -- Registrar tentativa bloqueada na auditoria
      INSERT INTO token_credits_audit (
        event_id,
        event_type,
        customer_id,
        operation,
        status,
        before_extra_tokens,
        after_extra_tokens,
        tokens_amount,
        metadata
      ) VALUES (
        'blocked_' || gen_random_uuid()::text,
        'blocked_token_reduction',
        NEW.customer_id,
        COALESCE(v_operation, 'unknown'),
        'blocked',
        v_old_extra_tokens,
        v_new_extra_tokens,
        v_difference,
        jsonb_build_object(
          'reason', 'Unauthorized attempt to reduce extra_tokens',
          'blocked_at', NOW(),
          'old_value', v_old_extra_tokens,
          'attempted_value', v_new_extra_tokens
        )
      );
      
      -- PRESERVAR o valor original
      NEW.extra_tokens := OLD.extra_tokens;
      
      RETURN NEW;
    END IF;
  END IF;
  
  -- Se chegou aqui, a operação é válida
  -- Registrar a mudança na auditoria se houver diferença significativa
  IF ABS(v_difference) > 0 THEN
    INSERT INTO token_credits_audit (
      event_id,
      event_type,
      customer_id,
      operation,
      status,
      before_extra_tokens,
      after_extra_tokens,
      tokens_amount,
      metadata
    ) VALUES (
      'auto_audit_' || gen_random_uuid()::text,
      CASE 
        WHEN v_difference > 0 THEN 'tokens_added'
        ELSE 'tokens_consumed'
      END,
      NEW.customer_id,
      COALESCE(v_operation, 'automatic_tracking'),
      'success',
      v_old_extra_tokens,
      v_new_extra_tokens,
      v_difference,
      jsonb_build_object(
        'auto_tracked', true,
        'tracked_at', NOW(),
        'operation', COALESCE(v_operation, 'automatic_tracking')
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Criar trigger para proteger extra_tokens
DROP TRIGGER IF EXISTS prevent_extra_tokens_loss ON stripe_subscriptions;
CREATE TRIGGER prevent_extra_tokens_loss
  BEFORE UPDATE ON stripe_subscriptions
  FOR EACH ROW
  WHEN (OLD.extra_tokens IS DISTINCT FROM NEW.extra_tokens)
  EXECUTE FUNCTION validate_extra_tokens_change();

-- 3. Restaurar os tokens perdidos do usuário Daniel
DO $$
DECLARE
  v_customer_id TEXT := 'cus_TCUkMn9DfvpxgC';
  v_tokens_to_restore BIGINT := 56566056000;
  v_current_extra_tokens BIGINT;
  v_new_extra_tokens BIGINT;
  v_user_id UUID;
  v_user_email TEXT;
BEGIN
  -- Buscar dados atuais
  SELECT extra_tokens INTO v_current_extra_tokens
  FROM stripe_subscriptions
  WHERE customer_id = v_customer_id;
  
  IF v_current_extra_tokens IS NULL THEN
    RAISE EXCEPTION 'Customer % not found', v_customer_id;
  END IF;
  
  v_new_extra_tokens := v_current_extra_tokens + v_tokens_to_restore;
  
  -- Buscar user_id e email
  SELECT sc.user_id, up.email 
  INTO v_user_id, v_user_email
  FROM stripe_customers sc
  LEFT JOIN user_profiles up ON sc.user_id = up.id
  WHERE sc.customer_id = v_customer_id;
  
  -- Definir contexto para bypass do trigger (operação autorizada)
  PERFORM set_config('app.token_operation', 'admin_adjustment', false);
  
  -- Restaurar os tokens
  UPDATE stripe_subscriptions
  SET 
    extra_tokens = v_new_extra_tokens,
    updated_at = NOW()
  WHERE customer_id = v_customer_id;
  
  -- Limpar contexto
  PERFORM set_config('app.token_operation', '', false);
  
  -- Registrar a compensação na auditoria
  INSERT INTO token_credits_audit (
    event_id,
    event_type,
    customer_id,
    operation,
    status,
    before_extra_tokens,
    after_extra_tokens,
    tokens_amount,
    metadata
  ) VALUES (
    'compensation_daniel_' || NOW()::text,
    'compensation',
    v_customer_id,
    'restore_lost_tokens_bug_fix',
    'success',
    v_current_extra_tokens,
    v_new_extra_tokens,
    v_tokens_to_restore,
    jsonb_build_object(
      'reason', 'Bug in sync-stripe-subscription caused token loss',
      'bug_description', 'last_token_reset_at was being set incorrectly causing token loss',
      'date_range', '2025-12-18 to 2025-12-20',
      'approved_by', 'admin',
      'ticket_reference', 'Critical bug fix - unauthorized token reduction',
      'user_email', v_user_email,
      'user_id', v_user_id
    )
  );
  
  RAISE NOTICE 'Successfully restored % tokens to customer % (%)', 
    v_tokens_to_restore, v_customer_id, v_user_email;
  
END $$;

-- 4. Criar índice para melhor performance nas queries de auditoria
CREATE INDEX IF NOT EXISTS idx_token_credits_audit_customer_operation 
ON token_credits_audit(customer_id, operation, created_at DESC);

-- 5. Adicionar comentários para documentação
COMMENT ON FUNCTION validate_extra_tokens_change() IS 
'Protege contra perda não autorizada de extra_tokens. Bloqueia reduções exceto quando explicitamente autorizado via app.token_operation.';

COMMENT ON TRIGGER prevent_extra_tokens_loss ON stripe_subscriptions IS
'Trigger que valida mudanças em extra_tokens antes de aplicar UPDATE. Previne perda acidental de tokens pagos.';
