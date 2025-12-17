# Edge Functions Overview

Todas as Edge Functions do sistema.

## Análise

### start-analysis
Inicia análise de um processo.

**Auth:** Required (user token)
**Input:** `{ processoId: string }`
**Output:** `{ success: boolean, geminiFileUri?: string }`

### upload-to-gemini
Faz upload de PDF para Gemini File API.

**Auth:** Service role
**Input:** `{ processoId: string, pdfPath: string }`
**Output:** `{ fileUri: string }`

### process-next-prompt
Worker que processa próximo chunk pendente.

**Auth:** Service role
**Input:** None (worker loop)
**Output:** `{ processedCount: number }`

### consolidation-worker
Consolida resultados parciais.

**Auth:** Service role
**Input:** `{ processoId: string }`
**Output:** `{ success: boolean }`

## Chat

### chat-with-processo
Chat sobre processo analisado.

**Auth:** Required (user token)
**Input:** `{ processoId: string, message: string }`
**Output:** `Stream<string>` (Server-sent events)

### process-audio-message
Converte áudio para texto (speech-to-text).

**Auth:** Required
**Input:** `{ audioBase64: string }`
**Output:** `{ text: string }`

## Stripe/Pagamentos

### stripe-checkout
Cria session de checkout.

**Auth:** Required
**Input:** `{ priceId: string, type: 'subscription' | 'tokens' }`
**Output:** `{ url: string }`

### stripe-webhook
Processa eventos do Stripe.

**Auth:** Webhook signature
**Input:** Stripe event
**Output:** `{ received: true }`

### cancel-subscription
Cancela assinatura do usuário.

**Auth:** Required
**Input:** None
**Output:** `{ success: boolean }`

### sync-stripe-subscription
Sincroniza dados locais com Stripe.

**Auth:** Service role / Admin
**Input:** `{ userId: string }`
**Output:** `{ synced: boolean }`

## Email

### send-confirmation-email
Email de confirmação de cadastro.

**Auth:** Service role
**Input:** `{ email: string, confirmUrl: string }`

### send-email-process-completed
Notifica conclusão de análise.

**Auth:** Service role
**Input:** `{ userId: string, processoId: string }`

### send-tokens-limit
Alerta de limite de tokens.

**Auth:** Service role
**Input:** `{ userId: string, percentage: number }`

### send-subscription-confirmation-email
Confirma nova assinatura.

**Auth:** Service role
**Input:** `{ userId: string, tier: string }`

## Admin

### admin-delete-user
Deleta usuário e todos seus dados.

**Auth:** Admin only
**Input:** `{ userId: string }`
**Output:** `{ deleted: true }`

### get-billing-analytics
Analytics de faturamento.

**Auth:** Admin only
**Input:** `{ startDate?: string, endDate?: string }`
**Output:** `{ revenue, users, subscriptions, ... }`

## Monitoring

### health-check-worker
Verifica saúde do sistema.

**Auth:** Service role (cron)
**Output:** `{ healthy: boolean, issues: Issue[] }`

### recover-stuck-processes
Recupera processos travados.

**Auth:** Service role (cron)
**Output:** `{ recovered: number }`

### auto-restart-failed-chunks
Reinicia chunks falhados.

**Auth:** Service role (cron)
**Output:** `{ restarted: number }`

## Diagnostic

### diagnose-stripe-customer
Diagnostica problemas com customer Stripe.

**Auth:** Admin
**Input:** `{ userId: string }`
**Output:** `{ diagnosis: object }`

### diagnose-dead-letter-chunks
Analisa chunks em dead letter queue.

**Auth:** Admin
**Output:** `{ chunks: Chunk[] }`

---

[← Voltar ao API Reference](./README.md)
