# 🚀 Como Migrar Usuários via Postman

## Passo a Passo Completo

### 📋 Passo 1: Obter o Token de Autenticação Admin

1. **Acesse o ARRJ-Dev:**
   - URL: https://arrj-dev.netlify.app

2. **Faça login como admin** com uma dessas contas:
   - `daniel@dmzdigital.com.br`
   - `jp@dmzdigital.com.br`

3. **Abra o Developer Tools:**
   - Pressione `F12` no teclado
   - Ou clique com botão direito > "Inspecionar"

4. **Vá para a aba Console**

5. **Cole e execute este comando:**
   ```javascript
   (await supabase.auth.getSession()).data.session.access_token
   ```

6. **Copie o token que aparecer** (algo como):
   ```
   "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzMyNzM..."
   ```

---

### 🔧 Passo 2: Configurar o Postman

#### 2.1 Abrir o Postman
- Se não tiver instalado, baixe em: https://www.postman.com/downloads/
- Ou use a versão web: https://web.postman.com/

#### 2.2 Criar uma Nova Requisição
1. Clique em **"New"** ou **"+"**
2. Selecione **"HTTP Request"**

#### 2.3 Configurar a URL
```
POST https://rslpleprodloodfsaext.supabase.co/functions/v1/admin-migrate-users
```

- **Método:** `POST` (selecione no dropdown à esquerda)
- **URL:** Cole a URL acima no campo de URL

---

### 📝 Passo 3: Configurar os Headers

1. Clique na aba **"Headers"**

2. Adicione os seguintes headers:

| Key | Value |
|-----|-------|
| `Authorization` | `Bearer SEU_TOKEN_AQUI` |
| `Content-Type` | `application/json` |

**IMPORTANTE:** Substitua `SEU_TOKEN_AQUI` pelo token que você copiou no Passo 1.

Exemplo:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzMyNzM...
Content-Type: application/json
```

---

### 📦 Passo 4: Configurar o Body

1. Clique na aba **"Body"**

2. Selecione **"raw"**

3. No dropdown à direita, selecione **"JSON"**

4. **Cole TODO o conteúdo do arquivo `MIGRATION_USERS_DATA.json`:**

```json
{
  "users": [
    {
      "id": "87a4f9e4-db30-4dfe-957d-8122b66b7015",
      "email": "daniel@dmzdigital.com.br",
      "encrypted_password": "$2a$10$fDqhj.Jx0NxmO.3YUf1P4ehnxwUBxtOzJtwgcU.ldjAsHiMcTOvDG",
      "email_confirmed_at": "2025-10-06 23:12:53.56099+00",
      "raw_app_meta_data": {
        "provider": "email",
        "providers": ["email", "google"]
      },
      "raw_user_meta_data": {
        "iss": "https://accounts.google.com",
        "sub": "114622583704731644631",
        "name": "Daniel Santos",
        "email": "daniel@dmzdigital.com.br",
        "picture": "https://lh3.googleusercontent.com/a/ACg8ocJE8ftCqlMn4XRoZhQrlgo61woKUWHIywyyYV5TjZYRRpUjnpQ=s96-c",
        "full_name": "Daniel Santos",
        "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocJE8ftCqlMn4XRoZhQrlgo61woKUWHIywyyYV5TjZYRRpUjnpQ=s96-c",
        "provider_id": "114622583704731644631",
        "custom_claims": {
          "hd": "dmzdigital.com.br"
        },
        "email_verified": true,
        "phone_verified": false
      },
      "created_at": "2025-10-06 23:12:53.56099+00",
      "updated_at": "2025-11-27 14:07:50.469951+00",
      "last_sign_in_at": "2025-11-26 00:01:05.161935+00",
      "profile": {
        "first_name": "Daniel",
        "last_name": "Santos",
        "avatar_url": "https://zvlqcxiwsrziuodiotar.supabase.co/storage/v1/object/public/avatars/87a4f9e4-db30-4dfe-957d-8122b66b7015/avatar.JPG",
        "oab": null,
        "phone": "+55 11987556013",
        "phone_country_code": "+55",
        "city": "São Paulo",
        "state": "SP",
        "is_admin": true,
        "theme_preference": "dark",
        "terms_accepted_at": "2025-10-06 23:12:53.56099+00",
        "email": "daniel@dmzdigital.com.br"
      }
    },
    {
      "id": "45ef022b-5963-42b9-9bc3-936a1d3de22a",
      "email": "jp@dmzdigital.com.br",
      "encrypted_password": "$2a$06$PzWPKSumoVUY9NvVLijuYuJpnWpbJtS1m0sIGjF89WzaXZZbPZl5K",
      "email_confirmed_at": "2025-10-06 23:14:28.031418+00",
      "raw_app_meta_data": {
        "provider": "email",
        "providers": ["email", "google"]
      },
      "raw_user_meta_data": {
        "iss": "https://accounts.google.com",
        "sub": "114847590530701049214",
        "name": "João Pedro Raupp",
        "email": "jp@dmzdigital.com.br",
        "picture": "https://lh3.googleusercontent.com/a/ACg8ocJEnkaVC3egchkccj1tATS7CKywRjVbMhv2FcekVDv4u-1PXw=s96-c",
        "full_name": "João Pedro Raupp",
        "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocJEnkaVC3egchkccj1tATS7CKywRjVbMhv2FcekVDv4u-1PXw=s96-c",
        "provider_id": "114847590530701049214",
        "custom_claims": {
          "hd": "dmzdigital.com.br"
        },
        "email_verified": true,
        "phone_verified": false
      },
      "created_at": "2025-10-06 23:14:28.031418+00",
      "updated_at": "2025-11-27 13:31:10.308732+00",
      "last_sign_in_at": "2025-11-25 12:14:00.358558+00",
      "profile": {
        "first_name": "João Pedro",
        "last_name": "Raupp",
        "avatar_url": "",
        "oab": "61.178",
        "phone": "+55 (11) 95801-4505",
        "phone_country_code": "+55",
        "city": "Pelotas",
        "state": "Rio Grande do Sul",
        "is_admin": true,
        "theme_preference": "dark",
        "terms_accepted_at": "2025-10-06 23:14:28.031418+00",
        "email": "jp@dmzdigital.com.br"
      }
    },
    {
      "id": "4981cbe6-ce57-440f-aedc-46aefe0b275f",
      "email": "rauppj3@gmail.com",
      "encrypted_password": null,
      "email_confirmed_at": "2025-11-19 20:55:03.232971+00",
      "raw_app_meta_data": {
        "provider": "google",
        "providers": ["google"]
      },
      "raw_user_meta_data": {
        "iss": "https://accounts.google.com",
        "sub": "104090152326855810411",
        "name": "Joao Raupp",
        "email": "rauppj3@gmail.com",
        "picture": "https://lh3.googleusercontent.com/a/ACg8ocLUwUds9U6A1g0bNlrxnY-RLOZ4AA-Np3Ml8P6obsy2lXiycg=s96-c",
        "full_name": "Joao Raupp",
        "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocLUwUds9U6A1g0bNlrxnY-RLOZ4AA-Np3Ml8P6obsy2lXiycg=s96-c",
        "provider_id": "104090152326855810411",
        "email_verified": true,
        "phone_verified": false
      },
      "created_at": "2025-11-19 20:55:03.222293+00",
      "updated_at": "2025-11-25 13:14:05.341775+00",
      "last_sign_in_at": "2025-11-19 20:55:03.234734+00",
      "profile": {
        "first_name": "Joao",
        "last_name": "Raupp",
        "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocLUwUds9U6A1g0bNlrxnY-RLOZ4AA-Np3Ml8P6obsy2lXiycg=s96-c",
        "oab": null,
        "phone": null,
        "phone_country_code": "+55",
        "city": null,
        "state": null,
        "is_admin": false,
        "theme_preference": "dark",
        "terms_accepted_at": "2025-11-19 20:55:03.219918+00",
        "email": "rauppj3@gmail.com"
      }
    },
    {
      "id": "c805c172-3d3d-4fbd-870c-a8a08706a86a",
      "email": "jp+2025@dmzdigital.com.br",
      "encrypted_password": "$2a$10$KP3WtrVXx6Saa/F0L5WEqejA1UTMMZYmOHjF9Ouc/EYwJ8nuQy4BK",
      "email_confirmed_at": "2025-11-20 13:37:01.762068+00",
      "raw_app_meta_data": {
        "provider": "email",
        "providers": ["email"]
      },
      "raw_user_meta_data": {
        "oab": "88.888",
        "sub": "c805c172-3d3d-4fbd-870c-a8a08706a86a",
        "city": "Pelotas",
        "email": "jp+2025@dmzdigital.com.br",
        "phone": "(11) 95801-4505",
        "state": "Rio Grande do Sul",
        "last_name": "Teste Pg",
        "first_name": "Joao",
        "email_verified": true,
        "phone_verified": false,
        "phone_country_code": "+55"
      },
      "created_at": "2025-11-20 13:36:09.763513+00",
      "updated_at": "2025-11-20 13:37:01.767852+00",
      "last_sign_in_at": "2025-11-20 13:37:01.765144+00",
      "profile": {
        "first_name": "Joao",
        "last_name": "Teste Pg",
        "avatar_url": null,
        "oab": "88.888",
        "phone": "(11) 95801-4505",
        "phone_country_code": "+55",
        "city": "Pelotas",
        "state": "Rio Grande do Sul",
        "is_admin": false,
        "theme_preference": "dark",
        "terms_accepted_at": "2025-11-20 13:36:09.763178+00",
        "email": "jp+2025@dmzdigital.com.br"
      }
    },
    {
      "id": "5429474f-97c2-4e61-b537-0da7099a85b1",
      "email": "twaning2222@gmail.com",
      "encrypted_password": null,
      "email_confirmed_at": "2025-11-25 12:18:10.359766+00",
      "raw_app_meta_data": {
        "provider": "google",
        "providers": ["google"]
      },
      "raw_user_meta_data": {
        "iss": "https://accounts.google.com",
        "sub": "103879016658438473014",
        "name": "Twan",
        "email": "twaning2222@gmail.com",
        "picture": "https://lh3.googleusercontent.com/a/ACg8ocKRwhs0O3Inhmx6k0dDb0VsU80oMgAkvt6Paj4bkWcORanTmts=s96-c",
        "full_name": "Twan",
        "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocKRwhs0O3Inhmx6k0dDb0VsU80oMgAkvt6Paj4bkWcORanTmts=s96-c",
        "provider_id": "103879016658438473014",
        "email_verified": true,
        "phone_verified": false
      },
      "created_at": "2025-11-25 12:18:10.342809+00",
      "updated_at": "2025-11-25 12:18:10.365863+00",
      "last_sign_in_at": "2025-11-25 12:18:10.36338+00",
      "profile": {
        "first_name": "Twan",
        "last_name": "",
        "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocKRwhs0O3Inhmx6k0dDb0VsU80oMgAkvt6Paj4bkWcORanTmts=s96-c",
        "oab": null,
        "phone": null,
        "phone_country_code": "+55",
        "city": null,
        "state": null,
        "is_admin": false,
        "theme_preference": "dark",
        "terms_accepted_at": "2025-11-25 12:18:10.336154+00",
        "email": "twaning2222@gmail.com"
      }
    }
  ]
}
```

---

### 🚀 Passo 5: Executar a Requisição

1. **Revise tudo:**
   - ✅ URL está correta
   - ✅ Método é POST
   - ✅ Headers estão configurados (Authorization e Content-Type)
   - ✅ Body tem o JSON completo

2. **Clique no botão "Send"** (azul, no canto superior direito)

3. **Aguarde a resposta** (aparecerá na parte inferior do Postman)

---

### ✅ Passo 6: Verificar o Resultado

#### Resposta de Sucesso:
```json
{
  "success": true,
  "message": "Migração concluída: 5 usuários criados, 0 falhas",
  "progress": [
    {
      "user_email": "daniel@dmzdigital.com.br",
      "auth_created": true,
      "profile_created": true
    },
    {
      "user_email": "jp@dmzdigital.com.br",
      "auth_created": true,
      "profile_created": true
    },
    {
      "user_email": "rauppj3@gmail.com",
      "auth_created": true,
      "profile_created": true
    },
    {
      "user_email": "jp+2025@dmzdigital.com.br",
      "auth_created": true,
      "profile_created": true
    },
    {
      "user_email": "twaning2222@gmail.com",
      "auth_created": true,
      "profile_created": true
    }
  ]
}
```

#### Status Code Esperado: `200 OK`

---

### 🎉 Passo 7: Confirmar no Dashboard

1. **Acesse o Dashboard do Supabase:**
   - https://supabase.com/dashboard/project/rslpleprodloodfsaext

2. **Vá para Authentication > Users**

3. **Você verá os 5 usuários migrados! 🎉**

---

## 🚨 Possíveis Erros e Soluções

### Erro 401: "Unauthorized"
**Causa:** Token inválido ou expirado
**Solução:** Gere um novo token (Passo 1) e atualize no Header

### Erro 403: "Admin access required"
**Causa:** Usuário logado não é admin
**Solução:** Faça login com `daniel@dmzdigital.com.br` ou `jp@dmzdigital.com.br`

### Erro 400: "users array is required"
**Causa:** JSON do body está malformado
**Solução:** Verifique se colou o JSON completo e se está válido

### Status 500: "Internal server error"
**Causa:** Erro no servidor
**Solução:** Verifique os logs da Edge Function no Dashboard Supabase

---

## 📸 Checklist Visual do Postman

```
┌─────────────────────────────────────────────────────┐
│ POST  https://rslpleprodloodfsaext.supabase.co/... │  [Send]
├─────────────────────────────────────────────────────┤
│ Params  Authorization  Headers  Body  Pre-request  │
│                                                     │
│ ✓ Headers:                                         │
│   Authorization: Bearer eyJhbGc...                 │
│   Content-Type: application/json                   │
│                                                     │
│ ✓ Body (raw - JSON):                              │
│   { "users": [ ... ] }                            │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 💾 Salvar para Uso Futuro

Após configurar, você pode:
1. Clicar em **"Save"** no Postman
2. Nomear: "Migrar Usuários ARRJ-Dev"
3. Salvar em uma Collection para reutilizar depois

**Obs:** Lembre-se de atualizar o token sempre que executar!

---

## 📞 Precisa de Ajuda?

Se encontrar algum problema:
1. Verifique se seguiu todos os passos
2. Confira se o JSON está completo e válido
3. Verifique se o token não expirou (tokens duram ~1 hora)
4. Tente gerar um novo token e executar novamente
