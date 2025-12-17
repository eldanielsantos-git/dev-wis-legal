# OAuth Authentication - Google e Microsoft

Documentação completa do sistema de autenticação social via OAuth.

## Visão Geral

O sistema suporta autenticação via:
- **Google OAuth 2.0** (Sign in with Google)
- **Microsoft Azure AD** (Sign in with Microsoft)
- **Email/Password** (autenticação tradicional)

## Configuração OAuth Google

### 1. Google Cloud Console

#### Criar Projeto

1. Acesse [Google Cloud Console](https://console.cloud.google.com)
2. Crie novo projeto ou selecione existente
3. Habilite **Google+ API**

#### Configurar OAuth Consent Screen

1. APIs & Services → OAuth consent screen
2. **User Type:** External
3. **App Information:**
   - App name: `Wis Legal`
   - User support email: `seu@email.com`
   - Developer contact: `seu@email.com`
4. **Scopes:**
   - `userinfo.email`
   - `userinfo.profile`
   - `openid`
5. **Test users:** Adicione emails para teste
6. Submeta para revisão (produção) ou deixe em teste

#### Criar Credentials

1. APIs & Services → Credentials
2. Create Credentials → OAuth 2.0 Client ID
3. **Application type:** Web application
4. **Name:** Wis Legal Production
5. **Authorized JavaScript origins:**
   ```
   http://localhost:5173
   https://seudominio.com
   https://xxx.supabase.co
   ```
6. **Authorized redirect URIs:**
   ```
   http://localhost:5173/auth/callback
   https://seudominio.com/auth/callback
   https://xxx.supabase.co/auth/v1/callback
   ```
7. Salve e copie:
   - **Client ID**
   - **Client Secret**

### 2. Configuração no Supabase

#### Dashboard

1. Supabase Dashboard → Authentication → Providers
2. Ative **Google**
3. Cole:
   - **Client ID:** (do Google Cloud Console)
   - **Client Secret:** (do Google Cloud Console)
4. **Redirect URL:** Copie e adicione no Google Cloud Console
   ```
   https://xxx.supabase.co/auth/v1/callback
   ```

#### Configurações Adicionais

```sql
-- Site URL (deve bater com frontend)
UPDATE auth.config
SET site_url = 'https://seudominio.com';

-- Redirect URLs permitidas
UPDATE auth.config
SET redirect_urls = ARRAY[
  'http://localhost:5173/**',
  'https://seudominio.com/**'
];
```

### 3. Frontend Integration

```typescript
// SignInPage.tsx ou componente de login

async function handleGoogleSignIn() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent'
      }
    }
  });

  if (error) {
    console.error('Google sign in error:', error);
    toast.error('Erro ao fazer login com Google');
  }
  // User será redirecionado para Google OAuth
}
```

### 4. Callback Handler

```typescript
// pages/AuthCallbackPage.tsx ou similar

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase automaticamente lida com o callback
    // Apenas verificamos se deu certo
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // Login bem-sucedido, redirecionar
        navigate('/dashboard');
      } else {
        // Falhou, voltar para login
        navigate('/signin?error=oauth_failed');
      }
    });
  }, [navigate]);

  return <div>Processando login...</div>;
}
```

### 5. Scopes e Permissões

**Scopes Solicitados:**
- `openid` - Identificador único do usuário
- `email` - Email do usuário
- `profile` - Nome e foto do perfil

**Dados Recebidos:**
```typescript
{
  id: 'google-oauth-id',
  email: 'user@gmail.com',
  user_metadata: {
    full_name: 'João Silva',
    avatar_url: 'https://lh3.googleusercontent.com/...',
    iss: 'https://accounts.google.com',
    sub: '1234567890',
    email_verified: true
  }
}
```

---

## Configuração OAuth Microsoft

### 1. Azure Portal

#### Criar App Registration

1. Acesse [Azure Portal](https://portal.azure.com)
2. Azure Active Directory → App registrations → New registration
3. **Name:** Wis Legal
4. **Supported account types:**
   - Accounts in any organizational directory and personal Microsoft accounts
5. **Redirect URI:**
   - Platform: Web
   - URI: `https://xxx.supabase.co/auth/v1/callback`
6. Register

#### Configurar Authentication

1. Authentication → Platform configurations → Add a platform → Web
2. **Redirect URIs:**
   ```
   http://localhost:5173/auth/callback
   https://seudominio.com/auth/callback
   https://xxx.supabase.co/auth/v1/callback
   ```
3. **Front-channel logout URL:** (opcional)
   ```
   https://seudominio.com/logout
   ```
4. **Implicit grant and hybrid flows:**
   - ☑ ID tokens (used for implicit and hybrid flows)
5. Save

#### API Permissions

1. API permissions → Add a permission → Microsoft Graph
2. **Delegated permissions:**
   - `openid`
   - `email`
   - `profile`
   - `User.Read`
3. Grant admin consent (se necessário)

#### Certificates & Secrets

1. Certificates & secrets → New client secret
2. **Description:** Wis Legal Production Secret
3. **Expires:** 24 months (recomendado)
4. Add
5. **Copie o Value imediatamente** (não será mostrado novamente)

#### Endpoints

1. Overview → Endpoints
2. Copie:
   - **OAuth 2.0 authorization endpoint (v2)**
   - **OAuth 2.0 token endpoint (v2)**

### 2. Configuração no Supabase

#### Dashboard

1. Supabase Dashboard → Authentication → Providers
2. Ative **Azure (Microsoft)**
3. Cole:
   - **Application (client) ID:** (do Azure Portal)
   - **Client Secret:** (do Azure Portal)
   - **Azure Tenant URL:** (se específico, senão use common)
     ```
     https://login.microsoftonline.com/common
     ```

### 3. Frontend Integration

```typescript
// SignInPage.tsx

async function handleMicrosoftSignIn() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'azure',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      scopes: 'email profile openid',
      queryParams: {
        prompt: 'select_account' // Força seleção de conta
      }
    }
  });

  if (error) {
    console.error('Microsoft sign in error:', error);
    toast.error('Erro ao fazer login com Microsoft');
  }
}
```

### 4. Scopes e Permissões

**Scopes Solicitados:**
- `openid` - Identificador único
- `email` - Email
- `profile` - Nome e foto
- `User.Read` - Informações básicas do perfil

**Dados Recebidos:**
```typescript
{
  id: 'azure-oauth-id',
  email: 'user@outlook.com',
  user_metadata: {
    full_name: 'Maria Santos',
    avatar_url: 'https://graph.microsoft.com/v1.0/me/photo/$value',
    iss: 'https://login.microsoftonline.com/.../v2.0',
    sub: 'AAAAAaaaa...',
    email_verified: true,
    preferred_username: 'user@outlook.com'
  }
}
```

---

## Auto-Aceitação de Convites Pendentes

Sistema que automaticamente aceita convites de workspace quando usuário faz login via OAuth.

### Fluxo

```
User faz login via OAuth (Google/Microsoft)
        ↓
AuthContext detecta novo login
        ↓
Verifica se há convites pendentes para o email
        ↓
Se houver, aceita automaticamente
        ↓
Associa user_id ao convite
        ↓
Notifica usuário
```

### Implementação

```typescript
// AuthContext.tsx

useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setUser(session.user);

        // Auto-aceitar convites pendentes
        await autoAcceptPendingInvites(session.user.email);
      }
    }
  );

  return () => subscription.unsubscribe();
}, []);

async function autoAcceptPendingInvites(email: string) {
  try {
    // Buscar convites pendentes
    const { data: invites } = await supabase
      .from('workspace_invites')
      .select('*')
      .eq('email', email)
      .is('accepted_at', null);

    if (!invites || invites.length === 0) return;

    // Aceitar cada convite
    for (const invite of invites) {
      await supabase
        .from('workspace_invites')
        .update({
          user_id: session.user.id,
          accepted_at: new Date().toISOString()
        })
        .eq('id', invite.id);

      // Criar membro do workspace
      await supabase
        .from('workspace_members')
        .insert({
          workspace_id: invite.workspace_id,
          user_id: session.user.id,
          role: invite.role || 'member'
        });
    }

    // Notificar usuário
    toast.success(
      `${invites.length} convite(s) de workspace aceito(s) automaticamente!`
    );
  } catch (error) {
    console.error('Error auto-accepting invites:', error);
  }
}
```

---

## Troubleshooting OAuth

### Google: Redirect URI Mismatch

**Erro:** `redirect_uri_mismatch`

**Causa:** URI de callback não está registrada no Google Cloud Console

**Solução:**
1. Verifique exatamente a URL que está sendo usada
2. Adicione no Google Cloud Console → Credentials → Edit OAuth client
3. Certifique-se de que não há espaços ou caracteres extras
4. Espere alguns minutos para propagar

### Microsoft: Invalid Client

**Erro:** `invalid_client`

**Causa:** Client Secret incorreto ou expirado

**Solução:**
1. Azure Portal → App registrations → Certificates & secrets
2. Verifique se secret não expirou
3. Gere novo secret se necessário
4. Atualize no Supabase

### CORS Errors

**Erro:** `CORS policy: No 'Access-Control-Allow-Origin' header`

**Causa:** Origem não autorizada

**Solução:**
1. Supabase Dashboard → Settings → API
2. Adicione domínio em **CORS Allowed Origins**
3. Google/Microsoft: Adicione origem em **Authorized JavaScript origins**

### Email Já Existe

**Erro:** User tenta OAuth mas email já existe via email/password

**Comportamento:**
- Supabase automaticamente vincula contas se email for o mesmo
- Se email não foi verificado, pode dar conflito

**Solução:**
```typescript
// Forçar verificação de email em signup tradicional
await supabase.auth.signUp({
  email,
  password,
  options: {
    emailRedirectTo: `${window.location.origin}/auth/callback`,
    // Não permitir login até verificar email
    data: { email_confirmed: false }
  }
});
```

### Token Expirado

**Erro:** Token OAuth expirou

**Comportamento:** Supabase automaticamente renova via refresh token

**Quando Falha:**
- Refresh token também expirou
- Usuário revogou acesso
- Mudou senha no Google/Microsoft

**Solução:**
```typescript
// Detectar e forçar re-login
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED' && !session) {
    // Refresh falhou, forçar logout
    supabase.auth.signOut();
    navigate('/signin?error=session_expired');
  }
});
```

---

## Segurança OAuth

### Best Practices Implementadas

1. **State Parameter**
   - Supabase adiciona automaticamente
   - Previne CSRF attacks

2. **PKCE (Proof Key for Code Exchange)**
   - Habilitado automaticamente para fluxos públicos
   - Protege contra authorization code interception

3. **Redirect URI Validation**
   - Sempre validar redirect URI
   - Nunca aceitar redirect arbitrário

4. **Token Storage**
   - Access token em memória ou localStorage
   - Refresh token em httpOnly cookie (ideal)
   - Nunca expor em URL

5. **Scope Minimal**
   - Apenas solicitar scopes necessários
   - Não pedir permissões desnecessárias

### Validações Adicionais

```typescript
// Validar provider e claims
async function validateOAuthUser(user: User) {
  // Verificar se email foi verificado pelo provider
  if (!user.user_metadata.email_verified) {
    throw new Error('Email não verificado pelo provedor OAuth');
  }

  // Verificar provider esperado
  const provider = user.app_metadata.provider;
  if (!['google', 'azure'].includes(provider)) {
    throw new Error('Provider OAuth não autorizado');
  }

  // Log de auditoria
  await supabase
    .from('audit_logs')
    .insert({
      user_id: user.id,
      action: 'oauth_login',
      provider,
      metadata: {
        email: user.email,
        timestamp: new Date().toISOString()
      }
    });
}
```

---

## Testing OAuth Localmente

### 1. Configurar Localhost

Google e Microsoft permitem localhost sem HTTPS.

**Google Cloud Console:**
```
http://localhost:5173
http://localhost:5173/auth/callback
```

**Azure Portal:**
```
http://localhost:5173
http://localhost:5173/auth/callback
```

### 2. Usar Ngrok (Alternativa)

Se precisar testar com domínio público:

```bash
ngrok http 5173
```

Adicione URL do ngrok nos consoles:
```
https://abc123.ngrok.io
https://abc123.ngrok.io/auth/callback
```

### 3. Test Accounts

**Google:**
- Adicione emails de teste no OAuth Consent Screen
- Ou publique o app (revisão do Google)

**Microsoft:**
- Use conta pessoal Microsoft (Outlook, Hotmail)
- Ou adicione usuários no Azure AD

---

## Monitoramento OAuth

### Métricas

```sql
-- Taxa de sucesso OAuth por provider
SELECT
  app_metadata->>'provider' as provider,
  COUNT(*) as total_logins,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as last_24h
FROM auth.users
WHERE app_metadata->>'provider' IN ('google', 'azure')
GROUP BY provider;
```

### Alertas

- Taxa de falha OAuth > 10%
- Spike de logins via OAuth
- Provider retornando erros consistentemente

---

## Links Úteis

- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [Microsoft Identity Platform](https://docs.microsoft.com/en-us/azure/active-directory/develop/)
- [Supabase Auth](https://supabase.com/docs/guides/auth)

---

[← Voltar às Features](./README.md) | [Próximo: Tokens →](./tokens-system.md)
