# 05 - Edge Functions

## 📋 Visão Geral

As Edge Functions são funções serverless executadas em runtime Deno, deployadas globalmente pela Supabase. Elas servem como camada de lógica de negócio entre o frontend e integrações externas.

## 🚀 Lista de Edge Functions

Total: **15 Edge Functions**

### Processamento de Análise
1. **start-analysis** - Inicia análise de processo
2. **process-next-prompt** - Processa próximo prompt na fila
3. **upload-to-gemini** - Faz upload de PDF para Gemini File API

### Chat e Áudio
4. **chat-with-processo** - Chat com IA sobre processo
5. **process-audio-message** - Transcreve e processa mensagem de áudio

### Upload e Storage
6. **create-upload-url** - Gera URL assinada para upload
7. **populate-pdf-base64** - Popula campo base64 de PDFs

### Stripe e Pagamentos
8. **stripe-checkout** - Cria sessão de checkout
9. **stripe-webhook** - Processa webhooks do Stripe
10. **sync-stripe-subscription** - Sincroniza assinatura
11. **sync-stripe-coupons** - Sincroniza cupons
12. **sync-stripe-extra-tokens** - Sincroniza tokens extras
13. **cancel-subscription** - Cancela assinatura

### Administração
14. **get-billing-analytics** - Retorna analytics de billing
15. **delete-user-account** - Deleta conta completa do usuário

## 📝 Documentação Detalhada

### 1. start-analysis

**Propósito:** Inicializa o processo de análise de um documento.

**Fluxo:**
```
1. Recebe processo_id
2. Valida se processo existe e está em status 'created'
3. Verifica se é processo chunkeado
4. Se chunkeado:
   - Upload de cada chunk para Gemini File API
   - Armazena URIs dos arquivos
5. Se não chunkeado:
   - Upload do PDF completo para Gemini
6. Atualiza status para 'analyzing'
7. Retorna sucesso
```

**Request:**
```typescript
POST /functions/v1/start-analysis
{
  "processo_id": "uuid"
}
```

**Response:**
```typescript
{
  "success": true,
  "processo_id": "uuid",
  "status": "analyzing"
}
```

**Código Simplificado:**
```typescript
const { processo_id } = await req.json();

const { data: processo } = await supabase
  .from('processos')
  .select('*')
  .eq('id', processo_id)
  .single();

if (processo.status !== 'created') {
  throw new Error('Processo já em análise');
}

// Upload para Gemini File API
const response = await fetch(`${supabaseUrl}/functions/v1/upload-to-gemini`, {
  method: 'POST',
  body: JSON.stringify({ processo_id })
});

// Atualiza status
await supabase
  .from('processos')
  .update({
    status: 'analyzing',
    analysis_started_at: new Date().toISOString()
  })
  .eq('id', processo_id);
```

### 2. process-next-prompt

**Propósito:** Processa o próximo prompt na fila de análise sequencial.

**Fluxo:**
```
1. Busca processo e próximo prompt pendente
2. Carrega texto completo do processo
3. Carrega modelo ativo (admin_system_models)
4. Chama Gemini API com prompt + contexto
5. Faz parsing do JSON retornado (5 estratégias)
6. Salva resultado em analysis_results
7. Atualiza current_prompt_number
8. Se foi último prompt, marca como completed
9. Debita tokens do usuário
10. Retorna resultado
```

**Request:**
```typescript
POST /functions/v1/process-next-prompt
{
  "processo_id": "uuid"
}
```

**Response:**
```typescript
{
  "completed": false,
  "prompt_title": "Visão Geral do Processo",
  "execution_order": 1,
  "execution_time_ms": 3245,
  "tokens_used": 15432
}
// OU
{
  "completed": true,
  "message": "Análise concluída"
}
```

**Parsing JSON (5 Estratégias):**
```typescript
// Estratégia 1: JSON puro
try {
  return JSON.parse(text);
} catch {}

// Estratégia 2: Remove markdown code blocks
try {
  const cleaned = text.replace(/```json\n?|\n?```/g, '');
  return JSON.parse(cleaned);
} catch {}

// Estratégia 3: Extrai primeiro objeto JSON
try {
  const match = text.match(/\{[\s\S]*\}/);
  return JSON.parse(match[0]);
} catch {}

// Estratégia 4: Extrai entre marcadores
try {
  const match = text.match(/\{[\s\S]*"citations_index"[\s\S]*?\]/);
  return JSON.parse(match[0] + '}');
} catch {}

// Estratégia 5: Fallback estrutura mínima
return {
  error: "Falha no parsing",
  raw_response: text.substring(0, 500)
};
```

### 3. upload-to-gemini

**Propósito:** Faz upload de PDF para Gemini File API.

**Fluxo:**
```
1. Busca PDF (base64 ou reconstrói de chunks)
2. Converte para buffer
3. Upload para Gemini File API
4. Aguarda processamento (state = 'ACTIVE')
5. Salva file_uri no banco
6. Retorna URI
```

**Request:**
```typescript
POST /functions/v1/upload-to-gemini
{
  "processo_id": "uuid",
  "chunk_id": "uuid" // opcional, se for chunk
}
```

**Integração Gemini File API:**
```typescript
const formData = new FormData();
formData.append('file', pdfBlob, 'processo.pdf');

const uploadResponse = await fetch(
  `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${geminiApiKey}`,
  {
    method: 'POST',
    body: formData
  }
);

const { file } = await uploadResponse.json();

// Polling até state = ACTIVE
while (file.state === 'PROCESSING') {
  await new Promise(r => setTimeout(r, 2000));
  // Check status
}

return file.uri;
```

### 4. chat-with-processo

**Propósito:** Responde perguntas sobre processo usando IA.

**Fluxo:**
```
1. Recebe processo_id e message
2. Carrega histórico de chat
3. Carrega análises completas do processo
4. Carrega texto completo (se necessário)
5. Monta contexto rico
6. Chama Gemini com contexto + pergunta
7. Salva mensagens no histórico
8. Debita tokens
9. Retorna resposta
```

**Request:**
```typescript
POST /functions/v1/chat-with-processo
{
  "processo_id": "uuid",
  "message": "Quais são os prazos mais próximos?"
}
```

**Response:**
```typescript
{
  "response": "Com base na análise...",
  "tokens_used": 1234,
  "model_used": "gemini-2.0-flash-exp"
}
```

**Contexto Montado:**
```typescript
const context = `
Você é um assistente jurídico especializado.

ANÁLISE COMPLETA DO PROCESSO:
${JSON.stringify(analises, null, 2)}

HISTÓRICO DA CONVERSA:
${chatHistory.map(m => `${m.role}: ${m.content}`).join('\n')}

Responda de forma precisa e profissional.
`;
```

### 5. process-audio-message

**Propósito:** Transcreve áudio e processa como mensagem de chat.

**Fluxo:**
```
1. Recebe audio_base64 e processo_id
2. Converte base64 para buffer
3. Chama Google Speech-to-Text API
4. Obtém transcrição
5. Salva áudio no Storage (opcional)
6. Processa como mensagem normal via chat-with-processo
7. Retorna transcrição + resposta
```

**Request:**
```typescript
POST /functions/v1/process-audio-message
{
  "processo_id": "uuid",
  "audio_base64": "data:audio/webm;base64,..."
}
```

**Response:**
```typescript
{
  "transcript": "Quais são os prazos?",
  "response": "Os prazos identificados são...",
  "tokens_used": 1500
}
```

### 6. stripe-checkout

**Propósito:** Cria sessão de checkout do Stripe.

**Fluxo:**
```
1. Recebe price_id (plano escolhido)
2. Busca ou cria cliente Stripe
3. Cria checkout session
4. Configura metadata (user_id, price_id)
5. Configura success/cancel URLs
6. Retorna session URL
```

**Request:**
```typescript
POST /functions/v1/stripe-checkout
{
  "price_id": "price_xxx",
  "quantity": 1
}
```

**Response:**
```typescript
{
  "session_url": "https://checkout.stripe.com/..."
}
```

### 7. stripe-webhook

**Propósito:** Processa eventos do Stripe (subscriptions, payments).

**Eventos Tratados:**
- `checkout.session.completed` - Assinatura criada
- `customer.subscription.updated` - Assinatura atualizada
- `customer.subscription.deleted` - Assinatura cancelada
- `invoice.payment_succeeded` - Pagamento bem-sucedido
- `invoice.payment_failed` - Pagamento falhou

**Fluxo:**
```
1. Valida assinatura do webhook
2. Extrai evento
3. Switch no tipo de evento
4. Atualiza banco de dados conforme evento
5. Cria notificação para usuário
6. Retorna 200 OK
```

**Validação:**
```typescript
const signature = req.headers.get('stripe-signature');
const event = stripe.webhooks.constructEvent(
  body,
  signature,
  webhookSecret
);
```

### 8. get-billing-analytics

**Propósito:** Retorna analytics de faturamento para admins.

**Métricas Retornadas:**
```typescript
{
  total_users: 150,
  active_subscriptions: 80,
  total_mrr: 24000, // Monthly Recurring Revenue
  churn_rate: 3.5,
  avg_tokens_per_user: 25000,
  top_plans: [
    { plan: "professional", count: 50, revenue: 15000 },
    { plan: "basic", count: 30, revenue: 9000 }
  ],
  revenue_by_month: [
    { month: "2025-10", revenue: 24000 },
    { month: "2025-09", revenue: 22000 }
  ]
}
```

### 9. delete-user-account

**Propósito:** Deleta completamente a conta de um usuário.

**Fluxo:**
```
1. Verifica autenticação
2. Busca todos os processos do usuário
3. Deleta arquivos do Storage
4. Deleta registros em cascata:
   - processos
   - paginas
   - analysis_results
   - chat_messages
   - notifications
   - token_usage_logs
5. Cancela assinatura Stripe
6. Deleta user_profile
7. Deleta auth.users (Supabase Auth)
8. Retorna confirmação
```

**Request:**
```typescript
POST /functions/v1/delete-user-account
{
  "confirm": true
}
```

## 🔧 CORS Configuration

Todas as Edge Functions incluem headers CORS:

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

// Handle OPTIONS
if (req.method === 'OPTIONS') {
  return new Response(null, { status: 200, headers: corsHeaders });
}

// Include in all responses
return new Response(JSON.stringify(data), {
  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
});
```

## 🔐 Autenticação

### Service Role (Edge Functions)
```typescript
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')! // Bypassa RLS
);
```

### Anon Key (Frontend)
```typescript
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY // Aplica RLS
);
```

## 📊 Performance

### Timeout Padrão
- **Default**: 60 segundos
- **process-next-prompt**: 120 segundos (análise IA)
- **upload-to-gemini**: 180 segundos (upload grandes)

### Cold Start
- **Tempo médio**: 200-500ms
- **Mitigação**: Keep-alive via cron jobs

### Retry Strategy
```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error('Max retries reached');
}
```

## 🚀 Deploy

```bash
# Deploy todas
supabase functions deploy

# Deploy específica
supabase functions deploy start-analysis

# Logs
supabase functions logs start-analysis
```

## 🔗 Próximos Documentos

- **[10-FLUXO-ANALISE.md](./10-FLUXO-ANALISE.md)** - Fluxo completo de análise
- **[06-INTEGRACOES-GCP.md](./06-INTEGRACOES-GCP.md)** - Google Cloud Platform

---

**15 Edge Functions serverless e escaláveis**
