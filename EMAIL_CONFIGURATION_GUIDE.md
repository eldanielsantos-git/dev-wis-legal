# Guia de Configuração de Emails - Compartilhamento de Processos

## 📧 Situação Atual

### ✅ O que está funcionando:
1. **Compartilhamento criado com sucesso** no banco de dados
2. **Notificações in-app** para usuários existentes
3. **Código da Edge Function correto** (`send-workspace-invite`)

### ⚠️ O que NÃO está funcionando:
**Emails não estão sendo enviados ao compartilhar processos**

---

## 🔍 Causa Raiz

O Supabase possui duas situações que podem impedir o envio de emails:

### 1. **AUTH Emails desabilitados** (mais provável)
Por padrão, projetos Supabase em desenvolvimento têm emails desabilitados para evitar spam.

### 2. **Templates de email não configurados**
Os templates padrão do Supabase precisam estar ativos.

---

## 🛠️ Solução Implementada

### Alterações na Edge Function `send-workspace-invite`:

**ANTES:**
- ❌ Enviava email apenas para usuários NOVOS
- ❌ Usuários existentes recebiam só notificação in-app

**DEPOIS:**
- ✅ Envia email para TODOS (novos e existentes)
- ✅ Usa `inviteUserByEmail()` com template padrão do Supabase
- ✅ Inclui metadados do compartilhamento no email
- ✅ Graceful fallback (não falha se email não enviar)

### Código Atualizado:

```typescript
// Send invitation email for BOTH new and existing users
try {
  const emailData = {
    shared_by: user.id,
    owner_name: ownerName,
    share_id: shareId,
    processo_id: processoId,
    processo_name: processo.nome_processo || processo.numero_processo,
    permission_level: permissionLevel,
    permission_text: permissionText,
    user_exists: userExists,
    invited_name: invitedName,
  };

  const { error: inviteError } = await supabaseClient.auth.admin.inviteUserByEmail(
    invitedEmail.toLowerCase(),
    {
      redirectTo: userExists
        ? `${supabaseUrl}/lawsuits-detail/${processoId}`
        : `${supabaseUrl}/workspace`,
      data: emailData,
    }
  );

  if (inviteError) {
    // Não falha a requisição - compartilhamento foi criado
    return {
      success: true,
      warning: "Compartilhamento criado, mas houve erro ao enviar email."
    };
  }
} catch (emailError) {
  // Graceful fallback
}
```

---

## 🚀 Como Habilitar Emails no Supabase

### Passo 1: Acessar o Dashboard do Supabase

1. Acesse: https://supabase.com/dashboard
2. Selecione seu projeto
3. Navegue até: **Authentication** → **Email Templates**

### Passo 2: Verificar se Emails estão Habilitados

1. Vá em: **Project Settings** → **Authentication**
2. Procure por: **"Enable Email Confirmations"**
3. Se estiver DESABILITADO:
   - ✅ Habilite a opção
   - ⚠️ **IMPORTANTE**: Isso afetará todos os novos cadastros

### Passo 3: Configurar SMTP (Opcional - Produção)

Para ambiente de **PRODUÇÃO**, é recomendado usar seu próprio SMTP:

1. Vá em: **Project Settings** → **Authentication** → **SMTP Settings**
2. Configure com:
   - **Host**: smtp.gmail.com (ou seu provedor)
   - **Port**: 587
   - **Username**: seu-email@dominio.com
   - **Password**: sua-senha-app
   - **Sender Name**: Nome da Aplicação
   - **Sender Email**: noreply@dominio.com

**Provedores recomendados:**
- ✅ **SendGrid** (gratuito até 100 emails/dia)
- ✅ **Mailgun** (gratuito até 5.000 emails/mês)
- ✅ **AWS SES** (muito barato)
- ✅ **Resend** (moderno, 3.000 emails/mês grátis)

### Passo 4: Personalizar Template de Convite

1. Vá em: **Authentication** → **Email Templates**
2. Selecione: **"Invite user"**
3. Edite o template HTML:

```html
<h2>Você foi convidado!</h2>

<p>Olá {{ .Data.invited_name }},</p>

<p><strong>{{ .Data.owner_name }}</strong> compartilhou o processo
<strong>"{{ .Data.processo_name }}"</strong> com você.</p>

<p><strong>Nível de permissão:</strong> {{ .Data.permission_text }}</p>

<p>Clique no link abaixo para acessar:</p>

<p><a href="{{ .ConfirmationURL }}">Acessar Processo Compartilhado</a></p>

<p>Se você não solicitou este acesso, ignore este email.</p>
```

**Variáveis disponíveis:**
- `{{ .Data.owner_name }}` - Nome de quem compartilhou
- `{{ .Data.processo_name }}` - Nome do processo
- `{{ .Data.permission_text }}` - "Somente Leitura" ou "Editor"
- `{{ .Data.invited_name }}` - Nome do convidado
- `{{ .ConfirmationURL }}` - Link para acessar

### Passo 5: Testar Envio

1. Compartilhe um processo com um usuário
2. Verifique:
   - ✅ Compartilhamento criado no banco
   - ✅ Notificação in-app criada
   - ✅ Email enviado (verificar caixa de entrada)
   - ✅ Email na pasta de spam (caso não apareça)

---

## 🧪 Como Testar Localmente

### Verificar Logs da Edge Function:

```bash
# Acesse o Supabase Dashboard
# Vá em: Edge Functions → send-workspace-invite → Logs
# Procure por:
# - "Error sending invite email:" → Email falhou
# - "Invitation sent successfully" → Email enviado
```

### Testar Manualmente via cURL:

```bash
curl -X POST 'https://[SEU-PROJECT-ID].supabase.co/functions/v1/send-workspace-invite' \
  -H "Authorization: Bearer [SEU-ACCESS-TOKEN]" \
  -H "Content-Type: application/json" \
  -d '{
    "shareId": "uuid-do-share",
    "processoId": "uuid-do-processo",
    "invitedEmail": "teste@example.com",
    "invitedName": "Teste User",
    "permissionLevel": "read_only",
    "userExists": true
  }'
```

---

## 📊 Fluxo Completo de Compartilhamento

```
1. Usuário clica em "Compartilhar"
   ↓
2. Preenche email e permissão
   ↓
3. Frontend chama send-workspace-invite
   ↓
4. Edge Function:
   a) Cria registro em workspace_shares
   b) Cria notificação in-app (se usuário existe)
   c) Tenta enviar email via inviteUserByEmail()
   ↓
5. Supabase AUTH:
   a) Verifica se emails estão habilitados
   b) Se SIM: Envia email com template
   c) Se NÃO: Retorna erro (função continua)
   ↓
6. Resultado:
   - ✅ Compartilhamento SEMPRE criado
   - ✅ Notificação SEMPRE criada
   - ⚠️ Email pode ou não ser enviado
```

---

## ⚡ Solução Temporária (Enquanto Configura SMTP)

### Opção 1: Usar apenas Notificações In-App
- ✅ Já está funcionando
- ✅ Usuário vê ao fazer login
- ❌ Usuário não sabe fora da plataforma

### Opção 2: Habilitar Supabase Default SMTP
- ✅ Funciona imediatamente
- ✅ Sem configuração extra
- ⚠️ Limite de 3 emails/hora em desenvolvimento
- ⚠️ Emails podem cair em spam

### Opção 3: Configurar SMTP Custom (Recomendado)
- ✅ Sem limites (dependendo do plano)
- ✅ Emails confiáveis (não vão para spam)
- ✅ Templates personalizados
- ❌ Requer configuração

---

## 🎯 Checklist de Configuração

- [ ] Verificar se emails AUTH estão habilitados
- [ ] Configurar SMTP (produção)
- [ ] Personalizar template "Invite user"
- [ ] Testar envio de email
- [ ] Verificar caixa de spam
- [ ] Validar links de redirecionamento
- [ ] Confirmar metadados no email

---

## 🐛 Troubleshooting

### Email não está chegando:

1. **Verificar logs da Edge Function**
   ```
   Supabase Dashboard → Edge Functions → send-workspace-invite → Logs
   ```

2. **Verificar se AUTH emails estão habilitados**
   ```
   Project Settings → Authentication → Enable Email Confirmations
   ```

3. **Verificar pasta de spam**
   - Emails do Supabase podem ser marcados como spam
   - Adicione sender aos contatos confiáveis

4. **Verificar rate limits**
   - Supabase free tier: 3 emails/hora
   - Upgrade para plano pago ou configure SMTP

### Email chega mas link não funciona:

1. **Verificar redirectTo URL**
   - Deve ser URL completa e válida
   - Deve estar na whitelist do Supabase

2. **Adicionar URL à whitelist**
   ```
   Project Settings → Authentication → Redirect URLs
   Adicionar: https://seu-dominio.com/*
   ```

### Usuário não recebe notificação in-app:

1. **Verificar tabela notifications**
   ```sql
   SELECT * FROM notifications
   WHERE user_id = '[user-id]'
   ORDER BY created_at DESC;
   ```

2. **Verificar RLS policies**
   ```sql
   SELECT * FROM notifications
   WHERE user_id = auth.uid();
   ```

---

## 📚 Referências

- [Supabase Auth Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Supabase SMTP Configuration](https://supabase.com/docs/guides/auth/auth-smtp)
- [Edge Functions Error Handling](https://supabase.com/docs/guides/functions/error-handling)

---

## 💡 Próximos Passos

1. **Curto Prazo:**
   - ✅ Habilitar emails no Supabase Dashboard
   - ✅ Testar envio de emails
   - ✅ Personalizar template básico

2. **Médio Prazo:**
   - 📧 Configurar SMTP custom (SendGrid/Mailgun)
   - 🎨 Design profissional de email
   - 📊 Tracking de emails (abertos/cliques)

3. **Longo Prazo:**
   - 🔔 Sistema de notificações por email (diário/semanal)
   - 📱 Notificações push (PWA)
   - 🤖 Emails automáticos (análise concluída, etc)

---

**Status Atual:** ✅ Edge Function atualizada e deployada
**Email Status:** ⚠️ Aguardando configuração no Supabase Dashboard
**Fallback:** ✅ Notificações in-app funcionando
