# Próximos Passos - Configuração do Mailchimp

## ✅ O que já foi feito:

1. ✅ Edge Functions criadas e deployadas:
   - `send-confirmation-email` - ATIVO
   - `update-mailchimp-status` - ATIVO

2. ✅ Tabela `email_logs` criada no banco de dados

3. ✅ Frontend modificado:
   - AuthContext envia email após cadastro
   - ConfirmEmailPage processa confirmação
   - SignUpPage com botão de reenvio

4. ✅ Build do projeto concluído com sucesso

---

## 🔧 O que VOCÊ precisa fazer agora:

### 1. Configurar Secrets no Supabase Dashboard

**CRÍTICO**: As Edge Functions não vão funcionar sem estes secrets!

Acesse: **Supabase Dashboard > Project Settings > Edge Functions > Secrets**

Adicione os seguintes secrets (clique em "New secret" para cada um):

```
Nome: MAILCHIMP_API_KEY
Valor: 8fa47ffa1374ecd84976c82af406fd53-us3

Nome: MAILCHIMP_JOURNEY_KEY
Valor: md-lLdwTyHqVNLpBu4MqRz06w

Nome: MAILCHIMP_JOURNEY_ENDPOINT
Valor: https://us3.api.mailchimp.com/3.0/customer-journeys/journeys/51/steps/315/actions/trigger

Nome: MAILCHIMP_AUDIENCE_ID
Valor: f67c9ef227

Nome: FRONTEND_URL
Valor: https://app.wislegal.io
```

**Nota**: Se você estiver em ambiente de staging/teste, ajuste `FRONTEND_URL` para a URL correta.

---

### 2. Verificar Template no Mailchimp

Acesse o painel do Mailchimp e verifique:

1. **Journey ID 51, Step 315** está configurada corretamente
2. O template HTML usa as seguintes variáveis:
   - `*|FNAME|*` - Nome do usuário (saudação)
   - `*|EMAIL|*` - Email do usuário (opcional)
   - `*|CONFIRMATION_URL|*` - Link do botão de confirmação

**Exemplo de botão no template:**
```html
<a href="*|CONFIRMATION_URL|*" style="...">
  Confirmar Email
</a>
```

---

### 3. Verificar Campo Personalizado no Público

No público do Mailchimp (ID: f67c9ef227):

1. Acesse **Audience > Settings > Audience fields and *|MERGE|* tags**
2. Verifique se existe campo personalizado `CONFIRM_STATUS`
3. Se não existir, crie com:
   - **Field label**: CONFIRM_STATUS
   - **Field type**: Text
   - **Tag**: CONFIRM_STATUS

---

### 4. Testar o Fluxo Completo

#### 4.1. Teste de Cadastro

1. Acesse `https://app.wislegal.io/sign-up` (ou sua URL de teste)
2. Crie uma conta com email válido que você tenha acesso
3. Após cadastro, verifique:
   - ✅ Mensagem "Conta criada! Verifique seu email"
   - ✅ Email chegou na caixa de entrada
   - ✅ Email tem saudação personalizada com seu nome
   - ✅ Botão "Confirmar Email" está presente

#### 4.2. Verificar Logs da Edge Function

No Supabase Dashboard:

1. Vá para **Edge Functions > send-confirmation-email**
2. Clique em **Logs**
3. Procure por logs como:
   ```
   ✓ Confirmation URL generated
   ✓ Member added to Mailchimp
   ✓ Mailchimp Journey triggered successfully
   ✓ Email send logged to database
   ```

#### 4.3. Verificar no Mailchimp

1. Acesse Mailchimp Dashboard
2. Vá para **Audience > All contacts**
3. Busque pelo email que você cadastrou
4. Verifique:
   - ✅ Campo `FNAME` está preenchido
   - ✅ Campo `CONFIRM_STATUS` está como "pendente"
   - ✅ Status da Journey (se disparou)

#### 4.4. Teste de Confirmação

1. Abra o email recebido
2. Clique no botão "Confirmar Email"
3. Verifique:
   - ✅ Redirecionou para `/confirm-email`
   - ✅ Mostrou mensagem "Email Confirmado!"
   - ✅ Redirecionou para `/app` após 2 segundos

#### 4.5. Verificar Atualização no Mailchimp

Volte ao Mailchimp e verifique:
- ✅ Campo `CONFIRM_STATUS` mudou para "confirmado"

#### 4.6. Verificar Logs no Banco

Execute no SQL Editor do Supabase:

```sql
-- Ver todos os emails enviados
SELECT * FROM email_logs ORDER BY sent_at DESC LIMIT 10;

-- Ver apenas confirmações
SELECT * FROM email_logs WHERE type = 'confirmation';

-- Ver atualizações de status
SELECT * FROM email_logs WHERE type = 'status_update';
```

---

### 5. Teste de Reenvio de Email

1. Na página "Conta criada", clique em "Reenviar email de confirmação"
2. Verifique:
   - ✅ Botão fica desabilitado por 60 segundos
   - ✅ Mostra countdown "Reenviar email (59s, 58s...)"
   - ✅ Novo email chega na caixa de entrada
   - ✅ Novo token funciona normalmente

---

### 6. Troubleshooting

Se algo não funcionar:

#### Email não está sendo enviado

1. Verificar logs da função `send-confirmation-email` no Supabase
2. Procurar por erros como:
   - `Missing Mailchimp environment variables` → Secrets não configurados
   - `401 Unauthorized` → API Key incorreta
   - `404 Not Found` → Journey ID ou Step ID incorretos

#### Token inválido ou expirado

- Tokens expiram em 24 horas
- Usar botão de reenvio para gerar novo token

#### Status não atualiza no Mailchimp

1. Verificar logs da função `update-mailchimp-status`
2. Verificar se email está em lowercase
3. Verificar se contato existe no público

#### Erro de CORS

- Edge Functions já incluem headers CORS corretos
- Se persistir, verificar se `FRONTEND_URL` está correto

---

### 7. Monitoramento Contínuo

Após confirmar que está funcionando:

1. **Criar alerta para taxa de erro**:
   ```sql
   SELECT
     COUNT(*) FILTER (WHERE status IN ('error', 'failed')) * 100.0 / COUNT(*) as error_rate
   FROM email_logs
   WHERE type = 'confirmation'
   AND sent_at > NOW() - INTERVAL '24 hours';
   ```

2. **Monitorar Journey no Mailchimp**:
   - Dashboard > Automations > Ver estatísticas da Journey 51

3. **Desabilitar confirmação padrão do Supabase**:
   - Dashboard > Authentication > Email Templates
   - Desativar template de confirmação nativo

---

### 8. Comandos Úteis (SQL)

```sql
-- Ver taxa de confirmação
SELECT
  COUNT(*) FILTER (WHERE type = 'confirmation') as enviados,
  COUNT(*) FILTER (WHERE type = 'status_update' AND status = 'success') as confirmados,
  COUNT(*) FILTER (WHERE type = 'status_update' AND status = 'success') * 100.0 /
    NULLIF(COUNT(*) FILTER (WHERE type = 'confirmation'), 0) as taxa_confirmacao
FROM email_logs;

-- Ver últimos erros
SELECT * FROM email_logs
WHERE status IN ('error', 'failed')
ORDER BY sent_at DESC
LIMIT 10;

-- Ver emails por usuário
SELECT
  email,
  COUNT(*) as total_emails,
  MAX(sent_at) as ultimo_envio
FROM email_logs
GROUP BY email
ORDER BY MAX(sent_at) DESC;
```

---

## 📚 Documentação Completa

Para mais detalhes, consulte:
- `MAILCHIMP_SETUP_GUIDE.md` - Guia completo com toda a implementação

---

## ✅ Checklist Final

Antes de considerar concluído, confirme:

- [ ] Secrets configurados no Supabase
- [ ] Template do Mailchimp usa variáveis corretas
- [ ] Campo CONFIRM_STATUS existe no público
- [ ] Teste de cadastro funcionando
- [ ] Email chegando com nome correto
- [ ] Botão de confirmação funciona
- [ ] Status atualiza no Mailchimp
- [ ] Reenvio de email funciona
- [ ] Logs no banco estão sendo criados
- [ ] Confirmação padrão do Supabase desabilitada

---

**Data**: 29/11/2025
**Status**: Edge Functions deployadas e aguardando configuração de secrets
