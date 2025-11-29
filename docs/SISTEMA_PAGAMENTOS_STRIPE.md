# Sistema de Pagamentos Stripe - Documentação Completa

## Índice
1. [Visão Geral](#visão-geral)
2. [Planos de Assinatura](#planos-de-assinatura)
3. [Pacotes de Tokens Extras](#pacotes-de-tokens-extras)
4. [Fluxo de Compra](#fluxo-de-compra)
5. [Sistema de Tokens](#sistema-de-tokens)
6. [Tabelas do Banco de Dados](#tabelas-do-banco-de-dados)
7. [Edge Functions](#edge-functions)
8. [Páginas e Componentes](#páginas-e-componentes)
9. [Administração](#administração)
10. [Auditoria de Tokens](#auditoria-de-tokens)
11. [RLS Policies](#rls-policies)

---

## Visão Geral

O sistema de pagamentos integra Stripe para gerenciar assinaturas mensais recorrentes e compras únicas de pacotes de tokens. O sistema possui 4 planos de assinatura e 2 pacotes de tokens extras disponíveis.

### Características Principais
- **Assinaturas Recorrentes**: Planos mensais com renovação automática
- **Tokens Acumuláveis**: Tokens não expiram durante período de vigência da assinatura
- **Ordem de Consumo**: Prioriza tokens do plano antes dos extras
- **Upgrade/Downgrade**: Permite mudança de plano mantendo tokens acumulados
- **Auditoria Completa**: Rastreamento detalhado de todas operações com tokens

---

## Planos de Assinatura

### 1. Plano Essencial
- **Nome**: Essencial
- **Preço**: R$ 59,00/mês
- **Tokens**: 1.200.000 (1,2M)
- **Capacidade**: ~220 páginas/mês
- **Stripe Price ID**: `price_1SG3zEJrr43cGTt4oUj89h9u`
- **Stripe Product ID**: `prod_TCSvtM9pDVEFS9`
- **Display Order**: 1

### 2. Plano Premium
- **Nome**: Premium
- **Preço**: R$ 159,00/mês
- **Tokens**: 4.000.000 (4M)
- **Capacidade**: ~750 páginas/mês
- **Stripe Price ID**: `price_1SG40ZJrr43cGTt4SGCX0JUZ`
- **Stripe Product ID**: `prod_TCSwuloaO4vRHL`
- **Display Order**: 2
- **Tag**: Recomendado

### 3. Plano Pro
- **Nome**: Pro
- **Preço**: R$ 309,00/mês
- **Tokens**: 8.000.000 (8M)
- **Capacidade**: ~1.500 páginas/mês
- **Stripe Price ID**: `price_1SG41xJrr43cGTt4MQwqdEiv`
- **Stripe Product ID**: `prod_TCSxhO2q0Ildqh`
- **Display Order**: 3

### 4. Plano Elite
- **Nome**: Elite
- **Preço**: R$ 759,00/mês
- **Tokens**: 20.000.000 (20M)
- **Capacidade**: ~3.700 páginas/mês
- **Stripe Price ID**: `price_1SG43JJrr43cGTt4URQn0TxZ`
- **Stripe Product ID**: `prod_TCSzedbK2kedbR`
- **Display Order**: 4

### Benefícios Comuns a Todos os Planos
1. Análise jurídica automatizada
2. Extração de dados dos processos
3. Geração de relatórios em DOCX
4. Chat com IA sobre seus processos
5. Suporte prioritário
6. Atualizações automáticas
7. Armazenamento seguro na nuvem
8. Interface intuitiva e moderna

---

## Pacotes de Tokens Extras

### Pacote 1: 1,2 Milhão de Tokens
- **Nome**: 1,2 Milhão de Tokens
- **Preço**: R$ 38,00 (pagamento único)
- **Tokens**: 1.200.000
- **Stripe Price ID**: `price_1SGAPJJrr43cGTt4r7k4qYZe`
- **Stripe Product ID**: `prod_TCZYC41p0xOw3O`
- **Checkout URL**: `https://buy.stripe.com/14A9AU7EE4HedohczU7Re09`
- **Display Order**: 1

### Pacote 2: 2 Milhões de Tokens
- **Nome**: 2 Milhões de Tokens
- **Preço**: R$ 76,00 (pagamento único)
- **Tokens**: 2.000.000
- **Stripe Price ID**: `price_1SGAQHJrr43cGTt4dKkvB9lD`
- **Stripe Product ID**: `prod_TCZZzd2SrGSDlD`
- **Checkout URL**: `https://buy.stripe.com/28E14o2kk0qY5VP2Zk7Re0a`
- **Display Order**: 2

---

## Fluxo de Compra

### Tratamento: Usuários Novos vs Existentes

O sistema identifica automaticamente se o usuário já possui cadastro no Stripe ou se é sua primeira compra.

#### Usuário Novo (Primeira Compra)
**Identificação**: Não existe registro em `stripe_customers` para o `user_id`.

**Processo**:
1. Cria Stripe Customer no Stripe
2. Salva mapeamento em `stripe_customers` (user_id → customer_id)
3. Cria registro inicial em `stripe_subscriptions` (status: 'not_started')
4. Todos tokens zerados inicialmente

**Rollback em caso de erro**:
- Se falhar ao criar `stripe_customers`: deleta customer do Stripe
- Se falhar ao criar `stripe_subscriptions`: deleta customer do Stripe e registro do banco

#### Usuário Existente (Cliente Stripe Ativo)
**Identificação**: Já existe `customer_id` em `stripe_customers` para o `user_id`.

**Processo**:
1. Reutiliza `customer_id` existente
2. Verifica se já tem registro em `stripe_subscriptions`
3. Se não tem: cria registro (status: 'not_started')
4. Se tem: mantém dados existentes (tokens, status, etc.)
5. Preserva `extra_tokens` e histórico

**Vantagens**:
- Mantém histórico de compras no Stripe
- Preserva métodos de pagamento salvos
- Não perde tokens acumulados
- Upgrade/downgrade sem criar novo customer

### 1. Assinatura de Plano

#### Passo 1: Seleção do Plano
- Usuário acessa `/signature` (SubscriptionPage)
- Sistema sincroniza assinatura atual via edge function `sync-stripe-subscription`
- Exibe cards de planos com informações e preços

#### Passo 2: Checkout
1. Usuário clica em "Assinar Agora" / "Upgrade" / "Downgrade"
2. Frontend chama edge function `stripe-checkout`:
   ```typescript
   POST /functions/v1/stripe-checkout
   Body: {
     price_id: string,
     mode: 'subscription',
     success_url: string,
     cancel_url: string
   }
   ```
3. Edge function:
   - Autentica usuário
   - **Busca customer existente** em `stripe_customers` por `user_id`
   - **Se não existe** (usuário novo):
     - Cria Stripe Customer no Stripe
     - Insere em `stripe_customers` (user_id, customer_id)
     - Se mode='subscription': Cria registro em `stripe_subscriptions` (status: 'not_started')
   - **Se existe** (usuário existente):
     - Usa `customer_id` existente
     - Se mode='subscription' E não tem `stripe_subscriptions`: cria registro
     - Se já tem subscription: mantém dados (preserva tokens)
   - Cria Checkout Session no Stripe com `customer_id`
   - Retorna URL de checkout

**Código Simplificado**:
```typescript
// Busca customer existente
const { data: customer } = await supabase
  .from('stripe_customers')
  .select('customer_id')
  .eq('user_id', user.id)
  .maybeSingle();

let customerId;

if (!customer) {
  // NOVO USUÁRIO
  const newCustomer = await stripe.customers.create({
    email: user.email,
    metadata: { userId: user.id }
  });

  await supabase.from('stripe_customers').insert({
    user_id: user.id,
    customer_id: newCustomer.id
  });

  if (mode === 'subscription') {
    await supabase.from('stripe_subscriptions').insert({
      customer_id: newCustomer.id,
      status: 'not_started'
    });
  }

  customerId = newCustomer.id;
} else {
  // USUÁRIO EXISTENTE
  customerId = customer.customer_id;

  // Garante que tem registro de subscription
  if (mode === 'subscription') {
    const { data: sub } = await supabase
      .from('stripe_subscriptions')
      .select('status')
      .eq('customer_id', customerId)
      .maybeSingle();

    if (!sub) {
      await supabase.from('stripe_subscriptions').insert({
        customer_id: customerId,
        status: 'not_started'
      });
    }
  }
}

// Cria sessão de checkout
const session = await stripe.checkout.sessions.create({
  customer: customerId,  // Sempre usa customer_id (novo ou existente)
  line_items: [{ price: price_id, quantity: 1 }],
  mode,
  success_url,
  cancel_url
});
```

#### Passo 3: Pagamento no Stripe
- Usuário é redirecionado para Stripe Checkout
- Preenche dados do cartão
- Stripe processa pagamento

#### Passo 4: Webhook e Ativação
1. Stripe envia webhook `checkout.session.completed`
2. Edge function `stripe-webhook` processa evento:
   - Verifica assinatura no Stripe
   - Atualiza `stripe_subscriptions` com:
     - subscription_id
     - status: 'active' ou 'trialing'
     - price_id
     - plan_tokens (baseado no plano)
     - current_period_start/end
     - payment_method
3. Trigger automático calcula `tokens_total = plan_tokens + extra_tokens`
4. Usuário é redirecionado para success page

### 2. Compra de Tokens Extras

**Pré-requisito**: Usuário DEVE ter uma assinatura ativa (ou cancelada dentro do período).

#### Passo 1: Seleção de Pacote
- Usuário acessa AddTokensSection (em `/signature` ou `/tokens`)
- Seleciona pacote desejado

#### Passo 2: Checkout
1. Frontend redireciona diretamente para checkout_url do pacote
2. Stripe processa pagamento único (mode: 'payment')

#### Passo 3: Webhook e Crédito
1. Stripe envia webhook `checkout.session.completed` com mode='payment'
2. Edge function `stripe-webhook` processa:
   - Identifica como compra one-time (mode='payment')
   - Busca price_id do line_item
   - Identifica tokens do pacote
   - **Busca subscription do usuário**:
     - Primeiro: por `customer_id` direto
     - Se não achar: busca por email → user_id → customer_id
   - Se não tem subscription: **AVISO e PULA** (usuário precisa ter plano primeiro)
   - Se tem subscription:
     - Incrementa `extra_tokens`
     - Registra em `token_credits_audit`
     - Insere em `stripe_orders` (histórico de compra)
3. Trigger recalcula `tokens_total`

**Tratamento Especial: Sem Subscription**

Se usuário comprar tokens extras SEM ter assinatura ativa:

```typescript
if (!subscription) {
  console.warn('No active subscription found to credit tokens');
  console.warn('Customer needs subscription before purchasing token packages');

  // Registra em auditoria como 'skipped'
  await logTokenCreditAudit({
    event_type: 'checkout.session.completed',
    customer_id: customerId,
    operation: 'credit_extra_tokens',
    status: 'skipped',
    error_message: 'No subscription found',
    subscription_found: false,
    tokens_amount: tokensToAdd
  });

  return; // Não credita tokens
}
```

**Comportamento**:
- Pagamento é processado normalmente no Stripe
- Dinheiro é recebido
- Mas tokens NÃO são creditados
- Auditoria registra como 'skipped'
- Suporte deve intervir manualmente se necessário

**Solução**: Usuário deve primeiro assinar um plano, depois comprar tokens extras.

#### Fallback: Busca por Email

O sistema possui um mecanismo de fallback para encontrar a subscription correta quando `customer_id` não tem correspondência direta:

**Cenário**: Usuário tem subscription mas não foi encontrada pelo `customer_id`.

**Fluxo**:
```typescript
// 1. Busca direta por customer_id
let subscription = await supabase
  .from('stripe_subscriptions')
  .select('*')
  .eq('customer_id', customerId)
  .maybeSingle();

// 2. Se não achou, busca por email (fallback)
if (!subscription && customerEmail) {
  // 2a. Busca user_id pelo email
  const { data: userProfile } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('email', customerEmail)
    .maybeSingle();

  if (userProfile) {
    // 2b. Busca customer_id do user
    const { data: customerByUser } = await supabase
      .from('stripe_customers')
      .select('customer_id')
      .eq('user_id', userProfile.id)
      .maybeSingle();

    if (customerByUser) {
      // 2c. Busca subscription pelo customer_id correto
      subscription = await supabase
        .from('stripe_subscriptions')
        .select('*')
        .eq('customer_id', customerByUser.customer_id)
        .maybeSingle();

      // 2d. Usa customer_id correto para creditar tokens
      targetCustomerId = customerByUser.customer_id;
    }
  }
}
```

**Quando isso ocorre**:
- Múltiplos customers no Stripe para mesmo email
- Dados desincronizados entre Stripe e banco
- Migrações de contas antigas

**Resultado**: Sistema consegue creditar tokens no lugar correto mesmo com dessincronia.

### 3. Upgrade de Plano

Quando usuário faz upgrade (ex: Premium → Pro):

1. **Preservação de Tokens**:
   - `plan_tokens` atualizado para novo plano (8M)
   - `extra_tokens` mantido
   - `tokens_used` mantido (não reseta)
   - `tokens_total` recalculado

2. **Exemplo**:
   ```
   Antes (Premium):
   plan_tokens: 4.000.000
   extra_tokens: 1.200.000
   tokens_used: 2.000.000
   tokens_total: 5.200.000
   tokens_remaining: 3.200.000

   Depois (Pro):
   plan_tokens: 8.000.000
   extra_tokens: 1.200.000
   tokens_used: 2.000.000
   tokens_total: 9.200.000
   tokens_remaining: 7.200.000
   ```

### 4. Downgrade de Plano

Quando usuário faz downgrade (ex: Pro → Premium):

1. **Preservação de Tokens**:
   - `plan_tokens` reduzido para novo plano (4M)
   - `extra_tokens` mantido
   - `tokens_used` mantido
   - Sistema permite uso até `tokens_total` acabar

2. **Comportamento**:
   - Se `tokens_used > plan_tokens`: usuário continua usando tokens extras
   - Tokens extras sempre preservados
   - Não há perda de tokens pagos

### 5. Cancelamento de Assinatura

#### Fluxo:
1. Usuário clica em "Cancelar Assinatura" na página de planos
2. Modal de confirmação é exibido (CancelSubscriptionModal)
3. Frontend chama edge function `cancel-subscription`
4. Edge function:
   ```typescript
   POST /functions/v1/cancel-subscription
   ```
   - Autentica usuário
   - Busca subscription_id no banco
   - Chama `stripe.subscriptions.cancel()`
   - Atualiza banco:
     ```sql
     status = 'canceled'
     canceled_at = now()
     cancel_at = null
     ```

#### Importante:
- **Tokens NÃO são perdidos no cancelamento**
- `plan_tokens`, `extra_tokens` e `tokens_used` permanecem inalterados
- Usuário pode continuar usando tokens restantes
- Sistema permite status 'canceled' processar até tokens acabarem
- Após fim do período pago, novos processos são bloqueados

---

## Sistema de Tokens

### Conversão Páginas → Tokens

**Fórmula**: 1 página = ~5.500 tokens

Implementado na função `calculate_tokens_from_pages()`:
```sql
CREATE FUNCTION calculate_tokens_from_pages(page_count integer)
RETURNS integer AS $$
BEGIN
  RETURN page_count * 5500;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

### Ordem de Consumo

**REGRA CRÍTICA**: Tokens do plano são consumidos ANTES dos tokens extras.

Implementado na função `debit_user_tokens()`:

```sql
1. Calcula: available_plan_tokens = plan_tokens - tokens_used
2. Se tokens_needed <= available_plan_tokens:
   - Debita apenas de tokens_used
   - extra_tokens não é tocado
3. Se tokens_needed > available_plan_tokens:
   - Debita todo available_plan_tokens (tokens_used = plan_tokens)
   - Debita restante de extra_tokens
```

### Exemplo de Consumo

**Cenário Inicial**:
```
plan_tokens: 4.000.000
extra_tokens: 1.200.000
tokens_used: 0
tokens_total: 5.200.000
```

**Processo 1: 500 páginas (2.750.000 tokens)**:
```
tokens_used: 2.750.000
extra_tokens: 1.200.000
tokens_remaining: 2.450.000
```

**Processo 2: 400 páginas (2.200.000 tokens)**:
```
tokens_used: 4.000.000 (consumiu todo plan_tokens)
extra_tokens: 250.000 (consumiu 950.000 dos extras)
tokens_remaining: 250.000
```

### Débito Automático

Quando processo é completado:

1. **Trigger**: `debit_tokens_for_process()`
2. **Condições**:
   - Status muda para 'completed' ou 'processing_forensic'
   - `pages_processed_successfully > 0`
   - `tokens_consumed = 0` (previne duplo débito)

3. **Ações**:
   ```sql
   -- 1. Calcula tokens
   tokens = pages * 5500

   -- 2. Registra em token_usage_history
   INSERT INTO token_usage_history (...)

   -- 3. Atualiza subscription
   UPDATE stripe_subscriptions
   SET tokens_used = tokens_used + tokens

   -- 4. Atualiza processo
   UPDATE processos
   SET tokens_consumed = tokens,
       token_transaction_id = history_id
   ```

### Funções de Token

#### 1. `debit_user_tokens()`
```sql
debit_user_tokens(
  p_user_id uuid,
  p_tokens_required bigint,
  p_operation_type text DEFAULT 'process_document',
  p_metadata jsonb DEFAULT '{}'
)
RETURNS jsonb
```

**Retorno**:
```json
{
  "success": true,
  "tokens_debited": 2750000,
  "tokens_from_plan": 2750000,
  "tokens_from_extra": 0,
  "new_tokens_used": 2750000,
  "new_extra_tokens": 1200000,
  "remaining_plan_tokens": 1250000,
  "remaining_extra_tokens": 1200000,
  "total_remaining": 2450000
}
```

#### 2. `check_user_tokens()`
```sql
check_user_tokens(p_user_id uuid, p_required_tokens bigint)
RETURNS jsonb
```

**Retorno**:
```json
{
  "has_subscription": true,
  "has_sufficient_tokens": true,
  "available_plan_tokens": 1250000,
  "available_extra_tokens": 1200000,
  "total_available": 2450000,
  "plan_tokens": 4000000,
  "extra_tokens": 1200000,
  "tokens_used": 2750000,
  "tokens_total": 5200000,
  "tokens_required": 550000,
  "subscription_status": "active",
  "consumption_order": "plan_tokens first, then extra_tokens",
  "message": "Sufficient tokens available"
}
```

---

## Tabelas do Banco de Dados

### 1. `subscription_plans`

Armazena configuração dos planos de assinatura.

**Colunas**:
```sql
id                  uuid PRIMARY KEY
name                text NOT NULL
description         text
stripe_price_id     text NOT NULL UNIQUE
price_brl           numeric(10,2) NOT NULL
tokens_included     bigint NOT NULL
is_active           boolean DEFAULT true
display_order       integer DEFAULT 0
created_at          timestamptz DEFAULT now()
updated_at          timestamptz DEFAULT now()
```

**Dados Atuais**:
| Name | Price | Tokens | Price ID |
|------|-------|--------|----------|
| Essencial | 59.00 | 1,200,000 | price_1SG3zEJrr43cGTt4oUj89h9u |
| Premium | 159.00 | 4,000,000 | price_1SG40ZJrr43cGTt4SGCX0JUZ |
| Pro | 309.00 | 8,000,000 | price_1SG41xJrr43cGTt4MQwqdEiv |
| Elite | 759.00 | 20,000,000 | price_1SG43JJrr43cGTt4URQn0TxZ |

### 2. `subscription_plan_benefits`

Armazena benefícios exibidos em todos os planos.

**Colunas**:
```sql
id              uuid PRIMARY KEY
benefit_text    text NOT NULL
is_active       boolean DEFAULT true
display_order   integer DEFAULT 0
created_at      timestamptz DEFAULT now()
```

**Benefícios Atuais**:
1. Análise jurídica automatizada
2. Extração de dados dos processos
3. Geração de relatórios em DOCX
4. Chat com IA sobre seus processos
5. Suporte prioritário
6. Atualizações automáticas
7. Armazenamento seguro na nuvem
8. Interface intuitiva e moderna

### 3. `token_packages`

Armazena pacotes de tokens para compra avulsa.

**Colunas**:
```sql
id                  uuid PRIMARY KEY
name                text NOT NULL
description         text
stripe_price_id     text NOT NULL UNIQUE
stripe_product_id   text
checkout_url        text
price_brl           numeric(10,2) NOT NULL
tokens_amount       bigint NOT NULL
is_active           boolean DEFAULT true
display_order       integer DEFAULT 0
created_at          timestamptz DEFAULT now()
updated_at          timestamptz DEFAULT now()
```

**Dados Atuais**:
| Name | Price | Tokens | Price ID | Checkout URL |
|------|-------|--------|----------|--------------|
| 1,2 Milhão de Tokens | 38.00 | 1,200,000 | price_1SGAPJJrr43cGTt4r7k4qYZe | https://buy.stripe.com/14A9AU7EE4HedohczU7Re09 |
| 2 Milhões de Tokens | 76.00 | 2,000,000 | price_1SGAQHJrr43cGTt4dKkvB9lD | https://buy.stripe.com/28E14o2kk0qY5VP2Zk7Re0a |

### 4. `stripe_customers`

Mapeia usuários para Stripe Customers.

**Colunas**:
```sql
id              uuid PRIMARY KEY
user_id         uuid NOT NULL REFERENCES auth.users
customer_id     text NOT NULL UNIQUE
deleted_at      timestamptz
created_at      timestamptz DEFAULT now()
```

**Relacionamento**:
- 1 usuário = 1 customer
- customer_id é o ID do Stripe

### 5. `stripe_subscriptions`

Armazena assinaturas e tokens do usuário.

**Colunas Principais**:
```sql
id                      bigint PRIMARY KEY
customer_id             text NOT NULL UNIQUE
subscription_id         text UNIQUE
status                  stripe_subscription_status NOT NULL
price_id                text
-- Tokens
plan_tokens             bigint DEFAULT 0
extra_tokens            bigint DEFAULT 0
tokens_used             bigint DEFAULT 0
tokens_total            bigint DEFAULT 0  -- calculado: plan_tokens + extra_tokens
tokens_carried_forward  bigint DEFAULT 0  -- tokens preservados de plano anterior
-- Billing
current_period_start    bigint
current_period_end      bigint
cancel_at_period_end    boolean DEFAULT false
-- Payment
payment_method_brand    text
payment_method_last4    text
-- Tracking
last_plan_change_at     timestamptz  -- timestamp da última mudança de plano
created_at              timestamptz DEFAULT now()
updated_at              timestamptz DEFAULT now()
deleted_at              timestamptz
```

**Status Possíveis**:
- `not_started`: Sem assinatura ativa
- `active`: Assinatura ativa
- `trialing`: Em período de teste
- `past_due`: Pagamento atrasado
- `canceled`: Cancelada (mas tokens ainda válidos)
- `incomplete`: Pagamento incompleto
- `unpaid`: Não pago

**Trigger Automático**:
```sql
-- Sempre que plan_tokens ou extra_tokens mudam:
UPDATE SET tokens_total = plan_tokens + extra_tokens
```

**Colunas de Rastreamento**:
- `tokens_carried_forward`: Total de tokens transferidos de planos anteriores (incluído em `extra_tokens`)
- `last_plan_change_at`: Data/hora da última mudança de plano (diferencia renovação de upgrade/downgrade)

### 6. `stripe_orders`

Armazena pedidos de compras únicas (pacotes de tokens).

**Colunas**:
```sql
id                    bigint PRIMARY KEY
checkout_session_id   text NOT NULL
payment_intent_id     text NOT NULL
customer_id           text NOT NULL
amount_subtotal       bigint NOT NULL
amount_total          bigint NOT NULL
currency              text NOT NULL
payment_status        text NOT NULL
status                stripe_order_status DEFAULT 'pending'
created_at            timestamptz DEFAULT now()
updated_at            timestamptz DEFAULT now()
deleted_at            timestamptz
```

**Status Possíveis** (enum `stripe_order_status`):
- `pending`: Processando pagamento
- `completed`: Pagamento confirmado e tokens creditados
- `canceled`: Pagamento cancelado

### 7. `stripe_coupons`

Armazena cupons de desconto sincronizados do Stripe.

**Colunas**:
```sql
id                  text PRIMARY KEY (Stripe coupon ID)
name                text
percent_off         numeric
amount_off          numeric
currency            text DEFAULT 'brl'
duration            text NOT NULL  -- 'once', 'repeating', 'forever'
duration_in_months  integer
times_redeemed      integer DEFAULT 0
max_redemptions     integer
valid               boolean DEFAULT true
created_at          timestamptz DEFAULT now()
updated_at          timestamptz DEFAULT now()
```

**Sincronização**:
- Edge function `sync-stripe-coupons` sincroniza cupons do Stripe
- Utilizado por admins para diagnosticar descontos aplicados

### 8. `plan_configuration_audit`

Auditoria de mudanças em planos, benefícios e pacotes.

**Colunas**:
```sql
id              uuid PRIMARY KEY
table_name      text NOT NULL  -- qual tabela foi alterada
record_id       uuid NOT NULL  -- ID do registro alterado
action          text NOT NULL  -- 'INSERT', 'UPDATE', 'DELETE'
old_values      jsonb          -- valores anteriores
new_values      jsonb          -- valores novos
changed_by      uuid REFERENCES auth.users
changed_at      timestamptz DEFAULT now()
```

**Uso**: Rastreia todas alterações em configurações de planos e pacotes por admins.

### 9. `token_usage_history`

Histórico detalhado de consumo de tokens.

**Colunas**:
```sql
id                  bigserial PRIMARY KEY
user_id             uuid NOT NULL REFERENCES auth.users
processo_id         uuid REFERENCES processos
tokens_consumed     integer NOT NULL
pages_processed     integer NOT NULL
operation_type      text DEFAULT 'process_document'
notes               text
created_at          timestamptz DEFAULT now()
```

**Usado para**:
- Histórico na página /tokens
- Auditoria de uso
- Relatórios de consumo

### 10. `token_credits_audit`

Auditoria de todas operações de crédito/débito de tokens.

**Colunas**:
```sql
id                      bigserial PRIMARY KEY
event_id                text
event_type              text NOT NULL
customer_id             text NOT NULL
operation               text NOT NULL
status                  text NOT NULL  -- 'success', 'failed', 'skipped'
tokens_amount           bigint
checkout_session_id     text
price_id                text
subscription_id         text
previous_extra_tokens   bigint
new_extra_tokens        bigint
subscription_found      boolean
error_message           text
processing_time_ms      integer
metadata                jsonb
created_at              timestamptz DEFAULT now()
```

**Tipos de Eventos**:
- `subscription_created`: Nova assinatura criada
- `subscription_updated`: Assinatura atualizada (renovação)
- `plan_change`: Upgrade/downgrade de plano
- `extra_tokens_purchased`: Compra de pacote de tokens
- `tokens_reset`: Reset de tokens no ciclo de cobrança
- `preserve_remaining_tokens`: Preservação de tokens em mudança de plano
- `checkout.session.completed`: Webhook do Stripe processado

**Operações**:
- `add_extra_tokens`: Adicionar tokens extras
- `credit_extra_tokens`: Creditar tokens (pode ser skipped se sem subscription)
- `preserve_tokens_within_period`: Preservar tokens de assinatura cancelada
- `fetch_subscription`, `identify_token_package`, etc.

### 11. Views do Banco

#### `stripe_user_subscriptions`
View segura que retorna dados da assinatura do usuário autenticado.

```sql
SELECT
  c.customer_id,
  s.subscription_id,
  s.status as subscription_status,
  s.price_id,
  s.current_period_start,
  s.current_period_end,
  s.cancel_at_period_end,
  s.payment_method_brand,
  s.payment_method_last4
FROM stripe_customers c
LEFT JOIN stripe_subscriptions s ON c.customer_id = s.customer_id
WHERE c.user_id = auth.uid()
AND c.deleted_at IS NULL
AND s.deleted_at IS NULL
```

**Uso**: Componente `SubscriptionStatus` busca desta view.

#### `stripe_user_orders`
View segura que retorna histórico de pedidos do usuário.

```sql
SELECT
  c.customer_id,
  o.id as order_id,
  o.checkout_session_id,
  o.payment_intent_id,
  o.amount_subtotal,
  o.amount_total,
  o.currency,
  o.payment_status,
  o.status as order_status,
  o.created_at as order_date
FROM stripe_customers c
LEFT JOIN stripe_orders o ON c.customer_id = o.customer_id
WHERE c.user_id = auth.uid()
AND c.deleted_at IS NULL
AND o.deleted_at IS NULL
```

**Uso**: Histórico de compras de pacotes de tokens.

#### `user_token_balance`
View para visualização consolidada do saldo de tokens.

```sql
SELECT
  sc.user_id,
  up.email,
  ss.customer_id,
  ss.subscription_id,
  ss.status as subscription_status,
  ss.price_id,
  ss.plan_tokens,
  ss.extra_tokens,
  ss.tokens_used,
  ss.tokens_total,
  GREATEST(ss.plan_tokens - ss.tokens_used, 0) as available_plan_tokens,
  ss.extra_tokens as available_extra_tokens,
  GREATEST(ss.plan_tokens - ss.tokens_used, 0) + ss.extra_tokens as total_available_tokens,
  ss.tokens_carried_forward,
  ss.current_period_start,
  ss.current_period_end,
  ss.last_plan_change_at,
  ss.cancel_at_period_end
FROM stripe_subscriptions ss
JOIN stripe_customers sc ON ss.customer_id = sc.customer_id
LEFT JOIN user_profiles up ON sc.user_id = up.id
WHERE ss.deleted_at IS NULL
```

**Uso**: Administração, relatórios, analytics.

---

## Edge Functions

### 1. `stripe-checkout`

**Responsabilidade**: Criar sessão de checkout do Stripe.

**Endpoint**: `POST /functions/v1/stripe-checkout`

**Input**:
```json
{
  "price_id": "price_1SG3zEJrr43cGTt4oUj89h9u",
  "mode": "subscription",
  "success_url": "https://app.com/success",
  "cancel_url": "https://app.com/cancel"
}
```

**Fluxo**:
1. Autentica usuário via Bearer token
2. Busca ou cria Stripe Customer
3. Cria registro em `stripe_customers` (se novo)
4. Cria registro em `stripe_subscriptions` (status: 'not_started')
5. Cria Stripe Checkout Session
6. Retorna URL de checkout

**Output**:
```json
{
  "sessionId": "cs_test_...",
  "url": "https://checkout.stripe.com/..."
}
```

**RLS**: Usa service_role key (bypass RLS).

### 2. `stripe-webhook`

**Responsabilidade**: Processar webhooks do Stripe.

**Endpoint**: `POST /functions/v1/stripe-webhook`

**Autenticação**: Valida signature do webhook usando `STRIPE_WEBHOOK_SECRET`.

**Eventos Processados**:

#### `checkout.session.completed` (mode='subscription')
1. Chama `syncCustomerFromStripe(customer_id, event_id)`
2. Busca subscription mais recente no Stripe
3. Atualiza `stripe_subscriptions`:
   - subscription_id, status, price_id
   - plan_tokens (busca em `subscription_plans`)
   - current_period_start, current_period_end
   - payment_method_brand, payment_method_last4
4. Registra em `token_credits_audit`

#### `checkout.session.completed` (mode='payment')
1. Chama `processOneTimePayment(event_id, customer_id, session)`
2. Insere em `stripe_orders`:
   - checkout_session_id, payment_intent_id
   - amount_subtotal, amount_total, currency
   - payment_status, status='completed'
3. Busca price_id do line_item
4. Identifica tokens do pacote (1.2M ou 2M)
5. Busca subscription do usuário (direto ou por email fallback)
6. **SE SEM SUBSCRIPTION**: registra 'skipped' e retorna (não credita)
7. **SE TEM SUBSCRIPTION**: incrementa `extra_tokens`
8. Registra em `token_credits_audit`
9. Trigger recalcula `tokens_total`

#### Eventos de Subscription
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `customer.subscription.trial_will_end`

Para todos esses eventos:
1. Extrai `customer_id` do evento
2. Chama `syncCustomerFromStripe(customer_id, event_id)`
3. Sincroniza todos dados da subscription

**Função `syncCustomerFromStripe()`**:
- Busca subscription ativa no Stripe
- Se não tem subscription mas tem registro com período válido: preserva tokens
- Verifica mudança de plano: preserva `plan_tokens` restantes em `extra_tokens`
- Verifica novo período de cobrança: reseta `tokens_used`
- Atualiza todos campos em `stripe_subscriptions`
- Registra em `token_credits_audit`

**Segurança**:
- Verifica signature do webhook
- Suporta até 3 webhook secrets configurados
- Logs detalhados de todas operações

**RLS**: Usa service_role key (bypass RLS).

### 3. `cancel-subscription`

**Responsabilidade**: Cancelar assinatura do usuário.

**Endpoint**: `POST /functions/v1/cancel-subscription`

**Input**: Nenhum (usa user do token).

**Fluxo**:
1. Autentica usuário
2. Busca customer_id e subscription_id
3. Chama `stripe.subscriptions.cancel()`
4. Atualiza banco:
   ```sql
   UPDATE stripe_subscriptions SET
     status = 'canceled',
     canceled_at = now(),
     cancel_at = null
   ```

**Output**:
```json
{
  "message": "Subscription cancelled successfully",
  "subscription_id": "sub_...",
  "status": "canceled"
}
```

**Importante**: Tokens NÃO são removidos no cancelamento.

**RLS**: Usa service_role key (bypass RLS).

### 4. `sync-stripe-subscription`

**Responsabilidade**: Sincronizar dados da assinatura com Stripe.

**Endpoint**: `POST /functions/v1/sync-stripe-subscription`

**Fluxo**:
1. Autentica usuário
2. Busca customer no banco
3. Lista subscriptions do customer no Stripe
4. Atualiza banco com dados mais recentes
5. Sincroniza tokens do plano

**Quando Executado**:
- Ao carregar página de planos
- Ao carregar página de tokens
- Periodicamente via polling

**RLS**: Usa service_role key (bypass RLS).

### 5. `sync-stripe-extra-tokens`

**Responsabilidade**: Sincronizar compras de tokens extras.

**Endpoint**: `POST /functions/v1/sync-stripe-extra-tokens`

**Fluxo**:
1. Lista todos pagamentos one-time do customer
2. Verifica quais foram pagamentos de pacotes de tokens
3. Soma tokens comprados
4. Atualiza extra_tokens se houver diferença

**Uso**: Recuperação de tokens em caso de dessincronia.

**RLS**: Usa service_role key (bypass RLS).

### 6. `sync-stripe-coupons`

**Responsabilidade**: Sincronizar cupons de desconto do Stripe.

**Endpoint**: `POST /functions/v1/sync-stripe-coupons`

**Fluxo**:
1. Lista todos cupons do Stripe (`stripe.coupons.list()`)
2. Para cada cupom: upsert em `stripe_coupons`
   - id, name, percent_off, amount_off
   - duration, duration_in_months
   - valid, times_redeemed, max_redemptions

**Uso**: Administração, diagnóstico de descontos aplicados.

**RLS**: Usa service_role key (bypass RLS).

---

## Páginas e Componentes

### Páginas

#### 1. `/signature` - SubscriptionPage

**Arquivo**: `src/pages/SubscriptionPage.tsx`

**Componente Principal**: `<SubscriptionPlans />`

**Funcionalidades**:
- Exibe cards de todos os planos
- Sincroniza assinatura atual
- Mostra status do plano ativo
- Permite assinar, fazer upgrade/downgrade
- Exibe TokenBreakdownCard
- Exibe AddTokensSection
- Botão de cancelamento

**Hooks Usados**:
- `useSubscriptionPlans()`: Carrega planos de `subscription_plans`
- `useSubscriptionStatus()`: Status da assinatura atual
- `useTokenPackages()`: Carrega pacotes de `token_packages`

**Componentes Filhos**:
- `SubscriptionStatus`: Card com status e dados da assinatura
- `SubscriptionPlans`: Grid de cards dos planos
- `TokenBreakdownCard`: Detalhamento de tokens (plan vs extra)
- `AddTokensSection`: Seção de compra de pacotes extras
- `CancelSubscriptionModal`: Modal de cancelamento

#### 2. `/tokens` - TokensPage

**Arquivo**: `src/pages/TokensPage.tsx`

**Funcionalidades**:
- Gráfico de uso de tokens (barra de progresso)
- Breakdown: plan_tokens + extra_tokens
- Histórico de consumo (tabela de processos)
- Seção de compra de tokens extras
- Botão "Ver Planos"
- Realtime updates via Supabase

**Context Usado**:
- `useTokenBalance()`: Saldo atualizado em tempo real

#### 3. `/success` - SuccessPage

**Arquivo**: `src/components/subscription/SuccessPage.tsx`

**Funcionalidades**:
- Exibida após checkout bem-sucedido
- Mensagem de confirmação
- Botão para voltar ao app

### Componentes

#### 1. SubscriptionPlans

**Arquivo**: `src/components/subscription/SubscriptionPlans.tsx`

**Props**:
```typescript
interface SubscriptionPlansProps {
  onSuccess?: () => void;
}
```

**Estado**:
- `plans`: Array de planos do banco
- `benefits`: Benefícios por plano
- `currentSubscription`: Assinatura atual
- `loading`: Estado de carregamento

**Funções**:
```typescript
syncAndFetchSubscription(): Promise<void>
handleSubscribe(priceId: string): Promise<void>
handleCancelSubscription(): Promise<boolean>
```

**Renderização**:
- Grid de 4 cards (um por plano)
- Cada card mostra:
  - Ícone do plano (Crown, Star, Zap, Sparkles)
  - Nome e preço
  - Tokens incluídos
  - Benefícios (lista com checkmarks)
  - Botão de ação (contexto: Assinar/Upgrade/Downgrade/Plano Ativo)
- Se tem plano ativo:
  - TokenBreakdownCard
  - AddTokensSection
  - Botão "Cancelar Assinatura"

#### 2. AddTokensSection

**Arquivo**: `src/components/subscription/AddTokensSection.tsx`

**Props**:
```typescript
interface AddTokensSectionProps {
  title?: string;
  description?: string;
  onPurchaseStart?: () => void;
  onPurchaseComplete?: () => void;
  onPurchaseError?: (error: string) => void;
}
```

**Funcionalidades**:
- Carrega pacotes de `token_packages`
- Exibe grid de cards de pacotes
- Redireciona para checkout_url direto
- Callbacks para tracking

**Hook Usado**:
- `useTokenPackages()`: Carrega pacotes ativos do banco

#### 3. TokenBreakdownCard

**Arquivo**: `src/components/subscription/TokenBreakdownCard.tsx`

**Funcionalidades**:
- Exibe breakdown detalhado:
  - Tokens do Plano (plan_tokens) - origem: plano mensal
  - Tokens Extras (extra_tokens) - origem: pacotes comprados + tokens preservados
  - Tokens Usados (tokens_used)
  - Total Disponível (tokens_total - tokens_used)
- Barra de progresso visual
- Informações de renovação
- Realtime updates via `TokenBalanceContext`

#### 4. UpgradeModal

**Arquivo**: `src/components/UpgradeModal.tsx`

**Props**:
```typescript
interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  tokensRequired: number;
  tokensAvailable: number;
  pagesRequired: number;
  pagesAvailable: number;
  planName?: string;
  reason: 'insufficient_tokens' | 'no_subscription';
}
```

**Funcionalidades**:
- **Caso 1: `no_subscription`**:
  - Título: "Assinatura Necessária"
  - Descrição: Precisa de plano ativo
  - Exibe `SubscriptionPlans` inline
- **Caso 2: `insufficient_tokens`**:
  - Título: "Tokens Insuficientes"
  - Card amarelo com detalhes:
    - Tokens disponíveis vs necessários
    - Páginas disponíveis vs necessárias
    - Déficit exato
  - Exibe `SubscriptionPlans` para upgrade

**Quando é Exibido**:
- Ao tentar processar documento sem assinatura
- Ao tentar processar documento sem tokens suficientes
- Validação feita por `TokenValidationService`

#### 5. CancelSubscriptionModal

**Arquivo**: `src/components/CancelSubscriptionModal.tsx`

**Props**:
```typescript
interface CancelSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<boolean>;
  isLoading: boolean;
  planName: string;
  onNavigateToHome?: () => void;
}
```

**Estados**:
1. **Confirmação**: Exibe aviso e botão "Cancelar Assinatura"
2. **Sucesso**: Animação de sucesso + mensagem
   - Auto-fecha em 2 segundos
   - Navega para home (opcional)

**Informações Exibidas**:
- Nome do plano que será cancelado
- Aviso sobre manutenção de tokens
- Informação sobre fim de acesso após período

#### 6. SubscriptionStatus

**Arquivo**: `src/components/subscription/SubscriptionStatus.tsx`

**Funcionalidades**:
- Card com informações da assinatura atual
- Exibe:
  - Nome do plano (busca em `stripeProducts`)
  - Status (ativo, cancelado, etc.)
  - Data da próxima renovação (formatada)
  - Método de pagamento (brand + last4)
- Botão de refresh manual
- Loading state durante sincronização

**Lógica de Sincronização**:
```typescript
initializeSubscription() {
  await syncWithStripe();  // chama edge function
  await fetchSubscription();  // busca do banco
}
```

**View Usada**: `stripe_user_subscriptions`

### Hooks Customizados

#### `useSubscriptionPlans()`
**Arquivo**: `src/hooks/useSubscriptionPlans.ts`

Carrega planos ativos de `subscription_plans`.

**Retorno**:
```typescript
{
  plans: SubscriptionPlan[];
  benefits: string[];
  loading: boolean;
  error: string | null;
}
```

#### `useTokenPackages()`
**Arquivo**: `src/hooks/useTokenPackages.ts`

Carrega pacotes ativos de `token_packages`.

**Retorno**:
```typescript
{
  packages: TokenPackage[];
  loading: boolean;
  error: string | null;
}
```

#### `useSubscriptionStatus()`
**Arquivo**: `src/hooks/useSubscriptionStatus.ts`

Monitora status da assinatura com realtime.

**Retorno**:
```typescript
{
  subscription: SubscriptionData | null;
  loading: boolean;
  refresh: () => Promise<void>;
}
```

---

## Administração

### Página: AdminSubscriptionManagementPage

**Arquivo**: `src/pages/AdminSubscriptionManagementPage.tsx`

**Seções**:

#### 1. Gerenciamento de Planos
- Tabela com todos planos
- Editar: nome, descrição, preço, tokens
- Toggle is_active
- Reordenar (display_order)
- **Não permite editar stripe_price_id**

#### 2. Gerenciamento de Benefícios
- Lista de benefícios
- Adicionar/editar/remover
- Toggle is_active
- Reordenar
- Aplicado a todos planos

#### 3. Gerenciamento de Pacotes de Tokens
- Tabela com pacotes
- Editar: nome, preço, tokens, checkout_url
- Toggle is_active
- Reordenar

#### 4. Auditoria de Configurações
- Tabela `plan_configuration_audit`
- Histórico de todas mudanças
- Filtros por tabela/ação
- Mostra old_values vs new_values

**Permissões RLS**:
- Apenas admins (`user_profiles.is_admin = true`)
- Políticas de UPDATE na tabela

### Estrutura de Gerenciamento

```typescript
// Exemplo de atualização de plano
async function updatePlan(planId: string, updates: Partial<Plan>) {
  const { error } = await supabase
    .from('subscription_plans')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', planId);

  // Trigger automático registra em plan_configuration_audit
}
```

**Regras**:
1. Nunca deletar registros (usar is_active = false)
2. Nunca modificar stripe_price_id
3. Novos preços = novo registro no Stripe + novo registro no banco
4. Mudanças auditadas automaticamente

---

## Auditoria de Tokens

### Página: AdminTokenCreditsAuditPage

**Arquivo**: `src/pages/AdminTokenCreditsAuditPage.tsx`

**Funcionalidades**:

#### 1. Visão Geral
- Total de usuários com assinatura
- Total de tokens alocados (todos usuários)
- Total de tokens consumidos
- Percentual médio de uso

#### 2. Filtros
- Por usuário (email/nome)
- Por tipo de evento
- Por período (data range)
- Por status (success/error)

#### 3. Tabela de Auditoria
**Colunas**:
- ID da Auditoria
- Timestamp
- Usuário (email)
- Tipo de Evento
- Operação
- Quantidade de Tokens
- Status
- Metadata (expandível)

**Dados Exibidos**:
```
token_credits_audit JOIN stripe_customers JOIN user_profiles
```

#### 4. Detalhes de Metadata

Cada registro mostra:
```json
{
  "user_id": "uuid",
  "tokens_from_plan": 2750000,
  "tokens_from_extra": 0,
  "previous_tokens_used": 0,
  "new_tokens_used": 2750000,
  "processo_id": "uuid",
  "file_name": "processo.pdf"
}
```

#### 5. Exportação
- CSV com todos dados filtrados
- Relatórios periódicos

### View: token_usage_audit

**Criada em**: `20251030000001_create_token_audit_view.sql`

```sql
CREATE VIEW token_usage_audit AS
SELECT
  tca.id,
  tca.event_type,
  tca.customer_id,
  sc.user_id,
  up.email,
  up.first_name,
  up.last_name,
  tca.operation,
  tca.status,
  tca.tokens_amount,
  tca.metadata,
  tca.created_at,
  ss.plan_tokens,
  ss.extra_tokens,
  ss.tokens_used,
  ss.tokens_total
FROM token_credits_audit tca
JOIN stripe_customers sc ON tca.customer_id = sc.customer_id
JOIN user_profiles up ON sc.user_id = up.id
LEFT JOIN stripe_subscriptions ss ON sc.customer_id = ss.customer_id
WHERE sc.deleted_at IS NULL
ORDER BY tca.created_at DESC;
```

**RLS**: Apenas admins.

---

## RLS Policies

### subscription_plans

```sql
-- Service role full access
"Service role can manage subscription_plans"
  FOR ALL TO service_role
  USING (true) WITH CHECK (true)

-- Authenticated users read active plans
"Authenticated users can read active plans"
  FOR SELECT TO authenticated
  USING (is_active = true)

-- Admins read all plans
"Admin users can read all plans"
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.is_admin = true
  ))

-- Admins update plans
"Admin users can update plans"
  FOR UPDATE TO authenticated
  USING (EXISTS (...is_admin...))
  WITH CHECK (EXISTS (...is_admin...))
```

### subscription_plan_benefits

```sql
-- Service role full access
"Service role can manage benefits"
  FOR ALL TO service_role
  USING (true) WITH CHECK (true)

-- Authenticated read active benefits
"Authenticated users can read active benefits"
  FOR SELECT TO authenticated
  USING (is_active = true)

-- Admins CRUD
"Admin users can read all benefits"
  FOR SELECT TO authenticated
  USING (EXISTS (...is_admin...))

"Admin users can insert benefits"
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (...is_admin...))

"Admin users can update benefits"
  FOR UPDATE TO authenticated
  USING (EXISTS (...is_admin...))
  WITH CHECK (EXISTS (...is_admin...))

"Admin users can delete benefits"
  FOR DELETE TO authenticated
  USING (EXISTS (...is_admin...))
```

### token_packages

```sql
-- Service role full access
"Service role can manage token_packages"
  FOR ALL TO service_role
  USING (true) WITH CHECK (true)

-- Authenticated read active packages
"Authenticated users can read active packages"
  FOR SELECT TO authenticated
  USING (is_active = true)

-- Admins read all
"Admin users can read all packages"
  FOR SELECT TO authenticated
  USING (EXISTS (...is_admin...))

-- Admins update
"Admin users can update packages"
  FOR UPDATE TO authenticated
  USING (EXISTS (...is_admin...))
  WITH CHECK (EXISTS (...is_admin...))
```

### stripe_customers

```sql
-- Service role full access
"Service role can manage stripe_customers"
  FOR ALL TO service_role
  USING (true) WITH CHECK (true)

-- Users read own customer
"Users can view their own customer info"
  FOR SELECT TO authenticated
  USING (user_id = auth.uid())

-- Admins read all
"Admins can view all customers"
  FOR SELECT TO authenticated
  USING (EXISTS (...is_admin...))
```

### stripe_subscriptions

```sql
-- Service role full access
"Service role can manage subscriptions"
  FOR ALL TO service_role
  USING (true) WITH CHECK (true)

-- Users read own via view
-- (stripe_user_subscriptions view usa stripe_customers.user_id)

-- Admins read all
"Admins can view all subscriptions"
  FOR SELECT TO authenticated
  USING (EXISTS (...is_admin...))

-- Admins update (ex: manual token adjustments)
"Admins can update subscriptions"
  FOR UPDATE TO authenticated
  USING (EXISTS (...is_admin...))
  WITH CHECK (EXISTS (...is_admin...))
```

### token_usage_history

```sql
-- Service role full access
"Service role can manage token usage history"
  FOR ALL TO service_role
  USING (true) WITH CHECK (true)

-- Users read own history
"Users can view their own token usage history"
  FOR SELECT TO authenticated
  USING (user_id = auth.uid())
```

### token_credits_audit

```sql
-- Service role full access
"Service role can manage audit"
  FOR ALL TO service_role
  USING (true) WITH CHECK (true)

-- Admins read all
"Admin users can read audit logs"
  FOR SELECT TO authenticated
  USING (EXISTS (...is_admin...))
```

### plan_configuration_audit

```sql
-- Service role full access
"Service role can manage audit"
  FOR ALL TO service_role
  USING (true) WITH CHECK (true)

-- Admins read all
"Admin users can read audit logs"
  FOR SELECT TO authenticated
  USING (EXISTS (...is_admin...))
```

---

## Observações Importantes

### 1. Tokens NUNCA Expiram Durante Vigência
- Tokens acumulam mensalmente
- Não resetam no billing period
- Só são "perdidos" se:
  - Assinatura cancelada E período terminou E tokens esgotados
  - Mas mesmo assim, extras comprados permanecem

### 2. Ordem de Consumo é CRÍTICA
- Sempre consumir plan_tokens primeiro
- Só tocar extra_tokens quando plan_tokens acabar
- Isso garante que tokens comprados duram mais

### 3. Upgrade/Downgrade Preserva Tudo
- tokens_used NÃO reseta
- extra_tokens NÃO reseta
- Usuário nunca perde tokens já pagos

### 4. Cancelamento é Seguro
- Tokens permanecem disponíveis
- Status 'canceled' ainda permite processar
- Usuário tem tempo de usar tokens restantes

### 5. Auditoria é Completa
- Toda operação registrada
- Metadata detalhada de cada débito
- Rastreabilidade total para suporte

### 6. Segurança via RLS
- Service role bypassa RLS (edge functions)
- Usuários só veem próprios dados
- Admins têm acesso total auditável

### 7. Sincronização com Stripe
- Sincronização em tempo real via webhooks
- Fallback com sync manual
- Proteção contra dessincronia

---

## Troubleshooting

### Usuário não recebeu tokens após pagamento

**Verificar**:
1. Webhook foi recebido?
   ```sql
   -- No Stripe Dashboard: Developers > Webhooks > Events
   -- Procurar por checkout.session.completed
   ```

2. Edge function processou?
   ```
   Logs do Supabase > Edge Functions > stripe-webhook
   Buscar por customer_id ou email do usuário
   ```

3. Banco foi atualizado?
   ```sql
   SELECT * FROM stripe_subscriptions
   WHERE customer_id = (
     SELECT customer_id FROM stripe_customers WHERE user_id = '<user_id>'
   );
   ```

4. Se não:
   - Chamar manualmente: `sync-stripe-subscription`
   - Ou `sync-stripe-extra-tokens` se foi pacote

### Tokens não debitam ao completar processo

**Verificar**:
1. Trigger está ativo?
   ```sql
   SELECT * FROM pg_trigger WHERE tgname = 'debit_tokens_for_process';
   ```

2. Processo tem páginas?
   ```sql
   SELECT pages_processed_successfully FROM processos WHERE id = '<processo_id>';
   ```

3. Tokens já foram debitados?
   ```sql
   SELECT tokens_consumed FROM processos WHERE id = '<processo_id>';
   ```

4. Histórico registrado?
   ```sql
   SELECT * FROM token_usage_history WHERE processo_id = '<processo_id>';
   ```

### Upgrade não aumentou tokens

**Verificar**:
1. Subscription foi atualizada?
   ```sql
   SELECT price_id, plan_tokens FROM stripe_subscriptions
   WHERE customer_id = '<customer_id>';
   ```

2. Trigger recalculou tokens_total?
   ```sql
   SELECT plan_tokens, extra_tokens, tokens_total FROM stripe_subscriptions
   WHERE customer_id = '<customer_id>';
   -- tokens_total deve ser plan_tokens + extra_tokens
   ```

3. Se não:
   - Trigger manual:
     ```sql
     UPDATE stripe_subscriptions
     SET tokens_total = plan_tokens + extra_tokens
     WHERE customer_id = '<customer_id>';
     ```

### Pacote extra não creditou

**Verificar**:
1. Pagamento confirmado no Stripe?
   - Dashboard > Payments > procurar por price_id

2. Webhook processou?
   - Logs > stripe-webhook > procurar por mode='payment'

3. Extra tokens incrementado?
   ```sql
   SELECT extra_tokens FROM stripe_subscriptions WHERE customer_id = '<customer_id>';
   ```

4. Auditoria registrada?
   ```sql
   SELECT * FROM token_credits_audit
   WHERE event_type = 'extra_tokens_purchased'
   AND customer_id = '<customer_id>'
   ORDER BY created_at DESC LIMIT 1;
   ```

---

**Fim da Documentação**
