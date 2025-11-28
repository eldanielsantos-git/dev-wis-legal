# Manual Deploy Guide - Wis Legal

Se você preferir fazer o deploy manualmente ou se o script automático não funcionar, siga estas instruções.

---

## 📋 Prerequisites

- Node.js 18.x ou superior instalado
- Conta em uma das plataformas de hosting (Netlify/Vercel/Cloudflare)
- Acesso às variáveis de ambiente do projeto

---

## 🔑 Environment Variables

Você precisará das seguintes variáveis de ambiente:

```bash
VITE_SUPABASE_URL=https://zvlqcxiwsrziuodiotar.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_51SEWMCJrr43cGTt4lwxCOvl...
```

> ⚠️ **Importante:** Nunca commite o arquivo `.env` no Git. Essas variáveis devem ser configuradas diretamente na plataforma de hosting.

---

## 🚀 Deploy com Netlify (Recomendado)

### Opção 1: Via Netlify Web UI (Mais Fácil)

1. **Acesse Netlify:**
   - Vá para [https://app.netlify.com](https://app.netlify.com)
   - Faça login ou crie uma conta

2. **Criar novo site:**
   - Clique em "Add new site" → "Import an existing project"
   - Ou arraste a pasta `dist/` para o upload manual

3. **Configurar build settings:**
   ```
   Build command: npm run build
   Publish directory: dist
   ```

4. **Adicionar variáveis de ambiente:**
   - Vá para "Site settings" → "Environment" → "Environment variables"
   - Clique em "Add a variable"
   - Adicione as 3 variáveis listadas acima

5. **Deploy:**
   - Clique em "Deploy site"
   - Aguarde o build completar (~2-3 minutos)

### Opção 2: Via Netlify CLI

1. **Instalar Netlify CLI:**
   ```bash
   npm install -g netlify-cli
   ```

2. **Login:**
   ```bash
   netlify login
   ```

3. **Inicializar site:**
   ```bash
   netlify init
   ```
   - Escolha "Create & configure a new site"
   - Selecione seu time
   - Escolha um nome único

4. **Configurar variáveis de ambiente:**
   ```bash
   netlify env:set VITE_SUPABASE_URL "https://zvlqcxiwsrziuodiotar.supabase.co"
   netlify env:set VITE_SUPABASE_ANON_KEY "sua-anon-key-aqui"
   netlify env:set VITE_STRIPE_PUBLISHABLE_KEY "sua-stripe-key-aqui"
   ```

5. **Build e deploy:**
   ```bash
   npm run build
   netlify deploy --prod --dir=dist
   ```

---

## 🔷 Deploy com Vercel

### Opção 1: Via Vercel Web UI

1. **Acesse Vercel:**
   - Vá para [https://vercel.com](https://vercel.com)
   - Faça login ou crie uma conta

2. **Importar projeto:**
   - Clique em "Add New" → "Project"
   - Conecte seu repositório Git ou faça upload manual

3. **Configurar build:**
   ```
   Framework Preset: Vite
   Build Command: npm run build
   Output Directory: dist
   ```

4. **Adicionar variáveis de ambiente:**
   - Na tela de configuração, clique em "Environment Variables"
   - Adicione as 3 variáveis
   - Marque: Production, Preview, Development (conforme necessário)

5. **Deploy:**
   - Clique em "Deploy"
   - Aguarde o build completar

### Opção 2: Via Vercel CLI

1. **Instalar Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Login:**
   ```bash
   vercel login
   ```

3. **Deploy:**
   ```bash
   npm run build
   vercel --prod
   ```

4. **Adicionar variáveis de ambiente:**
   ```bash
   vercel env add VITE_SUPABASE_URL
   # Cole o valor quando solicitado

   vercel env add VITE_SUPABASE_ANON_KEY
   # Cole o valor quando solicitado

   vercel env add VITE_STRIPE_PUBLISHABLE_KEY
   # Cole o valor quando solicitado
   ```

5. **Redeploy com variáveis:**
   ```bash
   vercel --prod
   ```

---

## ☁️ Deploy com Cloudflare Pages

### Via Cloudflare Dashboard

1. **Acesse Cloudflare:**
   - Vá para [https://dash.cloudflare.com](https://dash.cloudflare.com)
   - Navegue até "Pages"

2. **Criar projeto:**
   - Clique em "Create a project"
   - Conecte seu repositório Git ou faça upload direto

3. **Configurar build:**
   ```
   Framework preset: Vite
   Build command: npm run build
   Build output directory: dist
   ```

4. **Adicionar variáveis de ambiente:**
   - Na aba "Settings" → "Environment variables"
   - Adicione as 3 variáveis
   - Escolha: Production

5. **Deploy:**
   - Salve e aguarde o build automático

---

## 📁 Upload Manual (Fallback)

Se nenhuma das opções acima funcionar, você pode fazer upload manual:

1. **Build local:**
   ```bash
   npm install
   npm run build
   ```

2. **Verificar build:**
   ```bash
   ls -la dist/
   ```
   Você deve ver:
   - `index.html`
   - `_redirects`
   - pasta `assets/`
   - `manifest.json`
   - `robots.txt`
   - `sitemap.xml`

3. **Upload para qualquer CDN:**
   - AWS S3 + CloudFront
   - Google Cloud Storage
   - Azure Blob Storage
   - GitHub Pages
   - Qualquer servidor com suporte a Node.js

4. **IMPORTANTE:** Configure redirects para SPA:

   **Para Nginx:**
   ```nginx
   location / {
     try_files $uri $uri/ /index.html;
   }
   ```

   **Para Apache (.htaccess):**
   ```apache
   <IfModule mod_rewrite.c>
     RewriteEngine On
     RewriteBase /
     RewriteRule ^index\.html$ - [L]
     RewriteCond %{REQUEST_FILENAME} !-f
     RewriteCond %{REQUEST_FILENAME} !-d
     RewriteRule . /index.html [L]
   </IfModule>
   ```

---

## ✅ Post-Deploy Checklist

Depois do deploy, verifique:

### 1. Acesso Básico
- [ ] Site está acessível via HTTPS
- [ ] Favicon carrega corretamente
- [ ] Não há erros 404 no console

### 2. Funcionalidades
- [ ] Página inicial carrega
- [ ] Login/registro funciona
- [ ] Upload de PDF funciona
- [ ] Dashboard aparece após login
- [ ] Chat abre corretamente

### 3. Mobile
- [ ] Abrir em dispositivo móvel real
- [ ] Clicar no input do chat
- [ ] Verificar que header permanece visível
- [ ] Verificar que não há scroll horizontal
- [ ] Testar em iOS e Android

### 4. Performance
- [ ] Rodar Lighthouse
- [ ] Performance score > 90
- [ ] Accessibility score > 95
- [ ] Best Practices score > 95
- [ ] SEO score = 100

### 5. Console Errors
- [ ] Abrir DevTools (F12)
- [ ] Verificar que não há erros em vermelho
- [ ] Confirmar que logs de debug aparecem (se em dev mode)

---

## 🐛 Troubleshooting

### Build Failed

**Erro: `Cannot find module`**
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

**Erro: `Out of memory`**
```bash
NODE_OPTIONS="--max-old-space-size=4096" npm run build
```

### Deploy Successful mas Site Não Funciona

**Problema: Página em branco**
- Verifique console do navegador (F12)
- Provável causa: Variáveis de ambiente não configuradas
- Solução: Adicionar variáveis no dashboard da plataforma

**Problema: 404 ao navegar**
- Causa: SPA redirects não configurados
- Solução: Verificar se `_redirects` está na pasta `dist/`
- Conteúdo do `_redirects`: `/*    /index.html   200`

**Problema: CORS errors**
- Causa: Supabase não aceita requests do domínio
- Solução: Adicionar domínio de produção nas configurações do Supabase

### Performance Issues

**Problema: Site lento**
- Verificar se assets estão sendo servidos com gzip/brotli
- Verificar se CDN está ativo
- Rodar Lighthouse para identificar gargalos

---

## 📊 Monitoring

### Métricas para Acompanhar

1. **Uptime:** Deve ser > 99.9%
2. **Response Time:** Deve ser < 500ms
3. **Error Rate:** Deve ser < 1%
4. **Mobile Performance:** Lighthouse > 90

### Ferramentas Recomendadas

- **Uptime:** UptimeRobot, Pingdom
- **Performance:** Google Lighthouse, WebPageTest
- **Errors:** Sentry, LogRocket
- **Analytics:** Google Analytics (já configurado)

---

## 🔄 Atualizações Futuras

Para fazer deploy de atualizações:

1. **Fazer mudanças no código**
2. **Build:**
   ```bash
   npm run build
   ```
3. **Deploy:**
   ```bash
   netlify deploy --prod --dir=dist
   # ou
   vercel --prod
   # ou via UI da plataforma
   ```

---

## 📞 Suporte

Se tiver problemas com o deploy:

1. Verifique os logs da plataforma
2. Consulte a documentação:
   - [Netlify Docs](https://docs.netlify.com)
   - [Vercel Docs](https://vercel.com/docs)
   - [Cloudflare Pages Docs](https://developers.cloudflare.com/pages)
3. Verifique o arquivo `DEPLOYMENT_SUMMARY.md` para mais detalhes

---

**Última atualização:** 03/11/2025
**Status:** ✅ Pronto para deploy
**Build size:** ~3.5MB
