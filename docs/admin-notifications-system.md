# Sistema de Notificações Administrativas

## Visão Geral

Sistema completo e isolado para envio de notificações administrativas para o Slack. O sistema foi projetado para ser **100% seguro** - falhas nunca afetam o sistema principal.

## Arquitetura

### Componentes Principais

1. **Banco de Dados** (3 tabelas isoladas)
   - `admin_notification_types`: Tipos de notificações cadastrados
   - `admin_notification_config`: Configuração individual de cada tipo
   - `admin_notifications`: Histórico completo de notificações enviadas

2. **Edge Functions**
   - `send-admin-notification`: Hub central que processa todas as notificações
   - `_shared/slack-client.ts`: Cliente Slack isolado com formatação por severidade
   - `_shared/notify-admin-safe.ts`: Helper fire-and-forget para chamadas seguras

3. **Frontend**
   - `AdminNotificationsService.ts`: Serviço para gerenciar notificações
   - `AdminNotificationsPage.tsx`: Página admin completa com 4 abas

### Princípios de Segurança

- **Fire-and-Forget**: Notificações são enviadas sem bloquear o fluxo principal
- **Triple Try-Catch**: Múltiplas camadas de proteção contra erros
- **Falhas Silenciosas**: Erros são logados mas nunca propagados
- **Sempre Retorna Success**: Edge function sempre retorna HTTP 200

## Tipos de Notificações

### Sucessos (10 tipos)
- ✅ `analysis_completed`: Análise concluída com sucesso
- 🎉 `user_signup`: Novo usuário cadastrado
- 💳 `subscription_created`: Nova assinatura criada
- ⬆️ `subscription_upgraded`: Upgrade de plano
- ⬇️ `subscription_downgraded`: Downgrade de plano
- 🪙 `token_purchase`: Compra de tokens
- 🎯 `user_level_up`: Usuário subiu de nível
- 📧 `workspace_invite_sent`: Convite workspace enviado
- 👥 `friend_invite_sent`: Convite amigo enviado
- ✅ `invite_accepted`: Convite aceito

### Erros (9 tipos)
- ❌ `analysis_failed`: Erro em análise simples
- ⚠️ `analysis_complex_failed`: Erro em análise complexa
- ⏱️ `gemini_timeout`: Timeout Gemini API
- 🚫 `gemini_rate_limit`: Rate limit Gemini
- 🔧 `worker_error`: Erro em worker
- 💀 `dead_letter_queue`: Dead letter queue crítica
- 🔒 `process_stuck`: Processo travado
- 🗄️ `database_error`: Erro de banco
- 📦 `storage_error`: Erro de storage

### Integrações (6 tipos)
- 💳 `stripe_webhook_error`: Erro webhook Stripe
- 💸 `stripe_payment_failed`: Pagamento falhou
- 🪙 `stripe_token_payment_failed`: Pagamento tokens falhou
- ⚡ `stripe_chargeback`: Chargeback detectado
- 📧 `resend_email_error`: Erro email Resend
- 📉 `resend_high_bounce_rate`: Bounce rate alto

### Infraestrutura (5 tipos)
- 🔧 `github_action_failed`: GitHub Action falhou
- 🏗️ `netlify_build_failed`: Build Netlify falhou
- ⚠️ `deploy_warnings`: Deploy com warnings
- 📊 `supabase_quota_warning`: Quota Supabase próxima
- 📡 `netlify_bandwidth_high`: Bandwidth alto

### Sistema (5 tipos)
- ❌ `subscription_cancelled`: Assinatura cancelada
- 🗑️ `user_deleted`: Usuário deletado
- 📋 `bulk_operation_completed`: Operação em massa
- 💾 `backup_completed`: Backup concluído
- 🛠️ `maintenance_scheduled`: Manutenção agendada

## Integrações Implementadas

### process-next-prompt
- ✅ Notificação de sucesso quando análise completa
- ❌ Notificação de erro (simples e complexo) via `logCriticalErrorAndNotify`

### stripe-webhook
- 💳 Assinatura criada
- ❌ Assinatura cancelada
- ⬆️ Upgrade de plano
- ⬇️ Downgrade de plano
- 🪙 Compra de tokens

## Como Usar

### Adicionar Notificação em Edge Function

```typescript
import { notifyAdminSafe } from '../_shared/notify-admin-safe.ts';

// No seu código, após operação importante:
try {
  // ... sua lógica principal ...

  // Adicione a notificação (não bloqueia o fluxo)
  notifyAdminSafe({
    type: 'analysis_completed',
    title: 'Análise Concluída',
    message: 'Análise do processo foi concluída com sucesso.',
    severity: 'success',
    metadata: {
      processo_id: 'xxx',
      execution_time: 120,
      // ... outros dados relevantes
    },
    userId: 'user-uuid',
    processoId: 'processo-uuid',
  });
} catch (error) {
  // Notificação de erro
  notifyAdminSafe({
    type: 'analysis_failed',
    title: 'Erro em Análise',
    message: `Erro: ${error.message}`,
    severity: 'high',
    metadata: { error: error.toString() },
  });
}
```

### Configurar Slack Webhook

1. Acesse a página de administração: `/admin/notifications`
2. Configure o webhook URL do Slack na tabela `slack_notifications`
3. Habilite/desabilite tipos individuais na aba "Configurações"

### Variáveis de Ambiente

- `ADMIN_NOTIFICATIONS_ENABLED`: Flag master (padrão: true)
  - Se `false`, todo o sistema é desabilitado

## Página Admin

A página `/admin/notifications` possui 4 abas:

### 1. Estatísticas
- Total de notificações hoje
- Total últimas 24 horas
- Breakdown por severidade
- Breakdown por categoria
- Taxa de sucesso/falha Slack

### 2. Configurações
- Lista todos os tipos agrupados por categoria
- Toggle habilitado/desabilitado por tipo
- Toggle envio para Slack

### 3. Histórico
- Tabela com últimas 50 notificações
- Filtros por categoria, severidade, data
- Busca textual
- Modal com detalhes completos (metadata, erros, etc)

### 4. Testar
- Enviar notificação de teste
- Selecionar tipo específico
- Feedback imediato de sucesso/erro

## Formatação por Severidade

O Slack Client formata mensagens automaticamente:

- 🚨 **CRÍTICO** (vermelho): Requer ação imediata
- ⚠️ **ALTO** (laranja): Atenção urgente
- ℹ️ **MÉDIO** (amarelo): Deve ser revisado
- 📋 **BAIXO** (azul): Informativo
- ✅ **SUCESSO** (verde): Confirmação positiva

## Monitoramento

### Queries Úteis

```sql
-- Taxa de sucesso nas últimas 24h
SELECT
  COUNT(*) FILTER (WHERE sent_to_slack = true) as enviadas,
  COUNT(*) FILTER (WHERE sent_to_slack = false) as falhadas,
  COUNT(*) as total
FROM admin_notifications
WHERE created_at > now() - interval '24 hours';

-- Notificações mais frequentes
SELECT
  ant.name,
  COUNT(*) as total
FROM admin_notifications an
JOIN admin_notification_types ant ON an.notification_type_id = ant.id
WHERE an.created_at > now() - interval '7 days'
GROUP BY ant.name
ORDER BY total DESC
LIMIT 10;

-- Erros mais comuns
SELECT
  error_message,
  COUNT(*) as occurrences
FROM admin_notifications
WHERE error_message IS NOT NULL
AND created_at > now() - interval '7 days'
GROUP BY error_message
ORDER BY occurrences DESC;
```

## Troubleshooting

### Notificações não estão sendo enviadas ao Slack

1. Verificar webhook URL na tabela `slack_notifications`
2. Verificar se tipo está habilitado (`admin_notification_config`)
3. Verificar variável `ADMIN_NOTIFICATIONS_ENABLED`
4. Ver erros na tabela `admin_notifications.error_message`

### Sistema principal está sendo afetado

Impossível! O sistema usa fire-and-forget e múltiplos try-catch. Se isso acontecer, há um bug crítico no código.

### Como adicionar novo tipo de notificação

1. Inserir na tabela `admin_notification_types`
2. Sistema cria config automaticamente
3. Adicionar chamada `notifyAdminSafe` no código

## Boas Práticas

1. **Sempre** use `notifyAdminSafe`, nunca chame a edge function diretamente
2. **Sempre** envolva em try-catch (redundância é boa)
3. **Sempre** chame DEPOIS de salvar dados importantes
4. **Nunca** use await na notificação (fire-and-forget)
5. **Sempre** inclua metadata relevante
6. Use severidade apropriada (não abuse de "critical")

## Segurança

- RLS habilitado em todas as tabelas
- Apenas administradores podem acessar
- Service role necessário para inserir notificações
- Rate limiting de 200 notificações/minuto
- Auditoria de alterações em configurações

## Extensibilidade

Para adicionar nova integração:

1. Importar `notifyAdminSafe` na edge function
2. Adicionar chamadas após operações importantes
3. Escolher tipo existente ou adicionar novo
4. Incluir metadata relevante para debug

## Conclusão

Sistema robusto, seguro e isolado que permite monitoramento completo de eventos importantes da aplicação sem risco de afetar funcionalidades principais.
