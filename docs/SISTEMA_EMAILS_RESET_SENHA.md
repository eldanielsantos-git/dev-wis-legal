# Sistema de Emails - Reset de Senha

## Visão Geral

Este documento descreve o sistema de emails para reset de senha implementado no Wis Legal.

## Edge Function

**Nome:** `send-reset-password-email`

**URL:** `{SUPABASE_URL}/functions/v1/send-reset-password-email`

## Variáveis do Template de Email

### Variáveis Disponíveis

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `{{first_name}}` | Primeiro nome do usuário | João |
| `{{reset_url}}` | URL completa para reset de senha | https://app.wislegal.io/reset-password?token=abc123 |

### ⚠️ IMPORTANTE: Variável do Botão

**NO TEMPLATE DO EMAIL, USE:**
```html
<a href="{{reset_url}}">Redefinir Senha</a>
```

**NÃO USE:** `{{confirmation_url}}` (essa é para confirmação de email)

## Como Funciona

### 1. Usuário Solicita Reset

O usuário acessa a página "Esqueci Senha" e informa seu email.

```typescript
// ForgotPasswordPage.tsx
const response = await fetch(
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-reset-password-email`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email })
  }
);
```

### 2. Edge Function Gera Token

A edge function:
1. Busca o usuário pelo email
2. Gera um token UUID único
3. Define expiração de 1 hora
4. Salva no campo `password_reset_token` em `user_profiles`
5. Envia email com link personalizado

```typescript
const resetToken = crypto.randomUUID();
const expiresAt = new Date();
expiresAt.setHours(expiresAt.getHours() + 1);

const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;
```

### 3. Usuário Clica no Link

O link leva para: `/reset-password?token={UUID}`

```
https://app.wislegal.io/reset-password?token=550e8400-e29b-41d4-a716-446655440000
```

### 4. Validação do Token

A página `ResetPasswordPage` valida o token:

```typescript
// Busca no banco
const { data } = await supabase
  .from('user_profiles')
  .select('id, password_reset_token, password_reset_expires_at')
  .eq('password_reset_token', token)
  .maybeSingle();

// Verifica expiração
const expiresAt = new Date(data.password_reset_expires_at);
const now = new Date();
if (now > expiresAt) {
  // Token expirado
}
```

### 5. Atualização da Senha

Quando o usuário define a nova senha:

```typescript
const response = await fetch(
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-user-password`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      resetToken: resetToken,
      newPassword: newPassword
    })
  }
);
```

A edge function `update-user-password`:
1. Valida o token novamente
2. Verifica se não expirou
3. Atualiza a senha no Supabase Auth
4. **Limpa o token** (uso único)

## Campos do Banco de Dados

### Tabela: `user_profiles`

```sql
-- Campos para reset de senha
password_reset_token TEXT NULL,
password_reset_expires_at TIMESTAMPTZ NULL
```

### Índice

```sql
CREATE INDEX idx_user_profiles_password_reset_token
ON user_profiles(password_reset_token)
WHERE password_reset_token IS NOT NULL;
```

## Segurança

### ✅ Implementado

1. **Token único UUID**: Impossível adivinhar
2. **Expiração de 1 hora**: Limita janela de ataque
3. **Uso único**: Token é limpo após reset
4. **Índice otimizado**: Busca rápida por token
5. **Validação dupla**: Frontend + Backend
6. **Não revela existência**: Sempre retorna sucesso

### 🔒 Proteções

```typescript
// Por segurança, não revelar se o email existe ou não
if (!profileData) {
  return {
    success: true,
    message: "Se o email existir, você receberá instruções"
  };
}
```

## Logs

Todos os emails são registrados na tabela `email_logs`:

```typescript
await supabase.from('email_logs').insert({
  user_id: profileData.id,
  email_type: 'password_reset',
  to_email: email,
  subject: 'Redefinir Senha - Wis Legal',
  status: 'sent',
  sent_at: new Date().toISOString()
});
```

## Template HTML do Email

O template está configurado no **Resend** (não na edge function).

### Configuração do Template no Resend

**Nome do Template:** `reset-password`
**Template ID:** `aa4008f0-7e91-451e-82ad-5b711f23eab3`

### Estrutura do Template

```html
<!-- Header com logo -->
<img src="https://rslpleprodloodfsaext.supabase.co/storage/v1/object/public/assets/img/logo-color-white.svg" />

<!-- Saudação personalizada -->
<h1>Olá, {{first_name}}!</h1>

<!-- Botão de ação -->
<a href="{{reset_url}}">Redefinir Senha</a>

<!-- Link alternativo -->
<p>Ou copie e cole: {{reset_url}}</p>

<!-- Avisos de segurança -->
<ul>
  <li>Link válido por 1 hora</li>
  <li>Uso único</li>
  <li>Ignore se não solicitou</li>
</ul>
```

### Como a Edge Function Usa o Template

```typescript
const templateId = "aa4008f0-7e91-451e-82ad-5b711f23eab3";

const resendPayload = {
  from: "WisLegal <noreply@wislegal.io>",
  to: [email],
  template: {
    id: templateId,
    variables: {
      first_name: profileData.first_name,
      reset_url: resetUrl
    }
  }
};

const resendResponse = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${resendApiKey}`,
  },
  body: JSON.stringify(resendPayload),
});
```

## Configuração Necessária

### Variáveis de Ambiente (já configuradas)

```env
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
RESEND_API_KEY
```

### Configuração no Banco

```sql
-- URL base da aplicação
INSERT INTO system_config (key, value)
VALUES ('app_base_url', 'https://app.wislegal.io');
```

## Testando o Sistema

### 1. Solicitar Reset

```bash
curl -X POST https://{SUPABASE_URL}/functions/v1/send-reset-password-email \
  -H "Authorization: Bearer {ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"email":"usuario@exemplo.com"}'
```

### 2. Verificar Email Enviado

Checar inbox ou tabela `email_logs`:

```sql
SELECT * FROM email_logs
WHERE email_type = 'password_reset'
ORDER BY sent_at DESC
LIMIT 1;
```

### 3. Validar Token

```bash
curl https://app.wislegal.io/reset-password?token={UUID}
```

### 4. Atualizar Senha

```bash
curl -X POST https://{SUPABASE_URL}/functions/v1/update-user-password \
  -H "Authorization: Bearer {ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"resetToken":"UUID","newPassword":"NovaSenha123!"}'
```

## Troubleshooting

### Email não chegou

1. Verificar tabela `email_logs`
2. Checar status do Resend
3. Verificar spam/lixeira
4. Validar RESEND_API_KEY

### Token inválido

1. Verificar se token existe em `user_profiles`
2. Checar expiração (`password_reset_expires_at`)
3. Ver se já foi usado (token é null após uso)

### Erro ao atualizar senha

1. Verificar requisitos de senha (mínimo 6 chars, maiúscula, minúscula, número, especial)
2. Checar se token ainda é válido
3. Ver logs da edge function `update-user-password`

## Diferenças vs. Confirmação de Email

| Aspecto | Reset Senha | Confirmação Email |
|---------|-------------|-------------------|
| Variável botão | `{{reset_url}}` | `{{confirmation_url}}` |
| Edge function | `send-reset-password-email` | `send-confirmation-email` |
| Página destino | `/reset-password?token=` | `/confirm-email?token=` |
| Expiração | 1 hora | 24 horas |
| Uso | Único | Único |
| Trigger | Página "Esqueci Senha" | Cadastro de usuário |

## Resumo Rápido para Configuração

### ✅ O que já está pronto

- [x] Edge function `send-reset-password-email` criada
- [x] Edge function `update-user-password` atualizada
- [x] Campos `password_reset_token` e `password_reset_expires_at` no banco
- [x] Página `ForgotPasswordPage` configurada
- [x] Página `ResetPasswordPage` atualizada
- [x] Validação de senha com requisitos
- [x] Logs em `email_logs`

### 📝 O que você precisa fazer

1. **Configurar template no provedor de email (Resend/Mailchimp)**
   - Use a variável `{{reset_url}}` no botão
   - Use a variável `{{first_name}}` para saudação

2. **Testar fluxo completo**
   - Solicitar reset
   - Receber email
   - Clicar no link
   - Definir nova senha
   - Fazer login com nova senha

## Contato

Para dúvidas sobre implementação, consulte:
- `/docs/SISTEMA_EMAILS_CONFIRMACAO.md` - Sistema de confirmação de email
- `/supabase/functions/send-reset-password-email/index.ts` - Código da edge function
- `/src/pages/ForgotPasswordPage.tsx` - Página de solicitação
- `/src/pages/ResetPasswordPage.tsx` - Página de reset
