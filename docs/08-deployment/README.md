# Deployment

Guias de deploy e infraestrutura.

## 📋 Documentos Nesta Seção

### [Deploy em Produção](./production.md)
Guia completo para deploy em produção.

**Tópicos:**
- Pré-requisitos
- Build do frontend
- Deploy do frontend (Netlify/Vercel)
- Deploy das Edge Functions
- Configuração de domínios
- SSL/HTTPS

---

### [CI/CD Pipeline](./cicd.md)
Automação de builds e deploys.

**Tópicos:**
- GitHub Actions
- Workflows de CI
- Workflows de CD
- Testes automatizados
- Deploy automático

---

### [Configuração de Domínios](./domains.md)
Setup de domínios customizados.

**Tópicos:**
- Configuração DNS
- Domínio do frontend
- Domínio das APIs
- Certificados SSL
- Redirects

---

### [Variáveis de Ambiente](./environment-variables.md)
Gestão de variáveis de ambiente em produção.

**Tópicos:**
- Variáveis do frontend
- Variáveis das Edge Functions
- Secrets do Supabase
- Configuração por ambiente

---

## 🚀 Deploy Rápido

### Frontend (Netlify)

```bash
# 1. Build
npm run build

# 2. Deploy via Netlify CLI
netlify deploy --prod
```

### Edge Functions (Supabase)

```bash
# Deploy todas as functions
supabase functions deploy

# Deploy uma function específica
supabase functions deploy function-name
```

---

## 🌍 Ambientes

### Development
- Local development
- `.env.local`
- Supabase local (opcional)

### Staging
- Branch `staging`
- Deploy automático
- Dados de teste

### Production
- Branch `main`
- Deploy manual ou automático
- Dados reais
- Monitoramento ativo

---

## 📦 Checklist de Deploy

### Pré-Deploy
- [ ] Todos os testes passando
- [ ] Build sem erros
- [ ] Variáveis de ambiente configuradas
- [ ] Migrations aplicadas
- [ ] Edge Functions testadas

### Deploy
- [ ] Build do frontend
- [ ] Deploy do frontend
- [ ] Deploy das Edge Functions
- [ ] Verificar logs
- [ ] Smoke tests

### Pós-Deploy
- [ ] Validar funcionalidades críticas
- [ ] Monitorar erros
- [ ] Validar integrações (Stripe, Gemini)
- [ ] Verificar performance

---

## 🔧 Ferramentas

### Frontend
- **Netlify** ou **Vercel** - Hosting
- **GitHub Actions** - CI/CD

### Backend
- **Supabase CLI** - Deploy de Edge Functions
- **Supabase Dashboard** - Gestão do banco

### Monitoring
- **Supabase Logs** - Logs das Edge Functions
- **Sentry** - Error tracking (opcional)
- **Google Analytics** - Analytics (opcional)

---

## 🔗 Links Relacionados

- [Environment Setup](../01-getting-started/environment-setup.md)
- [Monitoring](../09-monitoring/README.md)
- [Troubleshooting](../10-troubleshooting/README.md)

---

[← Voltar ao Índice Principal](../README.md)
