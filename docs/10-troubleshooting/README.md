# Troubleshooting

Guias de resolução de problemas e debugging.

## 📋 Documentos Nesta Seção

### [Problemas Comuns](./common-issues.md)
Lista de problemas comuns e soluções.

**Tópicos:**
- Erros de upload
- Análise não inicia
- Análise travada
- Chunks falhados
- Erros de autenticação
- Problemas com Stripe

---

### [Debugging Guide](./debugging.md)
Guia para fazer debugging do sistema.

**Tópicos:**
- Como acessar logs
- Debugging frontend
- Debugging Edge Functions
- Debugging banco de dados
- Tools úteis

---

### [Recovery Procedures](./recovery.md)
Procedimentos de recuperação de falhas.

**Tópicos:**
- Recuperar análise travada
- Recuperar chunks falhados
- Rollback de migração
- Restaurar dados
- Emergency procedures

---

### [FAQ](./faq.md)
Perguntas frequentes.

**Tópicos:**
- Dúvidas gerais
- Dúvidas técnicas
- Dúvidas de integração
- Dúvidas de billing

---

## 🔧 Problemas Mais Comuns

### 1. Análise Não Inicia
**Sintomas:**
- Processo fica em "pending"
- Nenhum chunk criado

**Causas Possíveis:**
- Saldo de tokens insuficiente
- Erro no upload para Gemini
- Edge Function não disparada

**Soluções:**
- Verificar saldo de tokens
- Verificar logs da function `upload-to-gemini`
- Verificar se arquivo foi enviado ao Gemini

---

### 2. Análise Travada
**Sintomas:**
- Processo em "processing" por muito tempo
- Chunks não progridem

**Causas Possíveis:**
- Worker parado
- Chunk em dead letter queue
- Rate limit do Gemini

**Soluções:**
- Executar `recover-stuck-processes`
- Verificar dead letter queue
- Aguardar cooldown do rate limit

---

### 3. Erro de Autenticação
**Sintomas:**
- "Invalid token" ou "Unauthorized"
- Redirecionado para login

**Causas Possíveis:**
- Token expirado
- Sessão invalidada
- RLS policy bloqueando acesso

**Soluções:**
- Fazer logout e login novamente
- Limpar localStorage
- Verificar RLS policies

---

### 4. Stripe Webhook Failed
**Sintomas:**
- Assinatura não ativa após pagamento
- Tokens não creditados

**Causas Possíveis:**
- Webhook signature inválida
- Edge Function com erro
- Dados inconsistentes

**Soluções:**
- Verificar signature do webhook
- Reprocessar evento via Stripe Dashboard
- Sincronizar dados manualmente

---

## 🛠️ Ferramentas de Debug

### Logs
```bash
# Logs de Edge Function específica
supabase functions logs function-name

# Logs em tempo real
supabase functions logs --tail
```

### Database
```sql
-- Ver processos travados
SELECT * FROM processos
WHERE status = 'processing'
AND updated_at < NOW() - INTERVAL '30 minutes';

-- Ver chunks falhados
SELECT * FROM chunks
WHERE status = 'failed';

-- Ver dead letter queue
SELECT * FROM chunks
WHERE dead_letter_at IS NOT NULL;
```

### Admin Tools
- Restart stage manual
- Diagnose dead letter chunks
- Force sync customer
- Billing analytics

---

## 📞 Quando Pedir Ajuda

Se após tentar as soluções você ainda tiver problemas:

1. Colete informações:
   - Logs relevantes
   - ID do processo/chunk
   - Timestamp do erro
   - Passos para reproduzir

2. Verifique issues existentes no GitHub

3. Abra uma nova issue com todas as informações

---

## 🔗 Links Relacionados

- [Monitoring](../09-monitoring/README.md)
- [API Reference](../06-api-reference/README.md)
- [Database](../03-database/README.md)

---

[← Voltar ao Índice Principal](../README.md)
