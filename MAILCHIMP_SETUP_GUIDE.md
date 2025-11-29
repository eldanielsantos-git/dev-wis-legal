# Guia de Configuração do Mailchimp para Confirmação de Email

Este documento contém as instruções completas para configurar e testar o sistema de confirmação de email usando Mailchimp Journey API.

## 1. Configuração de Secrets no Supabase

Acesse o Dashboard do Supabase e configure as seguintes variáveis de ambiente:

1. Vá para **Project Settings > Edge Functions > Secrets**
2. Adicione os seguintes secrets:

```
MAILCHIMP_API_KEY=8fa47ffa1374ecd84976c82af406fd53-us3
MAILCHIMP_JOURNEY_KEY=md-lLdwTyHqVNLpBu4MqRz06w
MAILCHIMP_JOURNEY_ENDPOINT=https://us3.api.mailchimp.com/3.0/customer-journeys/journeys/51/steps/315/actions/trigger
MAILCHIMP_AUDIENCE_ID=f67c9ef227
FRONTEND_URL=https://app.wislegal.io
```

**Nota**: Substitua `FRONTEND_URL` pela URL do seu ambiente (produção ou staging).

## 2. Deploy das Edge Functions

Execute os seguintes comandos para fazer deploy das Edge Functions:

```bash
# Deploy da função de envio de email
supabase functions deploy send-confirmation-email

# Deploy da função de atualização de status
supabase functions deploy update-mailchimp-status
```

**Verificar logs em tempo real:**
```bash
supabase functions logs send-confirmation-email --follow
supabase functions logs update-mailchimp-status --follow
```

## 3. Estrutura do Sistema

### Edge Functions Criadas

1. **send-confirmation-email**
   - Localização: `supabase/functions/send-confirmation-email/index.ts`
   - Função: Gera token de confirmação e envia email via Mailchimp
   - Endpoint: `POST /functions/v1/send-confirmation-email`
   - Body esperado:
     ```json
     {
       "user_id": "uuid-do-usuario",
       "email": "email@exemplo.com",
       "first_name": "Nome"
     }
     ```

2. **update-mailchimp-status**
   - Localização: `supabase/functions/update-mailchimp-status/index.ts`
   - Função: Atualiza status do contato no Mailchimp (pendente → confirmado)
   - Endpoint: `POST /functions/v1/update-mailchimp-status`
   - Body esperado:
     ```json
     {
       "email": "email@exemplo.com",
       "status": "confirmado"
     }
     ```

### Tabela do Banco de Dados

**email_logs**: Armazena histórico de todos os emails enviados
```sql
CREATE TABLE email_logs (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  email text NOT NULL,
  type text NOT NULL CHECK (type IN ('confirmation', 'password_reset', 'status_update', 'notification')),
  status text NOT NULL CHECK (status IN ('sent', 'error', 'success', 'failed')),
  mailchimp_response jsonb DEFAULT '{}'::jsonb,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
```

### Páginas do Frontend

1. **SignUpPage** (`src/pages/SignUpPage.tsx`)
   - Modificado para chamar Edge Function após cadastro
   - Adiciona botão de reenvio de email com cooldown de 60 segundos

2. **ConfirmEmailPage** (`src/pages/ConfirmEmailPage.tsx`)
   - Nova página para confirmar email via token
   - Rota: `/confirm-email?token=TOKEN`
   - Atualiza status no Mailchimp após confirmação

## 4. Fluxo Completo de Funcionamento

### Cadastro de Novo Usuário

1. Usuário preenche formulário de cadastro
2. Frontend chama `signUp` do AuthContext
3. Supabase Auth cria usuário (não confirmado)
4. Trigger do banco insere dados em `user_profiles`
5. AuthContext chama Edge Function `send-confirmation-email`
6. Edge Function:
   - Gera token de confirmação via Supabase Admin API
   - Adiciona contato ao público do Mailchimp com `CONFIRM_STATUS: pendente`
   - Dispara Journey do Mailchimp com variáveis:
     - `FNAME`: Nome do usuário
     - `EMAIL`: Email do usuário
     - `CONFIRMATION_URL`: Link com token
7. Mailchimp processa template e envia email
8. Usuário vê página de sucesso com opção de reenviar email

### Confirmação de Email

1. Usuário recebe email e clica no botão "Confirmar Email"
2. Browser abre `/confirm-email?token=TOKEN`
3. ConfirmEmailPage:
   - Chama `supabase.auth.verifyOtp()` para validar token
   - Se válido, marca email como confirmado no Supabase
   - Chama Edge Function `update-mailchimp-status`
4. Edge Function atualiza Mailchimp:
   - Calcula MD5 hash do email
   - Faz PATCH para atualizar `CONFIRM_STATUS: confirmado`
5. Usuário é redirecionado para `/app`

### Reenvio de Email

1. Usuário clica em "Reenviar email de confirmação"
2. Sistema busca dados do usuário no banco
3. Chama Edge Function `send-confirmation-email` novamente
4. Novo token é gerado e novo email é enviado
5. Botão fica desabilitado por 60 segundos

## 5. Variáveis do Template no Mailchimp

O template configurado no Mailchimp (Journey ID 51, Step 315) deve usar as seguintes variáveis:

- **FNAME**: Nome do usuário (ex: "Daniel")
  - Uso no template: `Olá *|FNAME|*`

- **EMAIL**: Email do usuário (ex: "daniel@exemplo.com")
  - Uso no template: `Confirme seu email *|EMAIL|*`

- **CONFIRMATION_URL**: URL completa com token
  - Uso no template: `<a href="*|CONFIRMATION_URL|*">Confirmar Email</a>`

**Sintaxe do Mailchimp**: Use `*|VARIAVEL|*` para inserir variáveis no template HTML.

## 6. Campo Personalizado no Público

No público do Mailchimp (ID: f67c9ef227), existe um campo personalizado:

- **CONFIRM_STATUS**: Status da confirmação
  - Valores possíveis: `pendente` ou `confirmado`
  - Usado para segmentação e automações

## 7. Testes

### Testar Envio de Email (Manual)

```bash
# Obter token de acesso do usuário
# Substituir USER_TOKEN e USER_ID
curl -X POST https://SUPABASE_URL/functions/v1/send-confirmation-email \
  -H "Authorization: Bearer USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "USER_ID",
    "email": "teste@example.com",
    "first_name": "Teste"
  }'
```

### Testar Atualização de Status (Manual)

```bash
curl -X POST https://SUPABASE_URL/functions/v1/update-mailchimp-status \
  -H "Authorization: Bearer USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teste@example.com",
    "status": "confirmado"
  }'
```

### Testar Fluxo Completo

1. Criar nova conta com email válido que você tenha acesso
2. Verificar se email chegou na caixa de entrada
3. Clicar no botão de confirmação
4. Verificar se foi redirecionado para `/app`
5. Verificar no Mailchimp se status mudou para "confirmado"
6. Verificar logs na tabela `email_logs`

### Verificar Logs no Supabase

```sql
-- Ver todos os emails enviados
SELECT * FROM email_logs ORDER BY sent_at DESC LIMIT 10;

-- Ver emails de confirmação
SELECT * FROM email_logs WHERE type = 'confirmation' ORDER BY sent_at DESC;

-- Ver atualizações de status
SELECT * FROM email_logs WHERE type = 'status_update' ORDER BY sent_at DESC;
```

### Verificar no Mailchimp

1. Acesse o painel do Mailchimp
2. Vá para **Audience > All contacts**
3. Busque pelo email do usuário
4. Verifique os campos:
   - **FNAME**: deve ter o nome do usuário
   - **CONFIRM_STATUS**: deve estar "pendente" antes da confirmação e "confirmado" depois

## 8. Troubleshooting

### Email não está sendo enviado

1. Verificar logs da Edge Function:
   ```bash
   supabase functions logs send-confirmation-email --follow
   ```

2. Verificar se secrets estão configurados:
   ```bash
   supabase secrets list
   ```

3. Verificar se contato foi adicionado ao público do Mailchimp

4. Verificar se Journey está ativa no Mailchimp

### Token inválido ou expirado

- Tokens de confirmação expiram em 24 horas (padrão Supabase)
- Usuário deve usar botão "Reenviar email" para gerar novo token

### Status não está sendo atualizado no Mailchimp

1. Verificar logs da Edge Function `update-mailchimp-status`
2. Verificar se email está correto (lowercase)
3. Verificar se contato existe no público do Mailchimp

### Erro 401 (Unauthorized)

- Verificar se `MAILCHIMP_API_KEY` está correta
- Verificar se `MAILCHIMP_JOURNEY_KEY` está correta
- Verificar se Authorization header está sendo enviado

### Erro 404 (Not Found)

- Verificar se Journey ID e Step ID estão corretos no endpoint
- Verificar se Audience ID está correto

## 9. Monitoramento

### Métricas Importantes

1. **Taxa de envio**: Quantos emails foram enviados com sucesso
   ```sql
   SELECT COUNT(*) FROM email_logs
   WHERE type = 'confirmation' AND status = 'sent';
   ```

2. **Taxa de confirmação**: Quantos usuários confirmaram email
   ```sql
   SELECT COUNT(*) FROM email_logs
   WHERE type = 'status_update' AND status = 'success';
   ```

3. **Taxa de erro**: Quantos emails falharam
   ```sql
   SELECT COUNT(*) FROM email_logs
   WHERE status IN ('error', 'failed');
   ```

### Logs para Monitorar

- Logs das Edge Functions no Supabase Dashboard
- Logs de envio no painel do Mailchimp
- Tabela `email_logs` no banco de dados

## 10. Próximos Passos

Após confirmar que o sistema de confirmação está funcionando:

1. Desabilitar confirmação automática do Supabase
   - Dashboard > Authentication > Email Templates
   - Desativar template padrão de confirmação

2. Implementar sistema similar para:
   - Recuperação de senha
   - Convites de workspace
   - Notificações de análise concluída

3. Configurar alertas para:
   - Taxa de erro > 5%
   - Journey parada no Mailchimp
   - Falhas na API do Mailchimp

## 11. Contatos e Suporte

- **Mailchimp API Docs**: https://mailchimp.com/developer/transactional/api/
- **Supabase Edge Functions Docs**: https://supabase.com/docs/guides/functions
- **Supabase Auth Docs**: https://supabase.com/docs/guides/auth

---

**Data de criação**: 29/11/2025
**Versão**: 1.0
**Autor**: Sistema implementado via Claude Code
