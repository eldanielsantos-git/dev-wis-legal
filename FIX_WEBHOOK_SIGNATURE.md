# Como Corrigir o Erro de Webhook do Stripe

## Problema Identificado

O webhook do Stripe está retornando erro **400: Webhook signature verification failed**. Isso impede que as compras de tokens sejam creditadas automaticamente.

## Causa

Os webhook secrets configurados no Supabase não correspondem ao secret do webhook configurado no Stripe.

## Solução

### 1. Obter o Webhook Secret correto do Stripe

1. Acesse o [Dashboard do Stripe](https://dashboard.stripe.com/webhooks)
2. Encontre o webhook que aponta para sua Edge Function do Supabase
3. Clique no webhook
4. Na seção "Signing secret", clique em "Reveal" para ver o secret
5. Copie o valor (começa com `whsec_...`)

### 2. Atualizar os Secrets no Supabase

Execute os seguintes comandos (substitua `YOUR_WEBHOOK_SECRET` pelo valor copiado):

```bash
# Atualizar o secret principal
supabase secrets set STRIPE_WEBHOOK_SECRET_1=whsec_seu_secret_aqui

# Opcional: Se você tiver múltiplos webhooks
supabase secrets set STRIPE_WEBHOOK_SECRET_2=whsec_outro_secret
supabase secrets set STRIPE_WEBHOOK_SECRET_3=whsec_mais_um_secret
```

### 3. Verificar a Configuração

Depois de atualizar os secrets:

1. Reenvie o webhook que falhou no Stripe Dashboard
2. Verifique se o status muda de "Failed" para "Succeeded"
3. Confirme que os tokens foram creditados na conta do usuário

## URL do Webhook

A URL do webhook deve ser:
```
https://[SEU_PROJETO].supabase.co/functions/v1/stripe-webhook
```

## Eventos que o Webhook Deve Escutar

Certifique-se de que o webhook está configurado para escutar estes eventos:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

## Crédito Manual de Tokens (Caso Emergencial)

Se precisar creditar tokens manualmente enquanto corrige o webhook, use:

```sql
-- 1. Criar/atualizar subscription do cliente
INSERT INTO stripe_subscriptions (
  customer_id,
  subscription_id,
  price_id,
  status,
  plan_tokens,
  extra_tokens,
  tokens_total,
  tokens_used,
  created_at,
  updated_at
)
VALUES (
  'CUSTOMER_ID_DO_STRIPE',
  NULL,
  NULL,
  'not_started',
  0,
  QUANTIDADE_DE_TOKENS,
  QUANTIDADE_DE_TOKENS,
  0,
  NOW(),
  NOW()
)
ON CONFLICT (customer_id)
DO UPDATE SET
  extra_tokens = stripe_subscriptions.extra_tokens + QUANTIDADE_DE_TOKENS,
  tokens_total = stripe_subscriptions.tokens_total + QUANTIDADE_DE_TOKENS,
  updated_at = NOW();
```

## Pacotes de Tokens

- **1M Tokens**: R$ 38,00 → 1.000.000 tokens
- **2M Tokens**: R$ 76,00 → 2.000.000 tokens

## Verificar se o Customer existe

Antes de creditar tokens manualmente, verifique se o customer do Stripe está vinculado ao usuário:

```sql
SELECT
  sc.customer_id,
  sc.user_id,
  up.email,
  up.first_name
FROM stripe_customers sc
JOIN user_profiles up ON sc.user_id = up.id
WHERE sc.customer_id = 'CUSTOMER_ID_DO_STRIPE';
```

Se não existir, crie:

```sql
INSERT INTO stripe_customers (customer_id, user_id, created_at)
VALUES ('CUSTOMER_ID_DO_STRIPE', 'USER_ID_DO_SUPABASE', NOW());
```
