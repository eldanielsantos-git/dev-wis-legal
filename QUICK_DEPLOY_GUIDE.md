# ⚡ Guia Rápido de Deploy - 23 Edge Functions Restantes

## ✅ Status Atual

**3 funções JÁ deployadas:**
- start-analysis ✓
- upload-to-gemini ✓
- create-upload-url ✓

**23 funções PENDENTES** (prontas para deploy)

---

## 🚀 Solução Mais Rápida (1 COMANDO)

```bash
# No seu terminal LOCAL (onde está o código):
cd /caminho/do/seu/projeto

# Login + Link + Deploy tudo de uma vez
supabase login && \
supabase link --project-ref rslpleprodloodfsaext && \
supabase functions deploy --project-ref rslpleprodloodfsaext
```

**⏱️ Tempo estimado:** 3-5 minutos para todas as 26 funções

---

## 📋 Lista das 23 Funções Pendentes

### Grupo 1 - Pequenas (5 funções - ~1 minuto)
```bash
supabase functions deploy update-user-password --project-ref rslpleprodloodfsaext
supabase functions deploy cancel-subscription --project-ref rslpleprodloodfsaext
supabase functions deploy process-stuck-processos --project-ref rslpleprodloodfsaext
supabase functions deploy send-friend-invite --project-ref rslpleprodloodfsaext
supabase functions deploy start-analysis-complex --project-ref rslpleprodloodfsaext
```

### Grupo 2 - Médias (8 funções - ~2 minutos)
```bash
supabase functions deploy retry-chunk-uploads --project-ref rslpleprodloodfsaext
supabase functions deploy sync-stripe-coupons --project-ref rslpleprodloodfsaext
supabase functions deploy populate-pdf-base64 --project-ref rslpleprodloodfsaext
supabase functions deploy health-check-worker --project-ref rslpleprodloodfsaext
supabase functions deploy recover-stuck-processes --project-ref rslpleprodloodfsaext
supabase functions deploy restart-stage-manual --project-ref rslpleprodloodfsaext
supabase functions deploy delete-user-account --project-ref rslpleprodloodfsaext
supabase functions deploy admin-delete-user --project-ref rslpleprodloodfsaext
```

### Grupo 3 - Médias/Grandes (7 funções - ~2 minutos)
```bash
supabase functions deploy stripe-checkout --project-ref rslpleprodloodfsaext
supabase functions deploy get-billing-analytics --project-ref rslpleprodloodfsaext
supabase functions deploy sync-stripe-subscription --project-ref rslpleprodloodfsaext
supabase functions deploy sync-stripe-extra-tokens --project-ref rslpleprodloodfsaext
supabase functions deploy consolidation-worker --project-ref rslpleprodloodfsaext
supabase functions deploy process-audio-message --project-ref rslpleprodloodfsaext
supabase functions deploy process-complex-worker --project-ref rslpleprodloodfsaext
```

### Grupo 4 - Grandes (3 funções - ~2 minutos)
```bash
supabase functions deploy chat-with-processo --project-ref rslpleprodloodfsaext
supabase functions deploy stripe-webhook --project-ref rslpleprodloodfsaext
supabase functions deploy process-next-prompt --project-ref rslpleprodloodfsaext
```

---

## 📊 Detalhes das Funções por Tamanho

| Função | Linhas | Tempo Deploy |
|--------|--------|--------------|
| update-user-password | 113 | ~10s |
| cancel-subscription | 125 | ~10s |
| process-stuck-processos | 126 | ~10s |
| retry-chunk-uploads | 138 | ~10s |
| sync-stripe-coupons | 139 | ~10s |
| populate-pdf-base64 | 157 | ~15s |
| health-check-worker | 190 | ~15s |
| recover-stuck-processes | 191 | ~15s |
| restart-stage-manual | 201 | ~15s |
| delete-user-account | 217 | ~15s |
| stripe-checkout | 227 | ~20s |
| admin-delete-user | 229 | ~20s |
| send-friend-invite | 235 | ~20s |
| start-analysis-complex | 272 | ~20s |
| consolidation-worker | 300 | ~20s |
| process-audio-message | 316 | ~25s |
| get-billing-analytics | 352 | ~25s |
| sync-stripe-subscription | 387 | ~30s |
| sync-stripe-extra-tokens | 430 | ~30s |
| process-complex-worker | 482 | ~35s |
| chat-with-processo | 547 | ~40s |
| stripe-webhook | 750 | ~50s |
| process-next-prompt | 1021 | ~60s |

---

## ⚙️ Configuração de Variáveis (Depois do Deploy)

Acesse: https://supabase.com/dashboard/project/rslpleprodloodfsaext/settings/functions

### Variáveis Obrigatórias:
```
GEMINI_API_KEY=your_key_here
STRIPE_SECRET_KEY=your_key_here
STRIPE_WEBHOOK_SECRET=your_key_here
```

### Variáveis Opcionais:
```
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account"...}
STRIPE_WEBHOOK_SECRET_2=your_key_here  # Se usar múltiplos webhooks
STRIPE_WEBHOOK_SECRET_3=your_key_here  # Se usar múltiplos webhooks
```

---

## ✅ Verificação Pós-Deploy

1. Acesse: https://supabase.com/dashboard/project/rslpleprodloodfsaext/functions
2. Confirme que há **26 funções** listadas
3. Clique em cada função e verifique os logs
4. Teste uma função simples (ex: `health-check-worker`)

---

## 🐛 Troubleshooting

### Erro: "Not linked to project"
```bash
supabase link --project-ref rslpleprodloodfsaext
```

### Erro: "Unauthorized"
```bash
supabase logout
supabase login
```

### Erro: "Function already exists"
- Normal! O Supabase apenas atualiza a função existente
- Pode ignorar esta mensagem

### Deploy Lento/Timeout
- Normal para funções grandes (stripe-webhook, process-next-prompt)
- Aguarde 1-2 minutos por função grande
- Se travar, Ctrl+C e tente novamente

---

## 🎯 Resumo

**Total:** 23 funções pendentes
**Tempo total:** ~7-10 minutos (fazendo uma por uma)
**Tempo otimizado:** ~3-5 minutos (deploy de todas juntas)

**Comando Mágico:**
```bash
supabase functions deploy --project-ref rslpleprodloodfsaext
```

✨ **Pronto!** Todas as 26 Edge Functions estarão deployadas e funcionando.
