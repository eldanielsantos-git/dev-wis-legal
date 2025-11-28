# Deploy das Funções Restantes - Guia Rápido

## Status Atual

✅ **3 funções JÁ deployadas via MCP:**
- `start-analysis`
- `upload-to-gemini`
- `create-upload-url`

⏳ **23 funções PENDENTES**

---

## Comando Único para Deploy de TODAS as Funções

Execute no diretório do projeto:

```bash
cd /caminho/do/seu/projeto

# Login no Supabase (se ainda não fez)
supabase login

# Link ao projeto DESTINO
supabase link --project-ref rslpleprodloodfsaext

# Deploy de TODAS as funções de uma vez
supabase functions deploy --project-ref rslpleprodloodfsaext
```

**✨ Este comando fará o deploy automático de TODAS as 26 funções, incluindo as 3 que já estão deployadas (apenas atualizará se houver mudanças).**

---

## Lista Completa das 23 Funções Pendentes

```
1. admin-delete-user
2. cancel-subscription
3. chat-with-processo
4. consolidation-worker
5. delete-user-account
6. get-billing-analytics
7. health-check-worker
8. populate-pdf-base64
9. process-audio-message
10. process-complex-worker
11. process-next-prompt
12. process-stuck-processos
13. recover-stuck-processes
14. restart-stage-manual
15. retry-chunk-uploads
16. send-friend-invite
17. start-analysis-complex
18. stripe-checkout
19. stripe-webhook
20. sync-stripe-coupons
21. sync-stripe-extra-tokens
22. sync-stripe-subscription
23. update-user-password
```

---

## Se Preferir Deploy Individual (Lote por Lote)

### Lote 1 - Funções críticas de processamento (3 funções)
```bash
supabase functions deploy consolidation-worker --project-ref rslpleprodloodfsaext
supabase functions deploy stripe-checkout --project-ref rslpleprodloodfsaext
supabase functions deploy stripe-webhook --project-ref rslpleprodloodfsaext
```

### Lote 2 - Funções de análise (3 funções)
```bash
supabase functions deploy process-next-prompt --project-ref rslpleprodloodfsaext
supabase functions deploy start-analysis-complex --project-ref rslpleprodloodfsaext
supabase functions deploy process-complex-worker --project-ref rslpleprodloodfsaext
```

### Lote 3 - Funções de chat e áudio (3 funções)
```bash
supabase functions deploy chat-with-processo --project-ref rslpleprodloodfsaext
supabase functions deploy process-audio-message --project-ref rslpleprodloodfsaext
supabase functions deploy send-friend-invite --project-ref rslpleprodloodfsaext
```

### Lote 4 - Funções de sincronização Stripe (3 funções)
```bash
supabase functions deploy sync-stripe-subscription --project-ref rslpleprodloodfsaext
supabase functions deploy sync-stripe-coupons --project-ref rslpleprodloodfsaext
supabase functions deploy sync-stripe-extra-tokens --project-ref rslpleprodloodfsaext
```

### Lote 5 - Funções de assinatura (2 funções)
```bash
supabase functions deploy cancel-subscription --project-ref rslpleprodloodfsaext
supabase functions deploy get-billing-analytics --project-ref rslpleprodloodfsaext
```

### Lote 6 - Funções administrativas (3 funções)
```bash
supabase functions deploy admin-delete-user --project-ref rslpleprodloodfsaext
supabase functions deploy delete-user-account --project-ref rslpleprodloodfsaext
supabase functions deploy update-user-password --project-ref rslpleprodloodfsaext
```

### Lote 7 - Funções de manutenção (3 funções)
```bash
supabase functions deploy health-check-worker --project-ref rslpleprodloodfsaext
supabase functions deploy populate-pdf-base64 --project-ref rslpleprodloodfsaext
supabase functions deploy retry-chunk-uploads --project-ref rslpleprodloodfsaext
```

### Lote 8 - Funções de recuperação (3 funções)
```bash
supabase functions deploy process-stuck-processos --project-ref rslpleprodloodfsaext
supabase functions deploy recover-stuck-processes --project-ref rslpleprodloodfsaext
supabase functions deploy restart-stage-manual --project-ref rslpleprodloodfsaext
```

---

## Script Automático

Ou use o script já criado:

```bash
chmod +x deploy-all-functions.sh
./deploy-all-functions.sh
```

---

## Verificação Pós-Deploy

1. Acesse o Dashboard:
   https://supabase.com/dashboard/project/rslpleprodloodfsaext/functions

2. Você deverá ver **26 funções** listadas

3. Verifique os logs de cada função para confirmar que estão operacionais

---

## Variáveis de Ambiente Necessárias

Certifique-se de configurar estas variáveis no Dashboard:
https://supabase.com/dashboard/project/rslpleprodloodfsaext/settings/functions

### Obrigatórias:
- `GEMINI_API_KEY` - Chave da API do Google Gemini
- `STRIPE_SECRET_KEY` - Chave secreta do Stripe
- `STRIPE_WEBHOOK_SECRET` - Secret do webhook Stripe (ou `STRIPE_WEBHOOK_SECRET_1`)

### Opcionais:
- `GOOGLE_SERVICE_ACCOUNT_KEY` - Service account do Google Cloud (para Document AI)
- `STRIPE_WEBHOOK_SECRET_2` - Secret adicional do webhook (se usar múltiplos endpoints)
- `STRIPE_WEBHOOK_SECRET_3` - Secret adicional do webhook (se usar múltiplos endpoints)

**Nota:** As variáveis `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_ANON_KEY` são configuradas automaticamente.

---

## Tempo Estimado

- **Deploy de todas as funções:** ~3-5 minutos
- **Deploy individual (lote de 3):** ~30-60 segundos por lote

---

## Problemas Comuns

### 1. Erro "Not linked to project"
```bash
supabase link --project-ref rslpleprodloodfsaext
```

### 2. Erro "Unauthorized"
```bash
supabase login
```

### 3. Timeout durante deploy
- Funções grandes (como `stripe-webhook` e `process-next-prompt`) podem levar mais tempo
- Aguarde a conclusão ou tente novamente

---

## Comando Mais Simples (RECOMENDADO)

```bash
cd /seu/projeto
supabase login
supabase link --project-ref rslpleprodloodfsaext
supabase functions deploy --project-ref rslpleprodloodfsaext
```

**Pronto!** 🎉

Todas as 26 Edge Functions estarão deployadas no banco DESTINO.
