# 🚀 Guia de Configuração - Templates de Email Resend

## 📋 Opções de Configuração

Você tem **2 opções** para gerenciar templates de email:

### ✅ **Opção 1: Usar Templates do Resend Dashboard (RECOMENDADO)**

**Vantagens:**
- Editar templates sem fazer deploy
- Preview visual no dashboard
- Versionamento de templates
- Fácil de testar

**Como configurar:**

1. **Acesse o Resend Dashboard:**
   - https://resend.com/emails/templates

2. **Crie um novo template:**
   - Clique em "Create Template"
   - Nome: `wislegal-confirmation-email`

3. **Cole o HTML:**
   - Copie o conteúdo de `/email-templates/confirmation-email.html`
   - Cole no editor do Resend

4. **Configure as variáveis:**
   - O template usa: `{{first_name}}` e `{{confirmation_url}}`
   - O Resend detecta automaticamente

5. **Salve e copie o Template ID:**
   - Exemplo: `re_AbCdEfGh123456789`

6. **Configure no Supabase:**
   ```bash
   # No Supabase Dashboard:
   # Settings > Edge Functions > Environment Variables

   RESEND_CONFIRMATION_TEMPLATE_ID=re_AbCdEfGh123456789
   ```

7. **✅ Pronto!** Próximos cadastros usarão o template do Resend

---

### ⚙️ **Opção 2: Usar HTML Inline (Atual)**

**Vantagens:**
- Controle total do código
- Versionamento no Git
- Não depende do Resend Dashboard

**Desvantagens:**
- Precisa deploy da edge function a cada mudança
- Sem preview visual

**Como funciona:**
- Se `RESEND_CONFIRMATION_TEMPLATE_ID` NÃO estiver configurado
- A edge function usa o HTML embutido (inline)
- Para editar: modifique `/supabase/functions/send-confirmation-email/index.ts`
- Faça deploy da edge function

---

## 🎯 Recomendação

**Use a Opção 1 (Template do Resend)**

Motivos:
1. Você já criou um template no Resend
2. Mais fácil de manter e editar
3. Não precisa fazer deploy a cada mudança
4. Preview visual antes de enviar

---

## 📝 Variáveis Disponíveis

Todos os templates devem usar estas variáveis:

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `{{first_name}}` | Nome do usuário | João |
| `{{confirmation_url}}` | Link de confirmação | https://... |

**Importante:**
- Use a sintaxe `{{variable_name}}` (com chaves duplas)
- Não use outras variáveis sem atualizar a edge function

---

## 🧪 Como Testar

### 1. Testar template no Resend:
   - Resend Dashboard > Templates > [seu template]
   - Clique em "Send Test"
   - Preencha as variáveis
   - Envie para seu email

### 2. Testar na plataforma:
   - Crie um novo usuário de teste
   - Verifique o email recebido
   - Confira se nome e botão estão corretos

---

## 🔄 Fluxo de Envio de Email

```
1. Usuário se cadastra
   ↓
2. AuthContext chama edge function send-confirmation-email
   ↓
3. Edge function verifica se RESEND_CONFIRMATION_TEMPLATE_ID existe
   ↓
   ├─ SIM → Usa template do Resend Dashboard
   └─ NÃO → Usa HTML inline (embutido)
   ↓
4. Resend envia o email
   ↓
5. Edge function registra log na tabela email_logs
```

---

## 🛠️ Próximos Templates

Se precisar criar outros templates de email:

1. **Adicione o HTML em** `/email-templates/`
   - Exemplo: `password-reset.html`

2. **Crie/atualize edge function correspondente**
   - Exemplo: `send-password-reset-email`

3. **Use o mesmo padrão:**
   - Verificar se existe `RESEND_[TIPO]_TEMPLATE_ID`
   - Se sim, usar template do Resend
   - Se não, usar HTML inline

4. **Documente as variáveis** no README.md

---

## ⚡ Quick Start

**Para começar a usar agora:**

```bash
# 1. Configure a variável no Supabase Dashboard
RESEND_CONFIRMATION_TEMPLATE_ID=re_seu_template_id_aqui

# 2. Teste criando um novo usuário
# ✅ Email será enviado usando seu template do Resend!
```

**Para editar o template:**

1. Edite no Resend Dashboard
2. Salve
3. ✅ Próximo email já usará a nova versão!

---

## 🆘 Troubleshooting

### Email não está sendo enviado:

1. **Verifique a API Key:**
   ```bash
   # No Supabase Dashboard > Edge Functions > Environment Variables
   RESEND_API_KEY=re_sua_chave
   ```

2. **Verifique os logs da edge function:**
   - Supabase Dashboard > Edge Functions > send-confirmation-email > Logs

3. **Teste a edge function diretamente:**
   ```bash
   curl -X POST https://[seu-projeto].supabase.co/functions/v1/send-confirmation-email \
     -H "Authorization: Bearer [ANON_KEY]" \
     -H "Content-Type: application/json" \
     -d '{
       "user_id": "test-id",
       "email": "seu@email.com",
       "first_name": "Teste"
     }'
   ```

### Template não está sendo aplicado:

1. **Verifique se `RESEND_CONFIRMATION_TEMPLATE_ID` está configurado**
2. **Verifique se o Template ID está correto** no Resend Dashboard
3. **Confira os logs** para ver se está usando "template" ou "inline HTML"

### Variáveis não estão sendo substituídas:

1. **No Resend Dashboard:**
   - Use `{{first_name}}` (chaves duplas)
   - Não use `${first_name}` ou outras sintaxes

2. **Confira se o nome da variável está correto:**
   - `first_name` ✅
   - `firstName` ❌
   - `FIRST_NAME` ❌

---

**Última atualização:** 2025-12-01
**Autor:** Equipe WisLegal
