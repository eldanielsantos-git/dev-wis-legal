# Monitoring

Monitoramento, logs e observabilidade.

## 📋 Documentos Nesta Seção

### [Sistema de Logs](./logging.md)
Como logs são gerados e acessados.

**Tópicos:**
- Logs do frontend (console)
- Logs das Edge Functions
- Structured logging
- Log levels
- Acesso aos logs

---

### [Métricas e Analytics](./metrics.md)
Métricas de uso e performance.

**Tópicos:**
- Métricas de análise
- Métricas de tokens
- Métricas de custos
- User analytics
- Dashboards

---

### [Health Checks](./health-checks.md)
Monitoramento de saúde do sistema.

**Tópicos:**
- Health check workers
- Monitoring de processos travados
- Monitoring de chunks falhados
- Alertas automáticos
- Recovery automático

---

### [Alertas e Notificações](./alerts.md)
Sistema de alertas para problemas.

**Tópicos:**
- Alertas para admins
- Email notifications
- Error tracking
- Thresholds de alerta

---

## 📊 Principais Métricas

### Performance
- Tempo médio de análise
- Tempo de resposta da API
- Taxa de sucesso de análises
- Uptime do sistema

### Uso
- Processos criados/dia
- Análises concluídas/dia
- Mensagens de chat/dia
- Usuários ativos

### Negócio
- Tokens consumidos
- Custos com Gemini
- Receita (Stripe)
- Churn rate

### Erros
- Taxa de erro das Edge Functions
- Processos falhados
- Chunks em dead letter queue
- Timeout rate

---

## 🔍 Ferramentas de Monitoring

### Supabase
- **Logs Explorer** - Logs em tempo real
- **Database Performance** - Queries lentas
- **API Analytics** - Uso das APIs

### GitHub Actions
- **Workflow Monitoring** - Status dos workflows
- Monitor de análises travadas
- Monitor de chunks falhados

### Custom
- `health-check-worker` - Verifica saúde do sistema
- `recover-stuck-processes` - Recupera processos
- `auto-restart-failed-chunks` - Reinicia chunks

---

## 🚨 Alertas Configurados

### Críticos
- Sistema de análise parado
- Edge Function com erro 500+
- Database connection lost
- Stripe webhook failed

### Avisos
- Processo travado > 30min
- Chunk em dead letter > 5min
- Taxa de erro > 5%
- Custos Gemini acima do esperado

### Informativos
- Novo usuário registrado
- Assinatura criada/cancelada
- Limite de tokens atingido

---

## 📈 Dashboards

### Admin Dashboard
- Overview de processos
- Status de análises
- Tokens consumidos
- Usuários ativos

### Analytics Dashboard
- Billing analytics
- Usage metrics
- Error rates
- Performance metrics

---

## 🔗 Links Relacionados

- [Troubleshooting](../10-troubleshooting/README.md)
- [API Reference](../06-api-reference/README.md)
- [Deployment](../08-deployment/README.md)

---

[← Voltar ao Índice Principal](../README.md)
