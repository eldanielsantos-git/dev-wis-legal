# Sistema de Tokens - Documentação Completa

Sistema completo de gerenciamento de tokens, incluindo reserva, consumo, notificações e auditoria.

## Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────┐
│                  TOKEN BALANCE                          │
│  - available_tokens (disponível para uso)              │
│  - reserved_tokens (reservado para análises ativas)    │
│  - lifetime_tokens (total acumulado histórico)         │
└────────────────┬────────────────────────────────────────┘
                 │
      ┌──────────┼──────────┐
      │          │          │
      ▼          ▼          ▼
┌──────────┐ ┌──────────┐ ┌───────────────┐
│  TOKEN   │ │  TOKEN   │ │     TOKEN     │
│TRANSACT  │ │RESERVAT  │ │ NOTIFICATIONS │
│  IONS    │ │  IONS    │ │               │
└──────────┘ └──────────┘ └───────────────┘
```

---

## Tabelas do Sistema

### token_balance

```sql
CREATE TABLE token_balance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users UNIQUE NOT NULL,
  available_tokens bigint DEFAULT 0,
  reserved_tokens bigint DEFAULT 0,
  lifetime_tokens bigint DEFAULT 0,
  last_reset_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Campos:**
- `available_tokens`: Tokens disponíveis para uso imediato
- `reserved_tokens`: Tokens reservados para análises em andamento
- `lifetime_tokens`: Total de tokens acumulados (histórico)
- `last_reset_at`: Data da última renovação mensal

**Cálculo de Usable Tokens:**
```sql
usable_tokens = available_tokens - reserved_tokens
```

---

### token_transactions

```sql
CREATE TABLE token_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  amount bigint NOT NULL, -- Positivo para crédito, negativo para débito
  type text NOT NULL, -- 'purchase', 'monthly', 'usage', 'refund', 'bonus'
  description text,
  processo_id uuid REFERENCES processos,
  stripe_payment_id text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_token_transactions_user_id ON token_transactions(user_id);
CREATE INDEX idx_token_transactions_type ON token_transactions(type);
CREATE INDEX idx_token_transactions_created_at ON token_transactions(created_at);
```

**Tipos de Transação:**
- `purchase`: Compra avulsa de tokens
- `monthly`: Renovação mensal da assinatura
- `usage`: Consumo em análise ou chat
- `refund`: Devolução de tokens (análise cancelada)
- `bonus`: Bônus (referral, promoção)

---

### token_reservations

```sql
CREATE TABLE token_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  processo_id uuid REFERENCES processos NOT NULL,
  reserved_amount bigint NOT NULL,
  actual_used bigint DEFAULT 0,
  status text DEFAULT 'active', -- 'active', 'completed', 'refunded', 'cancelled'
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX idx_token_reservations_user_id ON token_reservations(user_id);
CREATE INDEX idx_token_reservations_processo_id ON token_reservations(processo_id);
CREATE INDEX idx_token_reservations_status ON token_reservations(status);
```

**Estados:**
- `active`: Reserva ativa (análise em andamento)
- `completed`: Reserva finalizada, tokens debitados
- `refunded`: Reserva cancelada, tokens devolvidos
- `cancelled`: Análise cancelada antes de iniciar

---

### token_limit_notifications

```sql
CREATE TABLE token_limit_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  notification_type text NOT NULL, -- '75_percent', '100_percent'
  notified_at timestamptz DEFAULT now(),
  UNIQUE(user_id, notification_type, DATE(notified_at)) -- Uma por dia
);
```

---

## Fluxos Principais

### 1. Adição de Tokens

#### 1.1. Renovação Mensal (Assinatura)

```typescript
// Triggered: Dia 1 de cada mês (ou aniversário da assinatura)
async function renewMonthlyTokens(userId: string) {
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('tier, monthly_tokens')
    .eq('user_id', userId)
    .single();

  if (!subscription || subscription.tier === 'free') {
    return; // Free tier não tem renovação automática
  }

  const monthlyTokens = subscription.monthly_tokens; // Ex: 50000 (Pro)

  // 1. Calcular rollover (30% max)
  const { data: balance } = await supabase
    .from('token_balance')
    .select('available_tokens')
    .eq('user_id', userId)
    .single();

  const rollover = Math.min(
    balance.available_tokens,
    monthlyTokens * 0.3 // 30% do plano
  );

  // 2. Adicionar tokens
  const totalToAdd = monthlyTokens + rollover;

  await supabase
    .from('token_balance')
    .update({
      available_tokens: totalToAdd,
      lifetime_tokens: balance.lifetime_tokens + monthlyTokens,
      last_reset_at: new Date().toISOString()
    })
    .eq('user_id', userId);

  // 3. Criar transação
  await supabase
    .from('token_transactions')
    .insert({
      user_id: userId,
      amount: monthlyTokens,
      type: 'monthly',
      description: `Renovação mensal - ${subscription.tier}`
    });

  // 4. Notificar usuário
  await sendMonthlyRenewalEmail(userId, totalToAdd);
}
```

#### 1.2. Compra Avulsa

```typescript
// Triggered: Após pagamento Stripe bem-sucedido
async function addPurchasedTokens(
  userId: string,
  tokens: number,
  stripePaymentId: string
) {
  // 1. Adicionar ao balance
  await supabase.rpc('add_tokens', {
    p_user_id: userId,
    p_amount: tokens
  });

  // 2. Criar transação
  await supabase
    .from('token_transactions')
    .insert({
      user_id: userId,
      amount: tokens,
      type: 'purchase',
      description: `Compra de ${tokens.toLocaleString()} tokens`,
      stripe_payment_id: stripePaymentId
    });

  // 3. Notificar usuário
  await sendTokenPurchaseEmail(userId, tokens);
}
```

#### 1.3. Bônus (Referral)

```typescript
async function addReferralBonus(userId: string, referrerId: string) {
  const REFERRAL_BONUS = 5000;

  // Bônus para novo usuário
  await addTokens(userId, REFERRAL_BONUS, 'bonus', 'Bônus de boas-vindas');

  // Bônus para quem indicou
  await addTokens(referrerId, REFERRAL_BONUS, 'bonus', 'Bônus por indicação');
}
```

---

### 2. Reserva de Tokens

```typescript
// TokenReservationService.ts
export class TokenReservationService {
  static async reserveTokens(
    userId: string,
    processoId: string,
    estimatedTokens: number
  ) {
    // 1. Verificar saldo disponível
    const { data: balance } = await supabase
      .from('token_balance')
      .select('available_tokens, reserved_tokens')
      .eq('user_id', userId)
      .single();

    const usableTokens = balance.available_tokens - balance.reserved_tokens;

    if (usableTokens < estimatedTokens) {
      throw new Error('Tokens insuficientes');
    }

    // 2. Criar reserva
    const { data: reservation } = await supabase
      .from('token_reservations')
      .insert({
        user_id: userId,
        processo_id: processoId,
        reserved_amount: estimatedTokens,
        status: 'active'
      })
      .select()
      .single();

    // 3. Atualizar balance (incrementa reserved_tokens)
    await supabase
      .from('token_balance')
      .update({
        reserved_tokens: balance.reserved_tokens + estimatedTokens
      })
      .eq('user_id', userId);

    return reservation;
  }
}
```

---

### 3. Consumo de Tokens

```typescript
async function consumeTokens(
  reservationId: string,
  actualTokensUsed: number
) {
  // 1. Get reservation
  const { data: reservation } = await supabase
    .from('token_reservations')
    .select('*')
    .eq('id', reservationId)
    .single();

  // 2. Calcular diferença
  const difference = reservation.reserved_amount - actualTokensUsed;

  // 3. Atualizar balance
  await supabase
    .from('token_balance')
    .update({
      available_tokens: balance.available_tokens - actualTokensUsed,
      reserved_tokens: balance.reserved_tokens - reservation.reserved_amount
    })
    .eq('user_id', reservation.user_id);

  // 4. Marcar reserva como completed
  await supabase
    .from('token_reservations')
    .update({
      status: 'completed',
      actual_used: actualTokensUsed,
      completed_at: new Date().toISOString()
    })
    .eq('id', reservationId);

  // 5. Criar transação de uso
  await supabase
    .from('token_transactions')
    .insert({
      user_id: reservation.user_id,
      amount: -actualTokensUsed,
      type: 'usage',
      description: `Análise de processo`,
      processo_id: reservation.processo_id
    });

  // 6. Se sobrou, criar transação de refund
  if (difference > 0) {
    await supabase
      .from('token_transactions')
      .insert({
        user_id: reservation.user_id,
        amount: difference,
        type: 'refund',
        description: `Devolução - uso menor que estimado`,
        processo_id: reservation.processo_id
      });
  }
}
```

---

### 4. Sistema de Notificações

#### 4.1. Monitoramento Automático

```sql
-- Trigger que verifica limite após cada transação
CREATE OR REPLACE FUNCTION check_token_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_percentage numeric;
  v_last_notification_75 timestamptz;
  v_last_notification_100 timestamptz;
BEGIN
  -- Calcular percentual disponível
  v_percentage := (NEW.available_tokens::numeric /
                  (SELECT monthly_tokens FROM subscriptions WHERE user_id = NEW.user_id)) * 100;

  -- Verificar última notificação 75%
  SELECT MAX(notified_at) INTO v_last_notification_75
  FROM token_limit_notifications
  WHERE user_id = NEW.user_id
  AND notification_type = '75_percent'
  AND DATE(notified_at) = CURRENT_DATE;

  -- Verificar última notificação 100%
  SELECT MAX(notified_at) INTO v_last_notification_100
  FROM token_limit_notifications
  WHERE user_id = NEW.user_id
  AND notification_type = '100_percent'
  AND DATE(notified_at) = CURRENT_DATE;

  -- Se atingiu 75% e não foi notificado hoje
  IF v_percentage <= 25 AND v_last_notification_75 IS NULL THEN
    -- Inserir notificação
    INSERT INTO token_limit_notifications (user_id, notification_type)
    VALUES (NEW.user_id, '75_percent');

    -- Trigger email (via Edge Function)
    PERFORM net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/send-tokens-limit',
      body := jsonb_build_object(
        'userId', NEW.user_id,
        'percentage', 75
      )
    );
  END IF;

  -- Se atingiu 100% (< 100 tokens) e não foi notificado hoje
  IF NEW.available_tokens < 100 AND v_last_notification_100 IS NULL THEN
    INSERT INTO token_limit_notifications (user_id, notification_type)
    VALUES (NEW.user_id, '100_percent');

    PERFORM net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/send-tokens-limit',
      body := jsonb_build_object(
        'userId', NEW.user_id,
        'percentage', 100
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_token_limit
  AFTER UPDATE OF available_tokens ON token_balance
  FOR EACH ROW
  EXECUTE FUNCTION check_token_limit();
```

#### 4.2. Edge Function de Email

```typescript
// supabase/functions/send-tokens-limit/index.ts
serve(async (req: Request) => {
  const { userId, percentage } = await req.json();

  const { data: user } = await supabase
    .from('users')
    .select('email, name')
    .eq('id', userId)
    .single();

  const { data: balance } = await supabase
    .from('token_balance')
    .select('available_tokens')
    .eq('user_id', userId)
    .single();

  let subject, message;

  if (percentage === 75) {
    subject = '⚠️ Você usou 75% dos seus tokens';
    message = `
      Olá ${user.name},

      Você já utilizou 75% dos seus tokens mensais.
      Tokens restantes: ${balance.available_tokens.toLocaleString()}

      [Comprar Mais Tokens] [Fazer Upgrade]
    `;
  } else {
    subject = '🚨 Seus tokens acabaram!';
    message = `
      Olá ${user.name},

      Seus tokens acabaram! (restam ${balance.available_tokens})

      Para continuar analisando processos, você pode:
      - Comprar tokens avulsos
      - Fazer upgrade do seu plano

      [Comprar Agora]
    `;
  }

  // Send via Resend
  await resend.emails.send({
    from: 'Wis Legal <noreply@wislegal.com>',
    to: user.email,
    subject,
    html: message
  });

  return new Response(JSON.stringify({ sent: true }));
});
```

---

## Limites por Tier

```typescript
export const TIER_LIMITS = {
  free: {
    monthly_tokens: 10_000,
    max_rollover: 3_000, // 30%
    max_processo_size: 100, // páginas
    analysis_types: ['simple']
  },
  pro: {
    monthly_tokens: 50_000,
    max_rollover: 15_000, // 30%
    max_processo_size: 1_000,
    analysis_types: ['simple', 'complex']
  },
  premium: {
    monthly_tokens: 150_000,
    max_rollover: 45_000,
    max_processo_size: 3_000,
    analysis_types: ['simple', 'complex', 'forensic']
  },
  enterprise: {
    monthly_tokens: 200_000,
    max_rollover: 60_000,
    max_processo_size: 5_000,
    analysis_types: ['simple', 'complex', 'forensic', 'custom']
  }
};
```

---

## Validação de Tokens

```typescript
// TokenValidationService.ts
export class TokenValidationService {
  static async validateSufficient(
    userId: string,
    requiredTokens: number
  ): Promise<boolean> {
    const { data } = await supabase
      .from('token_balance')
      .select('available_tokens, reserved_tokens')
      .eq('user_id', userId)
      .single();

    const usable = data.available_tokens - data.reserved_tokens;
    return usable >= requiredTokens;
  }

  static async validateTierLimit(
    userId: string,
    processoSize: number
  ): Promise<boolean> {
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('tier')
      .eq('user_id', userId)
      .single();

    const limits = TIER_LIMITS[subscription.tier];
    return processoSize <= limits.max_processo_size;
  }

  static async getAvailableTokens(userId: string): Promise<number> {
    const { data } = await supabase
      .from('token_balance')
      .select('available_tokens, reserved_tokens')
      .eq('user_id', userId)
      .single();

    return data.available_tokens - data.reserved_tokens;
  }
}
```

---

## Auditoria e Tracking

### TokenTrackingHelper.ts

```typescript
export class TokenTrackingHelper {
  static async logUsage(
    userId: string,
    processoId: string,
    tokensUsed: number,
    context: {
      analysisType?: string;
      chunkId?: string;
      chatMessageId?: string;
    }
  ) {
    await supabase
      .from('token_usage_log')
      .insert({
        user_id: userId,
        processo_id: processoId,
        tokens_used: tokensUsed,
        context: context,
        timestamp: new Date().toISOString()
      });
  }

  static async getUsageStats(userId: string, period: 'day' | 'week' | 'month') {
    const startDate = getStartDate(period);

    const { data } = await supabase
      .from('token_transactions')
      .select('amount, type, created_at')
      .eq('user_id', userId)
      .gte('created_at', startDate);

    return {
      total_used: data.filter(t => t.type === 'usage').reduce((sum, t) => sum + Math.abs(t.amount), 0),
      total_added: data.filter(t => ['purchase', 'monthly', 'bonus'].includes(t.type)).reduce((sum, t) => sum + t.amount, 0),
      by_day: groupByDay(data)
    };
  }
}
```

---

## Frontend Integration

### TokenBalanceContext.tsx

```typescript
export const TokenBalanceContext = createContext<TokenBalanceContextType | undefined>(undefined);

export function TokenBalanceProvider({ children }: { children: ReactNode }) {
  const [balance, setBalance] = useState<TokenBalance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBalance();

    // Subscribe to changes
    const subscription = supabase
      .channel('token_balance_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'token_balance',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          setBalance(payload.new);
        }
      )
      .subscribe();

    return () => subscription.unsubscribe();
  }, []);

  async function loadBalance() {
    const { data } = await supabase
      .from('token_balance')
      .select('*')
      .eq('user_id', user.id)
      .single();

    setBalance(data);
    setLoading(false);
  }

  const usableTokens = balance
    ? balance.available_tokens - balance.reserved_tokens
    : 0;

  return (
    <TokenBalanceContext.Provider value={{ balance, usableTokens, loading, refresh: loadBalance }}>
      {children}
    </TokenBalanceContext.Provider>
  );
}
```

---

## Métricas e KPIs

```sql
-- Tokens consumidos por dia (últimos 30 dias)
SELECT
  DATE(created_at) as date,
  SUM(ABS(amount)) as tokens_used
FROM token_transactions
WHERE type = 'usage'
AND created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date;

-- Usuários que atingiram 75% de consumo
SELECT
  u.email,
  tb.available_tokens,
  s.monthly_tokens,
  ROUND(100.0 * tb.available_tokens / s.monthly_tokens, 2) as percentage_remaining
FROM token_balance tb
JOIN auth.users u ON u.id = tb.user_id
JOIN subscriptions s ON s.user_id = tb.user_id
WHERE tb.available_tokens < (s.monthly_tokens * 0.25);

-- Taxa de conversão (free -> paid) por tokens
SELECT
  COUNT(DISTINCT user_id) FILTER (WHERE type = 'purchase') as purchased,
  COUNT(DISTINCT user_id) as total_users,
  ROUND(100.0 * COUNT(DISTINCT user_id) FILTER (WHERE type = 'purchase') /
        COUNT(DISTINCT user_id), 2) as conversion_rate
FROM token_transactions;
```

---

[← Voltar às Features](./README.md) | [Ver Stripe →](./stripe-integration-complete.md)
