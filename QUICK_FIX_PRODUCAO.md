# 🚨 CORREÇÃO RÁPIDA - SITE NÃO CARREGA EM PRODUÇÃO

## ❌ PROBLEMA
Site mostra tela preta com erro:
```
Missing Supabase URL or Anon Key
```

## ✅ SOLUÇÃO (5 minutos)

### 1️⃣ Configure as Variáveis no Netlify

Acesse: **Netlify Dashboard** → **Seu Site** → **Site Settings** → **Environment Variables**

Adicione estas 3 variáveis:

```
VITE_SUPABASE_URL
https://rslpleprodloodfsaext.supabase.co

VITE_SUPABASE_ANON_KEY
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzbHBsZXByb2Rsb29kZnNhZXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyNDIzNTUsImV4cCI6MjA3OTgxODM1NX0.gzpmv2kIe64e1CZ63HLn_43prFJlDT_IVz--shvDVkg

VITE_STRIPE_PUBLISHABLE_KEY
pk_live_51SEWMCJrr43cGTt4lwxCOvlVNMBEYpFjRRSQdIK7mGSzVY6QCUt6UbU8vWWcWd3mKSKVUdJz9C88I0HU7TyEPZux00gHXi4jNl
```

**IMPORTANTE:** Marque todos os Scopes (Production, Deploy previews, Branch deploys)

### 2️⃣ Faça Novo Deploy

**Opção A - Manual:**
- Vá em **Deploys** → **Trigger deploy** → **Deploy site**

**Opção B - Git:**
```bash
git add .
git commit -m "fix: adicionar variáveis de ambiente"
git push
```

### 3️⃣ Teste

Após o deploy:
1. Abra em **aba anônima**
2. Abra **Developer Tools (F12)**
3. Vá em **Console**
4. Deve aparecer: ✅ `Supabase client created successfully`

---

## 📖 Documentação Completa

Veja `CONFIGURAR_ENV_NETLIFY.md` para instruções detalhadas.

---

## ⚡ Solução Imediata

1. ✅ Adicionar variáveis no Netlify
2. ✅ Fazer novo deploy
3. ✅ Testar em aba anônima
4. ✅ Pronto! Site funcionando

**Tempo estimado:** 5 minutos
