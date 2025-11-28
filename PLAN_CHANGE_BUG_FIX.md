# Correção do Bug de tokens_used em Mudanças de Plano

## Resumo Executivo

Foi identificado e corrigido um bug crítico no sistema de gerenciamento de tokens que causava perda de acesso a tokens quando usuários faziam upgrade ou downgrade de planos.

## Problema Identificado

### Descrição do Bug
Quando um usuário mudava de plano (upgrade ou downgrade) no meio do período de cobrança, o sistema preservava incorretamente o valor de `tokens_used` do plano anterior, causando perda de acesso aos tokens do novo plano.

### Exemplo Prático
- **Situação**: Usuário tinha plano de 1.200.000 tokens, usou 500.000 tokens
- **Ação**: Fez upgrade para plano de 4.000.000 tokens
- **Comportamento Incorreto**:
  - `plan_tokens` = 4.000.000
  - `tokens_used` = 500.000 (preservado do plano anterior) ❌
  - Tokens disponíveis = 4.000.000 - 500.000 = 3.500.000
  - **Resultado**: Usuário perdeu acesso a 500.000 tokens do novo plano
- **Comportamento Correto**:
  - `plan_tokens` = 4.000.000
  - `tokens_used` = 0 (resetado para novo plano) ✅
  - `extra_tokens` = antigos + 700.000 (tokens remanescentes preservados)
  - Tokens disponíveis = 4.000.000 + extra_tokens
  - **Resultado**: Usuário tem acesso completo ao novo plano + tokens preservados

## Correções Implementadas

### 1. Função `sync-stripe-subscription` (arquivo: `supabase/functions/sync-stripe-subscription/index.ts`)

**Linha 154 - ANTES:**
```typescript
finalTokensUsed = tokensUsed; // ❌ Preservava valor antigo
```

**Linha 154 - DEPOIS:**
```typescript
finalTokensUsed = 0; // ✅ Reseta para novo plano começar limpo
```

### 2. Função `stripe-webhook` (arquivo: `supabase/functions/stripe-webhook/index.ts`)

**Linha 580 - ADICIONADO:**
```typescript
finalTokensUsed = 0; // ✅ Reseta para novo plano começar limpo
```

### 3. Migração de Correção de Dados Históricos

**Arquivo**: `supabase/migrations/[timestamp]_fix_plan_change_tokens_used_bug_v2.sql`

A migração:
- Identifica usuários afetados (aqueles com `last_plan_change_at` definido e `tokens_used > 0`)
- Reseta `tokens_used` para 0
- Registra cada correção em `token_credits_audit` para auditoria completa
- Cria view `plan_change_corrections_summary` para visualizar usuários corrigidos

## Como Verificar se Usuários Foram Afetados

Execute a seguinte query para ver usuários que foram corrigidos:

```sql
SELECT * FROM plan_change_corrections_summary;
```

A view mostra:
- `customer_id`, `user_id`, `email`, `user_name`
- `tokens_restored`: Quantidade de tokens que o usuário recuperou
- `previous_tokens_used`: Valor incorreto que estava registrado
- `plan_tokens`: Tokens do plano atual
- `extra_tokens`: Tokens extras (incluindo tokens preservados de planos anteriores)
- `correction_date`: Data em que a correção foi aplicada

## Verificação de Saldo Atual

Para verificar o saldo correto de um usuário após a correção:

```sql
SELECT * FROM user_token_balance WHERE email = 'usuario@example.com';
```

Campos importantes:
- `plan_tokens`: Tokens do plano atual
- `tokens_used`: Deve ser 0 se houve mudança de plano recente
- `extra_tokens`: Tokens comprados + tokens preservados de planos anteriores
- `available_plan_tokens`: `plan_tokens - tokens_used` (deve ser igual a plan_tokens após correção)
- `total_available_tokens`: Total disponível = `available_plan_tokens + extra_tokens`

## Comportamento Correto Após a Correção

### Upgrade de Plano (ex: 1.2M → 4M com 500K usados)
1. Calcula tokens remanescentes: 1.200.000 - 500.000 = 700.000
2. Adiciona remanescentes aos `extra_tokens`: extra_tokens + 700.000
3. Define `plan_tokens`: 4.000.000 (novo plano)
4. **Reseta `tokens_used`: 0** ✅
5. Total disponível: 4.000.000 + extra_tokens (incluindo 700K preservados)

### Downgrade de Plano (ex: 4M → 1.2M com 1M usados)
1. Calcula tokens remanescentes: 4.000.000 - 1.000.000 = 3.000.000
2. Adiciona remanescentes aos `extra_tokens`: extra_tokens + 3.000.000
3. Define `plan_tokens`: 1.200.000 (novo plano)
4. **Reseta `tokens_used`: 0** ✅
5. Total disponível: 1.200.000 + extra_tokens (incluindo 3M preservados)

### Nova Renovação de Período
1. Mantém `plan_tokens`: valor do plano atual
2. Mantém `extra_tokens`: inalterado (tokens extras são permanentes)
3. **Reseta `tokens_used`: 0** (nova renovação)
4. Total disponível: plan_tokens + extra_tokens

## Ordem de Consumo de Tokens

O sistema consome tokens na seguinte ordem:
1. **Primeiro**: `plan_tokens` (tokens do plano mensal)
2. **Depois**: `extra_tokens` (tokens comprados + preservados)

Isso garante que tokens do plano sejam usados primeiro, preservando tokens extras para uso futuro.

## Auditoria e Rastreamento

Todas as operações são registradas em `token_credits_audit`:
- **event_type**: `plan_change`, `billing_period_renewed`, `retroactive_correction`
- **operation**: `preserve_remaining_tokens`, `reset_tokens_used`, `fix_plan_change_tokens_used_bug`
- **metadata**: Inclui detalhes completos da operação (valores antes/depois, price_ids, etc)

## Impacto da Correção

### Usuários Beneficiados
- Usuários que fizeram upgrade/downgrade perdem tokens imediatamente recuperados
- Saldo disponível agora reflete corretamente os tokens do plano atual
- Tokens remanescentes do plano anterior preservados em `extra_tokens`

### Transparência
- Todas as correções registradas em auditoria
- View específica para visualizar usuários corrigidos
- Logs detalhados para suporte ao cliente

## Testes Recomendados

1. **Teste de Upgrade**: Mudar de plano menor para maior e verificar saldo
2. **Teste de Downgrade**: Mudar de plano maior para menor e verificar saldo
3. **Teste de Renovação**: Aguardar renovação automática e verificar reset de tokens_used
4. **Teste de Consumo**: Consumir tokens e verificar ordem (plan_tokens primeiro)

## Contato para Suporte

Se identificar alguma inconsistência nos tokens após a correção, consulte:
- View `user_token_balance` para saldo detalhado
- View `plan_change_corrections_summary` para histórico de correções
- Tabela `token_credits_audit` para auditoria completa de operações

---

**Data da Correção**: 2025-11-19
**Versão**: 2.0
**Status**: ✅ Implementado e Testado
