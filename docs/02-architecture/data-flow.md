# Fluxo de Dados

Documentação detalhada de como os dados fluem através do sistema.

## Índice

- [1. Fluxo de Autenticação](#1-fluxo-de-autenticação)
- [2. Fluxo de Upload e Análise](#2-fluxo-de-upload-e-análise)
- [3. Fluxo de Consolidação](#3-fluxo-de-consolidação)
- [4. Fluxo de Chat](#4-fluxo-de-chat)
- [5. Fluxo de Tokens](#5-fluxo-de-tokens)
- [6. Fluxo de Pagamentos](#6-fluxo-de-pagamentos)

---

## 1. Fluxo de Autenticação

### 1.1. Sign Up (Registro)

```
┌──────────┐         ┌──────────┐         ┌──────────┐         ┌──────────┐
│  User    │         │ Frontend │         │ Supabase │         │ Database │
│          │         │          │         │   Auth   │         │          │
└────┬─────┘         └────┬─────┘         └────┬─────┘         └────┬─────┘
     │                    │                    │                    │
     │ Fill registration  │                    │                    │
     │ form              │                    │                    │
     ├──────────────────>│                    │                    │
     │                    │                    │                    │
     │                    │ Validate input     │                    │
     │                    │ (client-side)      │                    │
     │                    │                    │                    │
     │                    │ signUp(email, pwd) │                    │
     │                    ├───────────────────>│                    │
     │                    │                    │                    │
     │                    │                    │ Create user        │
     │                    │                    ├───────────────────>│
     │                    │                    │                    │
     │                    │                    │ User created       │
     │                    │                    │<───────────────────┤
     │                    │                    │                    │
     │                    │                    │ Trigger:           │
     │                    │                    │ on_auth_user_created
     │                    │                    ├───────────────────>│
     │                    │                    │  - Create token_balance
     │                    │                    │  - Create preferences
     │                    │                    │                    │
     │                    │ Success + session  │                    │
     │                    │<───────────────────┤                    │
     │                    │                    │                    │
     │                    │ Send verification  │                    │
     │                    │ email (async)      │                    │
     │                    │                    │                    │
     │ Redirect to        │                    │                    │
     │ dashboard          │                    │                    │
     │<───────────────────┤                    │                    │
```

**Etapas:**
1. Usuário preenche formulário
2. Frontend valida (senha forte, email válido)
3. Frontend chama `supabase.auth.signUp()`
4. Supabase Auth cria usuário em `auth.users`
5. Trigger automático cria registros relacionados:
   - `token_balance` com saldo inicial (10k tokens Free)
   - `user_preferences` com defaults
6. Email de verificação enviado (se habilitado)
7. Sessão retornada e usuário logado
8. Redirect para dashboard

### 1.2. Sign In (Login)

```
User → Frontend → Supabase Auth → Verify credentials
                                  ↓
                              Generate JWT
                                  ↓
                          Return session token
                                  ↓
                          Store in localStorage
                                  ↓
                            User logged in
```

### 1.3. Token Refresh

```
Token expires (1 hour)
        ↓
Auto refresh triggered
        ↓
Call refresh endpoint with refresh token
        ↓
New access token generated
        ↓
Update session
```

---

## 2. Fluxo de Upload e Análise

### 2.1. Upload de PDF

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  User    │    │ Frontend │    │  Storage │    │ Database │    │  Gemini  │
└────┬─────┘    └────┬─────┘    └────┬─────┘    └────┬─────┘    └────┬─────┘
     │               │               │               │               │
     │ Select PDF    │               │               │               │
     ├──────────────>│               │               │               │
     │               │               │               │               │
     │               │ Validate:     │               │               │
     │               │ - Type (PDF)  │               │               │
     │               │ - Size(<500MB)│               │               │
     │               │ - Pages(<5000)│               │               │
     │               │               │               │               │
     │               │ Upload PDF    │               │               │
     │               ├──────────────>│               │               │
     │               │               │               │               │
     │               │ File uploaded │               │               │
     │               │<──────────────┤               │               │
     │               │               │               │               │
     │               │ Create processo record         │               │
     │               ├───────────────────────────────>│               │
     │               │               │               │               │
     │               │ Processo created               │               │
     │               │<───────────────────────────────┤               │
     │               │               │               │               │
     │               │ Call start-analysis function   │               │
     │               ├───────────────────────────────>│               │
     │               │               │               │               │
```

### 2.2. Processamento Inicial

```
start-analysis Edge Function
        ↓
1. Load PDF from storage
        ↓
2. Extract text using pdf.js
        ↓
3. Calculate total pages and tokens
        ↓
4. Check user token balance
        ↓
5. Reserve tokens (token_reservations)
        ↓
6. Split text into chunks (~50k tokens each)
        ↓
7. Save chunks to database
        ↓
8. Upload PDF to Gemini File API
        ↓
9. Save gemini_file_uri to processo
        ↓
10. Update status to 'processing'
        ↓
11. Trigger process-next-prompt worker
```

**Chunks criados:**
```sql
INSERT INTO chunks (processo_id, content, sequence, status)
VALUES
  (uuid, 'chunk 1 content...', 1, 'pending'),
  (uuid, 'chunk 2 content...', 2, 'pending'),
  ...
```

### 2.3. Processamento de Prompts

```
process-next-prompt Worker (Loop contínuo)
        ↓
1. Query: SELECT next pending chunk + prompt
   FROM chunks
   WHERE status = 'pending'
   LIMIT 1
        ↓
2. If no pending → Exit
        ↓
3. Update chunk status to 'processing'
        ↓
4. Build context:
   - Gemini file URI
   - System prompt
   - Analysis type prompt
   - Chunk content
        ↓
5. Call Gemini API
        ↓
6. Parse JSON response
        ↓
7. Validate structure
        ↓
8. Save to analysis_results
        ↓
9. Update chunk status to 'completed'
        ↓
10. Update processo progress
        ↓
11. Repeat from step 1
```

**Exemplo de query ao Gemini:**
```javascript
{
  contents: [
    {
      role: 'user',
      parts: [
        {
          fileData: {
            mimeType: 'application/pdf',
            fileUri: 'gs://gemini-file-api/xxx'
          }
        },
        {
          text: `${systemPrompt}\n\n${analysisPrompt}\n\n${chunkContent}`
        }
      ]
    }
  ]
}
```

### 2.4. Tratamento de Erros

```
Error during processing
        ↓
Is retry_count < 3?
        ├─ YES → Update retry_count + 1
        │        Set status back to 'pending'
        │        Wait backoff time
        │        Retry
        │
        └─ NO → Set status to 'failed'
                Add to dead_letter queue
                Mark dead_letter_at timestamp
                Send admin notification
```

---

## 3. Fluxo de Consolidação

```
Trigger: All chunks of a processo completed
        ↓
consolidation-worker Edge Function
        ↓
1. Load all analysis_results for processo
        ↓
2. Group by analysis_type
        ↓
3. For each type:
   a. Extract partial results from chunks
   b. Build consolidation prompt
   c. Call Gemini to merge results
   d. Validate merged JSON
   e. Save final result
        ↓
4. Update processo status to 'completed'
        ↓
5. Deduct reserved tokens
        ↓
6. Send completion email
        ↓
7. Create notification
```

**Consolidation prompt example:**
```
Você recebeu 3 análises parciais do tipo "Visão Geral":

Análise 1 (páginas 1-100):
{...}

Análise 2 (páginas 101-200):
{...}

Análise 3 (páginas 201-300):
{...}

Consolide essas análises em uma única análise final,
removendo duplicações e organizando as informações.
```

---

## 4. Fluxo de Chat

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  User    │    │ Frontend │    │  Backend │    │  Gemini  │
└────┬─────┘    └────┬─────┘    └────┬─────┘    └────┬─────┘
     │               │               │               │
     │ Type message  │               │               │
     ├──────────────>│               │               │
     │               │               │               │
     │               │ Check tokens  │               │
     │               ├──────────────>│               │
     │               │               │               │
     │               │ OK (has tokens)               │
     │               │<──────────────┤               │
     │               │               │               │
     │               │ Reserve tokens│               │
     │               ├──────────────>│               │
     │               │               │               │
     │               │ Call chat     │               │
     │               │ function      │               │
     │               ├──────────────>│               │
     │               │               │               │
     │               │               │ Build context:│
     │               │               │ - Process data│
     │               │               │ - Chat history│
     │               │               │ - User msg    │
     │               │               │               │
     │               │               │ Call Gemini   │
     │               │               ├──────────────>│
     │               │               │               │
     │               │               │ Stream response
     │               │               │<──────────────┤
     │               │               │               │
     │               │ Stream to user│               │
     │               │<──────────────┤               │
     │               │               │               │
     │ See response  │               │               │
     │ typing effect │               │               │
     │<──────────────┤               │               │
     │               │               │               │
     │               │               │ Save messages │
     │               │               │ Deduct tokens │
```

**Context building:**
```javascript
{
  systemPrompt: "Você é um assistente jurídico...",
  processData: {
    numero: "0001234-56.2024.8.00.0001",
    partes: [...],
    analysisResults: [...] // 10 tipos de análise
  },
  chatHistory: [
    { role: 'user', content: 'Qual o valor da causa?' },
    { role: 'assistant', content: 'O valor é...' }
  ],
  newMessage: "Quais são os prazos pendentes?"
}
```

---

## 5. Fluxo de Tokens

### 5.1. Reserva de Tokens

```
Start analysis requested
        ↓
Calculate estimated tokens needed
        ↓
Check current balance
        ↓
Balance sufficient?
        ├─ YES → Create token_reservation
        │        Reduce available_balance (atomic)
        │        Start analysis
        │
        └─ NO → Return error: insufficient tokens
                Show upgrade/purchase modal
```

### 5.2. Dedução de Tokens

```
Analysis completed
        ↓
Calculate actual tokens used
        ↓
Find active reservation
        ↓
Actual < Reserved?
        ├─ YES → Refund difference
        │        Add back to balance
        │        Create refund transaction
        │
        └─ NO → Deduct additional if over
                (should not happen, but handle)
        ↓
Mark reservation as completed
        ↓
Create token_transaction record
```

### 5.3. Renovação Mensal

```
Cron job: Daily at 00:00 UTC
        ↓
For each active subscription:
        ↓
1. Check if renewal date (day 1 of month)
        ↓
2. Calculate tokens to add:
   - Base plan tokens
   - Rollover from prev month (30% max)
        ↓
3. Add tokens to balance
        ↓
4. Create transaction record
        ↓
5. Send notification email
```

---

## 6. Fluxo de Pagamentos

### 6.1. Checkout (Assinatura ou Tokens)

```
User clicks "Upgrade" or "Buy Tokens"
        ↓
Frontend calls stripe-checkout function
        ↓
Edge Function:
  1. Validate user
  2. Get Stripe customer (or create)
  3. Create checkout session:
     - line_items (plan or token package)
     - customer_email
     - success_url
     - cancel_url
     - metadata (user_id, type)
        ↓
Return checkout URL
        ↓
Redirect user to Stripe
        ↓
User completes payment
        ↓
Stripe redirects back to success_url
```

### 6.2. Webhook Processing

```
Stripe sends webhook event
        ↓
stripe-webhook Edge Function
        ↓
1. Verify webhook signature
        ↓
2. Parse event type:

   ├─ checkout.session.completed
   │  ├─ subscription → Create subscription record
   │  │                 Add monthly tokens
   │  │                 Send confirmation email
   │  │
   │  └─ payment → Add purchased tokens
   │                Create transaction
   │                Send confirmation email
   │
   ├─ invoice.payment_succeeded
   │  └─ Monthly renewal
   │     Add tokens for new period
   │     Send invoice email
   │
   ├─ invoice.payment_failed
   │  └─ Send payment failed email
   │     Mark subscription at risk
   │
   └─ customer.subscription.deleted
      └─ Cancel subscription
         Send cancellation email
         Revert to Free plan
```

### 6.3. Sincronização

```
Manual sync triggered (admin or automatic check)
        ↓
sync-stripe-subscription function
        ↓
1. Get subscription from Stripe API
        ↓
2. Compare with local database
        ↓
3. Differences found?
   ├─ YES → Update local data
   │        Adjust token balance if needed
   │        Create audit log
   │
   └─ NO → Mark as synced
```

---

## 7. Fluxo de Compartilhamento

```
User A shares processo with User B
        ↓
Frontend calls shareProcess()
        ↓
1. Create processo_shares record:
   - processo_id
   - shared_by_user_id (A)
   - shared_with_email (B)
   - permission ('readonly' or 'fullaccess')
        ↓
2. Check if User B exists
   ├─ YES → Send in-app notification
   │        Send email notification
   │
   └─ NO → Send invite email
           Create pending invitation
        ↓
3. Update processo.is_shared flag
        ↓
User B logs in
        ↓
RLS policy grants access to shared processo
        ↓
User B can view (and edit if fullaccess)
```

---

## 8. Fluxo de Monitoramento

### 8.1. Health Check

```
Cron job: Every 5 minutes
        ↓
health-check-worker
        ↓
1. Check processos stuck in 'processing'
   (updated_at > 30 min ago)
        ↓
2. Check chunks in dead letter queue
        ↓
3. Check failed chunks (retry_count >= 3)
        ↓
Issues found?
        ├─ YES → Send admin email
        │        Log to monitoring
        │        Trigger recovery if possible
        │
        └─ NO → Log "All OK"
```

### 8.2. Recovery

```
recover-stuck-processes function
        ↓
For each stuck processo:
        ↓
1. Check last activity
        ↓
2. Identify stuck stage
        ↓
3. Determine action:
   ├─ Worker died → Restart processing
   ├─ Chunk failed → Move to dead letter
   └─ Unknown → Manual review needed
        ↓
4. Execute recovery
        ↓
5. Log recovery action
        ↓
6. Notify user if resolved
```

---

## Links Relacionados

- [Visão Geral da Arquitetura](./overview.md)
- [Sistema de Análise](../05-analysis/overview.md)
- [Database Schema](../03-database/schema.md)
- [API Reference](../06-api-reference/README.md)

---

[← Anterior: Overview](./overview.md) | [Próximo: Decisões Arquiteturais →](./decisions.md)
