# Sistema de Emails de Confirmação

## Visão Geral

O sistema de emails de confirmação é responsável por enviar emails de verificação para novos usuários após o cadastro. Utiliza a API Resend para envio de emails transacionais com templates HTML profissionais.

## Arquitetura

```
┌─────────────────┐
│   SignUpPage    │ (Frontend)
│   Component     │
└────────┬────────┘
         │
         ├─ 1. Usuário preenche formulário
         ├─ 2. handleDetailsSubmit()
         ├─ 3. signUp() → Cria usuário no Supabase Auth
         ├─ 4. Upload de avatar (opcional)
         ├─ 5. Mostra tela de sucesso
         │
         ├─ 6. Botão "Reenviar email"
         │    └─> handleResendEmail()
         │         │
         ▼         ▼
┌─────────────────────────────┐
│  Edge Function              │
│  send-confirmation-email    │
└─────────────┬───────────────┘
              │
              ├─ 1. Valida dados do usuário
              ├─ 2. Busca user_profile no banco
              ├─ 3. Formata dados para template
              ├─ 4. Chama API Resend
              │
              ▼
┌─────────────────────────────┐
│      Resend API             │
│   (api.resend.com)          │
└─────────────┬───────────────┘
              │
              └─> Email enviado ao usuário
```

## 1. Frontend - SignUpPage Component

### Localização
`/src/pages/SignUpPage.tsx`

### Estados Relevantes

```typescript
const [userEmail, setUserEmail] = useState('');           // Email do usuário
const [resendLoading, setResendLoading] = useState(false); // Loading do reenvio
const [resendDisabled, setResendDisabled] = useState(false); // Botão desabilitado
const [resendCountdown, setResendCountdown] = useState(0);   // Countdown 60s
```

### Fluxo de Cadastro

#### handleDetailsSubmit()
Função principal que processa o cadastro completo do usuário.

```typescript
const handleDetailsSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  // 1. Validações de senha
  const passwordCheck = validatePasswordStrict(formData.password);
  if (!passwordCheck.valid) {
    setError(passwordCheck.message || 'Senha inválida');
    return;
  }

  // 2. Verificar se senhas coincidem
  if (formData.password !== formData.confirmPassword) {
    setError('As senhas não coincidem');
    return;
  }

  setLoading(true);
  setError(null);
  setLoadingStep(0);

  try {
    // 3. Criar usuário no Supabase Auth
    const { user, error: signUpError } = await signUp(
      formData.email,
      formData.password,
      {
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone.replace(/\D/g, ''),
        phoneCountryCode: formData.phoneCountryCode,
        oab: formData.oab || undefined,
        city: formData.city || undefined,
        state: selectedState?.value || undefined
      }
    );

    if (signUpError) throw signUpError;
    if (!user) throw new Error('Erro ao criar usuário');

    // 4. Upload de avatar (se houver)
    if (avatarFile) {
      const { supabase } = await import('../lib/supabase');
      const fileExt = avatarFile.name.split('.').pop();
      const fileName = `${user.id}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, avatarFile, {
          upsert: true,
          contentType: avatarFile.type
        });

      if (uploadError) {
        console.error('[Avatar] Erro no upload:', uploadError);
      }
    }

    // 5. Salvar email e marcar sucesso
    setUserEmail(formData.email);
    setSuccess(true);

  } catch (err: any) {
    console.error('[SignUp] Erro no cadastro:', err);
    setError(err.message || 'Erro ao criar conta');
    setLoading(false);
  }
};
```

### Tela de Sucesso com Timer

Após o cadastro bem-sucedido, exibe uma sequência de mensagens com timer:

```typescript
const loadingMessages = [
  'Validando informações...',           // 0 - 1.7s
  'Criando sua conta...',               // 1.7s - 3.4s
  'Configurando seu perfil...',         // 3.4s - 5.1s
  'Preparando seu espaço de trabalho...', // 5.1s - 6.8s
  'Enviando email de confirmação...',   // 6.8s - 8.5s
  'Finalizando cadastro...'             // 8.5s - 10.2s
];

useEffect(() => {
  if (success && !showSuccessMessage) {
    const interval = setInterval(() => {
      setLoadingStep((prev) => {
        if (prev >= loadingMessages.length - 1) {
          clearInterval(interval);
          setTimeout(() => setShowSuccessMessage(true), 1000);
          return prev;
        }
        return prev + 1;
      });
    }, 1700); // 1.7 segundos por mensagem

    return () => clearInterval(interval);
  }
}, [success, showSuccessMessage]);
```

**Tempo total: ~11.2 segundos**
- 6 mensagens × 1.7s = 10.2s
- +1s delay final = 11.2s total

### Função de Reenvio de Email

#### handleResendEmail()
Função inteligente que verifica status e reenvia email.

```typescript
const handleResendEmail = async () => {
  // 1. Verificar se está em cooldown
  if (resendDisabled) return;

  // 2. Obter email (prioriza userEmail, fallback para formData)
  const emailToUse = userEmail || formData.email;
  if (!emailToUse) {
    setError('Email não encontrado. Por favor, recarregue a página e tente novamente.');
    return;
  }

  setResendLoading(true);
  setError(null);

  try {
    const { supabase } = await import('../lib/supabase');

    // 3. Buscar dados do perfil e verificar se já foi validado
    const { data: profileData } = await supabase
      .from('user_profiles')
      .select('id, first_name, last_name, phone, phone_country_code, email_verified')
      .eq('email', emailToUse.toLowerCase())
      .maybeSingle();

    if (!profileData) {
      throw new Error('Usuário não encontrado');
    }

    // 4. Verificar se email já foi confirmado
    if (profileData.email_verified) {
      setError(null);
      alert('Sua conta já está validada! Você pode fazer login.');
      return;
    }

    // 5. Chamar edge function para enviar email
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-confirmation-email`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: profileData.id,
          email: emailToUse,
          first_name: profileData.first_name,
          last_name: profileData.last_name,
          phone: profileData.phone,
          phone_country_code: profileData.phone_country_code
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Erro ao reenviar email');
    }

    // 6. Ativar cooldown de 60 segundos
    setResendDisabled(true);
    setResendCountdown(60);
    setError(null);
    alert('Email de confirmação reenviado com sucesso! Verifique sua caixa de entrada.');

  } catch (err: any) {
    console.error('[ResendEmail] Erro ao reenviar email:', err);
    setError(err.message || 'Erro ao reenviar email de confirmação');
  } finally {
    setResendLoading(false);
  }
};
```

### Timer de Cooldown (60 segundos)

Previne spam de emails:

```typescript
useEffect(() => {
  if (resendCountdown > 0) {
    const timer = setTimeout(() => {
      setResendCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  } else if (resendCountdown === 0 && resendDisabled) {
    setResendDisabled(false);
  }
}, [resendCountdown, resendDisabled]);
```

### UI do Botão de Reenvio

```tsx
<button
  onClick={handleResendEmail}
  disabled={resendDisabled || resendLoading}
  className="w-full bg-transparent border-2 border-wis-dark text-wis-dark py-3 px-4 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
>
  {resendLoading ? (
    <>
      <Loader className="w-4 h-4 animate-spin mr-2" />
      Reenviando...
    </>
  ) : resendDisabled ? (
    `Reenviar email (${resendCountdown}s)`
  ) : (
    'Reenviar email de confirmação'
  )}
</button>
```

## 2. Edge Function - send-confirmation-email

### Localização
`/supabase/functions/send-confirmation-email/index.ts`

### Estrutura da Edge Function

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestBody {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  phone_country_code?: string;
}

Deno.serve(async (req: Request) => {
  // 1. Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // 2. Parse request body
    const body: RequestBody = await req.json();
    const { user_id, email, first_name, last_name, phone, phone_country_code } = body;

    // 3. Validar campos obrigatórios
    if (!user_id || !email || !first_name) {
      return new Response(
        JSON.stringify({
          error: "Campos obrigatórios faltando: user_id, email, first_name"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 4. Criar token de verificação (válido por 24h)
    const verificationToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // 5. Buscar configuração do sistema (URL base)
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const { createClient } = await import("jsr:@supabase/supabase-js@2");
    const supabase = createClient(supabaseUrl!, supabaseKey!);

    const { data: config } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'app_base_url')
      .single();

    const baseUrl = config?.value || 'https://app.wislegal.io';
    const confirmationUrl = `${baseUrl}/confirm-email?token=${verificationToken}`;

    // 6. Salvar token no banco
    const { error: dbError } = await supabase
      .from('user_profiles')
      .update({
        email_verification_token: verificationToken,
        email_verification_expires_at: expiresAt.toISOString()
      })
      .eq('id', user_id);

    if (dbError) {
      console.error('[DB] Erro ao salvar token:', dbError);
      throw new Error('Erro ao gerar token de verificação');
    }

    // 7. Formatar telefone
    const fullPhone = phone && phone_country_code
      ? `${phone_country_code} ${phone}`
      : phone || 'Não informado';

    // 8. Montar template HTML do email
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Confirme seu email - Wis Legal</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">

                <!-- Header -->
                <tr>
                  <td style="padding: 40px 40px 20px; text-align: center; background-color: #1a1a1a; border-radius: 8px 8px 0 0;">
                    <img src="https://rslpleprodloodfsaext.supabase.co/storage/v1/object/public/assets/img/logo-color-white.svg"
                         alt="Wis Legal"
                         style="height: 50px; margin-bottom: 10px;">
                    <p style="color: #ffffff; font-size: 18px; margin: 0;">Simple legal analysis</p>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding: 40px;">
                    <h1 style="color: #1a1a1a; font-size: 24px; margin: 0 0 20px;">
                      Bem-vindo ao Wis Legal, ${first_name}!
                    </h1>

                    <p style="color: #333333; font-size: 16px; line-height: 1.5; margin: 0 0 20px;">
                      Estamos felizes em tê-lo conosco. Para começar a usar sua conta,
                      precisamos confirmar seu endereço de email.
                    </p>

                    <p style="color: #333333; font-size: 16px; line-height: 1.5; margin: 0 0 30px;">
                      Clique no botão abaixo para confirmar seu email:
                    </p>

                    <!-- CTA Button -->
                    <table role="presentation" style="margin: 0 auto;">
                      <tr>
                        <td style="border-radius: 6px; background-color: #1a1a1a;">
                          <a href="${confirmationUrl}"
                             style="display: inline-block; padding: 16px 40px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: bold;">
                            Confirmar Email
                          </a>
                        </td>
                      </tr>
                    </table>

                    <p style="color: #666666; font-size: 14px; line-height: 1.5; margin: 30px 0 0;">
                      Ou copie e cole este link no seu navegador:
                    </p>
                    <p style="color: #0066cc; font-size: 14px; word-break: break-all; margin: 10px 0 0;">
                      ${confirmationUrl}
                    </p>

                    <!-- User Info -->
                    <div style="margin-top: 40px; padding: 20px; background-color: #f8f8f8; border-radius: 6px;">
                      <h3 style="color: #1a1a1a; font-size: 16px; margin: 0 0 15px;">
                        Seus dados cadastrados:
                      </h3>
                      <table style="width: 100%; font-size: 14px; color: #333333;">
                        <tr>
                          <td style="padding: 5px 0;"><strong>Nome:</strong></td>
                          <td style="padding: 5px 0;">${first_name} ${last_name}</td>
                        </tr>
                        <tr>
                          <td style="padding: 5px 0;"><strong>Email:</strong></td>
                          <td style="padding: 5px 0;">${email}</td>
                        </tr>
                        <tr>
                          <td style="padding: 5px 0;"><strong>Telefone:</strong></td>
                          <td style="padding: 5px 0;">${fullPhone}</td>
                        </tr>
                      </table>
                    </div>

                    <p style="color: #999999; font-size: 12px; line-height: 1.5; margin: 30px 0 0;">
                      <strong>Importante:</strong> Este link é válido por 24 horas.
                      Após esse período, você precisará solicitar um novo email de confirmação.
                    </p>

                    <p style="color: #999999; font-size: 12px; line-height: 1.5; margin: 10px 0 0;">
                      Se você não criou esta conta, por favor ignore este email.
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="padding: 30px 40px; background-color: #f8f8f8; border-radius: 0 0 8px 8px; text-align: center;">
                    <p style="color: #666666; font-size: 14px; margin: 0 0 10px;">
                      © 2024 Wis Legal. Todos os direitos reservados.
                    </p>
                    <p style="color: #999999; font-size: 12px; margin: 0;">
                      <a href="https://wislegal.io/terms" style="color: #0066cc; text-decoration: none;">Termos de Uso</a> |
                      <a href="https://wislegal.io/privacy" style="color: #0066cc; text-decoration: none;">Política de Privacidade</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    // 9. Enviar email via Resend API
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY não configurada");
    }

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Wis Legal <noreply@wislegal.io>",
        to: email,
        subject: "Confirme seu email - Wis Legal",
        html: emailHtml,
      }),
    });

    if (!resendResponse.ok) {
      const errorData = await resendResponse.json();
      console.error('[Resend] Erro ao enviar email:', errorData);
      throw new Error('Erro ao enviar email via Resend');
    }

    // 10. Registrar log do email enviado
    const { error: logError } = await supabase
      .from('email_logs')
      .insert({
        user_id,
        email_type: 'confirmation',
        to_email: email,
        subject: 'Confirme seu email - Wis Legal',
        status: 'sent',
        sent_at: new Date().toISOString()
      });

    if (logError) {
      console.error('[EmailLog] Erro ao registrar log:', logError);
    }

    // 11. Retornar sucesso
    return new Response(
      JSON.stringify({
        success: true,
        message: "Email de confirmação enviado com sucesso"
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: any) {
    console.error('[SendConfirmationEmail] Erro:', error);
    return new Response(
      JSON.stringify({
        error: error.message || "Erro ao enviar email de confirmação"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
```

## 3. Resend API

### Configuração

**URL Base:** `https://api.resend.com`

**Variável de ambiente necessária:**
```bash
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Endpoint Usado

```
POST https://api.resend.com/emails
```

### Headers Necessários

```typescript
{
  "Authorization": "Bearer ${RESEND_API_KEY}",
  "Content-Type": "application/json"
}
```

### Payload da Requisição

```typescript
{
  "from": "Wis Legal <noreply@wislegal.io>",  // Sender
  "to": "user@example.com",                    // Recipient
  "subject": "Confirme seu email - Wis Legal", // Subject
  "html": "<html>...</html>"                   // HTML template
}
```

### Resposta de Sucesso (200)

```json
{
  "id": "49a3999c-0ce1-4ea6-ab68-afcd6dc2e794"
}
```

### Resposta de Erro (400/500)

```json
{
  "statusCode": 422,
  "message": "Invalid 'to' email address",
  "name": "validation_error"
}
```

### Rate Limits (Plano Free)

- **100 emails/dia**
- **Domínio verificado necessário** para produção
- **Modo sandbox:** permite envio apenas para emails autorizados

### Domínios Permitidos

Para usar `from: "Wis Legal <noreply@wislegal.io>"` é necessário:

1. Adicionar domínio `wislegal.io` no painel Resend
2. Configurar registros DNS:
   - SPF
   - DKIM
   - DMARC

## 4. Banco de Dados

### Tabela: user_profiles

```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  phone_country_code TEXT DEFAULT '+55',
  email_verified BOOLEAN DEFAULT FALSE,
  email_verification_token TEXT,
  email_verification_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Tabela: email_logs

```sql
CREATE TABLE email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  email_type TEXT NOT NULL, -- 'confirmation', 'reset_password', 'notification'
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL, -- 'sent', 'failed', 'pending'
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Tabela: system_config

```sql
CREATE TABLE system_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Exemplo de registro
INSERT INTO system_config (key, value, description) VALUES
('app_base_url', 'https://app.wislegal.io', 'URL base da aplicação');
```

## 5. Fluxo Completo de Confirmação

### Passo a Passo

1. **Usuário cria conta**
   - Frontend: `SignUpPage.handleDetailsSubmit()`
   - Cria usuário no `auth.users`
   - Cria perfil no `user_profiles` com `email_verified = false`

2. **Timer de 11 segundos**
   - Exibe mensagens de progresso
   - Dá tempo para o backend processar

3. **Tela de sucesso**
   - Mostra check verde
   - Instrução para verificar email
   - Botão "Reenviar email" disponível

4. **Usuário clica em "Reenviar email"**
   - Frontend: `handleResendEmail()`
   - Verifica se `email_verified = true`
     - Se sim → alerta "Conta já validada"
     - Se não → continua

5. **Edge function envia email**
   - Gera token único de verificação
   - Salva token no banco (válido 24h)
   - Monta HTML do email
   - Chama Resend API
   - Registra log em `email_logs`

6. **Usuário recebe email**
   - Contém link: `https://app.wislegal.io/confirm-email?token={UUID}`
   - Válido por 24 horas

7. **Usuário clica no link**
   - Abre página `ConfirmEmailPage`
   - Valida token no banco
   - Atualiza `email_verified = true`
   - Redireciona para login

8. **Cooldown de 60 segundos**
   - Previne spam
   - Timer countdown no botão

## 6. Variáveis de Ambiente

### Frontend (.env)

```bash
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx...
```

### Edge Function (Supabase Dashboard)

```bash
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxx
```

## 7. Segurança

### Tokens de Verificação

- **Gerados com:** `crypto.randomUUID()` (UUID v4)
- **Armazenados em:** `user_profiles.email_verification_token`
- **Expiração:** 24 horas
- **Validação:** Token + email + expiração

### Rate Limiting

- **Frontend:** Cooldown de 60 segundos entre reenvios
- **Resend:** 100 emails/dia (plano free)

### CORS

```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
```

## 8. Logs e Monitoramento

### Console Logs

```typescript
console.log('[SignUp] Criando usuário:', email);
console.log('[Avatar] Upload bem-sucedido');
console.error('[ResendEmail] Erro ao reenviar email:', err);
console.error('[DB] Erro ao salvar token:', dbError);
console.error('[Resend] Erro ao enviar email:', errorData);
```

### Tabela email_logs

Registra todos os emails enviados para auditoria:

```sql
SELECT
  email_type,
  to_email,
  status,
  sent_at,
  error_message
FROM email_logs
WHERE user_id = 'xxx-xxx-xxx'
ORDER BY created_at DESC;
```

## 9. Troubleshooting

### Email não chega

1. Verificar logs no Supabase Edge Functions
2. Verificar dashboard Resend
3. Verificar spam/lixo eletrônico
4. Verificar domínio configurado no Resend

### Token inválido/expirado

1. Verificar `email_verification_expires_at` no banco
2. Solicitar novo email (botão "Reenviar")

### Erro "Usuário não encontrado"

1. Verificar se usuário existe em `user_profiles`
2. Verificar se email está correto (case-insensitive)

### Cooldown não funciona

1. Verificar `resendCountdown` e `resendDisabled` states
2. Verificar useEffect do timer

## 10. Próximos Passos (Futuros Emails)

Para implementar novos tipos de email:

1. **Criar novo tipo em `email_logs.email_type`**
   - Ex: `'reset_password'`, `'invitation'`, `'notification'`

2. **Criar nova edge function**
   - Ex: `send-reset-password`, `send-invitation`
   - Seguir estrutura de `send-confirmation-email`

3. **Criar templates HTML**
   - Manter consistência visual
   - Header/Footer padrão
   - CTA button centralizado

4. **Adicionar função no frontend**
   - Seguir padrão de `handleResendEmail()`
   - Cooldown, loading, error handling

5. **Configurar no Resend**
   - Templates customizados
   - Webhooks para tracking
   - Bounce handling

## 11. Referências

- **Supabase Auth:** https://supabase.com/docs/guides/auth
- **Resend API:** https://resend.com/docs/api-reference
- **Edge Functions:** https://supabase.com/docs/guides/functions
- **Email Templates:** https://github.com/resend/email-templates
