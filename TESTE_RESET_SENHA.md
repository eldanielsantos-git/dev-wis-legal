# 🧪 Guia de Teste - Reset de Senha

## ✅ Pré-requisitos

1. Sistema configurado e rodando
2. Template de email configurado no provedor com as variáveis:
   - `{{first_name}}`
   - `{{reset_url}}`
3. Edge functions deployadas:
   - `send-reset-password-email`
   - `update-user-password`

## 🔍 Teste Passo a Passo

### 1️⃣ Solicitar Reset de Senha

1. Acesse a página de login
2. Clique em "Esqueci minha senha"
3. Digite o email de um usuário cadastrado
4. Clique em "Enviar Link"

**✅ Resultado esperado:**
- Mensagem: "Email enviado! Verifique sua caixa de entrada"
- Nenhum erro no console

### 2️⃣ Verificar Email

1. Abra o email recebido
2. Verifique se contém:
   - Nome do usuário correto (`{{first_name}}`)
   - Botão "Redefinir Senha" funcional
   - Link alternativo para copiar/colar
   - Avisos de segurança (válido 1 hora)

**✅ Resultado esperado:**
- Email chegou em até 1 minuto
- Template renderizado corretamente
- Variáveis substituídas com valores reais

### 3️⃣ Clicar no Link

1. Clique no botão "Redefinir Senha" no email
2. Deve abrir página `/reset-password?token={UUID}`

**✅ Resultado esperado:**
- Página carrega sem erro
- Mostra formulário de nova senha
- Não mostra mensagem de token inválido

### 4️⃣ Validar Requisitos de Senha

Digite senhas inválidas para testar validação:

**Testes a fazer:**

| Senha | Deve falhar? | Motivo |
|-------|--------------|--------|
| `123` | ✅ Sim | Menos de 6 caracteres |
| `senha123` | ✅ Sim | Sem maiúscula |
| `SENHA123` | ✅ Sim | Sem minúscula |
| `SenhaAbc` | ✅ Sim | Sem número |
| `Senha123` | ✅ Sim | Sem caractere especial |
| `Senha123!` | ❌ Não | Válida! |

**✅ Resultado esperado:**
- Indicadores visuais (✓/✗) mudam conforme digita
- Senhas inválidas mostram erro específico
- Senha válida permite prosseguir

### 5️⃣ Confirmar Senha

1. Digite uma senha válida: `NovaSenha123!`
2. Confirme a mesma senha
3. Clique em "Redefinir Senha"

**✅ Resultado esperado:**
- Loading aparece
- Mensagem: "Senha atualizada com sucesso!"
- Redirecionamento automático para login em 2 segundos

### 6️⃣ Fazer Login com Nova Senha

1. Na página de login
2. Digite o email
3. Digite a nova senha: `NovaSenha123!`
4. Clique em "Entrar"

**✅ Resultado esperado:**
- Login bem-sucedido
- Acesso ao sistema normalmente
- Senha antiga não funciona mais

## 🔧 Testes de Segurança

### Teste 1: Token Expirado

1. Obter um token do banco:
   ```sql
   SELECT password_reset_token FROM user_profiles
   WHERE email = 'teste@exemplo.com';
   ```

2. Atualizar expiração para o passado:
   ```sql
   UPDATE user_profiles
   SET password_reset_expires_at = NOW() - INTERVAL '1 hour'
   WHERE email = 'teste@exemplo.com';
   ```

3. Tentar usar o link

**✅ Resultado esperado:**
- Mensagem: "Link de recuperação expirado"
- Não permite definir nova senha

### Teste 2: Token Já Usado

1. Completar reset de senha normalmente
2. Tentar usar o mesmo link novamente

**✅ Resultado esperado:**
- Mensagem: "Link de recuperação inválido"
- Token foi limpo do banco (`password_reset_token = NULL`)

### Teste 3: Token Inválido

1. Criar URL manual com token falso:
   ```
   https://app.wislegal.io/reset-password?token=123-fake-token
   ```

**✅ Resultado esperado:**
- Mensagem: "Link de recuperação inválido"
- Não permite prosseguir

### Teste 4: Email Não Cadastrado

1. Na página "Esqueci Senha"
2. Digite email não cadastrado: `naoexiste@exemplo.com`
3. Clique em "Enviar Link"

**✅ Resultado esperado:**
- Mensagem genérica: "Se o email existir, você receberá instruções"
- NÃO revela que email não existe (segurança)
- Nenhum email é enviado

## �� Verificações no Banco de Dados

### Verificar Token Gerado

```sql
SELECT
  id,
  first_name,
  email,
  password_reset_token,
  password_reset_expires_at
FROM user_profiles
WHERE email = 'teste@exemplo.com';
```

**✅ Resultado esperado:**
- `password_reset_token`: UUID válido
- `password_reset_expires_at`: +1 hora do momento atual

### Verificar Log de Email

```sql
SELECT
  email_type,
  to_email,
  subject,
  status,
  sent_at
FROM email_logs
WHERE email_type = 'password_reset'
ORDER BY sent_at DESC
LIMIT 5;
```

**✅ Resultado esperado:**
- Registro com `status = 'sent'`
- `sent_at` próximo ao horário da solicitação

### Verificar Token Foi Limpo

Após reset bem-sucedido:

```sql
SELECT
  password_reset_token,
  password_reset_expires_at
FROM user_profiles
WHERE email = 'teste@exemplo.com';
```

**✅ Resultado esperado:**
- `password_reset_token`: NULL
- `password_reset_expires_at`: NULL

## 🐛 Troubleshooting

### Problema: Email não chega

**Verificar:**

1. Edge function foi chamada:
   ```sql
   SELECT * FROM email_logs
   WHERE email_type = 'password_reset'
   ORDER BY sent_at DESC LIMIT 1;
   ```

2. Logs da edge function:
   - Abrir Dashboard Supabase
   - Functions > send-reset-password-email > Logs

3. API Key do Resend válida:
   - Verificar `RESEND_API_KEY` nas configurações

**Solução:** Verificar spam/lixeira, aguardar até 5 minutos

### Problema: Token inválido sempre

**Verificar:**

1. Token existe no banco:
   ```sql
   SELECT * FROM user_profiles
   WHERE password_reset_token IS NOT NULL;
   ```

2. Token não expirou:
   ```sql
   SELECT
     password_reset_expires_at,
     password_reset_expires_at > NOW() as is_valid
   FROM user_profiles
   WHERE password_reset_token = 'SEU_TOKEN_AQUI';
   ```

**Solução:** Gerar novo token solicitando reset novamente

### Problema: Erro ao atualizar senha

**Verificar:**

1. Logs da edge function `update-user-password`
2. Senha atende requisitos (6+ chars, maiúscula, minúscula, número, especial)
3. Token ainda é válido

**Solução:** Verificar console do browser (F12) para ver erro específico

## 📝 Checklist de Teste Completo

- [ ] Solicitar reset de senha
- [ ] Receber email em até 1 minuto
- [ ] Template renderizado corretamente
- [ ] Variáveis substituídas (`first_name`, `reset_url`)
- [ ] Link funciona e abre página correta
- [ ] Validação de senha funciona
- [ ] Reset bem-sucedido
- [ ] Login com nova senha funciona
- [ ] Senha antiga não funciona mais
- [ ] Token expirado é rejeitado
- [ ] Token já usado é rejeitado
- [ ] Token inválido é rejeitado
- [ ] Email não cadastrado não revela informação
- [ ] Token é limpo após uso
- [ ] Log de email criado corretamente

## ✅ Teste Finalizado

Se todos os itens acima funcionaram, o sistema de reset de senha está 100% operacional!

## 📞 Suporte

Para problemas:
1. Verificar logs das edge functions no Dashboard Supabase
2. Verificar tabela `email_logs` para histórico de envios
3. Consultar documentação em `/docs/SISTEMA_EMAILS_RESET_SENHA.md`
