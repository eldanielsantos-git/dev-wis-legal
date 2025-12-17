# API Reference

Documentação completa das APIs e Edge Functions.

## 📋 Documentos Nesta Seção

### [Edge Functions Overview](./edge-functions.md)
Visão geral de todas as Edge Functions do sistema.

**Tópicos:**
- Lista completa de functions
- Propósito de cada uma
- Parâmetros e retornos
- Autenticação requerida

---

### [API Endpoints](./endpoints.md)
Documentação detalhada de cada endpoint.

**Tópicos:**
- Análise endpoints
- Chat endpoints
- Admin endpoints
- Email endpoints
- Stripe endpoints

---

### [Schemas e Validações](./schemas.md)
Schemas de request/response e validações.

**Tópicos:**
- Request schemas
- Response schemas
- Validações
- Error responses

---

### [Exemplos de Uso](./examples.md)
Exemplos práticos de uso das APIs.

**Tópicos:**
- Exemplos curl
- Exemplos JavaScript
- Exemplos TypeScript
- Error handling

---

## 🔌 Principais Edge Functions

### Análise
- **start-analysis** - Inicia análise de processo
- **upload-to-gemini** - Upload de arquivo para Gemini
- **process-next-prompt** - Processa próximo prompt
- **consolidation-worker** - Consolida resultados
- **restart-stage-manual** - Reinicia stage manualmente

### Chat
- **chat-with-processo** - Chat sobre processo
- **process-audio-message** - Processa áudio para texto

### Stripe/Pagamentos
- **stripe-checkout** - Cria checkout session
- **stripe-webhook** - Webhook de eventos Stripe
- **cancel-subscription** - Cancela assinatura

### Email
- **send-confirmation-email** - Email de confirmação
- **send-email-process-completed** - Notifica conclusão
- **send-tokens-limit** - Alerta de limite de tokens
- **send-subscription-confirmation-email** - Confirma assinatura

### Admin
- **admin-delete-user** - Delete usuário (admin)
- **get-billing-analytics** - Analytics de billing
- **sync-stripe-subscription** - Sincroniza assinatura

### Monitoring
- **health-check-worker** - Health check automático
- **recover-stuck-processes** - Recupera processos travados
- **auto-restart-failed-chunks** - Reinicia chunks falhados

---

## 🔐 Autenticação

### Tipos de Autenticação

1. **User Authentication**
   - Bearer token no header Authorization
   - Token obtido via Supabase Auth

2. **Service Role**
   - Para operações administrativas
   - Usado em workers internos

3. **Webhook Signature**
   - Para webhooks do Stripe
   - Validação de assinatura

---

## 📝 Padrões de Request/Response

### Request Padrão
```json
{
  "headers": {
    "Authorization": "Bearer <token>",
    "Content-Type": "application/json"
  },
  "body": {
    // payload
  }
}
```

### Response Padrão - Sucesso
```json
{
  "success": true,
  "data": {
    // result data
  }
}
```

### Response Padrão - Erro
```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE"
  }
}
```

---

## 🔗 Links Relacionados

- [Sistema de Análise](../05-analysis/README.md)
- [Database Schema](../03-database/README.md)
- [Troubleshooting](../10-troubleshooting/README.md)

---

[← Voltar ao Índice Principal](../README.md)
