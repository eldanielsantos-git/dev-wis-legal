# Sistema de Monitoramento Automatizado - GitHub Actions

Sistema completo de 6 workflows que monitoram e recuperam automaticamente processos e chunks travados no sistema de processamento de documentos.

---

## Indice

1. [Visao Geral](#visao-geral)
2. [Arquitetura do Sistema](#arquitetura-do-sistema)
3. [Workflows para Arquivos Complexos](#workflows-para-arquivos-complexos)
4. [Workflow para Arquivos Pequenos](#workflow-para-arquivos-pequenos)
5. [Comparacao e Diferencas](#comparacao-e-diferencas)
6. [Edge Functions Detalhadas](#edge-functions-detalhadas)
7. [RPCs e Funcoes Database](#rpcs-e-funcoes-database)
8. [Configuracao e Setup](#configuracao-e-setup)
9. [Monitoramento e Debugging](#monitoramento-e-debugging)
10. [Estrategia de Resiliencia](#estrategia-de-resiliencia)
11. [Metricas e KPIs](#metricas-e-kpis)
12. [Troubleshooting](#troubleshooting)
13. [Custos e Limites](#custos-e-limites)

---

## Visao Geral

O sistema de monitoramento automatizado utiliza GitHub Actions para executar verificacoes periodicas e recuperacao automatica de processos e chunks travados. O sistema opera em duas camadas principais:

- **Arquivos Complexos** (> 1000 paginas): Processados em chunks paralelos, requerem subdivisao e consolidacao
- **Arquivos Pequenos** (< 1000 paginas): Processados sequencialmente, mais simples e rapidos

### Tabela Comparativa dos 6 Workflows

| Workflow | Frequencia | Threshold | Tipo Arquivo | Edge Function | Worker Disparado | Criticidade |
|----------|------------|-----------|--------------|---------------|------------------|-------------|
| **Monitor Stuck Processes** | 1 minuto | 3-5 min | Complexos | `process-stuck-processos` | Nenhum (apenas detecta) | ALTA |
| **Monitor Auto Restart Failed** | 3 minutos | N/A | Complexos | `auto-restart-failed-chunks` | `process-complex-worker` | ALTA |
| **Monitor Complex Health Check** | 5 minutos | 15 min | Complexos | `health-check-worker` | `process-complex-worker` | MEDIA |
| **Monitor Stuck Chunks** | 5 minutos | 10 min | Complexos | `recover-stuck-chunks` | `process-complex-worker` | MEDIA |
| **Monitor Stuck Small Files** | 5 minutos | 10 min | Pequenos | `detect-stuck-processes-small-files` | `process-next-prompt` | MEDIA |
| **Monitor Complex Recovery** | 10 minutos | 15 min | Complexos | `recover-stuck-processes` | `consolidation-worker` ou `process-complex-worker` | BAIXA |

### Objetivos do Sistema

1. **Alta Disponibilidade**: Deteccao rapida de falhas (1-10 minutos)
2. **Resiliencia Automatica**: Recovery sem intervencao manual
3. **Escalabilidade**: Subdivisao automatica de chunks grandes
4. **Observabilidade**: Logs detalhados e metricas precisas
5. **Economia de Recursos**: Liberacao de locks e prevencao de duplicacao
6. **Experiencia do Usuario**: Continuidade apos falhas transparente

---

## Arquitetura do Sistema

### Fluxo de Processamento

```
Usuario Upload
    |
    v
Arquivo < 1000 paginas?
    |
    |--- SIM ---> Processamento Sequencial (process-next-prompt)
    |                  |
    |                  v
    |             Monitor Stuck Small Files (5 min)
    |
    |--- NAO ---> Processamento em Chunks (process-complex-worker)
                       |
                       v
                  +--- Monitor Stuck Processes (1 min)
                  +--- Monitor Auto Restart Failed (3 min)
                  +--- Monitor Complex Health Check (5 min)
                  +--- Monitor Stuck Chunks (5 min)
                  +--- Monitor Complex Recovery (10 min)
                       |
                       v
                  Consolidacao (consolidation-worker)
```

### Maquina de Estados - Processos

```
pending -> queued -> analyzing -> processing -> consolidating -> completed
                        |             |              |
                        v             v              v
                     [stuck]       [stuck]        [stuck]
                        |             |              |
                        +-------------+--------------+
                                      |
                                      v
                              Recovery Automatico
                                      |
                                      v
                              Volta ao estado anterior
```

### Maquina de Estados - Chunks

```
pending -> processing -> completed
    |           |            |
    |           v            |
    |        failed          |
    |        (retry_count)   |
    |           |            |
    |     retry_count < 30?  |
    |           |            |
    |    +------+------+     |
    |    |             |     |
    |    v             v     |
    |  retry      subdivided |
    |    |             |     |
    |    v             v     |
    | pending    sub-chunks  |
    |    |             |     |
    +----+-------------+-----+
                 |
                 v (retry_count >= 30)
            dead_letter
```

---

## Workflows para Arquivos Complexos

Arquivos complexos (> 1000 paginas) sao subdivididos em chunks de ate 300 paginas cada. Cada chunk e processado paralelamente e depois consolidado em um resultado unico.

### 1. Monitor Stuck Processes

**Objetivo**: Detecta processos travados mas NAO reinicia automaticamente (apenas identifica)

**Arquivo**: `.github/workflows/monitor-stuck-processes.yml`

**Frequencia**: A cada 1 minuto (mais frequente)

**Thresholds**:
- Processos em `analyzing`: > 5 minutos
- Processos em `queued`: > 3 minutos

**Codigo YAML Completo**:

```yaml
name: Monitor Stuck Processes

on:
  schedule:
    # Executa a cada 1 minuto para detectar e reiniciar processos travados rapidamente
    - cron: '*/1 * * * *'
  # Permite execucao manual
  workflow_dispatch:

jobs:
  monitor-processes:
    runs-on: ubuntu-latest
    steps:
      - name: Check for stuck processes
        run: |
          echo "Verificando processos travados..."
          response=$(curl -w "%{http_code}" -s -o /tmp/response.json -X POST \
            "${{ secrets.SUPABASE_URL }}/functions/v1/process-stuck-processos" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json")

          echo "HTTP Status: $response"
          echo "Response:"
          cat /tmp/response.json | jq '.' || cat /tmp/response.json

          if [ "$response" != "200" ]; then
            echo "Falha ao verificar processos travados"
            exit 1
          fi

          # Extrair contadores
          restarted=$(cat /tmp/response.json | jq -r '.restarted_count // 0')
          stuck=$(cat /tmp/response.json | jq -r '.stuck_count // 0')
          completed=$(cat /tmp/response.json | jq -r '.completed_count // 0')

          echo "Resumo:"
          echo "  Completados: $completed"
          echo "  Reiniciados: $restarted"
          echo "  Ainda travados: $stuck"

          if [ "$restarted" -gt 0 ]; then
            echo "$restarted processo(s) foram reiniciados automaticamente!"
          fi
        continue-on-error: true
```

**Edge Function**: `supabase/functions/process-stuck-processos/index.ts`

**Fluxo de Operacao**:

1. Busca processos em `analyzing` por mais de 5 minutos
2. Busca processos em `queued` por mais de 3 minutos
3. Para cada processo travado:
   - Verifica se existem `analysis_results` pendentes
   - Se NAO existem pendentes: marca processo como `completed`
   - Se existem pendentes: identifica como `stuck` (precisa intervencao)
4. Retorna contadores: `completed_count`, `stuck_count`

**Observacao Importante**: Este workflow NAO reinicia processos automaticamente. Ele apenas detecta e reporta. O reinicio e feito por outros workflows.

**Response Esperada**:

```json
{
  "message": "Verificacao de processos concluida",
  "total": 3,
  "stuck_count": 1,
  "completed_count": 2,
  "stuck_processos": [
    {
      "processo_id": "uuid-123",
      "file_name": "processo-grande.pdf",
      "status": "completed",
      "message": "Marcado como completo automaticamente",
      "needs_user_action": false
    },
    {
      "processo_id": "uuid-456",
      "file_name": "processo-travado.pdf",
      "status": "stuck",
      "message": "Aguardando retomada pelo usuario ou sistema",
      "needs_user_action": true,
      "current_prompt": 3,
      "total_prompts": 9
    }
  ]
}
```

---

### 2. Monitor Auto Restart Failed Chunks

**Objetivo**: Subdivide automaticamente chunks que falharam por exceder limite de tokens

**Arquivo**: `.github/workflows/monitor-auto-restart-failed.yml`

**Frequencia**: A cada 3 minutos

**Condicoes para Acao**:
- `token_validation_status` = `'exceeded'`
- `status` = `'failed'`
- `subdivision_parent_id` IS NULL (nao e sub-chunk)

**Codigo YAML Completo**:

```yaml
name: Monitor Auto Restart Failed Chunks

on:
  schedule:
    - cron: '*/3 * * * *'
  workflow_dispatch:

jobs:
  auto-restart:
    runs-on: ubuntu-latest
    steps:
      - name: Call auto-restart-failed-chunks
        run: |
          response=$(curl -s -w "\n%{http_code}" -X POST \
            "${{ secrets.SUPABASE_URL }}/functions/v1/auto-restart-failed-chunks" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json")

          http_code=$(echo "$response" | tail -n1)
          body=$(echo "$response" | sed '$d')

          echo "Response: $body"
          echo "HTTP Status: $http_code"

          if [ "$http_code" -ne 200 ]; then
            echo "Auto-restart failed with status $http_code"
            exit 1
          fi

          echo "Auto-restart check completed successfully"
```

**Edge Function**: `supabase/functions/auto-restart-failed-chunks/index.ts`

**Fluxo de Operacao**:

1. Busca chunks com `token_validation_status = 'exceeded'` e `status = 'failed'`
2. Limita a 10 chunks por execucao
3. Para cada chunk encontrado:
   - Calcula numero de sub-chunks necessarios (tamanho: 80 paginas cada)
   - Cria sub-chunks na tabela `process_chunks`
   - Para cada sub-chunk:
     - Calcula `estimated_tokens` (paginas * 1500)
     - Define `token_validation_status` (exceeded se > 850000, senao valid)
     - Cria entradas na `processing_queue` para todos os prompts ativos
   - Marca chunk original como `subdivided`
   - Marca itens na queue como `completed` com nota "Chunk subdivided"
4. Dispara ate 3 instancias de `process-complex-worker`

**Parametros dos Sub-Chunks**:

- Tamanho padrao: 80 paginas
- Estimativa de tokens: paginas * 1500
- Limite de token: 850.000 tokens
- Priority na queue: 10

**Response Esperada**:

```json
{
  "message": "Subdivisao automatica concluida",
  "total_subdivided": 2,
  "total_subchunks_created": 8,
  "results": [
    {
      "original_chunk_id": "chunk-uuid-1",
      "pages": "1-300",
      "sub_chunks_created": 4,
      "sub_chunk_ids": ["sub-1", "sub-2", "sub-3", "sub-4"]
    },
    {
      "original_chunk_id": "chunk-uuid-2",
      "pages": "301-600",
      "sub_chunks_created": 4,
      "sub_chunk_ids": ["sub-5", "sub-6", "sub-7", "sub-8"]
    }
  ]
}
```

**Exemplo de Log**:

```
Buscando chunks com erro de token limit...
Encontrados 2 chunks para subdividir

Subdividindo chunk abc-123 (paginas 1-300)
   Dividindo 300 paginas em 4 sub-chunks de ~80 paginas
   Sub-chunk 1/4 criado: 1-80 (80 pgs, ~120,000 tokens)
   Sub-chunk 2/4 criado: 81-160 (80 pgs, ~120,000 tokens)
   Sub-chunk 3/4 criado: 161-240 (80 pgs, ~120,000 tokens)
   Sub-chunk 4/4 criado: 241-300 (60 pgs, ~90,000 tokens)

Disparando workers para processar sub-chunks...

Resumo:
   Chunks subdivididos: 2
   Total de sub-chunks criados: 8
```

---

### 3. Monitor Complex Health Check

**Objetivo**: Manutencao geral da fila de processamento e verificacao de saude do sistema

**Arquivo**: `.github/workflows/monitor-complex-health-check.yml`

**Frequencia**: A cada 5 minutos

**Codigo YAML Completo**:

```yaml
name: Monitor Complex Health Check

on:
  schedule:
    - cron: '*/5 * * * *'
  workflow_dispatch:

jobs:
  health-check:
    runs-on: ubuntu-latest
    steps:
      - name: Call health-check-worker
        run: |
          response=$(curl -s -w "\n%{http_code}" -X POST \
            "${{ secrets.SUPABASE_URL }}/functions/v1/health-check-worker" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json")

          http_code=$(echo "$response" | tail -n1)
          body=$(echo "$response" | sed '$d')

          echo "Response: $body"
          echo "HTTP Status: $http_code"

          if [ "$http_code" -ne 200 ]; then
            echo "Health check failed with status $http_code"
            exit 1
          fi

          echo "Health check completed successfully"
```

**Edge Function**: `supabase/functions/health-check-worker/index.ts`

**Fluxo de Operacao**:

1. **Libera Locks Expirados**:
   - Chama RPC `release_expired_locks()`
   - Retorna: `released_count`, `moved_to_retry`, `moved_to_dead_letter`

2. **Verifica Heartbeat de Processos**:
   - Busca processos em `processing` ou `queued`
   - Filtra por `last_heartbeat` < 15 minutos atras
   - Marca como `is_healthy = false`
   - Se tem itens pendentes na queue, dispara `process-complex-worker`

3. **Estatisticas da Fila**:
   - Conta items por status: `pending`, `processing`, `retry`, `dead_letter`
   - Se `retry` > 0: dispara workers para processos com itens em retry
   - Se `dead_letter` > 0: loga detalhes dos primeiros 10 items

4. **Alerta de Dead Letter**:
   - Lista IDs, processo_id, tentativas e mensagem de erro

**Response Esperada**:

```json
{
  "success": true,
  "message": "Health check concluido",
  "expired_locks_released": 3,
  "unhealthy_processes": 1
}
```

**Exemplo de Log**:

```
[worker-abc] Health check iniciado

[worker-abc] 3 locks expirados liberados
[worker-abc]    - 2 movidos para retry
[worker-abc]    - 1 movidos para dead_letter

[worker-abc] 1 processo(s) sem heartbeat detectado(s)
[worker-abc] Atualizando status de saude do processo: processo-123
[worker-abc] Ha itens pendentes, reiniciando worker para: processo-123

[worker-abc] Fila de processamento:
[worker-abc]    - Pendentes: 15
[worker-abc]    - Processando: 8
[worker-abc]    - Retry: 2
[worker-abc]    - Dead Letter: 1

[worker-abc] Ha 2 item(ns) em retry. Disparando workers...

[worker-abc] ALERTA: 1 item(ns) em dead letter queue
[worker-abc] Itens em dead letter:
[worker-abc]    - ID: queue-item-456
[worker-abc]      Processo: processo-789
[worker-abc]      Tentativas: 30
[worker-abc]      Erro: Token limit exceeded after subdivision

[worker-abc] Health check concluido
```

---

### 4. Monitor Stuck Chunks

**Objetivo**: Recupera chunks que ficaram travados na fila de processamento

**Arquivo**: `.github/workflows/monitor-stuck-chunks.yml`

**Frequencia**: A cada 5 minutos

**Threshold**: 10 minutos (configuravel via parametro)

**Codigo YAML Completo**:

```yaml
name: Monitor Stuck Chunks

on:
  schedule:
    # Executa a cada 5 minutos
    - cron: '*/5 * * * *'
  workflow_dispatch:

jobs:
  recover-chunks:
    runs-on: ubuntu-latest
    steps:
      - name: Call recover-stuck-chunks
        run: |
          response=$(curl -s -w "\n%{http_code}" -X POST \
            "${{ secrets.SUPABASE_URL }}/functions/v1/recover-stuck-chunks" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{"threshold_minutes": 10}')

          http_code=$(echo "$response" | tail -n1)
          body=$(echo "$response" | sed '$d')

          echo "Response: $body"
          echo "HTTP Status: $http_code"

          if [ "$http_code" -ne 200 ]; then
            echo "Chunk recovery check failed with status $http_code"
            exit 1
          fi

          echo "Chunk recovery check completed successfully"
```

**Edge Function**: `supabase/functions/recover-stuck-chunks/index.ts`

**Fluxo de Operacao**:

1. Chama RPC `get_stuck_chunks(p_stuck_threshold_minutes: 10)`
2. Para cada chunk travado encontrado:
   - Loga: chunk_id, status, attempt_number, minutes_stuck
3. Chama RPC `recover_stuck_chunks(p_stuck_threshold_minutes: 10)`
4. Para cada processo afetado:
   - Verifica se pode criar worker: `can_spawn_worker(p_processo_id)`
   - Se sim: dispara `process-complex-worker`
5. Retorna resumo: stuck_found, recovered_count, workers_triggered

**Response Esperada**:

```json
{
  "message": "Recuperacao automatica concluida",
  "threshold_minutes": 10,
  "stuck_found": 5,
  "recovered_count": 5,
  "processos_affected": 2,
  "workers_triggered": 2,
  "processo_ids": ["processo-123", "processo-456"]
}
```

**Exemplo de Log**:

```
Buscando chunks travados ha mais de 10 minutos...
Encontrados 5 chunks travados
   - Chunk chunk-1: status='processing', attempts=2, stuck=12min
   - Chunk chunk-2: status='processing', attempts=1, stuck=15min
   - Chunk chunk-3: status='retry', attempts=5, stuck=11min
   - Chunk chunk-4: status='processing', attempts=0, stuck=13min
   - Chunk chunk-5: status='retry', attempts=3, stuck=10min

Recuperando chunks travados...
5 chunks recuperados
Processos afetados: 2

Disparando workers para reprocessar...
   Worker disparado para processo processo-123
   Worker disparado para processo processo-456

Resumo: {
  "message": "Recuperacao automatica concluida",
  "threshold_minutes": 10,
  "stuck_found": 5,
  "recovered_count": 5,
  "processos_affected": 2,
  "workers_triggered": 2
}
```

---

### 5. Monitor Complex Recovery

**Objetivo**: Recuperacao profunda de processos travados em fases de consolidacao ou processamento

**Arquivo**: `.github/workflows/monitor-complex-recovery.yml`

**Frequencia**: A cada 10 minutos

**Threshold**: 15 minutos sem heartbeat

**Codigo YAML Completo**:

```yaml
name: Monitor Complex Recovery

on:
  schedule:
    - cron: '*/10 * * * *'
  workflow_dispatch:

jobs:
  recover-stuck:
    runs-on: ubuntu-latest
    steps:
      - name: Call recover-stuck-processes
        run: |
          response=$(curl -s -w "\n%{http_code}" -X POST \
            "${{ secrets.SUPABASE_URL }}/functions/v1/recover-stuck-processes" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json")

          http_code=$(echo "$response" | tail -n1)
          body=$(echo "$response" | sed '$d')

          echo "Response: $body"
          echo "HTTP Status: $http_code"

          if [ "$http_code" -ne 200 ]; then
            echo "Recovery check failed with status $http_code"
            exit 1
          fi

          echo "Recovery check completed successfully"
```

**Edge Function**: `supabase/functions/recover-stuck-processes/index.ts`

**Fluxo de Operacao**:

1. Busca processos em `consolidating` ou `processing`
2. Filtra por `last_heartbeat` < 15 minutos atras
3. Para cada processo:
   - **Se `consolidating` OU todos chunks completados**:
     - Verifica se ha `analysis_results` pendentes
     - Se sim: dispara `consolidation-worker`
     - Se nao: marca processo como `completed`
   - **Se `processing` com chunks pendentes**:
     - Dispara `process-complex-worker`
4. Atualiza `last_heartbeat` apos recovery

**Logica de Decisao**:

```
Processo em consolidating?
    |
    |--- SIM ---> Tem analysis_results pendentes?
    |                 |
    |                 |--- SIM ---> Dispara consolidation-worker
    |                 |
    |                 |--- NAO ---> Marca como completed
    |
    |--- NAO ---> Esta em processing?
                      |
                      |--- SIM ---> Dispara process-complex-worker
                      |
                      |--- NAO ---> Ignora
```

**Response Esperada**:

```json
{
  "success": true,
  "message": "2 processos recuperados, 0 falhas",
  "recovered": [
    {
      "processo_id": "processo-123",
      "action": "consolidation_restarted"
    },
    {
      "processo_id": "processo-456",
      "action": "marked_completed"
    }
  ],
  "failed": []
}
```

**Exemplo de Log**:

```
[worker-xyz] Verificando processos travados...

[worker-xyz] 2 processos travados encontrados

[worker-xyz] Recuperando processo: processo-123
[worker-xyz]    Phase: consolidating
[worker-xyz]    Last heartbeat: 2024-12-22T10:15:00Z
[worker-xyz]    Chunks: 10/10
[worker-xyz] Disparando consolidation-worker para processo-123
[worker-xyz] Consolidation-worker disparado com sucesso

[worker-xyz] Recuperando processo: processo-456
[worker-xyz]    Phase: processing
[worker-xyz]    Last heartbeat: 2024-12-22T10:10:00Z
[worker-xyz]    Chunks: 8/10
[worker-xyz] Disparando process-complex-worker para processo-456
[worker-xyz] Process-complex-worker disparado com sucesso

[worker-xyz] Recuperacao concluida:
[worker-xyz]    Recuperados: 2
[worker-xyz]    Falhas: 0
```

---

## Workflow para Arquivos Pequenos

Arquivos pequenos (< 1000 paginas) sao processados sequencialmente, prompt por prompt, usando a funcao `process-next-prompt`.

### 6. Monitor Stuck Small Files

**Objetivo**: Recupera arquivos pequenos que ficaram travados durante processamento sequencial

**Arquivo**: `.github/workflows/monitor-stuck-small-files.yml`

**Frequencia**: A cada 5 minutos

**Threshold**: 10 minutos sem heartbeat

**Filtro**: `is_chunked = false`

**Codigo YAML Completo**:

```yaml
name: Monitor Stuck Processes - Small Files

on:
  schedule:
    # Roda a cada 5 minutos
    - cron: '*/5 * * * *'
  workflow_dispatch: # Permite execucao manual para testes

jobs:
  detect-and-recover:
    runs-on: ubuntu-latest
    timeout-minutes: 3

    steps:
      - name: Detect and Recover Stuck Small Files
        run: |
          echo "Iniciando deteccao de processos travados (arquivos pequenos)..."

          response=$(curl -s -w "\n%{http_code}" -X POST \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json" \
            "${{ secrets.SUPABASE_URL }}/functions/v1/detect-stuck-processes-small-files")

          http_code=$(echo "$response" | tail -n1)
          body=$(echo "$response" | sed '$d')

          echo "Status HTTP: $http_code"
          echo "Resposta:"
          echo "$body" | jq '.' || echo "$body"

          if [ "$http_code" -ne 200 ]; then
            echo "Falha na deteccao/recuperacao"
            exit 1
          fi

          echo "Deteccao/recuperacao concluida com sucesso"

      - name: Log Execution Time
        if: always()
        run: |
          echo "Execucao finalizada em $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
```

**Edge Function**: `supabase/functions/detect-stuck-processes-small-files/index.ts`

**Fluxo de Operacao**:

1. Busca `analysis_results` em `processing` por mais de 10 minutos
2. Filtra por processos com `is_chunked = false` e `status = 'analyzing'`
3. Para cada processo travado encontrado (deduplica por processo_id):
   - Loga informacoes: processo_id, file_name, prompt_title, processing_at
   - Reseta prompts para `pending` e limpa `processing_at`
   - Dispara `process-next-prompt` para continuar processamento
4. Retorna: processos recuperados e falhas

**Diferenca Importante**: Este workflow e especifico para arquivos pequenos que NAO usam chunking. Ele reseta o status do prompt e reinicia o processamento sequencial.

**Response Esperada**:

```json
{
  "success": true,
  "message": "2 processos recuperados, 0 falhas",
  "recovered": [
    {
      "processo_id": "processo-small-1",
      "action": "processing_restarted",
      "file_name": "documento-pequeno.pdf"
    },
    {
      "processo_id": "processo-small-2",
      "action": "processing_restarted",
      "file_name": "contrato-simples.pdf"
    }
  ],
  "failed": []
}
```

**Exemplo de Log**:

```
[worker-abc] Detectando processos pequenos travados...

[worker-abc] 2 prompts travados encontrados em processos pequenos

[worker-abc] Recuperando processo: processo-small-1
[worker-abc]    Arquivo: documento-pequeno.pdf
[worker-abc]    Prompt: Analise de Riscos
[worker-abc]    Processing at: 2024-12-22T10:05:00Z
[worker-abc] Liberando locks de prompts travados...
[worker-abc] Disparando process-next-prompt...
[worker-abc] Processo processo-small-1 recuperado com sucesso

[worker-abc] Recuperando processo: processo-small-2
[worker-abc]    Arquivo: contrato-simples.pdf
[worker-abc]    Prompt: Estrategias Juridicas
[worker-abc]    Processing at: 2024-12-22T10:08:00Z
[worker-abc] Liberando locks de prompts travados...
[worker-abc] Disparando process-next-prompt...
[worker-abc] Processo processo-small-2 recuperado com sucesso

[worker-abc] Recuperacao concluida:
[worker-abc]    Recuperados: 2
[worker-abc]    Falhas: 0
```

---

## Comparacao e Diferencas

### Arquivos Pequenos vs Complexos

| Aspecto | Arquivos Pequenos | Arquivos Complexos |
|---------|-------------------|-------------------|
| **Criterio** | < 1000 paginas | >= 1000 paginas |
| **is_chunked** | false | true |
| **Processamento** | Sequencial | Paralelo (chunks) |
| **Worker** | process-next-prompt | process-complex-worker |
| **Tabela Principal** | analysis_results | processing_queue + process_chunks |
| **Status** | pending, processing, completed | pending, processing, failed, retry, dead_letter, subdivided |
| **Recovery** | Reseta prompt para pending | Reseta chunk para retry |
| **Consolidacao** | Nao necessita | consolidation-worker |
| **Subdivisao** | Nao aplicavel | Chunks de 80 paginas se exceder tokens |
| **Workflow Especifico** | Monitor Stuck Small Files | 5 workflows dedicados |
| **Threshold** | 10 minutos | 3-15 minutos (varia por workflow) |

### Estrategias de Recovery por Tipo

**Arquivos Pequenos**:
1. Detecta prompt em processing > 10 min
2. Reseta status para pending
3. Dispara process-next-prompt
4. Continua processamento sequencial

**Arquivos Complexos**:
1. Detecta chunks/processos travados
2. Verifica tipo de problema (token limit, timeout, heartbeat)
3. Aplica estrategia especifica:
   - Token limit: Subdivide chunk em partes menores
   - Timeout: Reseta chunk para retry
   - Heartbeat: Dispara novo worker
4. Consolida quando todos chunks completados

### Matriz de Decisao

| Situacao | Arquivo Pequeno | Arquivo Complexo |
|----------|----------------|------------------|
| **Prompt travado** | Reseta para pending + process-next-prompt | N/A (usa chunks) |
| **Chunk travado** | N/A | Reseta para retry + process-complex-worker |
| **Token limit** | Erro fatal (arquivo muito grande) | Subdivide chunk em 80 paginas |
| **Lock expirado** | Libera lock + process-next-prompt | Libera lock + move para retry/dead_letter |
| **Heartbeat parado** | Detecta e reinicia prompt | Detecta e reinicia worker |
| **Todos itens completos** | Marca processo como completed | Dispara consolidation-worker |

---

## Edge Functions Detalhadas

### 1. auto-restart-failed-chunks

**Caminho**: `supabase/functions/auto-restart-failed-chunks/index.ts`

**Objetivo**: Subdivide automaticamente chunks que excederam o limite de tokens da API Gemini

**Query Principal**:

```typescript
const { data: failedChunks } = await supabase
  .from('process_chunks')
  .select('id, processo_id, chunk_index, start_page, end_page, pages_count, token_validation_status, error_message')
  .eq('token_validation_status', 'exceeded')
  .eq('status', 'failed')
  .is('subdivision_parent_id', null)
  .limit(10);
```

**Logica de Subdivisao**:

```typescript
const subChunkSize = 80; // paginas
const subChunksCount = Math.ceil(pagesCount / subChunkSize);

for (let i = 0; i < subChunksCount; i++) {
  const subChunkEndPage = Math.min(currentPage + subChunkSize - 1, chunk.end_page);
  const subChunkPages = subChunkEndPage - currentPage + 1;
  const estimatedTokens = subChunkPages * 1500;

  // Cria sub-chunk
  await supabase.from('process_chunks').insert({
    processo_id: chunk.processo_id,
    chunk_index: chunk.chunk_index,
    start_page: currentPage,
    end_page: subChunkEndPage,
    pages_count: subChunkPages,
    total_chunks: subChunksCount,
    status: 'pending',
    subdivision_parent_id: chunk.id,
    subdivision_index: i,
    estimated_tokens: estimatedTokens,
    token_validation_status: estimatedTokens > 850000 ? 'exceeded' : 'valid'
  });

  // Cria entradas na processing_queue para cada prompt ativo
  const { data: prompts } = await supabase
    .from('analysis_prompts')
    .select('id, prompt_content')
    .eq('is_active', true);

  for (const prompt of prompts) {
    await supabase.from('processing_queue').insert({
      processo_id: chunk.processo_id,
      chunk_id: newSubChunk.id,
      queue_type: 'chunk_processing',
      priority: 10,
      prompt_id: prompt.id,
      prompt_content: prompt.prompt_content,
      context_data: {
        chunk_index: chunk.chunk_index,
        subdivision_index: i,
        is_subdivided: true,
        parent_chunk_id: chunk.id
      },
      timeout_seconds: 900
    });
  }
}

// Marca chunk original como subdivided
await supabase
  .from('process_chunks')
  .update({
    status: 'subdivided',
    token_validation_status: 'subdivided'
  })
  .eq('id', chunk.id);
```

**Workers Disparados**:

```typescript
for (let i = 0; i < Math.min(3, subChunks.length); i++) {
  fetch(`${supabaseUrl}/functions/v1/process-complex-worker`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseServiceKey}`,
    },
    body: JSON.stringify({ processo_id: chunk.processo_id }),
  });
}
```

**Tabelas Afetadas**:
- `process_chunks`: Cria sub-chunks, atualiza status do original
- `processing_queue`: Cria itens para cada sub-chunk + prompt
- Dispara: `process-complex-worker`

---

### 2. health-check-worker

**Caminho**: `supabase/functions/health-check-worker/index.ts`

**Objetivo**: Manutencao preventiva e health check geral do sistema

**RPC Utilizado**: `release_expired_locks()`

**Query Principal - Processos Sem Heartbeat**:

```typescript
const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

const { data: unhealthyProcesses } = await supabase
  .from('complex_processing_status')
  .select('processo_id, current_phase, last_heartbeat, chunks_processing')
  .in('current_phase', ['processing', 'queued'])
  .lt('last_heartbeat', fifteenMinutesAgo);
```

**Acoes Executadas**:

1. **Libera locks expirados**:
```typescript
const { data: expiredLocks } = await supabase
  .rpc('release_expired_locks')
  .single();
```

2. **Marca processos como unhealthy**:
```typescript
await supabase
  .from('complex_processing_status')
  .update({
    is_healthy: false,
    health_check_message: `Ultimo heartbeat em ${proc.last_heartbeat}. Possivel falha no worker.`
  })
  .eq('processo_id', proc.processo_id);
```

3. **Reinicia workers se necessario**:
```typescript
const { data: pendingItems } = await supabase
  .from('processing_queue')
  .select('id')
  .eq('processo_id', proc.processo_id)
  .in('status', ['pending', 'retry'])
  .limit(1)
  .maybeSingle();

if (pendingItems) {
  fetch(`${supabaseUrl}/functions/v1/process-complex-worker`, {
    method: 'POST',
    body: JSON.stringify({ processo_id: proc.processo_id })
  });
}
```

4. **Monitora fila**:
```typescript
const { data: stats } = await supabase
  .from('processing_queue')
  .select('status')
  .in('status', ['pending', 'processing', 'retry', 'dead_letter']);

const pending = stats.filter(s => s.status === 'pending').length;
const processing = stats.filter(s => s.status === 'processing').length;
const retry = stats.filter(s => s.status === 'retry').length;
const deadLetter = stats.filter(s => s.status === 'dead_letter').length;
```

**Tabelas Monitoradas**:
- `processing_queue`: Status da fila
- `complex_processing_status`: Heartbeat e saude
- Dispara: `process-complex-worker`

---

### 3. recover-stuck-processes

**Caminho**: `supabase/functions/recover-stuck-processes/index.ts`

**Objetivo**: Recovery avancado de processos em fase de consolidacao ou processamento

**Threshold**: 15 minutos

**Query Principal**:

```typescript
const stuckThreshold = new Date(Date.now() - 15 * 60 * 1000).toISOString();

const { data: stuckProcesses } = await supabase
  .from('complex_processing_status')
  .select('processo_id, current_phase, last_heartbeat, chunks_completed, total_chunks')
  .in('current_phase', ['consolidating', 'processing'])
  .lt('last_heartbeat', stuckThreshold);
```

**Logica de Recovery por Fase**:

```typescript
if (processo.current_phase === 'consolidating' ||
    (processo.current_phase === 'processing' && processo.chunks_completed === processo.total_chunks)) {

  // Verifica se ainda tem resultados pendentes
  const { data: pendingResults } = await supabase
    .from('analysis_results')
    .select('id')
    .eq('processo_id', processo.processo_id)
    .in('status', ['pending', 'processing'])
    .limit(1)
    .maybeSingle();

  if (pendingResults) {
    // Dispara consolidacao
    await fetch(`${supabaseUrl}/functions/v1/consolidation-worker`, {
      method: 'POST',
      body: JSON.stringify({ processo_id: processo.processo_id })
    });
  } else {
    // Marca como completo
    await supabase
      .from('processos')
      .update({
        status: 'completed',
        analysis_completed_at: new Date().toISOString()
      })
      .eq('id', processo.processo_id);
  }

} else if (processo.current_phase === 'processing') {
  // Dispara processamento
  await fetch(`${supabaseUrl}/functions/v1/process-complex-worker`, {
    method: 'POST',
    body: JSON.stringify({ processo_id: processo.processo_id })
  });
}
```

**Tabelas Afetadas**:
- `complex_processing_status`: Atualiza heartbeat e status
- `processos`: Marca como completed se necessario
- `analysis_results`: Verifica pendencias
- Dispara: `consolidation-worker` ou `process-complex-worker`

---

### 4. recover-stuck-chunks

**Caminho**: `supabase/functions/recover-stuck-chunks/index.ts`

**Objetivo**: Recovery de chunks individuais travados na fila

**Parametros**: `{ threshold_minutes: 10 }`

**RPCs Utilizados**:

1. **get_stuck_chunks**:
```typescript
const { data: stuckChunks } = await supabase
  .rpc('get_stuck_chunks', { p_stuck_threshold_minutes: threshold_minutes });
```

2. **recover_stuck_chunks**:
```typescript
const { data: recoveryResult } = await supabase
  .rpc('recover_stuck_chunks', { p_stuck_threshold_minutes: threshold_minutes })
  .single();
```

3. **can_spawn_worker**:
```typescript
const { data: canSpawn } = await supabase
  .rpc('can_spawn_worker', { p_processo_id: processoId })
  .maybeSingle();
```

**Fluxo Completo**:

```typescript
// 1. Busca chunks travados
const stuckChunks = await getStuckChunks(threshold);

// 2. Recupera chunks (reseta para retry)
const { recovered_count, processo_ids } = await recoverStuckChunks(threshold);

// 3. Para cada processo afetado
for (const processoId of processo_ids) {
  // Verifica se pode criar worker
  const canSpawn = await canSpawnWorker(processoId);

  if (canSpawn) {
    // Dispara worker
    await fetch('process-complex-worker', {
      body: JSON.stringify({ processo_id: processoId })
    });
  }
}
```

**Tabelas Afetadas**:
- `processing_queue`: Reseta chunks para retry
- Dispara: `process-complex-worker` (se permitido)

---

### 5. process-stuck-processos

**Caminho**: `supabase/functions/process-stuck-processos/index.ts`

**Objetivo**: Detecta processos travados (NAO reinicia automaticamente)

**Thresholds**:
- `analyzing`: 5 minutos
- `queued`: 3 minutos

**Queries Principais**:

```typescript
const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();

// Processos em analyzing
const { data: analyzingProcessos } = await supabase
  .from('processos')
  .select('id, file_name, user_id, analysis_started_at, current_prompt_number, total_prompts, status')
  .eq('status', 'analyzing')
  .lt('analysis_started_at', fiveMinutesAgo)
  .limit(10);

// Processos em queued
const { data: queuedProcessos } = await supabase
  .from('processos')
  .select('id, file_name, user_id, analysis_started_at, current_prompt_number, total_prompts, status, updated_at')
  .eq('status', 'queued')
  .not('analysis_started_at', 'is', null)
  .lt('updated_at', threeMinutesAgo)
  .limit(10);
```

**Logica de Classificacao**:

```typescript
for (const processo of stuckProcessos) {
  // Verifica se tem analysis_results pendentes
  const { data: pendingResults } = await supabase
    .from('analysis_results')
    .select('id, status')
    .eq('processo_id', processo.id)
    .in('status', ['pending', 'processing'])
    .limit(1)
    .maybeSingle();

  if (!pendingResults) {
    // Nao tem pendentes, marca como completo
    await supabase
      .from('processos')
      .update({
        status: 'completed',
        analysis_completed_at: new Date().toISOString()
      })
      .eq('id', processo.id);

    results.push({
      status: 'completed',
      needs_user_action: false
    });
  } else {
    // Tem pendentes, esta realmente travado
    results.push({
      status: 'stuck',
      needs_user_action: true,
      current_prompt: processo.current_prompt_number,
      total_prompts: processo.total_prompts
    });
  }
}
```

**Importante**: Esta funcao NAO reinicia processos. Ela apenas detecta e classifica.

**Tabelas Afetadas**:
- `processos`: Marca como completed se aplicavel
- `analysis_results`: Verifica pendencias
- Dispara: Nenhum worker

---

### 6. detect-stuck-processes-small-files

**Caminho**: `supabase/functions/detect-stuck-processes-small-files/index.ts`

**Objetivo**: Recovery especifico para arquivos pequenos (is_chunked = false)

**Threshold**: 10 minutos

**Query Principal**:

```typescript
const stuckThreshold = new Date(Date.now() - 10 * 60 * 1000).toISOString();

const { data: stuckPrompts } = await supabase
  .from('analysis_results')
  .select(`
    id,
    processo_id,
    prompt_title,
    status,
    processing_at,
    processos!inner(is_chunked, status, file_name)
  `)
  .eq('status', 'processing')
  .lt('processing_at', stuckThreshold)
  .eq('processos.is_chunked', false)
  .eq('processos.status', 'analyzing');
```

**Fluxo de Recovery**:

```typescript
// Deduplica por processo_id
const processedProcessos = new Set<string>();

for (const prompt of stuckPrompts) {
  const processoId = prompt.processo_id;

  if (processedProcessos.has(processoId)) {
    continue;
  }
  processedProcessos.add(processoId);

  // 1. Reseta prompts para pending
  await supabase
    .from('analysis_results')
    .update({
      status: 'pending',
      processing_at: null
    })
    .eq('processo_id', processoId)
    .eq('status', 'processing');

  // 2. Dispara process-next-prompt
  await fetch(`${supabaseUrl}/functions/v1/process-next-prompt`, {
    method: 'POST',
    body: JSON.stringify({ processo_id: processoId })
  });
}
```

**Tabelas Afetadas**:
- `analysis_results`: Reseta status para pending
- Dispara: `process-next-prompt`

---

## RPCs e Funcoes Database

### release_expired_locks

**Proposito**: Libera locks de itens na processing_queue que expiraram e move para retry ou dead_letter

**Retorno**:

```json
{
  "released_count": 5,
  "moved_to_retry": 4,
  "moved_to_dead_letter": 1
}
```

**Logica**:

```sql
-- Busca itens com lock expirado
SELECT * FROM processing_queue
WHERE status = 'processing'
  AND locked_at < NOW() - INTERVAL '15 minutes'
  AND (locked_until IS NULL OR locked_until < NOW());

-- Para cada item:
-- Se attempt_number < max_attempts (30):
UPDATE processing_queue
SET status = 'retry',
    locked_at = NULL,
    locked_by = NULL
WHERE id = item_id;

-- Se attempt_number >= max_attempts:
UPDATE processing_queue
SET status = 'dead_letter',
    moved_to_dead_letter_at = NOW()
WHERE id = item_id;
```

---

### get_stuck_chunks

**Proposito**: Busca chunks que estao travados ha mais de X minutos

**Parametros**:
- `p_stuck_threshold_minutes`: integer (ex: 10)

**Query**:

```sql
SELECT
  pq.id as queue_id,
  pq.chunk_id,
  pq.processo_id,
  pq.status,
  pq.attempt_number,
  pq.locked_at,
  EXTRACT(EPOCH FROM (NOW() - pq.locked_at))/60 as minutes_stuck
FROM processing_queue pq
WHERE pq.status IN ('processing', 'retry')
  AND pq.locked_at < NOW() - (p_stuck_threshold_minutes || ' minutes')::INTERVAL
ORDER BY pq.locked_at ASC;
```

**Retorno**:

```json
[
  {
    "queue_id": "queue-123",
    "chunk_id": "chunk-456",
    "processo_id": "processo-789",
    "status": "processing",
    "attempt_number": 2,
    "locked_at": "2024-12-22T10:00:00Z",
    "minutes_stuck": 15.5
  }
]
```

---

### recover_stuck_chunks

**Proposito**: Reseta chunks travados para retry

**Parametros**:
- `p_stuck_threshold_minutes`: integer

**Logica**:

```sql
-- Atualiza chunks travados
UPDATE processing_queue
SET status = 'retry',
    locked_at = NULL,
    locked_by = NULL,
    locked_until = NULL,
    attempt_number = attempt_number + 1
WHERE status IN ('processing', 'retry')
  AND locked_at < NOW() - (p_stuck_threshold_minutes || ' minutes')::INTERVAL
  AND attempt_number < 30
RETURNING processo_id;

-- Agrupa processo_ids unicos
SELECT
  COUNT(*) as recovered_count,
  ARRAY_AGG(DISTINCT processo_id) as processo_ids
FROM updated_chunks;
```

**Retorno**:

```json
{
  "recovered_count": 5,
  "processo_ids": ["processo-123", "processo-456"]
}
```

---

### can_spawn_worker

**Proposito**: Verifica se e permitido criar mais um worker para um processo

**Parametros**:
- `p_processo_id`: uuid

**Logica**:

```sql
-- Conta workers ativos
SELECT COUNT(*) as active_workers
FROM processing_queue
WHERE processo_id = p_processo_id
  AND status = 'processing'
  AND locked_at > NOW() - INTERVAL '5 minutes';

-- Retorna true se active_workers < max_workers (ex: 5)
RETURN active_workers < 5;
```

**Retorno**:

```json
true
```

---

## Configuracao e Setup

### Passo 1: Configurar Secrets no GitHub

Os workflows requerem 2 secrets configurados no repositorio GitHub:

1. **SUPABASE_URL**
   - Formato: `https://seu-projeto.supabase.co`
   - Onde encontrar: Supabase Dashboard > Settings > API > Project URL

2. **SUPABASE_SERVICE_ROLE_KEY**
   - Formato: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - Onde encontrar: Supabase Dashboard > Settings > API > service_role secret
   - IMPORTANTE: Use service_role, NAO anon key (anon key nao tem permissoes suficientes)

**Como adicionar secrets**:

1. Acesse seu repositorio no GitHub
2. Va em Settings > Secrets and variables > Actions
3. Clique em "New repository secret"
4. Adicione `SUPABASE_URL` com o valor
5. Clique em "Add secret"
6. Repita para `SUPABASE_SERVICE_ROLE_KEY`

---

### Passo 2: Habilitar GitHub Actions

1. Acesse Settings > Actions > General
2. Em "Actions permissions", selecione:
   - "Allow all actions and reusable workflows"
3. Em "Workflow permissions", selecione:
   - "Read and write permissions"
4. Clique em "Save"

---

### Passo 3: Testar Workflows Manualmente

Todos os workflows suportam execucao manual via `workflow_dispatch`.

**Como executar manualmente**:

1. Va em Actions tab no GitHub
2. Selecione o workflow desejado (ex: "Monitor Stuck Processes")
3. Clique em "Run workflow"
4. Selecione branch "main"
5. Clique em "Run workflow"
6. Aguarde execucao e verifique logs

**Checklist de Validacao**:

- [ ] Workflow executou sem erros (status verde)
- [ ] HTTP status code = 200 nos logs
- [ ] Response JSON retornado corretamente
- [ ] Edge function logou execucao no Supabase
- [ ] Nenhum secret invalido reportado

**Exemplo de log de sucesso**:

```
Response: {"success":true,"message":"Nenhum processo travado encontrado","recovered":0}
HTTP Status: 200
Auto-restart check completed successfully
```

---

### Passo 4: Configurar Notificacoes (Opcional)

#### Slack Notifications

Adicione step ao final de cada workflow:

```yaml
- name: Notify Slack on Failure
  if: failure()
  uses: slackapi/slack-github-action@v1.24.0
  with:
    payload: |
      {
        "text": "Workflow '${{ github.workflow }}' failed!",
        "blocks": [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*Workflow:* ${{ github.workflow }}\n*Status:* Failed\n*Run:* <${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}|View Run>"
            }
          }
        ]
      }
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

Configure secret `SLACK_WEBHOOK` com webhook URL do Slack.

#### Email Alerts

```yaml
- name: Send Email Alert
  if: failure()
  uses: dawidd6/action-send-mail@v3
  with:
    server_address: smtp.gmail.com
    server_port: 465
    username: ${{ secrets.EMAIL_USERNAME }}
    password: ${{ secrets.EMAIL_PASSWORD }}
    subject: '[ALERT] GitHub Actions workflow failed'
    to: admin@seudominio.com
    from: noreply@seudominio.com
    body: |
      Workflow ${{ github.workflow }} failed!

      Repository: ${{ github.repository }}
      Run ID: ${{ github.run_id }}
      URL: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
```

---

## Monitoramento e Debugging

### Acessando Logs dos Workflows

1. GitHub Repository > Actions tab
2. Selecione o workflow na lista lateral
3. Clique na execucao especifica (por data/hora)
4. Expanda o step para ver logs detalhados

**Filtros Uteis**:
- Filtrar por status: "failure", "success", "in_progress"
- Filtrar por branch: "main"
- Filtrar por periodo: "Last 7 days"

---

### Interpretando Outputs

**Response de Sucesso**:

```json
{
  "success": true,
  "message": "5 chunks recuperados",
  "recovered_count": 5,
  "workers_triggered": 2
}
```

**Response de Erro**:

```json
{
  "error": "Erro ao buscar chunks: relation 'process_chunks' does not exist"
}
```

**Campos Importantes**:
- `success`: boolean indicando sucesso geral
- `*_count`: contadores de acoes realizadas
- `error`: mensagem de erro se aplicavel
- `processo_ids`: array de processos afetados

**Usando jq para parsing**:

```bash
# Extrair apenas recovered_count
echo "$response" | jq '.recovered_count'

# Listar todos processo_ids
echo "$response" | jq -r '.processo_ids[]'

# Verificar se houve erro
echo "$response" | jq 'has("error")'
```

---

### Logs das Edge Functions

**Via Supabase Dashboard**:

1. Acesse Supabase Dashboard
2. Va em Edge Functions
3. Selecione a funcao (ex: "auto-restart-failed-chunks")
4. Clique em "Logs"
5. Use filtros por periodo e nivel (info, error, warn)

**Via CLI**:

```bash
# Ver logs em tempo real
supabase functions logs auto-restart-failed-chunks --tail

# Ver ultimos 100 logs
supabase functions logs auto-restart-failed-chunks --limit 100

# Filtrar por nivel
supabase functions logs auto-restart-failed-chunks --level error
```

**Exemplo de log detalhado**:

```
2024-12-22T10:30:15Z INFO Buscando chunks com erro de token limit...
2024-12-22T10:30:15Z INFO Encontrados 2 chunks para subdividir
2024-12-22T10:30:15Z INFO Subdividindo chunk abc-123 (paginas 1-300)
2024-12-22T10:30:16Z INFO Sub-chunk 1/4 criado: 1-80 (80 pgs, ~120,000 tokens)
2024-12-22T10:30:16Z INFO Sub-chunk 2/4 criado: 81-160 (80 pgs, ~120,000 tokens)
2024-12-22T10:30:17Z INFO Sub-chunk 3/4 criado: 161-240 (80 pgs, ~120,000 tokens)
2024-12-22T10:30:17Z INFO Sub-chunk 4/4 criado: 241-300 (60 pgs, ~90,000 tokens)
2024-12-22T10:30:18Z INFO Disparando workers para processar sub-chunks...
2024-12-22T10:30:18Z INFO Resumo: Chunks subdivididos: 2, Total de sub-chunks criados: 8
```

---

### Correlacao de Logs

Para debugar um problema especifico, correlacione logs em 3 niveis:

1. **GitHub Actions Logs**: Quando workflow executou, HTTP status
2. **Edge Function Logs**: O que a funcao fez, quais queries executou
3. **Database Logs**: Estado das tabelas antes/depois

**Exemplo de Investigacao**:

```
Problema: Workflow "Monitor Stuck Chunks" executou mas nao recuperou chunks

1. GitHub Actions:
   - HTTP 200, response: {"recovered_count": 0}
   - Workflow executou com sucesso

2. Edge Function:
   - Log: "Nenhum chunk travado encontrado"
   - Query retornou 0 resultados

3. Database:
   - SELECT * FROM processing_queue WHERE status = 'processing'
   - Resultado: 5 chunks em processing, mas locked_at < 10 min
   - Conclusao: Chunks nao atingiram threshold ainda
```

---

## Estrategia de Resiliencia

### Ordem de Prioridade (Por Frequencia)

```
Nivel 1: Monitor Stuck Processes (1 min)
         Deteccao mais rapida, identifica travamentos imediatos

Nivel 2: Monitor Auto Restart Failed (3 min)
         Subdivide chunks com token limit, previne falhas recorrentes

Nivel 3: Monitor Complex Health Check (5 min)
         Manutencao geral, libera locks, verifica heartbeat

Nivel 4: Monitor Stuck Chunks (5 min)
         Recovery de chunks travados, reseta para retry

Nivel 5: Monitor Stuck Small Files (5 min)
         Recovery especifico para arquivos pequenos

Nivel 6: Monitor Complex Recovery (10 min)
         Recovery profundo de processos em consolidacao
```

### Escalacao de Tentativas

```
Tentativa 0: Processamento normal
         |
         v (falha)
Tentativa 1: Auto-restart (retry_count < 3)
         |  Workflow: Monitor Auto Restart (3 min)
         |  Acao: Reseta chunk para pending
         v (falha)
Tentativa 2: Stuck chunk recovery (3 < retry_count < 30)
         |  Workflow: Monitor Stuck Chunks (5 min)
         |  Acao: Reseta chunk para retry, dispara worker
         v (falha)
Tentativa 3: Health check recovery
         |  Workflow: Monitor Complex Health Check (5 min)
         |  Acao: Libera lock, move para retry
         v (falha)
Tentativa 4: Process recovery
         |  Workflow: Monitor Complex Recovery (10 min)
         |  Acao: Reinicia worker ou consolidacao
         v (falha apos 30 tentativas)
Dead Letter Queue:
         Alerta para admin, precisa intervencao manual
```

### Timeline de Recovery

```
T+0:00  Chunk falha
T+0:01  Monitor Stuck Processes detecta (nao age)
T+0:03  Monitor Auto Restart tenta subdivir (se token limit)
T+0:05  Monitor Complex Health Check libera lock
T+0:05  Monitor Stuck Chunks reseta para retry
T+0:10  Monitor Complex Recovery reinicia processo
T+0:15  Se ainda travado, ciclo se repete
T+1:30  Apos 30 tentativas, move para dead_letter
```

### Coordenacao Entre Workflows

**Prevencao de Conflitos**:

1. **Idempotencia**: Todas funcoes verificam estado antes de agir
2. **Locks**: Processing_queue usa locked_at para prevenir processamento duplicado
3. **Status Exclusivos**: Um chunk nao pode estar em 2 estados simultaneamente
4. **Thresholds Diferentes**: Cada workflow age em diferentes intervalos de tempo

**Exemplo de Coordenacao**:

```
Chunk X entra em estado "failed" por token limit
     |
     v (T+3 min)
Monitor Auto Restart detecta e subdivide
     |
     v (chunk X agora esta "subdivided")
Monitor Stuck Chunks verifica mas ignora (nao esta em "processing")
     |
     v (sub-chunks entram em "pending")
Monitor Complex Health Check dispara workers para sub-chunks
     |
     v (sub-chunks processam com sucesso)
Monitor Complex Recovery verifica processo e inicia consolidacao
```

---

## Metricas e KPIs

### KPIs de Recovery

#### Taxa de Sucesso de Recovery

```sql
-- Ultimas 24 horas
SELECT
  COUNT(*) FILTER (WHERE status = 'completed' AND retry_count > 0) as auto_recovered,
  COUNT(*) FILTER (WHERE status = 'dead_letter') as failed_permanent,
  COUNT(*) FILTER (WHERE retry_count > 0) as total_with_retries,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE status = 'completed' AND retry_count > 0) /
    NULLIF(COUNT(*) FILTER (WHERE retry_count > 0), 0),
    2
  ) as recovery_success_rate_percent
FROM processing_queue
WHERE created_at > NOW() - INTERVAL '24 hours';
```

**Resultado Esperado**:

```
auto_recovered: 450
failed_permanent: 5
total_with_retries: 455
recovery_success_rate_percent: 98.90
```

#### Tempo Medio Ate Recovery

```sql
SELECT
  AVG(EXTRACT(EPOCH FROM (
    CASE
      WHEN status = 'completed' THEN completed_at
      ELSE updated_at
    END - created_at
  )) / 60) as avg_minutes_to_recovery
FROM processing_queue
WHERE retry_count > 0
  AND created_at > NOW() - INTERVAL '24 hours'
  AND status IN ('completed', 'failed');
```

**Resultado Esperado**:

```
avg_minutes_to_recovery: 12.5
```

#### Processos Recuperados Por Dia

```sql
SELECT
  DATE(completed_at) as date,
  COUNT(*) FILTER (WHERE retry_count = 0) as first_attempt_success,
  COUNT(*) FILTER (WHERE retry_count > 0) as recovered_after_retry,
  COUNT(*) as total_completed
FROM processing_queue
WHERE status = 'completed'
  AND completed_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(completed_at)
ORDER BY date DESC;
```

**Resultado Esperado**:

```
date         | first_attempt | recovered | total
-------------|---------------|-----------|-------
2024-12-22   | 850           | 120       | 970
2024-12-21   | 920           | 95        | 1015
2024-12-20   | 880           | 110       | 990
```

#### Chunks em Dead Letter

```sql
SELECT
  COUNT(*) as dead_letter_count,
  MIN(moved_to_dead_letter_at) as oldest,
  MAX(moved_to_dead_letter_at) as newest,
  AVG(attempt_number) as avg_attempts
FROM processing_queue
WHERE status = 'dead_letter'
  AND moved_to_dead_letter_at > NOW() - INTERVAL '7 days';
```

**Resultado Esperado**:

```
dead_letter_count: 12
oldest: 2024-12-15 08:30:00
newest: 2024-12-22 14:15:00
avg_attempts: 30.0
```

---

### Queries SQL Uteis

#### Processos Travados nas Ultimas 24h

```sql
SELECT
  p.id,
  p.file_name,
  p.status,
  p.analysis_started_at,
  p.updated_at,
  EXTRACT(EPOCH FROM (NOW() - p.updated_at)) / 60 as minutes_since_update,
  COUNT(ar.id) FILTER (WHERE ar.status = 'pending') as pending_prompts,
  COUNT(ar.id) FILTER (WHERE ar.status = 'completed') as completed_prompts
FROM processos p
LEFT JOIN analysis_results ar ON ar.processo_id = p.id
WHERE p.status IN ('analyzing', 'processing', 'queued')
  AND p.updated_at < NOW() - INTERVAL '10 minutes'
  AND p.updated_at > NOW() - INTERVAL '24 hours'
GROUP BY p.id
ORDER BY minutes_since_update DESC;
```

#### Taxa de Falha Por Periodo

```sql
SELECT
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as total_items,
  COUNT(*) FILTER (WHERE status = 'completed') as completed,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  COUNT(*) FILTER (WHERE status = 'dead_letter') as dead_letter,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE status IN ('failed', 'dead_letter')) /
    NULLIF(COUNT(*), 0),
    2
  ) as failure_rate_percent
FROM processing_queue
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour DESC;
```

#### Chunks Por Estado

```sql
SELECT
  status,
  COUNT(*) as count,
  AVG(attempt_number) as avg_attempts,
  MIN(created_at) as oldest,
  MAX(created_at) as newest
FROM processing_queue
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY status
ORDER BY count DESC;
```

#### Workers Ativos No Momento

```sql
SELECT
  COUNT(DISTINCT locked_by) as active_workers,
  COUNT(*) as items_processing,
  AVG(EXTRACT(EPOCH FROM (NOW() - locked_at)) / 60) as avg_processing_minutes,
  MAX(EXTRACT(EPOCH FROM (NOW() - locked_at)) / 60) as max_processing_minutes
FROM processing_queue
WHERE status = 'processing'
  AND locked_at > NOW() - INTERVAL '30 minutes';
```

#### Performance de Recovery Por Workflow

```sql
-- Esta query precisa de uma tabela de audit/log
-- Exemplo conceitual:
SELECT
  workflow_name,
  COUNT(*) as executions,
  AVG(recovered_count) as avg_recovered_per_run,
  SUM(recovered_count) as total_recovered,
  MAX(execution_time_seconds) as max_duration
FROM workflow_audit_log
WHERE executed_at > NOW() - INTERVAL '7 days'
GROUP BY workflow_name
ORDER BY total_recovered DESC;
```

---

### Dashboard Sugerido

**Metricas em Tempo Real**:

1. **Status da Fila**:
   - Pending: 25
   - Processing: 12
   - Retry: 3
   - Dead Letter: 1

2. **Workers Ativos**: 5/10

3. **Taxa de Sucesso (24h)**: 98.5%

4. **Tempo Medio de Recovery**: 10 minutos

5. **Processos Travados**: 2 (necessitam atencao)

**Graficos de Tendencia**:

- Taxa de falha por hora (ultimas 24h)
- Numero de recoveries por hora
- Tempo de processamento medio
- Tamanho da dead letter queue

**Alertas Visuais**:

- VERMELHO: Dead letter > 10 items
- AMARELO: Taxa de falha > 5%
- VERDE: Sistema operando normalmente

**Exportacao de Dados**:

- CSV com historico de metricas
- JSON para integracao com sistemas externos
- API endpoint para dashboards customizados

---

## Troubleshooting

### Workflow Nao Executa

**Sintoma**: Workflow agendado nao aparece em execucoes recentes

**Causas Possiveis**:

1. **Repositorio inativo**: GitHub desabilita workflows apos 60 dias sem commits
2. **Actions desabilitadas**: Settings pode ter actions bloqueadas
3. **Syntax error no YAML**: Workflow com erro nao e executado

**Solucoes**:

```bash
# 1. Verificar se workflow e valido
# Va em Actions > Workflows > Selecione o workflow
# Se tiver erro de syntax, aparecera mensagem vermelha

# 2. Habilitar actions
# Settings > Actions > General
# Selecione "Allow all actions and reusable workflows"

# 3. "Acordar" workflows inativos
# Faca um commit qualquer no repositorio
git commit --allow-empty -m "Wake up workflows"
git push origin main

# 4. Executar manualmente uma vez
# Actions > Selecione workflow > Run workflow
```

---

### Secrets Nao Funcionam

**Sintoma**: Workflow falha com erro 401 Unauthorized ou 403 Forbidden

**Causas Possiveis**:

1. Secret nao configurado corretamente
2. Usando anon key ao inves de service_role key
3. Secret expirado ou revogado
4. Nome do secret diferente no YAML

**Solucoes**:

```bash
# 1. Verificar se secrets existem
# Settings > Secrets and variables > Actions
# Deve ter: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY

# 2. Verificar formato dos secrets
# SUPABASE_URL deve comecar com https://
# SUPABASE_SERVICE_ROLE_KEY deve ser uma string longa (JWT)

# 3. Testar secrets manualmente
curl -X POST \
  "$SUPABASE_URL/functions/v1/health-check-worker" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"

# Se retornar 401: Secret invalido
# Se retornar 200: Secret funciona, problema esta no workflow

# 4. Verificar nome do secret no YAML
# Deve ser exatamente: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
# Nao: ${{ secrets.SUPABASE_ANON_KEY }}
```

---

### Edge Function Retorna Erro 500

**Sintoma**: Workflow executa mas edge function retorna erro 500

**Causas Possiveis**:

1. Erro na logica da funcao (bug)
2. Tabela/coluna nao existe no database
3. Timeout na query (query muito lenta)
4. RPC nao existe ou tem parametros errados

**Solucoes**:

```bash
# 1. Ver logs da edge function
# Supabase Dashboard > Edge Functions > Selecione funcao > Logs

# 2. Exemplo de erro comum:
# "relation 'processing_queue' does not exist"
# Solucao: Rodar migration que cria a tabela

# 3. Exemplo de erro de RPC:
# "function get_stuck_chunks(p_stuck_threshold_minutes integer) does not exist"
# Solucao: Criar a funcao RPC no database

# 4. Testar edge function localmente
supabase functions serve auto-restart-failed-chunks

# Em outro terminal:
curl -X POST http://localhost:54321/functions/v1/auto-restart-failed-chunks \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"

# 5. Deploy nova versao da funcao
supabase functions deploy auto-restart-failed-chunks
```

---

### Rate Limit GitHub Actions

**Sintoma**: Workflow nao executa ou e colocado em fila

**Causa**: Limite de minutos do GitHub Actions excedido

**Limites Por Plano**:

- **Free**: 2,000 minutos/mes
- **Pro**: 3,000 minutos/mes
- **Team**: 10,000 minutos/mes
- **Enterprise**: 50,000 minutos/mes

**Calculo de Uso Atual**:

```
6 workflows
Frequencias: 1, 3, 5, 5, 5, 10 minutos
Duracao media: 1 minuto cada

Execucoes por hora:
- 1 min: 60 execucoes
- 3 min: 20 execucoes
- 5 min: 12 execucoes (x3 workflows)
- 10 min: 6 execucoes

Total: 60 + 20 + 36 + 6 = 122 execucoes/hora
Total: 122 * 24 * 30 = 87,840 execucoes/mes
Minutos: 87,840 * 1 min = 87,840 minutos/mes

Plano necessario: Enterprise ou Self-hosted runner
```

**Solucoes**:

1. **Ajustar frequencias**:
```yaml
# Antes (1 min):
- cron: '*/1 * * * *'

# Depois (5 min):
- cron: '*/5 * * * *'
```

2. **Self-hosted runner**:
```yaml
jobs:
  monitor-processes:
    runs-on: self-hosted  # Ao inves de ubuntu-latest
```

3. **Executar apenas em horarios criticos**:
```yaml
on:
  schedule:
    # Apenas durante horario comercial
    - cron: '*/5 9-18 * * 1-5'
```

---

### Chunks em Dead Letter Acumulando

**Sintoma**: Numero de chunks em dead_letter aumenta continuamente

**Causas Possiveis**:

1. Chunk muito grande mesmo apos subdivisao
2. Conteudo do PDF corrompido ou ilegivel
3. API Gemini instavel ou com limite de rate
4. Bug na logica de processamento

**Investigacao**:

```sql
-- Ver chunks em dead_letter
SELECT
  pq.id,
  pq.processo_id,
  pq.chunk_id,
  pq.attempt_number,
  pq.error_message,
  pq.moved_to_dead_letter_at,
  pc.start_page,
  pc.end_page,
  pc.pages_count,
  pc.estimated_tokens
FROM processing_queue pq
JOIN process_chunks pc ON pc.id = pq.chunk_id
WHERE pq.status = 'dead_letter'
ORDER BY pq.moved_to_dead_letter_at DESC
LIMIT 10;
```

**Analise de Erro Comum**:

```sql
-- Agrupar por tipo de erro
SELECT
  SUBSTRING(error_message, 1, 100) as error_type,
  COUNT(*) as occurrences
FROM processing_queue
WHERE status = 'dead_letter'
  AND moved_to_dead_letter_at > NOW() - INTERVAL '7 days'
GROUP BY error_type
ORDER BY occurrences DESC;
```

**Solucoes Por Tipo de Erro**:

1. **"Token limit exceeded"**:
```sql
-- Forcar subdivisao adicional
UPDATE process_chunks
SET status = 'failed',
    token_validation_status = 'exceeded'
WHERE id IN (
  SELECT chunk_id FROM processing_queue WHERE status = 'dead_letter'
);
-- Proximo auto-restart vai subdividir novamente
```

2. **"Rate limit exceeded"**:
```sql
-- Resetar para retry com delay
UPDATE processing_queue
SET status = 'retry',
    attempt_number = 0,
    locked_at = NULL,
    retry_after = NOW() + INTERVAL '5 minutes'
WHERE status = 'dead_letter'
  AND error_message LIKE '%rate limit%';
```

3. **"Invalid PDF content"**:
```sql
-- Marcar processo como failed (nao tem como recuperar)
UPDATE processos
SET status = 'failed',
    error_message = 'Arquivo PDF corrompido ou ilegivel'
WHERE id IN (
  SELECT DISTINCT processo_id
  FROM processing_queue
  WHERE status = 'dead_letter'
    AND error_message LIKE '%invalid%pdf%'
);
```

---

### Workers Nao Sao Disparados

**Sintoma**: Recovery executa mas workers nao iniciam

**Verificacoes**:

```sql
-- 1. Verificar se processo permite novos workers
SELECT * FROM can_spawn_worker('processo-id-aqui');

-- 2. Ver workers ativos
SELECT
  COUNT(*) as active_workers,
  locked_by,
  MAX(locked_at) as last_activity
FROM processing_queue
WHERE status = 'processing'
  AND locked_at > NOW() - INTERVAL '10 minutes'
GROUP BY locked_by;

-- 3. Verificar se ha itens pending/retry
SELECT COUNT(*) as pending_items
FROM processing_queue
WHERE processo_id = 'processo-id-aqui'
  AND status IN ('pending', 'retry');
```

**Causa**: Limite de workers atingido

**Solucao**: Aguardar workers atuais completarem ou ajustar limite

---

## Custos e Limites

### GitHub Actions

**Custos Por Plano**:

| Plano | Minutos Inclusos | Custo Adicional | Repositorios |
|-------|------------------|-----------------|--------------|
| Free | 2,000 min/mes | N/A | Publicos apenas |
| Pro | 3,000 min/mes | $0.008/min | Publicos + Privados |
| Team | 10,000 min/mes | $0.008/min | Publicos + Privados |
| Enterprise | 50,000 min/mes | $0.008/min | Publicos + Privados |

**Estimativa de Uso Atual**:

```
Workflow 1 (1 min):  60 exec/hora * 24h * 30d * 1 min = 43,200 min/mes
Workflow 2 (3 min):  20 exec/hora * 24h * 30d * 1 min = 14,400 min/mes
Workflow 3 (5 min):  12 exec/hora * 24h * 30d * 1 min =  8,640 min/mes
Workflow 4 (5 min):  12 exec/hora * 24h * 30d * 1 min =  8,640 min/mes
Workflow 5 (5 min):  12 exec/hora * 24h * 30d * 1 min =  8,640 min/mes
Workflow 6 (10 min):  6 exec/hora * 24h * 30d * 1 min =  4,320 min/mes

Total: 87,840 minutos/mes
```

**Recomendacao**:
- Para producao: Plano Enterprise OU self-hosted runner
- Para desenvolvimento/teste: Reduzir frequencias

---

### Supabase Edge Functions

**Limites Free Tier**:
- 500,000 invocations/mes
- 400,000 GB-s execution time

**Estimativa de Uso**:

```
6 edge functions
~122 invocations/hora (ver calculo acima)
122 * 24 * 30 = 87,840 invocations/mes

Duracao media: 2 segundos
87,840 * 2s = 175,680 segundos = 48.8 horas de execucao

Bem abaixo do limite free tier
```

**Custo**: $0 (dentro do free tier)

---

### Supabase Database

**Operacoes SQL Por Mes**:

```
Workflows executam ~87,840 vezes/mes
Cada workflow faz ~5 queries em media
Total: 439,200 queries/mes

Free tier: 5 GB storage + unlimited queries
```

**Custo**: $0 (queries sao ilimitadas no Supabase)

---

### Total Cost of Ownership

**Cenario 1: GitHub Free + Self-hosted Runner**
- GitHub: $0
- Self-hosted runner (VPS): ~$10/mes
- Supabase: $0 (free tier)
- **Total: $10/mes**

**Cenario 2: GitHub Pro**
- GitHub Pro: $4/mes (usuario)
- Minutos extras: (87,840 - 3,000) * $0.008 = $679/mes
- Supabase: $0
- **Total: $683/mes**

**Cenario 3: GitHub Team**
- GitHub Team: $4/mes por usuario (min 3 usuarios) = $12/mes
- Minutos extras: (87,840 - 10,000) * $0.008 = $623/mes
- Supabase: $0
- **Total: $635/mes**

**Recomendacao**: Self-hosted runner e a opcao mais economica para este volume de execucoes.

---

## Glossario

**Termos Tecnicos**:

- **Chunk**: Subdivisao de um arquivo grande em partes menores (ate 300 paginas)
- **Sub-chunk**: Subdivisao adicional de um chunk que excedeu token limit (ate 80 paginas)
- **Heartbeat**: Atualizacao periodica de `last_heartbeat` indicando que worker esta ativo
- **Dead Letter Queue**: Fila para itens que falharam apos maximo de tentativas
- **Subdivided**: Status de chunk que foi subdividido em partes menores
- **Lock**: Mecanismo de prevencao de processamento duplicado usando `locked_at` e `locked_by`
- **RPC**: Remote Procedure Call - funcao executada no database
- **Worker**: Processo que executa tarefas (process-complex-worker, consolidation-worker, etc)
- **Consolidation**: Fase final que junta resultados de todos chunks em resultado unico
- **Token**: Unidade de texto para APIs de LLM (Gemini usa ~1500 tokens/pagina)
- **Threshold**: Tempo limite antes de considerar item travado
- **Retry**: Tentativa de reprocessar item que falhou
- **is_chunked**: Flag indicando se arquivo usa processamento em chunks (true) ou sequencial (false)

**Codigos e Status**:

**HTTP Status Codes**:
- 200: Sucesso
- 401: Nao autorizado (secret invalido)
- 403: Acesso negado (sem permissoes)
- 500: Erro interno da funcao

**Process Status**:
- pending: Aguardando inicio
- queued: Na fila para processar
- analyzing: Processando prompts
- processing: Processando chunks (arquivo complexo)
- consolidating: Juntando resultados
- completed: Concluido com sucesso
- failed: Falhou permanentemente

**Chunk Status**:
- pending: Aguardando processamento
- processing: Sendo processado
- completed: Completado com sucesso
- failed: Falhou (pode ser retried)
- subdivided: Foi subdividido em sub-chunks
- retry: Aguardando nova tentativa
- dead_letter: Falhou apos 30 tentativas

**Queue Status**:
- pending: Aguardando processamento
- processing: Sendo processado (tem lock)
- completed: Completado com sucesso
- failed: Falhou (sera retried)
- retry: Aguardando retry
- dead_letter: Falhou permanentemente (30+ tentativas)

---

## Links Externos

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [GitHub Actions Pricing](https://docs.github.com/en/billing/managing-billing-for-github-actions/about-billing-for-github-actions)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Supabase CLI](https://supabase.com/docs/reference/cli/introduction)
- [Cron Expression Syntax](https://crontab.guru/)
- [Mermaid Diagram Syntax](https://mermaid.js.org/intro/)
- [Self-hosted Runners Setup](https://docs.github.com/en/actions/hosting-your-own-runners/about-self-hosted-runners)

---

## FAQ

**1. Por que usar GitHub Actions ao inves de cron jobs no servidor?**

- Desacoplamento: Workflows rodam independente da aplicacao
- Escalabilidade: GitHub cuida da infraestrutura
- Logs centralizados: Facil debug e auditoria
- Execucao manual: workflow_dispatch para testes
- Versioning: Workflows sao versionados com codigo

**2. Como identificar gargalos no sistema?**

```sql
-- Ver distribuicao de tempo de processamento
SELECT
  CASE
    WHEN processing_time_seconds < 60 THEN '< 1 min'
    WHEN processing_time_seconds < 300 THEN '1-5 min'
    WHEN processing_time_seconds < 600 THEN '5-10 min'
    ELSE '> 10 min'
  END as time_range,
  COUNT(*) as count
FROM (
  SELECT
    EXTRACT(EPOCH FROM (completed_at - locked_at)) as processing_time_seconds
  FROM processing_queue
  WHERE status = 'completed'
    AND completed_at > NOW() - INTERVAL '24 hours'
) t
GROUP BY time_range;
```

**3. Quando aumentar frequencia dos workflows?**

Indicadores:
- Taxa de recovery > 10% (muitos itens precisando retry)
- Tempo medio ate recovery > 15 minutos
- Usuarios reportando lentidao
- Dead letter queue crescendo

**4. Como debugar um workflow que falhou?**

1. Ver logs no GitHub Actions
2. Identificar HTTP status code
3. Ver logs da edge function no Supabase
4. Verificar estado do database
5. Testar edge function manualmente

**5. Como resetar manualmente um processo?**

```sql
-- Para arquivos pequenos:
UPDATE analysis_results
SET status = 'pending', processing_at = NULL
WHERE processo_id = 'uuid-aqui'
  AND status = 'processing';

-- Para arquivos complexos:
UPDATE processing_queue
SET status = 'retry', locked_at = NULL, locked_by = NULL
WHERE processo_id = 'uuid-aqui'
  AND status IN ('processing', 'failed');
```

**6. Como interpretar erros de token limit?**

```
Error: "Token limit exceeded"

Causa: Chunk tem mais de 850,000 tokens estimados
Acao automatica: auto-restart-failed-chunks subdivide em chunks de 80 paginas
Prevencao: Arquivos muito grandes sao automaticamente chunked em 300 paginas
```

**7. Como lidar com dead letter queue?**

Estrategias:
1. Analisar tipo de erro predominante
2. Para token limit: forcar subdivisao adicional
3. Para rate limit: adicionar delay antes de retry
4. Para conteudo invalido: marcar processo como failed
5. Alertar admin se dead_letter > 10 items

---

[Voltar ao README principal](../README.md) | [Proximo: Workflows Architecture →](./workflows-architecture.md)
