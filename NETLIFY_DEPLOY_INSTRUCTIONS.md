# 🚀 Instruções de Deploy na Netlify

O projeto está **100% pronto** para deploy! Escolha uma das opções abaixo:

---

## ✅ Opção 1: Deploy via Netlify CLI (Mais Rápido)

### Passo 1: Login na Netlify
```bash
netlify login
```
Isso abrirá seu navegador para autenticação.

### Passo 2: Inicializar o site (primeira vez)
```bash
netlify init
```

Responda as perguntas:
- **What would you like to do?** → `Create & configure a new site`
- **Team:** → Escolha seu time
- **Site name:** → `wis-legal` (ou nome de sua preferência)
- **Your build command:** → `npm run build`
- **Directory to deploy:** → `dist`

### Passo 3: Configurar variáveis de ambiente
```bash
netlify env:set VITE_SUPABASE_URL "https://zvlqcxiwsrziuodiotar.supabase.co"
netlify env:set VITE_SUPABASE_ANON_KEY "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2bHFjeGl3c3J6aXVvZGlvdGFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY2ODQ2MjIsImV4cCI6MjA0MjI2MDYyMn0.NaJHe8UF4C-0jdMb0JUHWO19e5-7_y-qU2gOrfQcPFA"
netlify env:set VITE_STRIPE_PUBLISHABLE_KEY "pk_live_51SEWMCJrr43cGTt4lwxCOvlVNMBEYpFjRRSQdIK7mGSzVY6QCUt6UbU8vWWcWd3mKSKVUdJz9C88I0HU7TyEPZux00gHXi4jNl"
```

### Passo 4: Deploy!
```bash
netlify deploy --prod
```

✅ **Pronto!** Seu site estará no ar em alguns segundos.

---

## ✅ Opção 2: Deploy via Netlify Web UI (Mais Visual)

### Passo 1: Acesse Netlify
Abra [https://app.netlify.com](https://app.netlify.com) e faça login

### Passo 2: Novo Site
- Clique em **"Add new site"** → **"Deploy manually"**
- Ou arraste a pasta `dist/` diretamente para o campo de upload

### Passo 3: Configurar Variáveis de Ambiente
Após o deploy inicial:

1. Vá em **"Site settings"** → **"Environment"** → **"Environment variables"**
2. Clique em **"Add a variable"**
3. Adicione estas 3 variáveis:

```
Nome: VITE_SUPABASE_URL
Valor: https://zvlqcxiwsrziuodiotar.supabase.co

Nome: VITE_SUPABASE_ANON_KEY
Valor: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2bHFjeGl3c3J6aXVvZGlvdGFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY2ODQ2MjIsImV4cCI6MjA0MjI2MDYyMn0.NaJHe8UF4C-0jdMb0JUHWO19e5-7_y-qU2gOrfQcPFA

Nome: VITE_STRIPE_PUBLISHABLE_KEY
Valor: pk_live_51SEWMCJrr43cGTt4lwxCOvlVNMBEYpFjRRSQdIK7mGSzVY6QCUt6UbU8vWWcWd3mKSKVUdJz9C88I0HU7TyEPZux00gHXi4jNl
```

### Passo 4: Redeploy
Após adicionar as variáveis:
- Vá em **"Deploys"**
- Clique em **"Trigger deploy"** → **"Clear cache and deploy site"**

✅ **Pronto!** Aguarde o build completar.

---

## ✅ Opção 3: Deploy via Git (Deploy Contínuo)

### Passo 1: Push para GitHub
Se ainda não fez:
```bash
git remote add origin https://github.com/seu-usuario/wis-legal.git
git push -u origin master
```

### Passo 2: Conectar Repositório na Netlify
1. Na Netlify: **"Add new site"** → **"Import an existing project"**
2. Escolha **GitHub** e autorize
3. Selecione o repositório `wis-legal`

### Passo 3: Configurar Build
```
Build command: npm run build
Publish directory: dist
```

### Passo 4: Adicionar Variáveis de Ambiente
(Mesmo processo da Opção 2, Passo 3)

### Passo 5: Deploy Automático
- O site será deployado automaticamente
- Futuros commits disparam deploys automáticos

✅ **Pronto!** Deploy contínuo configurado.

---

## 📊 Status do Projeto

✅ **Build criado:** `/tmp/cc-agent/57679597/project/dist/`
✅ **Tamanho:** 3.5 MB (~650 KB gzipped)
✅ **Configuração:** `netlify.toml` criado
✅ **SPA Routing:** Configurado
✅ **SEO:** robots.txt + sitemap.xml
✅ **PWA:** manifest.json
✅ **Segurança:** Headers de segurança configurados

---

## 🔍 Verificações Pós-Deploy

Após o deploy, teste:

### ✅ Básico
- [ ] Site carrega com HTTPS
- [ ] Nenhum erro 404 nos assets
- [ ] Favicon aparece corretamente

### ✅ Funcionalidades
- [ ] Login/Logout funciona
- [ ] Upload de PDF funciona
- [ ] Dashboard carrega
- [ ] Chat abre corretamente

### ✅ Mobile
- [ ] Abrir em dispositivo móvel
- [ ] Testar chat (header e input fixos)
- [ ] Sem scroll horizontal
- [ ] Testar em iOS e Android

### ✅ Performance
- [ ] Lighthouse: Performance > 90
- [ ] Lighthouse: Accessibility > 95
- [ ] Lighthouse: Best Practices > 95
- [ ] Lighthouse: SEO = 100

---

## 🐛 Troubleshooting

### Problema: Site mostra página em branco

**Causa:** Variáveis de ambiente não configuradas

**Solução:**
1. Adicionar as 3 variáveis no dashboard da Netlify
2. Fazer redeploy (Trigger deploy → Clear cache)

### Problema: 404 ao navegar

**Causa:** SPA redirects não configurados

**Solução:**
- Verificar se `_redirects` está em `dist/`
- Verificar se `netlify.toml` está no root do projeto

### Problema: Build falha

**Solução:**
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

---

## 🎉 Tudo Pronto!

O projeto está 100% preparado para deploy. Escolha uma das opções acima e em menos de 5 minutos seu site estará no ar!

**Arquivos importantes:**
- ✅ `dist/` - Build pronto
- ✅ `netlify.toml` - Configuração da Netlify
- ✅ `.env.example` - Template das variáveis

**Próximos passos:**
1. Escolher opção de deploy acima
2. Executar deploy
3. Testar em produção
4. Monitorar por 24h

---

**Data:** 03/11/2025
**Status:** ✅ Pronto para produção
**Build:** ✅ Compilado com sucesso

🚀 **Boa sorte com o deploy!**
