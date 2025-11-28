# 15 - Sistema de Tokens e Monetização

## 📋 Visão Geral

O WisLegal utiliza um sistema de **tokens** como unidade de consumo para operações de IA. Este sistema integra-se completamente com Stripe para monetização via assinaturas.

## 💰 Modelo de Negócio

### Planos de Assinatura

| Plano | Preço/mês | Tokens Mensais | Processos | Target |
|-------|-----------|----------------|-----------|--------|
| **Básico** | R$ 99 | 10.000 | ~10-15 | Advogados autônomos |
| **Profissional** | R$ 299 | 50.000 | ~50-75 | Escritórios pequenos |
| **Enterprise** | Customizado | Ilimitado | Ilimitado | Grandes escritórios |

### Custo por Operação

| Operação | Tokens Médios | Variação |
|----------|---------------|----------|
| **Análise Completa** (1-50 pág) | 15.000 | 12k-20k |
| **Análise Completa** (51-200 pág) | 25.000 | 20k-35k |
| **Análise Completa** (201-500 pág) | 50.000 | 40k-70k |
| **Mensagem Chat** | 500-2.000 | Varia |
| **Áudio Chat** (1 min) | 1.000-3.000 | Varia |

## 🏗️ Arquitetura do Sistema

### Tabelas Principais

#### 1. stripe_subscriptions

```sql
CREATE TABLE stripe_subscriptions (
  subscription_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  status TEXT NOT NULL,
  tokens_base INTEGER NOT NULL DEFAULT 0,
  tokens_extra INTEGER DEFAULT 0,
  tokens_total INTEGER GENERATED ALWAYS AS
    (tokens_base + tokens_extra) STORED,
  tokens_used INTEGER DEFAULT 0,
  current_period_end BIGINT
);
```

**Campos:**
- `tokens_base`: Tokens do plano mensal
- `tokens_extra`: Tokens comprados adicionalmente
- `tokens_total`: Soma automática (computed column)
- `tokens_used`: Tokens consumidos no período
- `current_period_end`: Timestamp de renovação

#### 2. token_usage_logs

```sql
CREATE TABLE token_usage_logs (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  processo_id UUID,
  operation_type TEXT NOT NULL,
  tokens_used INTEGER NOT NULL,
  model_name TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Tipos de Operação:**
- `analysis` - Análise forense completa
- `chat` - Mensagem de chat
- `audio` - Transcrição de áudio

#### 3. token_credits_audit

```sql
CREATE TABLE token_credits_audit (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  amount INTEGER NOT NULL,
  operation TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

Registra:
- Adições de tokens (purchase, bonus)
- Débitos de tokens (analysis, chat)
- Ajustes manuais (admin)

## 🔄 Fluxo de Consumo

### 1. Verificação Prévia

Antes de iniciar qualquer operação:

```typescript
const tokensNeeded = estimateTokens(pageCount);

const hasTokens = await tokenService.checkTokenAvailability(
  user.id,
  tokensNeeded
);

if (!hasTokens) {
  showUpgradeModal();
  return;
}

// Prosseguir com operação
```

### 2. Débito de Tokens

Após operação concluída:

```typescript
// No Edge Function process-next-prompt
const tokensUsed = result.usage.total_tokens;

// Atualiza subscription
await supabase
  .from('stripe_subscriptions')
  .update({
    tokens_used: supabase.raw(`tokens_used + ${tokensUsed}`)
  })
  .eq('customer_id', customerId);

// Log de auditoria
await supabase
  .from('token_usage_logs')
  .insert({
    user_id: userId,
    processo_id: processoId,
    operation_type: 'analysis',
    tokens_used: tokensUsed,
    model_name: 'gemini-2.0-flash-exp'
  });
```

### 3. Trigger Automático

```sql
CREATE OR REPLACE FUNCTION debit_tokens_on_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_tokens_used INTEGER;
BEGIN
  IF OLD.status != 'completed' AND NEW.status = 'completed' THEN
    -- Soma tokens de todas as análises
    SELECT COALESCE(SUM(tokens_used), 0)
    INTO v_tokens_used
    FROM analysis_results
    WHERE processo_id = NEW.id;

    -- Debita da subscription
    UPDATE stripe_subscriptions
    SET tokens_used = tokens_used + v_tokens_used
    WHERE customer_id = (
      SELECT customer_id FROM stripe_customers
      WHERE user_id = NEW.user_id
    );

    -- Log
    INSERT INTO token_usage_logs (
      user_id, processo_id, operation_type, tokens_used
    ) VALUES (
      NEW.user_id, NEW.id, 'analysis', v_tokens_used
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER debit_tokens_trigger
  AFTER UPDATE ON processos
  FOR EACH ROW
  EXECUTE FUNCTION debit_tokens_on_completion();
```

## 💳 Integração com Stripe

### Checkout Flow

```typescript
// Frontend: Usuário clica em plano
const response = await fetch(
  `${supabaseUrl}/functions/v1/stripe-checkout`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      price_id: 'price_xxx', // ID do plano
      quantity: 1
    })
  }
);

const { session_url } = await response.json();

// Redireciona para Stripe Checkout
window.location.href = session_url;
```

### Webhook Processing

```typescript
// Edge Function: stripe-webhook

// Event: checkout.session.completed
if (event.type === 'checkout.session.completed') {
  const session = event.data.object;

  // Criar ou atualizar subscription
  await supabase
    .from('stripe_subscriptions')
    .upsert({
      subscription_id: session.subscription,
      customer_id: session.customer,
      status: 'active',
      tokens_base: getTokensForPlan(session.metadata.price_id),
      tokens_used: 0,
      current_period_end: session.current_period_end
    });

  // Notificar usuário
  await supabase
    .from('notifications')
    .insert({
      user_id: session.metadata.user_id,
      type: 'success',
      message: 'Assinatura ativada com sucesso!'
    });
}

// Event: customer.subscription.updated
if (event.type === 'customer.subscription.updated') {
  const subscription = event.data.object;

  await supabase
    .from('stripe_subscriptions')
    .update({
      status: subscription.status,
      current_period_end: subscription.current_period_end
    })
    .eq('subscription_id', subscription.id);
}

// Event: customer.subscription.deleted
if (event.type === 'customer.subscription.deleted') {
  await supabase
    .from('stripe_subscriptions')
    .update({
      status: 'canceled',
      deleted_at: NOW()
    })
    .eq('subscription_id', event.data.object.id);
}
```

### Renovação Mensal

Stripe gerencia automaticamente:
1. Cobra cartão no dia da renovação
2. Webhook `invoice.payment_succeeded`
3. Sistema reseta `tokens_used` para 0
4. `tokens_total` mantém valor do plano

```typescript
// Webhook: invoice.payment_succeeded
if (event.type === 'invoice.payment_succeeded') {
  const invoice = event.data.object;

  if (invoice.billing_reason === 'subscription_cycle') {
    // Renovação mensal - reset tokens
    await supabase
      .from('stripe_subscriptions')
      .update({
        tokens_used: 0,
        current_period_end: invoice.period_end
      })
      .eq('subscription_id', invoice.subscription);
  }
}
```

## 🛒 Tokens Extras (Add-ons)

### Compra de Tokens Avulsos

```typescript
// Pacotes disponíveis
const tokenPackages = [
  { id: 'pack_5k', tokens: 5000, price: 49 },
  { id: 'pack_20k', tokens: 20000, price: 159 },
  { id: 'pack_50k', tokens: 50000, price: 349 }
];

// Checkout de tokens extras
const response = await fetch(
  `${supabaseUrl}/functions/v1/stripe-checkout`,
  {
    method: 'POST',
    body: JSON.stringify({
      price_id: 'price_token_pack_5k',
      quantity: 1,
      mode: 'payment' // One-time payment
    })
  }
);
```

### Adicionar Tokens Extras

```sql
-- Após pagamento confirmado (webhook)
UPDATE stripe_subscriptions
SET tokens_extra = tokens_extra + 5000
WHERE customer_id = $customer_id;

-- tokens_total atualiza automaticamente (computed column)
```

## 📊 Dashboard de Tokens

### Exibição para Usuário

```typescript
interface TokenUsage {
  total: number;          // tokens_total
  used: number;           // tokens_used
  remaining: number;      // total - used
  percentage: number;     // (used / total) * 100
  resetDate: Date;        // current_period_end
}

const usage = await tokenService.getUserTokenUsageSummary(user.id);

// UI Component
<TokenUsageCard>
  <CircularProgress value={usage.percentage} />
  <p>{usage.used.toLocaleString()} / {usage.total.toLocaleString()}</p>
  <p>Renova em: {formatDate(usage.resetDate)}</p>

  {usage.percentage > 80 && (
    <Button onClick={handleBuyTokens}>
      Comprar Tokens Extras
    </Button>
  )}
</TokenUsageCard>
```

### Cores por Threshold

```typescript
const getUsageColor = (percentage: number) => {
  if (percentage < 75) return 'green';
  if (percentage < 90) return 'yellow';
  return 'red';
};
```

## 📈 Analytics para Admins

### Métricas de Uso

```sql
-- Usuários mais consumidores
SELECT
  u.email,
  SUM(t.tokens_used) as total_tokens
FROM token_usage_logs t
JOIN user_profiles u ON u.id = t.user_id
WHERE t.created_at >= NOW() - INTERVAL '30 days'
GROUP BY u.id, u.email
ORDER BY total_tokens DESC
LIMIT 20;

-- Média de tokens por operação
SELECT
  operation_type,
  AVG(tokens_used) as avg_tokens,
  COUNT(*) as operations
FROM token_usage_logs
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY operation_type;

-- Revenue por plano
SELECT
  p.name as plan,
  COUNT(s.subscription_id) as subscribers,
  SUM(p.price) as monthly_revenue
FROM stripe_subscriptions s
JOIN stripe_prices p ON p.id = s.price_id
WHERE s.status = 'active'
GROUP BY p.name, p.price;
```

### Dashboard Admin

```typescript
const analytics = await BillingAnalyticsService.getBillingAnalytics();

/*
{
  total_users: 150,
  active_subscriptions: 80,
  total_mrr: 24000,
  avg_tokens_per_user: 25000,
  token_consumption_rate: 0.75, // 75% médio de uso
  top_consumers: [...],
  revenue_by_plan: [...]
}
*/
```

## 🔒 Validações e Limites

### Validação Pré-Operação

```typescript
async function validateTokens(
  userId: string,
  tokensNeeded: number
): Promise<{ valid: boolean; message?: string }> {
  const summary = await tokenService.getUserTokenUsageSummary(userId);

  if (summary.remaining < tokensNeeded) {
    return {
      valid: false,
      message: `Tokens insuficientes. Necessário: ${tokensNeeded}, Disponível: ${summary.remaining}`
    };
  }

  return { valid: true };
}
```

### Prevenção de Overdraft

```sql
-- Constraint no banco
ALTER TABLE stripe_subscriptions
ADD CONSTRAINT tokens_used_not_negative
CHECK (tokens_used >= 0);

ALTER TABLE stripe_subscriptions
ADD CONSTRAINT tokens_used_not_exceed_total
CHECK (tokens_used <= tokens_total);
```

### Rate Limiting

```typescript
// Limitar operações por minuto
const RATE_LIMIT = 10; // operações/minuto

const recentOps = await supabase
  .from('token_usage_logs')
  .select('id')
  .eq('user_id', userId)
  .gte('created_at', new Date(Date.now() - 60000).toISOString());

if (recentOps.data.length >= RATE_LIMIT) {
  throw new Error('Rate limit excedido. Aguarde 1 minuto.');
}
```

## 🎁 Bônus e Promoções

### Cupons de Desconto

```typescript
// Criar cupom no Stripe
const coupon = await stripe.coupons.create({
  percent_off: 20,
  duration: 'once',
  name: 'WELCOME20'
});

// Aplicar no checkout
const session = await stripe.checkout.sessions.create({
  ...checkoutParams,
  discounts: [{
    coupon: 'WELCOME20'
  }]
});
```

### Tokens de Bônus

```sql
-- Admin concede tokens bônus
INSERT INTO token_credits_audit (
  user_id,
  amount,
  operation,
  description
) VALUES (
  $user_id,
  5000,
  'bonus',
  'Bônus de boas-vindas'
);

UPDATE stripe_subscriptions
SET tokens_extra = tokens_extra + 5000
WHERE customer_id = (
  SELECT customer_id FROM stripe_customers
  WHERE user_id = $user_id
);
```

## 🔗 Próximos Documentos

- **[16-SISTEMA-NOTIFICACOES.md](./16-SISTEMA-NOTIFICACOES.md)** - Notificações
- **[18-PAINEL-ADMIN.md](./18-PAINEL-ADMIN.md)** - Painel admin

---

**Sistema de tokens flexível e escalável**
