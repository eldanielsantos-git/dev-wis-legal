# Configuração de Ambiente

Guia completo para configurar todas as variáveis de ambiente e serviços externos necessários.

## Visão Geral

O sistema requer integração com os seguintes serviços:

- **Supabase** - Database, Auth, Storage, Edge Functions (obrigatório)
- **Google Gemini** - IA para análise e chat (obrigatório)
- **Stripe** - Pagamentos e assinaturas (opcional para dev)
- **Resend** - Envio de emails (configurado nas Edge Functions)

---

## Arquivo .env

Crie o arquivo `.env` na raiz do projeto:

```bash
cp .env.example .env
```

Estrutura do arquivo `.env`:

```env
# ============================================
# SUPABASE
# ============================================
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key-aqui

# ============================================
# GOOGLE GEMINI
# ============================================
VITE_GEMINI_API_KEY=sua-gemini-api-key-aqui

# ============================================
# STRIPE (Opcional para desenvolvimento)
# ============================================
VITE_STRIPE_PUBLIC_KEY=pk_test_sua-stripe-public-key

# ============================================
# APP CONFIG
# ============================================
VITE_APP_NAME=ProcessIA
VITE_APP_URL=http://localhost:5173
```

---

## 1. Configuração do Supabase

### 1.1. Criar Projeto no Supabase

1. Acesse [https://app.supabase.com](https://app.supabase.com)
2. Faça login ou crie uma conta
3. Clique em **"New Project"**
4. Preencha:
   - **Name**: Nome do projeto (ex: `processIA`)
   - **Database Password**: Senha forte (salve em local seguro)
   - **Region**: Escolha a região mais próxima
   - **Pricing Plan**: Free tier é suficiente para desenvolvimento
5. Clique em **"Create new project"**
6. Aguarde ~2 minutos para o projeto ser provisionado

### 1.2. Obter Credenciais

No dashboard do projeto:

1. Vá em **Settings** (ícone de engrenagem) → **API**
2. Copie os valores:

```env
# Project URL
VITE_SUPABASE_URL=https://abcdefghijklmnop.supabase.co

# anon/public key
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 1.3. Executar Migrations

#### Opção A: Via Dashboard (Recomendado para Iniciantes)

1. Vá em **SQL Editor** no dashboard
2. Para cada arquivo em `supabase/migrations/`:
   - Clique em **"New query"**
   - Copie e cole o conteúdo do arquivo de migration
   - Clique em **"Run"**
3. Execute as migrations em ordem cronológica (pelo nome do arquivo)

#### Opção B: Via Supabase CLI (Recomendado para Desenvolvimento)

```bash
# Instale a CLI
npm install -g supabase

# Login
supabase login

# Link com o projeto
supabase link --project-ref seu-project-ref

# Execute as migrations
supabase db push
```

### 1.4. Configurar Storage

1. Vá em **Storage** no dashboard
2. Crie os buckets necessários:
   - `processos` - Para PDFs
   - `avatars` - Para fotos de perfil (opcional)

3. Configure políticas de acesso:

**Bucket: processos**
```sql
-- Policy: Users can upload their own files
CREATE POLICY "Users can upload own files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'processos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Policy: Users can read their own files
CREATE POLICY "Users can read own files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'processos' AND auth.uid()::text = (storage.foldername(name))[1]);
```

### 1.5. Configurar Email Auth

1. Vá em **Authentication** → **Settings**
2. Configure:
   - **Site URL**: `http://localhost:5173` (dev) ou sua URL de produção
   - **Redirect URLs**: Adicione `http://localhost:5173/**`
3. Em **Email Templates**, customize os templates se desejar

### 1.6. Edge Functions

As Edge Functions serão deployadas posteriormente, mas você pode configurar secrets:

```bash
# Service Role Key (para workers)
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key

# Gemini API Key
supabase secrets set GEMINI_API_KEY=sua-gemini-key

# Stripe Secret Key
supabase secrets set STRIPE_SECRET_KEY=sua-stripe-secret-key

# Resend API Key
supabase secrets set RESEND_API_KEY=sua-resend-key
```

---

## 2. Configuração do Google Gemini

### 2.1. Criar API Key

1. Acesse [Google AI Studio](https://aistudio.google.com)
2. Faça login com sua conta Google
3. Clique em **"Get API key"** no menu lateral
4. Clique em **"Create API key"**
5. Escolha ou crie um projeto do Google Cloud
6. Copie a API key gerada

```env
VITE_GEMINI_API_KEY=AIzaSyA...sua-key-aqui
```

### 2.2. Verificar Quota

1. Acesse [Google Cloud Console](https://console.cloud.google.com)
2. Navegue para **APIs & Services** → **Credentials**
3. Verifique sua API key e limites
4. Para produção, considere habilitar billing para quotas maiores

### 2.3. Configurar Limites (Opcional)

No código, você pode ajustar rate limits e retry logic em:
- `src/lib/gemini.ts`
- Edge Functions que usam Gemini

### 2.4. Custos Estimados

**Gemini Pro 1.5 (Dezembro 2025):**
- Grátis até 50 requests/dia
- Pay-as-you-go após limite free

**Exemplo de consumo:**
- Processo pequeno (100 páginas): ~$0.05-0.10
- Processo médio (500 páginas): ~$0.25-0.50
- Processo grande (1000 páginas): ~$0.50-1.00

---

## 3. Configuração do Stripe (Opcional)

Necessário apenas se você for testar pagamentos localmente.

### 3.1. Criar Conta

1. Acesse [https://dashboard.stripe.com/register](https://dashboard.stripe.com/register)
2. Crie uma conta
3. Complete o onboarding

### 3.2. Obter Keys de Teste

1. Acesse o Dashboard
2. Ative o **"Test mode"** (toggle no canto superior direito)
3. Vá em **Developers** → **API keys**
4. Copie as keys:

```env
# Publishable key (frontend)
VITE_STRIPE_PUBLIC_KEY=pk_test_...

# Secret key (backend - para Edge Functions)
STRIPE_SECRET_KEY=sk_test_...
```

### 3.3. Criar Produtos e Preços

#### Via Dashboard:

1. Vá em **Products** → **Add product**
2. Crie os produtos:

**Free Plan**
- Name: Free
- Recurring: Monthly
- Price: $0

**Pro Plan**
- Name: Pro
- Recurring: Monthly
- Price: $29.99

**Enterprise Plan**
- Name: Enterprise
- Recurring: Monthly
- Price: $99.99

3. Para cada produto, copie o **Price ID** (começar com `price_...`)

#### Via Stripe CLI (Recomendado):

```bash
# Instale Stripe CLI
# Mac: brew install stripe/stripe-cli/stripe
# Windows: scoop install stripe
# Linux: Ver docs

# Login
stripe login

# Criar produtos
stripe products create --name="Pro Plan" --description="Plano Pro"
stripe prices create --product=prod_xxx --unit-amount=2999 --currency=usd --recurring="interval=month"
```

### 3.4. Configurar Webhooks

Para desenvolvimento local:

```bash
# Forward webhooks para localhost
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook
```

O Stripe CLI mostrará um **webhook signing secret** (começar com `whsec_...`).

Configure na Edge Function ou como secret:

```bash
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
```

### 3.5. Cartões de Teste

Use estes cartões para testar pagamentos:

| Cenário | Número | CVV | Data |
|---------|--------|-----|------|
| Sucesso | 4242 4242 4242 4242 | 123 | Qualquer futura |
| Requer 3DS | 4000 0027 6000 3184 | 123 | Qualquer futura |
| Falha | 4000 0000 0000 0002 | 123 | Qualquer futura |
| Sem fundos | 4000 0000 0000 9995 | 123 | Qualquer futura |

---

## 4. Configuração de Email (Resend)

### 4.1. Criar Conta

1. Acesse [https://resend.com](https://resend.com)
2. Crie uma conta
3. Verifique seu email

### 4.2. Obter API Key

1. Vá em **API Keys**
2. Clique em **"Create API Key"**
3. Copie a key

```bash
# Configure como secret do Supabase
supabase secrets set RESEND_API_KEY=re_...
```

### 4.3. Configurar Domínio (Opcional)

Para produção, configure um domínio verificado:

1. Vá em **Domains**
2. Adicione seu domínio
3. Configure os registros DNS (SPF, DKIM, DMARC)
4. Aguarde verificação

Para desenvolvimento, você pode usar o domínio padrão (`onboarding@resend.dev`).

---

## 5. Verificação das Configurações

### 5.1. Teste de Conectividade

Execute o script de verificação:

```bash
npm run check-env
```

### 5.2. Teste Manual

#### Testar Supabase:

```javascript
// No console do browser
import { supabase } from './src/lib/supabase';

// Teste de conexão
const { data, error } = await supabase.from('processos').select('count');
console.log('Supabase OK:', !error);
```

#### Testar Gemini:

```javascript
import { model } from './src/lib/gemini';

// Teste de geração
const result = await model.generateContent('Olá, mundo!');
console.log('Gemini OK:', result.response.text());
```

#### Testar Stripe:

```javascript
// Tente criar um checkout
// Via interface do app após login
```

---

## 6. Configurações por Ambiente

### Development (.env.local)

```env
VITE_SUPABASE_URL=https://dev-project.supabase.co
VITE_SUPABASE_ANON_KEY=dev-anon-key
VITE_GEMINI_API_KEY=dev-gemini-key
VITE_STRIPE_PUBLIC_KEY=pk_test_...
VITE_APP_URL=http://localhost:5173
```

### Staging (.env.staging)

```env
VITE_SUPABASE_URL=https://staging-project.supabase.co
VITE_SUPABASE_ANON_KEY=staging-anon-key
VITE_GEMINI_API_KEY=staging-gemini-key
VITE_STRIPE_PUBLIC_KEY=pk_test_...
VITE_APP_URL=https://staging.seudominio.com
```

### Production (.env.production)

```env
VITE_SUPABASE_URL=https://prod-project.supabase.co
VITE_SUPABASE_ANON_KEY=prod-anon-key
VITE_GEMINI_API_KEY=prod-gemini-key
VITE_STRIPE_PUBLIC_KEY=pk_live_...
VITE_APP_URL=https://seudominio.com
```

---

## 7. Segurança

### 7.1. Nunca Commite Secrets

Verifique que `.env` está no `.gitignore`:

```gitignore
# Environment
.env
.env.local
.env.*.local
```

### 7.2. Rotação de Keys

Recomendações:
- **Development**: Rotação não crítica
- **Staging**: A cada 90 dias
- **Production**: A cada 30-60 dias

### 7.3. Princípio do Menor Privilégio

- Use **anon key** no frontend (não service role key!)
- Service role key apenas nas Edge Functions
- Configure RLS corretamente

### 7.4. Monitore Uso

- Configure alertas de uso no Google Cloud
- Monitore custos no Stripe Dashboard
- Verifique logs no Supabase

---

## 8. Troubleshooting

### Erro: Invalid API key (Supabase)

- Verifique se copiou a key completa
- Certifique-se de usar a anon key (não service role)
- Verifique se não há espaços extras

### Erro: API key not valid (Gemini)

- Verifique se a key está ativa no Google AI Studio
- Verifique quota disponível
- Tente regenerar a key

### Erro: No such plan (Stripe)

- Certifique-se de ter criado os produtos no Stripe
- Verifique se está usando as Price IDs corretas
- Confirme que está em test mode

### Erro: Authentication failed

- Limpe o localStorage do browser
- Verifique URL do Supabase
- Confirme que as migrations foram executadas

---

## 9. Próximos Passos

Após configurar todas as variáveis:

1. Execute o projeto: `npm run dev`
2. Siga o [Quick Start](./quick-start.md)
3. Explore a [Arquitetura](../02-architecture/overview.md)

---

## Recursos Úteis

### Documentação Oficial

- [Supabase Docs](https://supabase.com/docs)
- [Google AI Docs](https://ai.google.dev/docs)
- [Stripe Docs](https://stripe.com/docs)
- [Resend Docs](https://resend.com/docs)

### Comunidades

- [Supabase Discord](https://discord.supabase.com)
- [Stripe Community](https://community.stripe.com)

---

[← Anterior: Instalação](./installation.md) | [Próximo: Quick Start →](./quick-start.md)
