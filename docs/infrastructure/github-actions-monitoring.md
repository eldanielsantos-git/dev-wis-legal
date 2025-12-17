# GitHub Actions - Sistema de Monitoramento Automatizado

Sistema completo de 5 workflows que monitoram e recuperam automaticamente processos e chunks travados.

## Visão Geral

O sistema usa GitHub Actions para executar verificações periódicas e recuperação automatizada:

| Workflow | Frequência | Função | Criticidade |
|----------|------------|--------|-------------|
| **monitor-stuck-processes** | 1 minuto | Identifica processos travados | 🔴 Alta |
| **monitor-auto-restart-failed-chunks** | 3 minutos | Reinicia chunks falhados | 🔴 Alta |
| **monitor-complex-health-check** | 5 minutos | Health check geral | 🟡 Média |
| **monitor-stuck-chunks** | 5 minutos | Identifica chunks travados | 🟡 Média |
| **monitor-complex-recovery** | 10 minutos | Recuperação de análises complexas | 🟢 Baixa |

---

## 1. Monitor Stuck Processes

**Arquivo:** `.github/workflows/monitor-stuck-processes.yml`
**Frequência:** A cada 1 minuto
**Função:** Detecta e recupera processos que ficaram travados em "processing"

### Workflow YAML

```yaml
name: Monitor Stuck Processes

on:
  schedule:
    - cron: '*/1 * * * *'  # A cada 1 minuto
  workflow_dispatch:  # Permite execução manual

jobs:
  check-stuck-processes:
    runs-on: ubuntu-latest
    timeout-minutes: 5

    steps:
      - name: Check for Stuck Processes
        run: |
          curl -X POST \
            '${{ secrets.SUPABASE_URL }}/functions/v1/process-stuck-processos' \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{}'

      - name: Log Result
        if: always()
        run: |
          echo "Stuck processes check completed at $(date)"
```

### Edge Function Correspondente

**`supabase/functions/process-stuck-processos/index.ts`**

```typescript
serve(async (req: Request) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Buscar processos travados (> 30 min sem atualização)
  const { data: stuckProcessos } = await supabase
    .from('processos')
    .select('*')
    .eq('status', 'processing')
    .lt('updated_at', new Date(Date.now() - 30 * 60 * 1000).toISOString());

  let recovered = 0;

  for (const processo of stuckProcessos || []) {
    try {
      // Verificar chunks pendentes
      const { data: pendingChunks } = await supabase
        .from('chunks')
        .select('count')
        .eq('processo_id', processo.id)
        .eq('status', 'pending');

      if (pendingChunks && pendingChunks.length > 0) {
        // Ainda há chunks pendentes, trigger worker
        await triggerWorker();
      } else {
        // Todos chunks completados, trigger consolidação
        await triggerConsolidation(processo.id);
      }

      recovered++;
    } catch (error) {
      console.error(`Failed to recover processo ${processo.id}:`, error);
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      checked: stuckProcessos?.length || 0,
      recovered
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
```

### Configuração

**Secrets Necessários:**
- `SUPABASE_URL`: URL do projeto Supabase
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key (não a anon key!)

**Adicionar Secrets:**
1. GitHub Repository → Settings → Secrets and variables → Actions
2. New repository secret
3. Adicione `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`

---

## 2. Monitor Auto-Restart Failed Chunks

**Arquivo:** `.github/workflows/monitor-auto-restart-failed.yml`
**Frequência:** A cada 3 minutos
**Função:** Reinicia automaticamente chunks que falharam mas ainda têm retries disponíveis

### Workflow YAML

```yaml
name: Monitor Auto-Restart Failed Chunks

on:
  schedule:
    - cron: '*/3 * * * *'  # A cada 3 minutos
  workflow_dispatch:

jobs:
  auto-restart-failed:
    runs-on: ubuntu-latest
    timeout-minutes: 5

    steps:
      - name: Auto-Restart Failed Chunks
        run: |
          curl -X POST \
            '${{ secrets.SUPABASE_URL }}/functions/v1/auto-restart-failed-chunks' \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json"

      - name: Log Result
        if: always()
        run: echo "Auto-restart check completed"
```

### Edge Function Correspondente

```typescript
serve(async (req: Request) => {
  const supabase = createClient(...);

  // Buscar chunks falhados com retries disponíveis
  const { data: failedChunks } = await supabase
    .from('chunks')
    .select('*')
    .eq('status', 'failed')
    .lt('retry_count', 3)  // Máximo 3 retries
    .is('dead_letter_at', null);

  let restarted = 0;

  for (const chunk of failedChunks || []) {
    try {
      // Reset status e incrementa retry
      await supabase
        .from('chunks')
        .update({
          status: 'pending',
          retry_count: chunk.retry_count + 1,
          error_message: null
        })
        .eq('id', chunk.id);

      restarted++;
    } catch (error) {
      console.error(`Failed to restart chunk ${chunk.id}:`, error);
    }
  }

  // Trigger worker se houver chunks para processar
  if (restarted > 0) {
    await triggerWorker();
  }

  return new Response(
    JSON.stringify({
      success: true,
      checked: failedChunks?.length || 0,
      restarted
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
```

---

## 3. Monitor Complex Health Check

**Arquivo:** `.github/workflows/monitor-complex-health-check.yml`
**Frequência:** A cada 5 minutos
**Função:** Verifica saúde geral do sistema (workers, database, dead letter queue)

### Workflow YAML

```yaml
name: Monitor Complex Health Check

on:
  schedule:
    - cron: '*/5 * * * *'  # A cada 5 minutos
  workflow_dispatch:

jobs:
  health-check:
    runs-on: ubuntu-latest
    timeout-minutes: 5

    steps:
      - name: Run Health Check
        id: health
        run: |
          response=$(curl -X POST \
            '${{ secrets.SUPABASE_URL }}/functions/v1/health-check-worker' \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json")

          echo "response=$response" >> $GITHUB_OUTPUT

      - name: Check Health Status
        run: |
          if echo '${{ steps.health.outputs.response }}' | jq -e '.healthy == false'; then
            echo "::warning::System health check failed!"
            exit 1
          fi

      - name: Notify on Failure
        if: failure()
        run: |
          # Aqui você pode adicionar notificação (Slack, email, etc)
          echo "Health check failed - alerting team"
```

### Edge Function Correspondente

```typescript
serve(async (req: Request) => {
  const supabase = createClient(...);

  const issues: string[] = [];

  // Check 1: Processos travados
  const { data: stuckProcessos } = await supabase
    .from('processos')
    .select('count')
    .eq('status', 'processing')
    .lt('updated_at', new Date(Date.now() - 30 * 60 * 1000).toISOString());

  if (stuckProcessos && stuckProcessos.length > 0) {
    issues.push(`${stuckProcessos.length} processos travados`);
  }

  // Check 2: Chunks em dead letter
  const { data: deadLetterChunks } = await supabase
    .from('chunks')
    .select('count')
    .not('dead_letter_at', 'is', null);

  if (deadLetterChunks && deadLetterChunks.length > 5) {
    issues.push(`${deadLetterChunks.length} chunks em dead letter queue`);
  }

  // Check 3: Taxa de falha alta
  const { data: recentChunks } = await supabase
    .from('chunks')
    .select('status')
    .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());

  const failureRate = recentChunks
    ? recentChunks.filter(c => c.status === 'failed').length / recentChunks.length
    : 0;

  if (failureRate > 0.1) {
    issues.push(`Taxa de falha alta: ${(failureRate * 100).toFixed(1)}%`);
  }

  const healthy = issues.length === 0;

  return new Response(
    JSON.stringify({
      healthy,
      issues,
      timestamp: new Date().toISOString()
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
```

---

## 4. Monitor Stuck Chunks

**Arquivo:** `.github/workflows/monitor-stuck-chunks.yml`
**Frequência:** A cada 5 minutos
**Função:** Identifica chunks específicos que ficaram travados em "processing"

### Workflow YAML

```yaml
name: Monitor Stuck Chunks

on:
  schedule:
    - cron: '*/5 * * * *'
  workflow_dispatch:

jobs:
  recover-stuck-chunks:
    runs-on: ubuntu-latest
    timeout-minutes: 5

    steps:
      - name: Recover Stuck Chunks
        run: |
          curl -X POST \
            '${{ secrets.SUPABASE_URL }}/functions/v1/recover-stuck-chunks' \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json"
```

### Edge Function Correspondente

```typescript
serve(async (req: Request) => {
  const supabase = createClient(...);

  // Chunks em "processing" por mais de 10 minutos
  const { data: stuckChunks } = await supabase
    .from('chunks')
    .select('*')
    .eq('status', 'processing')
    .lt('updated_at', new Date(Date.now() - 10 * 60 * 1000).toISOString());

  let recovered = 0;

  for (const chunk of stuckChunks || []) {
    try {
      // Reset para pending
      await supabase
        .from('chunks')
        .update({
          status: 'pending',
          retry_count: chunk.retry_count + 1
        })
        .eq('id', chunk.id);

      recovered++;
    } catch (error) {
      console.error(`Failed to recover chunk ${chunk.id}:`, error);
    }
  }

  if (recovered > 0) {
    await triggerWorker();
  }

  return new Response(
    JSON.stringify({ success: true, recovered }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
```

---

## 5. Monitor Complex Recovery

**Arquivo:** `.github/workflows/monitor-complex-recovery.yml`
**Frequência:** A cada 10 minutos
**Função:** Recuperação específica para análises complexas (processos grandes)

### Workflow YAML

```yaml
name: Monitor Complex Recovery

on:
  schedule:
    - cron: '*/10 * * * *'
  workflow_dispatch:

jobs:
  complex-recovery:
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - name: Run Complex Recovery
        run: |
          curl -X POST \
            '${{ secrets.SUPABASE_URL }}/functions/v1/recover-stuck-processes' \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{"analysis_type": "complex"}'
```

---

## Execução Manual

Todos os workflows podem ser executados manualmente:

1. GitHub Repository → Actions
2. Selecione o workflow
3. Run workflow → Run workflow (branch main)

---

## Logs e Debugging

### Ver Logs de Execução

1. GitHub → Actions
2. Selecione o workflow
3. Clique na execução
4. Visualize logs de cada step

### Logs das Edge Functions

```bash
# Via Supabase CLI
supabase functions logs process-stuck-processos --tail

# Via Dashboard
Supabase → Edge Functions → Selecione function → Logs
```

---

## Alertas

### Configurar Notificações

Adicione step de notificação nos workflows:

```yaml
- name: Notify Slack on Failure
  if: failure()
  uses: rtCamp/action-slack-notify@v2
  env:
    SLACK_WEBHOOK: ${{ secrets.SLACK_WEBHOOK }}
    SLACK_MESSAGE: 'Monitoring workflow failed!'
```

### Email Alerts

```yaml
- name: Send Email Alert
  if: failure()
  uses: dawidd6/action-send-mail@v3
  with:
    server_address: smtp.gmail.com
    server_port: 465
    username: ${{ secrets.EMAIL_USERNAME }}
    password: ${{ secrets.EMAIL_PASSWORD }}
    subject: GitHub Action failed
    to: admin@seudominio.com
    from: noreply@seudominio.com
    body: Monitoring workflow failed!
```

---

## Estratégia de Resiliência

### Ordem de Recuperação

1. **Stuck Chunks** (5 min) → Libera chunks travados
2. **Auto-Restart Failed** (3 min) → Reinicia chunks falhados
3. **Stuck Processes** (1 min) → Recupera processos travados
4. **Health Check** (5 min) → Valida estado geral
5. **Complex Recovery** (10 min) → Recuperação profunda

### Escalação

```
Tentativa 1: Auto-restart (< 3 retries)
        ↓
Tentativa 2: Stuck chunk recovery
        ↓
Tentativa 3: Stuck process recovery
        ↓
Falha: Dead Letter Queue → Alerta admin
```

---

## Métricas

### KPIs de Monitoramento

```sql
-- Taxa de recuperação automática
SELECT
  COUNT(*) FILTER (WHERE status = 'completed' AND retry_count > 0) as auto_recovered,
  COUNT(*) FILTER (WHERE status = 'failed' AND retry_count >= 3) as failed_permanent,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE status = 'completed' AND retry_count > 0) /
    NULLIF(COUNT(*) FILTER (WHERE retry_count > 0), 0),
    2
  ) as recovery_rate_percent
FROM chunks
WHERE created_at > NOW() - INTERVAL '24 hours';
```

### Dashboard Sugerido

- Total de processos recuperados (últimas 24h)
- Total de chunks reiniciados (últimas 24h)
- Taxa de sucesso de recovery
- Tempo médio até recovery
- Chunks em dead letter queue

---

## Troubleshooting

### Workflow Não Executa

**Causa:** Repositório inativo ou desabilitado

**Solução:**
1. Settings → Actions → General
2. Permitir "Allow all actions and reusable workflows"
3. Fazer um commit para "acordar" workflows

### Secrets Não Funcionam

**Causa:** Secrets incorretos ou expirados

**Solução:**
1. Settings → Secrets and variables → Actions
2. Verificar/atualizar secrets
3. Testar com execução manual

### Rate Limit GitHub Actions

**Causa:** Muitas execuções simultâneas

**Solução:**
- Free tier: 2000 minutos/mês
- Ajustar frequência se necessário
- Considerar self-hosted runner

---

## Custos

**GitHub Actions:**
- Public repos: Grátis ilimitado
- Private repos: 2000 min/mês (free tier)

**Estimativa de Uso:**
- 5 workflows
- Média 2 min cada
- Total: ~4500 min/mês

**Recomendação:** Private repo com GitHub Pro ou Team

---

[← Voltar à Infraestrutura](./README.md) | [Próximo: Edge Functions →](./edge-functions-detailed.md)
