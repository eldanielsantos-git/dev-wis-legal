# 🔧 Configurar Variáveis de Ambiente no Netlify

## 🚨 PROBLEMA IDENTIFICADO

O erro no console mostra:
```
❌ [supabase.ts] Missing Supabase credentials!
❌ Missing Supabase URL or Anon Key
```

**Causa:** As variáveis de ambiente não estão configuradas no Netlify.

---

## ✅ SOLUÇÃO: Configurar Variáveis no Netlify

### 📋 **Passo 1: Acessar Configurações do Site**

1. Entre no [Netlify Dashboard](https://app.netlify.com/)
2. Selecione seu site **wislegal.io** (ou o nome do seu site)
3. Vá em **Site settings** (Configurações do site)
4. No menu lateral, clique em **Environment variables** (Variáveis de ambiente)

---

### 📋 **Passo 2: Adicionar as Variáveis**

Clique em **Add a variable** e adicione TODAS estas variáveis:

#### **1. VITE_SUPABASE_URL**
```
Key: VITE_SUPABASE_URL
Value: https://rslpleprodloodfsaext.supabase.co
Scopes: ✅ Production, ✅ Deploy previews, ✅ Branch deploys
```

#### **2. VITE_SUPABASE_ANON_KEY**
```
Key: VITE_SUPABASE_ANON_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzbHBsZXByb2Rsb29kZnNhZXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyNDIzNTUsImV4cCI6MjA3OTgxODM1NX0.gzpmv2kIe64e1CZ63HLn_43prFJlDT_IVz--shvDVkg
Scopes: ✅ Production, ✅ Deploy previews, ✅ Branch deploys
```

#### **3. VITE_STRIPE_PUBLISHABLE_KEY**
```
Key: VITE_STRIPE_PUBLISHABLE_KEY
Value: pk_live_51SEWMCJrr43cGTt4lwxCOvlVNMBEYpFjRRSQdIK7mGSzVY6QCUt6UbU8vWWcWd3mKSKVUdJz9C88I0HU7TyEPZux00gHXi4jNl
Scopes: ✅ Production, ✅ Deploy previews, ✅ Branch deploys
```

---

### 📋 **Passo 3: Fazer Novo Deploy**

Após adicionar as variáveis, você precisa fazer um novo deploy:

**Opção 1 - Trigger Deploy Manualmente:**
1. Vá em **Deploys**
2. Clique em **Trigger deploy**
3. Selecione **Deploy site**

**Opção 2 - Fazer Push no Git:**
```bash
git add .
git commit -m "fix: configurar variáveis de ambiente"
git push
```

---

### 📋 **Passo 4: Verificar se Funcionou**

Após o deploy completar:

1. ✅ Abra o site em uma **aba anônima**
2. ✅ Abra o **Developer Tools** (F12)
3. ✅ Vá para a aba **Console**
4. ✅ Recarregue a página

**Você deve ver:**
```
✅ [supabase.ts] Initializing Supabase client
✅ [supabase.ts] URL: https://rslpleprodloodfsaext.supabase.co
✅ [supabase.ts] Key exists: true
✅ [supabase.ts] Supabase client created successfully
✅ [main.tsx] Starting application
✅ [main.tsx] Root element found, rendering app
✅ [main.tsx] App rendered successfully
```

**Se ainda aparecer erro:**
- Verifique se digitou as variáveis corretamente (sem espaços extras)
- Verifique se marcou os **Scopes** corretos
- Faça **Clear cache and deploy site** no Netlify

---

## 🎯 **Checklist Completo**

- [ ] Acessei o Netlify Dashboard
- [ ] Entrei em Site Settings → Environment Variables
- [ ] Adicionei `VITE_SUPABASE_URL`
- [ ] Adicionei `VITE_SUPABASE_ANON_KEY`
- [ ] Adicionei `VITE_STRIPE_PUBLISHABLE_KEY`
- [ ] Marquei todos os Scopes (Production, Deploy previews, Branch deploys)
- [ ] Fiz um novo deploy (Trigger deploy ou Git push)
- [ ] Aguardei o deploy completar
- [ ] Testei em aba anônima
- [ ] Verifiquei os logs no Console (F12)
- [ ] Site está funcionando! ✅

---

## 🔍 **Como Verificar as Variáveis**

**No Netlify (antes do build):**
1. Site Settings → Environment Variables
2. Deve mostrar as 3 variáveis listadas

**No Console do Navegador (depois do deploy):**
```javascript
// Abra o Console (F12) e digite:
console.log(import.meta.env.VITE_SUPABASE_URL);
// Deve mostrar: https://rslpleprodloodfsaext.supabase.co
```

**IMPORTANTE:** Se retornar `undefined`, as variáveis não foram configuradas corretamente.

---

## ⚠️ **Erros Comuns**

### ❌ **Erro 1: Variável retorna undefined**
**Causa:** Nome da variável incorreto ou faltando prefixo `VITE_`
**Solução:** Vite só expõe variáveis que começam com `VITE_`

### ❌ **Erro 2: Funciona localmente mas não em produção**
**Causa:** Arquivo `.env` local existe, mas variáveis não estão no Netlify
**Solução:** Configurar as variáveis no Netlify (este guia)

### ❌ **Erro 3: Deploy antigo ainda aparece**
**Causa:** Cache do navegador ou CDN
**Solução:**
- Hard refresh: `Ctrl+Shift+R` (Windows) ou `Cmd+Shift+R` (Mac)
- Ou testar em aba anônima

---

## 📸 **Exemplo Visual**

No Netlify, após configurar, você deve ver algo assim:

```
Environment variables (3)

┌─────────────────────────────────┬─────────────────┬────────────────────────┐
│ Key                             │ Scopes          │ Value                  │
├─────────────────────────────────┼─────────────────┼────────────────────────┤
│ VITE_SUPABASE_URL               │ All             │ https://rslple...      │
│ VITE_SUPABASE_ANON_KEY          │ All             │ eyJhbGciOiJIUzI1...    │
│ VITE_STRIPE_PUBLISHABLE_KEY     │ All             │ pk_live_51SEWMC...     │
└─────────────────────────────────┴─────────────────┴────────────────────────┘
```

---

## 🎉 **Resultado Esperado**

Após seguir todos os passos:
- ✅ Site carrega normalmente (sem tela preta)
- ✅ Supabase conecta corretamente
- ✅ Login/Registro funcionam
- ✅ Todos os recursos do site funcionam
- ✅ Sem erros no console

---

## 🆘 **Precisa de Ajuda?**

Se ainda não funcionar após seguir todos os passos:

1. Tire um print da tela de Environment Variables no Netlify
2. Tire um print do Console (F12) mostrando os erros
3. Verifique o log do deploy no Netlify (Deploys → clique no último deploy → Ver log)
4. Procure por erros durante o build

---

## 📝 **Nota Importante**

**NUNCA** comite o arquivo `.env` no Git! Ele está no `.gitignore` por segurança.

As variáveis de ambiente devem SEMPRE ser configuradas:
- ✅ Localmente: arquivo `.env` (não commitado)
- ✅ Produção: Netlify Environment Variables (este guia)
- ✅ CI/CD: No serviço de CI (GitHub Actions, etc)
