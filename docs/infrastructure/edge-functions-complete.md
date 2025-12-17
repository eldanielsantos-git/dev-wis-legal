# Edge Functions Completas - Todas as 49 Functions

Documentação detalhada e organizada de todas as Edge Functions do sistema.

## Índice por Categoria

- [Análise e Processamento (11)](#análise-e-processamento)
- [Monitoramento e Recuperação (10)](#monitoramento-e-recuperação)
- [Emails (15)](#emails-15-tipos)
- [Stripe e Pagamentos (7)](#stripe-e-pagamentos)
- [Administração (4)](#administração)
- [Chat e IA (2)](#chat-e-ia)

---

## Análise e Processamento

### 1. start-analysis
**Função:** Inicia análise de processo pequeno (< 1000 páginas)

**Auth:** User token
**Input:**
```typescript
{
  processoId: string;
  analysisType?: 'simple' | 'complex';
}
```
**Output:**
```typescript
{
  success: boolean;
  geminiFileUri?: string;
  totalChunks: number;
}
```

**Fluxo:**
1. Valida usuário e saldo de tokens
2. Carrega PDF do storage
3. Extrai texto com pdf.js
4. Calcula tokens necessários
5. Reserva tokens
6. Cria chunks (~50k tokens cada)
7. Upload para Gemini File API
8. Salva gemini_file_uri
9. Trigger process-next-prompt worker

---

### 2. start-analysis-complex
**Função:** Inicia análise de processo grande (> 1000 páginas)

**Auth:** User token
**Input:**
```typescript
{
  processoId: string;
}
```

**Diferenças vs start-analysis:**
- Chunk size maior (100k tokens)
- Processing strategy diferente
- Worker dedicado (process-complex-worker)
- Timeout estendido

---

### 3. process-next-prompt
**Função:** Worker principal que processa chunks pendentes em loop

**Auth:** Service role (chamado internamente)
**Input:** None (loop automático)

**Lógica:**
```typescript
while (true) {
  // 1. Get next pending chunk
  const chunk = await getNextPendingChunk();
  if (!chunk) break;

  // 2. Mark as processing
  await markProcessing(chunk.id);

  // 3. Build prompt
  const prompt = buildAnalysisPrompt(chunk);

  // 4. Call Gemini
  const result = await gemini.generateContent({
    contents: [
      {
        role: 'user',
        parts: [
          { fileData: { fileUri: geminiFileUri } },
          { text: prompt }
        ]
      }
    ]
  });

  // 5. Parse and save
  const parsed = parseJSON(result.text());
  await saveAnalysisResult(chunk.id, parsed);

  // 6. Mark complete
  await markCompleted(chunk.id);

  // 7. Update processo progress
  await updateProgress(processoId);
}
```

---

### 4. process-complex-worker
**Função:** Worker especializado para processos complexos

Similar ao process-next-prompt mas com:
- Chunks maiores
- Timeout maior
- Retry logic mais agressivo
- Consolidation diferente

---

### 5. consolidation-worker
**Função:** Consolida resultados parciais em análises finais

**Triggered:** Quando todos os chunks completam

**Lógica:**
```typescript
// 1. Load all partial results
const partials = await getPartialResults(processoId);

// 2. Group by analysis type
const grouped = groupByType(partials);

// 3. For each type, consolidate with AI
for (const [type, results] of Object.entries(grouped)) {
  const prompt = buildConsolidationPrompt(type, results);
  const consolidated = await gemini.generateContent(prompt);

  await saveFinalResult(processoId, type, consolidated);
}

// 4. Mark complete
await markProcessoCompleted(processoId);

// 5. Deduct tokens
await deductReservedTokens(processoId);

// 6. Send notification
await sendCompletionEmail(userId);
```

---

### 6. upload-to-gemini
**Função:** Faz upload de PDF para Gemini File API

**Auth:** Service role
**Input:**
```typescript
{
  processoId: string;
  pdfPath: string;
}
```
**Output:**
```typescript
{
  fileUri: string;
  mimeType: string;
}
```

**Gemini API Call:**
```typescript
const file = await GoogleAIFileManager.uploadFile({
  file: pdfBuffer,
  mimeType: 'application/pdf',
  displayName: `processo-${processoId}`
});

return file.uri; // gs://generativeai-uploads/...
```

---

### 7. populate-pdf-base64
**Função:** Helper para popular campo pdf_base64 (legacy)

**Nota:** Função de migração, pode ser removida após migration completa.

---

### 8. create-upload-url
**Função:** Cria URL assinada para upload direto de PDF

**Auth:** User token
**Input:**
```typescript
{
  fileName: string;
  fileSize: number;
}
```
**Output:**
```typescript
{
  uploadUrl: string;
  path: string;
  expiresIn: number;
}
```

---

### 9. retry-chunk-uploads
**Função:** Retenta uploads de chunks para Gemini que falharam

**Auth:** Service role / Admin

---

### 10. restart-stage-manual
**Função:** Reinicia manualmente um stage específico de análise

**Auth:** Admin
**Input:**
```typescript
{
  processoId: string;
  stage: 'extraction' | 'chunking' | 'analysis' | 'consolidation';
}
```

---

### 11. restart-stuck-analysis
**Função:** Reinicia análise completamente travada

**Auth:** Admin

---

## Monitoramento e Recuperação

### 12. health-check-worker
**Função:** Verifica saúde geral do sistema

**Chamado por:** GitHub Action (a cada 5 min)

**Checks:**
1. Processos travados (> 30 min)
2. Chunks em dead letter (> 5)
3. Taxa de falha alta (> 10%)
4. Workers responsivos
5. Database connectivity

**Output:**
```typescript
{
  healthy: boolean;
  issues: string[];
  metrics: {
    stuckProcessos: number;
    deadLetterChunks: number;
    failureRate: number;
  };
}
```

---

### 13. process-stuck-processos
**Função:** Recupera processos travados

**Chamado por:** GitHub Action (a cada 1 min)

**Lógica:**
- Busca processos em "processing" por > 30 min
- Verifica se há chunks pendentes
- Se sim: trigger worker
- Se não: trigger consolidation

---

### 14. recover-stuck-chunks
**Função:** Recupera chunks travados em "processing"

**Chamado por:** GitHub Action (a cada 5 min)

**Lógica:**
- Busca chunks em "processing" por > 10 min
- Reset para "pending"
- Incrementa retry_count
- Trigger worker

---

### 15. recover-stuck-processes
**Função:** Recuperação avançada de processos

**Chamado por:** GitHub Action (a cada 10 min)

**Lógica:**
- Identifica causa raiz
- Toma ação apropriada
- Log de recovery
- Notifica usuário se resolvido

---

### 16. auto-restart-failed-chunks
**Função:** Reinicia automaticamente chunks falhados

**Chamado por:** GitHub Action (a cada 3 min)

**Lógica:**
- Busca chunks com status='failed' e retry_count < 3
- Reset para 'pending'
- Incrementa retry_count
- Trigger worker

---

### 17. diagnose-dead-letter-chunks
**Função:** Analisa chunks em dead letter queue

**Auth:** Admin
**Output:**
```typescript
{
  chunks: Array<{
    id: string;
    processoId: string;
    errorMessage: string;
    retryCount: number;
    deadLetterAt: string;
  }>;
  summary: {
    total: number;
    byError: Record<string, number>;
  };
}
```

---

### 18-21. tier-system-health-check, download-all-storage, etc.

Outras funções de diagnóstico e manutenção.

---

## Emails (15 Tipos)

### 22. send-confirmation-email
**Função:** Email de confirmação de cadastro

**Triggered:** Após signup
**Template:** Confirmation email com link
**Variáveis:**
- `confirmationUrl`
- `userEmail`

---

### 23. send-reset-password-email
**Função:** Email de reset de senha

**Triggered:** User solicita reset
**Template:** Password reset com link temporário
**Variáveis:**
- `resetUrl`
- `expiresIn: '1 hour'`

---

### 24. send-email-process-completed
**Função:** Notifica conclusão de análise

**Triggered:** Processo completado
**Template:**
```
Olá {userName},

Sua análise do processo {processoNumero} foi concluída!

🎯 Total de análises: 10
⏱️ Tempo de processamento: {duration}
💎 Tokens utilizados: {tokensUsed}

[Ver Resultado]
```

---

### 25. send-tokens-limit
**Função:** Alerta de limite de tokens

**Triggered:**
- 75% de tokens consumidos
- 100% de tokens consumidos

**Template:** Aviso + CTA para comprar mais

---

### 26. send-subscription-confirmation-email
**Função:** Confirma nova assinatura

**Triggered:** Stripe checkout.session.completed (subscription)
**Variáveis:**
- `tier` (Pro, Enterprise)
- `monthlyTokens`
- `price`
- `nextBillingDate`

---

### 27. send-subscription-upgrade-email
**Função:** Confirma upgrade de plano

---

### 28. send-subscription-downgrade-email
**Função:** Confirma downgrade de plano

---

### 29. send-subscription-cancellation-email
**Função:** Confirma cancelamento

**Template:**
```
Sua assinatura {tier} foi cancelada.

Você ainda terá acesso até {endDate}.
Tokens restantes: {remaining}

[Reativar Assinatura]
```

---

### 30. send-payment-failure-email
**Função:** Alerta falha de pagamento

**Triggered:** Stripe invoice.payment_failed

---

### 31. send-token-purchase-email
**Função:** Confirma compra de tokens avulsos

**Variáveis:**
- `tokens` comprados
- `price`
- `newBalance`

---

### 32. send-workspace-invite
**Função:** Convite para workspace

**Template:**
```
{inviterName} convidou você para o workspace "{workspaceName}"

[Aceitar Convite]
```

---

### 33. send-friend-invite
**Função:** Convite de amigo (referral)

**Template:**
```
{friendName} está usando Wis Legal e quer que você experimente!

🎁 Bônus de 5.000 tokens para ambos ao se cadastrar.

[Aceitar Convite]
```

---

### 34. send-change-email
**Função:** Confirma mudança de email

---

### 35. send-admin-analysis-error
**Função:** Notifica admin sobre erro em análise

---

### 36. send-admin-complex-analysis-error
**Função:** Notifica admin sobre erro em análise complexa

---

## Stripe e Pagamentos

### 37. stripe-checkout
**Função:** Cria Stripe Checkout Session

**Auth:** User token
**Input:**
```typescript
{
  priceId: string;
  type: 'subscription' | 'tokens';
  successUrl?: string;
  cancelUrl?: string;
}
```
**Output:**
```typescript
{
  url: string; // Redirect to Stripe
  sessionId: string;
}
```

**Implementação:**
```typescript
const session = await stripe.checkout.sessions.create({
  customer: stripeCustomerId,
  line_items: [{
    price: priceId,
    quantity: 1
  }],
  mode: type === 'subscription' ? 'subscription' : 'payment',
  success_url: successUrl || `${appUrl}/subscription/success`,
  cancel_url: cancelUrl || `${appUrl}/subscription`,
  metadata: {
    userId,
    type
  }
});
```

---

### 38. stripe-webhook
**Função:** Processa eventos do Stripe

**Auth:** Webhook signature verification
**Events Handled:**
- `checkout.session.completed`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

**Lógica checkout.session.completed:**
```typescript
if (session.mode === 'subscription') {
  // Create/update subscription
  await createSubscription(userId, session.subscription);

  // Add monthly tokens
  await addTokens(userId, monthlyTokens, 'subscription');

  // Send email
  await sendSubscriptionConfirmationEmail(userId);
} else {
  // One-time payment (tokens)
  const tokens = getTokensFromPrice(session.amount_total);
  await addTokens(userId, tokens, 'purchase');

  // Send email
  await sendTokenPurchaseEmail(userId, tokens);
}
```

---

### 39. sync-stripe-subscription
**Função:** Sincroniza subscription local com Stripe

**Auth:** Service role / Admin
**Input:**
```typescript
{
  userId: string;
}
```

**Lógica:**
1. Get subscription from Stripe API
2. Compare with local database
3. Update local if different
4. Adjust token balance if needed
5. Create audit log

---

### 40. sync-stripe-coupons
**Função:** Sincroniza coupons do Stripe

---

### 41. sync-stripe-extra-tokens
**Função:** Sincroniza compras de tokens avulsos

---

### 42. force-sync-customer
**Função:** Força sincronização completa de um customer

---

### 43. diagnose-stripe-customer
**Função:** Diagnóstico completo de customer Stripe

**Auth:** Admin
**Output:**
```typescript
{
  customer: StripeCustomer;
  subscriptions: Subscription[];
  invoices: Invoice[];
  paymentMethods: PaymentMethod[];
  localData: {
    subscription: LocalSubscription;
    tokenBalance: TokenBalance;
  };
  issues: string[];
}
```

---

## Administração

### 44. admin-delete-user
**Função:** Deleta usuário e todos seus dados (GDPR)

**Auth:** Admin only
**Input:**
```typescript
{
  userId: string;
  reason?: string;
}
```

**Lógica:**
1. Delete processos (cascade deletes chunks, analysis_results, chat_messages)
2. Delete PDFs from storage
3. Delete token_balance, transactions, reservations
4. Cancel Stripe subscription
5. Delete user from auth.users
6. Create audit log

---

### 45. admin-migrate-users
**Função:** Migração em massa de usuários (data migration)

---

### 46. delete-user-account
**Função:** Usuário deleta própria conta

**Auth:** User token (próprio usuário)

Similar ao admin-delete-user mas:
- User pode deletar apenas própria conta
- Confirmação adicional necessária
- Email de confirmação enviado

---

### 47. update-user-password
**Função:** Admin força atualização de senha

---

## Chat e IA

### 48. chat-with-processo
**Função:** Chat interativo sobre processo analisado

**Auth:** User token
**Input:**
```typescript
{
  processoId: string;
  message: string;
  chatHistoryLimit?: number;
}
```
**Output:** Stream de texto (Server-Sent Events)

**Implementação:**
```typescript
// 1. Reserve tokens
await reserveTokens(userId, estimatedTokens);

// 2. Build context
const context = {
  systemPrompt: await getSystemPrompt(),
  processData: await getProcessData(processoId),
  analysisResults: await getAnalysisResults(processoId),
  chatHistory: await getChatHistory(processoId, limit: 10),
  newMessage: message
};

// 3. Call Gemini with streaming
const stream = await gemini.generateContentStream(context);

// 4. Stream response
for await (const chunk of stream) {
  yield chunk.text();
}

// 5. Save messages
await saveChatMessages(processoId, message, fullResponse);

// 6. Deduct tokens
await deductTokens(userId, actualTokensUsed);
```

---

### 49. process-audio-message
**Função:** Converte áudio em texto (Speech-to-Text)

**Auth:** User token
**Input:**
```typescript
{
  audioBase64: string;
  language?: 'pt-BR';
}
```
**Output:**
```typescript
{
  text: string;
  confidence: number;
}
```

**Implementação:** Google Speech-to-Text API

---

## Sumário de Uso

**Total: 49 Edge Functions**

| Categoria | Quantidade |
|-----------|------------|
| Análise e Processamento | 11 |
| Monitoramento e Recuperação | 10 |
| Emails | 15 |
| Stripe e Pagamentos | 7 |
| Administração | 4 |
| Chat e IA | 2 |

---

## Deployment

Todas as Edge Functions são deployadas via:

```bash
# Deploy todas
supabase functions deploy

# Deploy uma específica
supabase functions deploy chat-with-processo
```

## Secrets Necessários

```bash
supabase secrets set GEMINI_API_KEY=xxx
supabase secrets set STRIPE_SECRET_KEY=xxx
supabase secrets set RESEND_API_KEY=xxx
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=xxx
```

---

[← Voltar à Infraestrutura](./README.md) | [Ver GitHub Actions →](./github-actions-monitoring.md)
