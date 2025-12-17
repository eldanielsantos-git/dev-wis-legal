# Deploy em Produção

Guia completo para deploy do sistema em produção.

## Pré-requisitos

- [ ] Conta Netlify ou Vercel (frontend)
- [ ] Projeto Supabase em produção
- [ ] Conta Google Cloud (Gemini API)
- [ ] Conta Stripe (pagamentos)
- [ ] Domínio configurado

## Checklist de Deploy

### 1. Frontend

#### Build

```bash
# Build para produção
npm run build

# Preview local do build
npm run preview
```

#### Deploy via Netlify

```bash
# Instalar Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Deploy
netlify deploy --prod
```

**Configurações Netlify:**
- Build command: `npm run build`
- Publish directory: `dist`
- Environment variables: Configurar no dashboard

#### Deploy via Vercel

```bash
# Instalar Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

### 2. Backend (Supabase)

#### Database

```bash
# Aplicar todas as migrations
supabase db push

# Ou via dashboard: SQL Editor → executar migrations
```

#### Edge Functions

```bash
# Deploy todas as functions
supabase functions deploy

# Deploy function específica
supabase functions deploy start-analysis
```

#### Secrets

```bash
# Configurar secrets
supabase secrets set GEMINI_API_KEY=xxx
supabase secrets set STRIPE_SECRET_KEY=xxx
supabase secrets set RESEND_API_KEY=xxx
```

### 3. Environment Variables

#### Frontend (.env.production)

```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
VITE_GEMINI_API_KEY=xxx
VITE_STRIPE_PUBLIC_KEY=pk_live_xxx
VITE_APP_URL=https://seudominio.com
```

#### Supabase (Secrets)

```bash
# Service keys (internal use only)
SUPABASE_SERVICE_ROLE_KEY=xxx
GEMINI_API_KEY=xxx
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
RESEND_API_KEY=re_xxx
```

### 4. Domínio

#### Netlify

1. Settings → Domain management
2. Add custom domain
3. Configure DNS:
   - A record → Netlify IP
   - CNAME www → netlify subdomain

#### SSL

Automático via Netlify/Vercel (Let's Encrypt)

### 5. Stripe

#### Products

1. Stripe Dashboard → Products
2. Criar planos: Free, Pro, Enterprise
3. Copiar Price IDs
4. Configurar no sistema

#### Webhook

```bash
# URL do webhook
https://xxx.supabase.co/functions/v1/stripe-webhook

# Events to listen:
- checkout.session.completed
- invoice.payment_succeeded
- invoice.payment_failed
- customer.subscription.updated
- customer.subscription.deleted
```

### 6. Email (Resend)

1. Adicionar domínio
2. Configurar DNS (SPF, DKIM)
3. Verificar domínio
4. Criar API key

## Validação Pós-Deploy

### Smoke Tests

```bash
# 1. Acessar homepage
curl https://seudominio.com

# 2. Testar signup
# Via browser: criar conta de teste

# 3. Testar upload
# Via browser: fazer upload de PDF pequeno

# 4. Testar checkout
# Via browser: tentar comprar tokens (usar cartão teste)
```

### Monitoramento

- [ ] Verificar logs no Supabase
- [ ] Verificar Analytics
- [ ] Configurar alertas
- [ ] Testar email notifications

## Rollback

Se algo der errado:

### Frontend

```bash
# Netlify: rollback via dashboard
# Deployments → Previous deploy → Publish

# Vercel: similar
```

### Edge Functions

```bash
# Redeployer versão anterior
git checkout <commit-anterior>
supabase functions deploy
```

### Database

```bash
# Usar backup automático do Supabase
# Dashboard → Database → Backups → Restore
```

## Monitoramento Contínuo

### Logs

```bash
# Ver logs de Edge Function
supabase functions logs function-name --tail
```

### Métricas

- Taxa de erro
- Tempo de resposta
- Processos concluídos
- Tokens consumidos
- Receita

### Alertas

- Erro em Edge Function > 5%
- Processo travado > 30min
- Database CPU > 80%
- Custos Gemini acima do esperado

## Custos Estimados

**Mensal (estimativa para 1000 usuários ativos):**

- Supabase Pro: $25/mês
- Netlify Pro: $19/mês (opcional)
- Gemini API: ~$500/mês (variável)
- Stripe: 2.9% + $0.30 por transação
- Resend: $20/mês (10k emails)

**Total estimado: $600-800/mês**

---

[← Voltar ao Deployment](./README.md)
