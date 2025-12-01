# 📧 Email Templates - Wis Legal

Esta pasta contém todos os templates de email usados pela plataforma.

## 📁 Estrutura

```
email-templates/
├── README.md                    # Este arquivo
├── confirmation-email.html      # Template de confirmação de email
└── [outros templates futuros]
```

## 🎨 Templates Disponíveis

### 1. `confirmation-email.html`
**Uso:** Email de confirmação de cadastro
**Edge Function:** `send-confirmation-email`
**Variáveis:**
- `{{first_name}}` - Nome do usuário
- `{{confirmation_url}}` - Link de confirmação

---

## 🔧 Como Usar Templates

### Opção 1: Usar templates do Resend (Recomendado para produção)

1. **Criar template no Resend Dashboard:**
   - Acesse: https://resend.com/emails/templates
   - Clique em "Create Template"
   - Cole o HTML do arquivo `.html`
   - Configure as variáveis: `first_name`, `confirmation_url`
   - Salve e copie o `template_id`

2. **Atualizar edge function para usar template:**
   ```typescript
   // Ao invés de enviar HTML direto:
   const resendResponse = await fetch("https://api.resend.com/emails", {
     method: "POST",
     headers: {
       "Content-Type": "application/json",
       "Authorization": `Bearer ${resendApiKey}`,
     },
     body: JSON.stringify({
       from: "WisLegal <noreply@wislegal.io>",
       to: [email],
       template: "template_id_aqui", // ID do template do Resend
       params: {
         first_name: finalFirstName,
         confirmation_url: confirmationUrl
       }
     }),
   });
   ```

### Opção 2: Usar HTML embutido (Atual)

A edge function lê o HTML diretamente e faz replace das variáveis.

**Vantagens:**
- Versionamento dos templates no Git
- Fácil de editar e testar localmente
- Sem dependência do dashboard do Resend

**Desvantagens:**
- Precisa fazer deploy da edge function a cada mudança
- Sem preview no Resend Dashboard

---

## ✏️ Como Editar Templates

1. Edite o arquivo `.html` na pasta `email-templates/`
2. Use variáveis no formato: `{{variable_name}}`
3. Teste localmente (veja seção abaixo)
4. Faça deploy da edge function ou atualize no Resend

---

## 🧪 Como Testar Templates

### Testar localmente (HTML estático):

1. Abra o arquivo `.html` no navegador
2. Substitua manualmente as variáveis para visualizar

### Testar com dados reais:

1. Crie um usuário de teste na plataforma
2. Verifique o email recebido
3. Ajuste o template conforme necessário

---

## 📋 Variáveis Disponíveis por Template

### `confirmation-email.html`
| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `{{first_name}}` | Nome do usuário | João |
| `{{confirmation_url}}` | Link de confirmação | https://... |

---

## 🎯 Boas Práticas

1. **Sempre teste em múltiplos clientes de email:**
   - Gmail, Outlook, Apple Mail, etc.

2. **Use inline CSS:**
   - Alguns clientes removem `<style>` tags

3. **Imagens:**
   - Use URLs absolutas
   - Host no Supabase Storage ou CDN
   - Sempre adicione `alt` text

4. **Responsividade:**
   - Use tabelas ao invés de divs
   - Teste em mobile e desktop

5. **Acessibilidade:**
   - Use textos alternativos
   - Contraste adequado
   - Fonte legível (min 14px)

---

## 🔄 Processo de Atualização

### Para usar templates do Resend Dashboard:

1. Edite o HTML na pasta `email-templates/`
2. Copie o HTML atualizado
3. Cole no Resend Dashboard
4. Salve o template
5. ✅ Pronto! (não precisa deploy)

### Para usar HTML embutido:

1. Edite o HTML na pasta `email-templates/`
2. Atualize a edge function correspondente
3. Deploy da edge function
4. ✅ Teste!

---

## 📝 Adicionar Novo Template

1. Crie arquivo `novo-template.html` nesta pasta
2. Use variáveis no formato `{{variable_name}}`
3. Documente as variáveis aqui no README
4. Crie/atualize edge function correspondente
5. Teste e faça deploy

---

**Última atualização:** 2025-12-01
**Mantido por:** Equipe WisLegal
