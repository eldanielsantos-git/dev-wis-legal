# Template de Email - Confirmação de Assinatura

## Informações Gerais

Este documento contém todas as informações necessárias para criar o template de email de confirmação de assinatura no Resend.

---

## 📧 Dados do Template

### Nome do Template (Resend)
`subscription-confirmation`

### Assunto do Email
**Nova assinatura:** `Bem-vindo ao {{plan_name}} - Sua assinatura foi confirmada! 🎉`

**Upgrade:** `Upgrade realizado com sucesso para o plano {{plan_name}}! 🚀`

---

## 🔑 Variáveis do Template (Template Variables)

As seguintes variáveis serão enviadas pela edge function e devem ser configuradas no template do Resend:

| Variável | Tipo | Descrição | Exemplo |
|----------|------|-----------|---------|
| `first_name` | string | Primeiro nome do usuário | "João" |
| `last_name` | string | Sobrenome do usuário | "Silva" |
| `email` | string | Email do usuário | "joao@exemplo.com" |
| `plan_name` | string | Nome do plano contratado | "Premium" |
| `plan_price` | string | Valor do plano formatado | "R$ 159,00" |
| `plan_tokens` | string | Quantidade de tokens formatada | "12.000.000" |
| `is_upgrade` | boolean | Se é um upgrade (true) ou nova assinatura (false) | true/false |
| `subscription_start_date` | string | Data de início da assinatura formatada | "02/12/2025" |
| `current_period_end` | string | Data de fim do período atual formatada | "02/01/2026" |
| `app_url` | string | URL da aplicação | "https://seu-app.com" |

---

## 📝 Estrutura do Email Sugerida

### Seção 1: Saudação
```
Olá {{first_name}},
```

### Seção 2: Mensagem de Confirmação

**Para nova assinatura:**
```
Acabamos de confirmar que sua compra foi realizada com sucesso! 🎉

Agora você tem acesso completo ao plano {{plan_name}}.
```

**Para upgrade:**
```
Parabéns! Seu upgrade foi realizado com sucesso! 🚀

Agora você está aproveitando todos os benefícios do plano {{plan_name}}.
```

### Seção 3: Detalhes da Assinatura

```
📋 Detalhes da sua assinatura:

• Plano: {{plan_name}}
• Valor: {{plan_price}}/mês
• Tokens inclusos: {{plan_tokens}} tokens/mês
• Data de renovação: {{current_period_end}}
```

### Seção 4: Benefícios

```
✨ Com o seu plano {{plan_name}} você pode:

• Analisar processos jurídicos de forma prática e ágil
• Otimizar sua rotina de trabalho
• Economizar tempo em análises complexas
• Acessar insights estratégicos automaticamente
```

### Seção 5: Call to Action

```
[Botão: Começar a Usar Agora]
Link: {{app_url}}/workspace
```

### Seção 6: Informações Adicionais

```
💡 Dica: Seus tokens são renovados automaticamente todo mês.
Não se preocupe, tokens não utilizados não são perdidos!

Precisa de ajuda? Nossa equipe está à disposição.
```

### Seção 7: Rodapé

```
Atenciosamente,
Equipe [Nome do App]

---

Este email foi enviado para {{email}}
Para gerenciar sua assinatura, acesse: {{app_url}}/subscription
```

---

## 🎨 Design Sugerido

### Cores
- **Primária:** #3B82F6 (azul)
- **Sucesso:** #10B981 (verde)
- **Texto:** #1F2937 (cinza escuro)
- **Background:** #F9FAFB (cinza claro)

### Fontes
- **Títulos:** Inter Bold, 24px
- **Corpo:** Inter Regular, 16px

---

## 📊 Dados Disponíveis no Sistema

### Planos Ativos

| Nome | Preço | Tokens | Stripe Price ID |
|------|-------|--------|-----------------|
| Essencial | R$ 59,00 | 4.400.000 | price_1SG3zEJrr43cGTt4oUj89h9u |
| Premium | R$ 159,00 | 12.000.000 | price_1SG40ZJrr43cGTt4SGCX0JUZ |
| Pro | R$ 309,00 | 24.000.000 | price_1SG41xJrr43cGTt4MQwqdEiv |
| Elite | R$ 759,00 | 60.000.000 | price_1SG43JJrr43cGTt4URQn0TxZ |

---

## 🔧 Tabelas e Colunas Utilizadas

### Query SQL para buscar dados:

```sql
SELECT
  up.first_name,
  up.last_name,
  up.email,
  sp.name as plan_name,
  sp.price_brl as plan_price,
  sp.tokens_included as plan_tokens,
  ss.subscription_id,
  ss.status,
  ss.current_period_start,
  ss.current_period_end,
  ss.created_at
FROM stripe_subscriptions ss
JOIN stripe_customers sc ON ss.customer_id = sc.customer_id
JOIN user_profiles up ON sc.user_id = up.id
LEFT JOIN subscription_plans sp ON ss.price_id = sp.stripe_price_id
WHERE ss.subscription_id = $1
  AND ss.deleted_at IS NULL;
```

### Tabelas Envolvidas:

1. **stripe_subscriptions**
   - `subscription_id` - ID da assinatura no Stripe
   - `customer_id` - ID do cliente no Stripe
   - `price_id` - ID do preço/plano no Stripe
   - `status` - Status da assinatura (active, canceled, etc)
   - `current_period_start` - Início do período atual (timestamp)
   - `current_period_end` - Fim do período atual (timestamp)
   - `created_at` - Data de criação

2. **stripe_customers**
   - `customer_id` - ID do cliente no Stripe
   - `user_id` - ID do usuário no sistema

3. **user_profiles**
   - `id` - UUID do usuário
   - `first_name` - Primeiro nome
   - `last_name` - Sobrenome
   - `email` - Email do usuário

4. **subscription_plans**
   - `name` - Nome do plano
   - `price_brl` - Preço em reais
   - `tokens_included` - Tokens inclusos
   - `stripe_price_id` - ID do preço no Stripe

5. **email_logs** (para registro)
   - `user_id` - ID do usuário
   - `email` - Email destinatário
   - `type` - Tipo do email (novo: 'subscription_confirmed')
   - `status` - Status do envio
   - `email_provider_response` - Resposta do Resend

---

## 🚀 Edge Function

### Nome
`send-subscription-confirmation-email`

### Endpoint
`POST /functions/v1/send-subscription-confirmation-email`

### Payload de Entrada

```json
{
  "subscription_id": "sub_1STSNuJrr43cGTt4vkoRzaE9",
  "is_upgrade": false
}
```

### Quando Chamar

1. **Nova assinatura:** Webhook do Stripe `checkout.session.completed`
2. **Upgrade:** Webhook do Stripe `customer.subscription.updated`

---

## ✅ Checklist de Implementação

### Você (Criar Template no Resend):

- [ ] Criar template no Resend com nome `subscription-confirmation`
- [ ] Adicionar todas as variáveis listadas acima
- [ ] Testar template com dados de exemplo
- [ ] Anotar o **Template ID** gerado pelo Resend
- [ ] Passar o Template ID para implementação

### Desenvolvedor (Implementar Edge Function):

- [ ] Criar edge function `send-subscription-confirmation-email`
- [ ] Implementar busca de dados das tabelas
- [ ] Formatar datas e valores
- [ ] Detectar se é upgrade ou nova assinatura
- [ ] Integrar com Resend usando Template ID
- [ ] Registrar envio na tabela `email_logs`
- [ ] Adicionar tratamento de erros
- [ ] Adicionar chamada no webhook do Stripe

---

## 📌 Informações Importantes

### Formatações Necessárias:

- **Datas:** Converter timestamp Unix para formato brasileiro (dd/mm/aaaa)
- **Valores:** Formatar com "R$" e separador de milhares (R$ 159,00)
- **Tokens:** Formatar com separador de milhares (12.000.000)

### Tratamento de Upgrade:

Para detectar upgrade, comparar:
1. `last_plan_change_at` existe e é recente
2. Buscar plano anterior do usuário
3. Se houver plano anterior, é upgrade

### Novo Tipo de Email:

Adicionar novo tipo à tabela `email_logs`:
- `subscription_confirmed` - Email de confirmação de assinatura

---

## 📞 Próximos Passos

1. **Você:** Cria o template no Resend
2. **Você:** Me passa o Template ID
3. **Eu:** Implemento a edge function
4. **Eu:** Integro com o webhook do Stripe
5. **Nós:** Testamos o fluxo completo

---

## 🧪 Dados para Teste

Use estes dados para testar o template:

```json
{
  "first_name": "João",
  "last_name": "Silva",
  "email": "joao@exemplo.com",
  "plan_name": "Premium",
  "plan_price": "R$ 159,00",
  "plan_tokens": "12.000.000",
  "is_upgrade": false,
  "subscription_start_date": "02/12/2025",
  "current_period_end": "02/01/2026",
  "app_url": "https://seu-app.com"
}
```
