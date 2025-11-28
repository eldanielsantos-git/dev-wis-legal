# Guia Completo: Deploy de Edge Functions no Banco DESTINO

## Situação Atual

✅ **3 funções JÁ deployadas:**
- `start-analysis`
- `upload-to-gemini`
- `create-upload-url`

⏳ **23 funções PENDENTES de deploy**

---

## Pré-requisitos

```bash
# 1. Instalar Supabase CLI (se ainda não tiver)
npm install -g supabase

# 2. Verificar instalação
supabase --version
```

---

## Método 1: Deploy Automático de Todas (RECOMENDADO)

Execute no diretório raiz do projeto:

```bash
cd /caminho/do/seu/projeto

# Login no Supabase
supabase login

# Link ao projeto DESTINO
supabase link --project-ref rslpleprodloodfsaext

# Deploy de TODAS as funções de uma vez
supabase functions deploy --project-ref rslpleprodloodfsaext
```

**✨ Este comando fará deploy de TODAS as funções automaticamente!**

---

## Método 2: Deploy Individual (se preferir controle)

Se quiser deploy individual das 23 funções pendentes:

```bash
# Função por função
supabase functions deploy process-next-prompt --project-ref rslpleprodloodfsaext
supabase functions deploy consolidation-worker --project-ref rslpleprodloodfsaext
supabase functions deploy chat-with-processo --project-ref rslpleprodloodfsaext
supabase functions deploy stripe-checkout --project-ref rslpleprodloodfsaext
supabase functions deploy stripe-webhook --project-ref rslpleprodloodfsaext
supabase functions deploy admin-delete-user --project-ref rslpleprodloodfsaext
supabase functions deploy cancel-subscription --project-ref rslpleprodloodfsaext
supabase functions deploy delete-user-account --project-ref rslpleprodloodfsaext
supabase functions deploy get-billing-analytics --project-ref rslpleprodloodfsaext
supabase functions deploy health-check-worker --project-ref rslpleprodloodfsaext
supabase functions deploy populate-pdf-base64 --project-ref rslpleprodloodfsaext
supabase functions deploy process-audio-message --project-ref rslpleprodloodfsaext
supabase functions deploy process-complex-worker --project-ref rslpleprodloodfsaext
supabase functions deploy process-stuck-processos --project-ref rslpleprodloodfsaext
supabase functions deploy recover-stuck-processes --project-ref rslpleprodloodfsaext
supabase functions deploy restart-stage-manual --project-ref rslpleprodloodfsaext
supabase functions deploy retry-chunk-uploads --project-ref rslpleprodloodfsaext
supabase functions deploy send-friend-invite --project-ref rslpleprodloodfsaext
supabase functions deploy start-analysis-complex --project-ref rslpleprodloodfsaext
supabase functions deploy sync-stripe-coupons --project-ref rslpleprodloodfsaext
supabase functions deploy sync-stripe-extra-tokens --project-ref rslpleprodloodfsaext
supabase functions deploy sync-stripe-subscription --project-ref rslpleprodloodfsaext
supabase functions deploy update-user-password --project-ref rslpleprodloodfsaext
```

---

## Método 3: Script Automático

Use o script já criado (`deploy-all-functions.sh`):

```bash
chmod +x deploy-all-functions.sh
./deploy-all-functions.sh
```

---

## Verificação Pós-Deploy

Após o deploy, verifique no Dashboard:
👉 https://supabase.com/dashboard/project/rslpleprodloodfsaext/functions

Você deverá ver **26 funções** no total.

---

## Variáveis de Ambiente

**IMPORTANTE:** As Edge Functions precisam das seguintes variáveis de ambiente configuradas no projeto DESTINO:

### Configurar no Dashboard:
https://supabase.com/dashboard/project/rslpleprodloodfsaext/settings/functions

Certifique-se de que estas variáveis estão configuradas:

```
GEMINI_API_KEY=<sua-chave>
GOOGLE_SERVICE_ACCOUNT_KEY=<sua-service-account-json>
STRIPE_SECRET_KEY=<sua-stripe-key>
STRIPE_WEBHOOK_SECRET=<seu-webhook-secret>
```

**✅ Nota:** As variáveis `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, e `SUPABASE_ANON_KEY` são configuradas automaticamente.

---

## Problemas Comuns

### 1. "Error: Not linked to a project"
```bash
supabase link --project-ref rslpleprodloodfsaext
```

### 2. "Error: Unauthorized"
```bash
supabase login
```

### 3. Deploy falha com erro de dependências
- As dependências npm: são baixadas automaticamente pelo Supabase
- Não é necessário `npm install` no projeto

---

## Lista Completa de Funções (26 total)

| # | Função | Status |
|---|--------|--------|
| 1 | admin-delete-user | ⏳ Pendente |
| 2 | cancel-subscription | ⏳ Pendente |
| 3 | chat-with-processo | ⏳ Pendente |
| 4 | consolidation-worker | ⏳ Pendente |
| 5 | create-upload-url | ✅ Deployada |
| 6 | delete-user-account | ⏳ Pendente |
| 7 | get-billing-analytics | ⏳ Pendente |
| 8 | health-check-worker | ⏳ Pendente |
| 9 | populate-pdf-base64 | ⏳ Pendente |
| 10 | process-audio-message | ⏳ Pendente |
| 11 | process-complex-worker | ⏳ Pendente |
| 12 | process-next-prompt | ⏳ Pendente |
| 13 | process-stuck-processos | ⏳ Pendente |
| 14 | recover-stuck-processes | ⏳ Pendente |
| 15 | restart-stage-manual | ⏳ Pendente |
| 16 | retry-chunk-uploads | ⏳ Pendente |
| 17 | send-friend-invite | ⏳ Pendente |
| 18 | start-analysis | ✅ Deployada |
| 19 | start-analysis-complex | ⏳ Pendente |
| 20 | stripe-checkout | ⏳ Pendente |
| 21 | stripe-webhook | ⏳ Pendente |
| 22 | sync-stripe-coupons | ⏳ Pendente |
| 23 | sync-stripe-extra-tokens | ⏳ Pendente |
| 24 | sync-stripe-subscription | ⏳ Pendente |
| 25 | update-user-password | ⏳ Pendente |
| 26 | upload-to-gemini | ✅ Deployada |

---

## Comando Mais Simples

O comando mais simples e direto para deployar tudo:

```bash
cd /seu/projeto
supabase login
supabase link --project-ref rslpleprodloodfsaext
supabase functions deploy --project-ref rslpleprodloodfsaext
```

**É isso!** 🎉
