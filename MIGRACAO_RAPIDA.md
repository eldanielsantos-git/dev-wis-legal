# 🚀 Migração Rápida de Usuários - ARRJ-Dev

## ❌ O Que NÃO Funcionou
Executar SQL direto em `auth.users` via SQL Editor (sem permissões).

## ✅ Solução Implementada
Edge Function `admin-migrate-users` (já deployada) que usa Admin API.

---

## 📋 Como Executar (2 Minutos)

### 1️⃣ Obter Token Admin
```javascript
// No console do navegador (F12), após login como admin:
(await supabase.auth.getSession()).data.session.access_token
```

### 2️⃣ Executar no Postman
```
POST https://rslpleprodloodfsaext.supabase.co/functions/v1/admin-migrate-users

Headers:
Authorization: Bearer [SEU_TOKEN_AQUI]
Content-Type: application/json

Body:
[Cole todo o conteúdo de MIGRATION_USERS_DATA.json]
```

### 3️⃣ Verificar
- Dashboard > Authentication > Users
- Verá os 5 usuários migrados! 🎉

---

## 👥 Usuários que Serão Migrados

- ✅ **daniel@dmzdigital.com.br** (Admin, senha preservada)
- ✅ **jp@dmzdigital.com.br** (Admin, senha preservada)
- ✅ **rauppj3@gmail.com** (Google OAuth)
- ✅ **jp+2025@dmzdigital.com.br** (senha preservada)
- ✅ **twaning2222@gmail.com** (Google OAuth)

---

## 🔒 O Que é Preservado

- ✅ IDs originais (integridade referencial)
- ✅ Senhas encriptadas (login funciona)
- ✅ OAuth tokens (Google login funciona)
- ✅ Metadados (avatares, nomes, etc)
- ✅ Permissões admin
- ✅ Datas de criação

---

**Arquivo de dados**: `MIGRATION_USERS_DATA.json`
**Guia completo**: `GUIA_MIGRACAO_USUARIOS.md`
