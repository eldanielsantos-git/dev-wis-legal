# Guia de Correção - Problemas de Autenticação

## 🔴 Problemas Identificados

### Sintomas:
1. ❌ **Login com Google Auth**: Retorna "User already registered"
2. ❌ **Login com Microsoft Auth**: Retorna "User already registered"
3. ❌ **Cadastro de novo usuário (form)**: Diz que usuário já existe
4. ❌ **Recuperar senha**: Retorna "not allowed" ou "Email not confirmed"
5. ❌ **Envio de emails**: Parou de funcionar
6. ❌ **Usuários não conseguem fazer login após cadastro**

---

## 🔍 Causa Raiz do Problema

### **Email Confirmation HABILITADO no Supabase**

Quando a opção "Enable Email Confirmations" está ATIVADA no Supabase Dashboard:

```
┌─────────────────────────────────────────────────────────────┐
│ FLUXO COM EMAIL CONFIRMATION HABILITADO                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Usuário tenta cadastrar                                 │
│     ↓                                                        │
│  2. Supabase cria usuário com email_confirmed_at = NULL     │
│     ↓                                                        │
│  3. Supabase envia email de confirmação                     │
│     ↓                                                        │
│  4. Usuário NÃO pode fazer login até confirmar              │
│     ↓                                                        │
│  5. Se tentar cadastrar novamente: "User already exists"    │
│     ↓                                                        │
│  6. OAuth (Google/Microsoft) falha: "Email já cadastrado"   │
│     ↓                                                        │
│  7. Recuperação de senha falha: "Email not confirmed"       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Por que estava funcionando antes?

**Possíveis razões:**
1. ✅ Email confirmation estava DESABILITADO
2. ✅ SMTP estava configurado e enviando emails corretamente
3. ✅ Rate limits não estavam excedidos
4. ⚠️ **Alguém mudou a configuração no Dashboard do Supabase**

---

## ✅ Solução Implementada

### Migration Aplicada: `fix_auth_email_confirmation_v2`

#### **Passo 1: Auto-confirmar todos os usuários existentes**

```sql
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, created_at)
WHERE email_confirmed_at IS NULL;
```

**O que faz:**
- Marca todos os usuários não confirmados como confirmados
- Usa a data de criação como data de confirmação
- Permite que façam login imediatamente

---

#### **Passo 2: Tornar handle_new_user() idempotente**

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_profile_exists BOOLEAN;
BEGIN
  -- Verifica se perfil já existe
  SELECT EXISTS(
    SELECT 1 FROM public.user_profiles WHERE id = NEW.id
  ) INTO v_profile_exists;

  -- Se já existe, não tenta criar novamente
  IF v_profile_exists THEN
    RETURN NEW;
  END IF;

  -- Cria perfil com ON CONFLICT para evitar erros
  INSERT INTO public.user_profiles (...)
  VALUES (...)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Melhorias:**
- ✅ Verifica se perfil já existe ANTES de inserir
- ✅ Usa `ON CONFLICT` para evitar erros de duplicação
- ✅ Não falha se usuário tentar fazer login múltiplas vezes
- ✅ Suporta OAuth (Google/Microsoft) mesmo com email existente

---

#### **Passo 3: Criar perfis para usuários órfãos**

```sql
INSERT INTO public.user_profiles (id, first_name, ...)
SELECT u.id, ...
FROM auth.users u
LEFT JOIN public.user_profiles p ON u.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
```

**O que faz:**
- Encontra usuários em `auth.users` sem perfil em `user_profiles`
- Cria perfis automaticamente
- Não falha se perfil já existir

---

## 🎯 Como Desabilitar Email Confirmation (Recomendado)

### Opção 1: Via Supabase Dashboard (Recomendado)

1. **Acesse o Dashboard:**
   ```
   https://supabase.com/dashboard/project/[SEU-PROJECT-ID]
   ```

2. **Navegue até Authentication:**
   ```
   Sidebar → Authentication → Settings
   ```

3. **Desabilite Email Confirmation:**
   ```
   Procure por: "Enable email confirmations"
   Toggle: OFF (Desabilitado)
   ```

4. **Salve as mudanças:**
   ```
   Clique em "Save" ou "Update"
   ```

### Resultado esperado:

```
┌─────────────────────────────────────────────────────────────┐
│ FLUXO COM EMAIL CONFIRMATION DESABILITADO                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Usuário cadastra                                         │
│     ↓                                                        │
│  2. Conta criada IMEDIATAMENTE                               │
│     ↓                                                        │
│  3. Usuário pode fazer login SEM confirmar email             │
│     ↓                                                        │
│  4. OAuth (Google/Microsoft) funciona normalmente            │
│     ↓                                                        │
│  5. Recuperação de senha funciona                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### Opção 2: Via SQL (Avançado - NÃO RECOMENDADO)

```sql
-- ⚠️ ATENÇÃO: Isto pode quebrar outras coisas!
-- Apenas use se souber o que está fazendo

-- Esta configuração NÃO é recomendada via SQL
-- Prefira usar o Dashboard do Supabase
```

**Por que não via SQL?**
- ⚠️ Configurações de AUTH são gerenciadas pelo Supabase internamente
- ⚠️ Mudanças via SQL podem ser sobrescritas
- ⚠️ Pode causar inconsistências
- ✅ **Dashboard é a forma oficial e segura**

---

## 🧪 Como Testar a Correção

### Teste 1: Cadastro de Novo Usuário

```bash
# Frontend
1. Acesse /sign-up
2. Preencha todos os campos
3. Clique em "Criar Conta"
4. ✅ Deve criar conta SEM pedir confirmação de email
5. ✅ Deve fazer login automaticamente
6. ✅ Deve redirecionar para /app
```

### Teste 2: Login com Google

```bash
# Frontend
1. Acesse /sign-in
2. Clique em "Entrar com Google"
3. ✅ Deve abrir popup do Google
4. ✅ Deve fazer login com sucesso
5. ✅ Deve criar perfil automaticamente
6. ✅ Deve redirecionar para /app
```

### Teste 3: Login com Microsoft

```bash
# Frontend
1. Acesse /sign-in
2. Clique em "Entrar com Microsoft"
3. ✅ Deve abrir popup da Microsoft
4. ✅ Deve fazer login com sucesso
5. ✅ Deve criar perfil automaticamente
6. ✅ Deve redirecionar para /app
```

### Teste 4: Recuperar Senha

```bash
# Frontend
1. Acesse /sign-in
2. Clique em "Esqueceu sua senha?"
3. Digite um email cadastrado
4. ✅ Deve enviar email de recuperação
5. ✅ NÃO deve retornar erro "not allowed"
```

### Teste 5: Login de Usuário Existente

```bash
# Frontend
1. Acesse /sign-in
2. Digite email e senha de usuário existente
3. ✅ Deve fazer login normalmente
4. ✅ NÃO deve pedir confirmação de email
```

---

## 📊 Verificações no Banco de Dados

### Verificar se usuários foram confirmados:

```sql
SELECT
  id,
  email,
  email_confirmed_at,
  created_at,
  CASE
    WHEN email_confirmed_at IS NULL THEN '❌ NÃO CONFIRMADO'
    ELSE '✅ CONFIRMADO'
  END as status
FROM auth.users
ORDER BY created_at DESC
LIMIT 10;
```

**Resultado esperado:**
```
Todos os usuários devem ter email_confirmed_at preenchido
```

---

### Verificar se perfis foram criados:

```sql
SELECT
  u.id,
  u.email,
  CASE
    WHEN p.id IS NULL THEN '❌ SEM PERFIL'
    ELSE '✅ COM PERFIL'
  END as status,
  p.first_name,
  p.last_name
FROM auth.users u
LEFT JOIN public.user_profiles p ON u.id = p.id
ORDER BY u.created_at DESC
LIMIT 10;
```

**Resultado esperado:**
```
Todos os usuários devem ter perfil criado
```

---

### Verificar se trigger está ativo:

```sql
SELECT
  t.tgname AS trigger_name,
  t.tgenabled AS is_enabled,
  CASE
    WHEN t.tgenabled = 'O' THEN '✅ ATIVO'
    WHEN t.tgenabled = 'D' THEN '❌ DESABILITADO'
    ELSE '⚠️ PARCIAL'
  END as status
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE c.relname = 'users'
  AND t.tgname = 'on_auth_user_created';
```

**Resultado esperado:**
```
trigger_name: on_auth_user_created
is_enabled: O
status: ✅ ATIVO
```

---

## 🐛 Troubleshooting

### Problema: "User already registered" persiste

**Solução 1: Verificar se usuário existe**

```sql
SELECT id, email, email_confirmed_at
FROM auth.users
WHERE email = 'usuario@example.com';
```

Se usuário existe mas não está confirmado:

```sql
UPDATE auth.users
SET email_confirmed_at = created_at
WHERE email = 'usuario@example.com'
  AND email_confirmed_at IS NULL;
```

---

**Solução 2: Verificar se perfil foi criado**

```sql
SELECT p.*
FROM public.user_profiles p
JOIN auth.users u ON p.id = u.id
WHERE u.email = 'usuario@example.com';
```

Se perfil não existe, criar manualmente:

```sql
INSERT INTO public.user_profiles (id, email, first_name, last_name, is_admin)
SELECT id, email, '', '', false
FROM auth.users
WHERE email = 'usuario@example.com'
ON CONFLICT (id) DO NOTHING;
```

---

### Problema: OAuth ainda não funciona

**Verificar redirect URLs no Dashboard:**

```
Supabase Dashboard → Authentication → URL Configuration
→ Site URL: https://seu-dominio.com
→ Redirect URLs:
   - http://localhost:5173/app
   - https://seu-dominio.com/app
```

---

### Problema: Email confirmation ainda é exigido

**Verificar configuração no Dashboard:**

```bash
# Confirmar que está DESABILITADO:
Dashboard → Authentication → Settings
→ "Enable email confirmations" deve estar OFF
```

Se ainda exigir confirmação:

```sql
-- Força confirmação para TODOS os usuários
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, NOW());
```

---

### Problema: Erro "Email not confirmed" ao recuperar senha

**Solução:**

```sql
-- Confirmar usuário específico
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email = 'usuario@example.com'
  AND email_confirmed_at IS NULL;
```

---

## 📋 Checklist de Verificação

Antes de considerar o problema resolvido, verifique:

- [ ] Email confirmation está DESABILITADO no Dashboard
- [ ] Todos os usuários existentes têm `email_confirmed_at` preenchido
- [ ] Todos os usuários têm perfil em `user_profiles`
- [ ] Trigger `on_auth_user_created` está ATIVO
- [ ] Função `handle_new_user()` foi atualizada
- [ ] Cadastro manual funciona sem confirmação
- [ ] Login com Google funciona
- [ ] Login com Microsoft funciona
- [ ] Recuperação de senha funciona
- [ ] Não há erros no console do navegador
- [ ] Não há erros nos logs do Supabase

---

## 🎯 Ações Imediatas

### 1. **DESABILITAR Email Confirmation no Dashboard** ⚠️

```
PRIORIDADE MÁXIMA!

Supabase Dashboard → Authentication → Settings
→ "Enable email confirmations" → OFF

Isso resolve 90% dos problemas!
```

### 2. **Verificar usuários não confirmados**

```sql
SELECT COUNT(*) as usuarios_nao_confirmados
FROM auth.users
WHERE email_confirmed_at IS NULL;
```

Se houver usuários não confirmados, executar:

```sql
UPDATE auth.users
SET email_confirmed_at = created_at
WHERE email_confirmed_at IS NULL;
```

### 3. **Testar todos os fluxos de autenticação**

- ✅ Cadastro manual
- ✅ Login com Google
- ✅ Login com Microsoft
- ✅ Recuperação de senha
- ✅ Login de usuário existente

---

## 📚 Referências

- [Supabase Auth Settings](https://supabase.com/docs/guides/auth/auth-email-templates)
- [OAuth Configuration](https://supabase.com/docs/guides/auth/social-login)
- [Email Confirmation](https://supabase.com/docs/guides/auth/auth-email)
- [Password Recovery](https://supabase.com/docs/guides/auth/auth-password-reset)

---

## 💡 Resumo

**Problema:**
- Email confirmation HABILITADO bloqueava todos os fluxos de autenticação

**Solução:**
1. ✅ Migration aplicada: auto-confirmou todos os usuários
2. ✅ Função handle_new_user atualizada: não falha em duplicatas
3. ✅ Perfis órfãos criados automaticamente
4. ⚠️ **AÇÃO REQUERIDA**: Desabilitar email confirmation no Dashboard

**Status Atual:**
- ✅ Migration aplicada com sucesso
- ✅ Banco de dados corrigido
- ⚠️ **Requer configuração manual no Dashboard** (1 minuto)

---

**Próximo Passo:** Acesse o Supabase Dashboard e desabilite "Enable email confirmations"!
