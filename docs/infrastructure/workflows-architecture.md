# Arquitetura Visual dos Workflows - Diagramas Mermaid

Visualizacoes detalhadas da arquitetura, fluxos e interacoes do sistema de monitoramento automatizado.

---

## Indice

1. [Arquitetura Geral do Sistema](#arquitetura-geral-do-sistema)
2. [Timeline de Execucao](#timeline-de-execucao)
3. [Maquina de Estados - Processos](#maquina-de-estados---processos)
4. [Maquina de Estados - Chunks](#maquina-de-estados---chunks)
5. [Fluxo de Decisao para Recovery](#fluxo-de-decisao-para-recovery)
6. [Sequencia de Interacoes](#sequencia-de-interacoes)
7. [Estrategia de Escalacao](#estrategia-de-escalacao)
8. [Fluxos Detalhados por Workflow](#fluxos-detalhados-por-workflow)

---

## Arquitetura Geral do Sistema

```mermaid
graph TB
    subgraph "GitHub Actions"
        W1[Monitor Stuck Processes<br/>1 min]
        W2[Monitor Auto Restart Failed<br/>3 min]
        W3[Monitor Complex Health Check<br/>5 min]
        W4[Monitor Stuck Chunks<br/>5 min]
        W5[Monitor Stuck Small Files<br/>5 min]
        W6[Monitor Complex Recovery<br/>10 min]
    end

    subgraph "Supabase Edge Functions"
        EF1[process-stuck-processos]
        EF2[auto-restart-failed-chunks]
        EF3[health-check-worker]
        EF4[recover-stuck-chunks]
        EF5[detect-stuck-processes-small-files]
        EF6[recover-stuck-processes]
    end

    subgraph "Workers"
        WK1[process-complex-worker]
        WK2[consolidation-worker]
        WK3[process-next-prompt]
    end

    subgraph "Database Tables"
        DB1[(processos)]
        DB2[(process_chunks)]
        DB3[(processing_queue)]
        DB4[(analysis_results)]
        DB5[(complex_processing_status)]
    end

    W1 -->|HTTP POST| EF1
    W2 -->|HTTP POST| EF2
    W3 -->|HTTP POST| EF3
    W4 -->|HTTP POST| EF4
    W5 -->|HTTP POST| EF5
    W6 -->|HTTP POST| EF6

    EF1 -.->|Query| DB1
    EF1 -.->|Query| DB4

    EF2 -->|Dispara| WK1
    EF2 -.->|Query/Update| DB2
    EF2 -.->|Query/Update| DB3

    EF3 -->|Dispara| WK1
    EF3 -.->|Query/Update| DB3
    EF3 -.->|Query/Update| DB5

    EF4 -->|Dispara| WK1
    EF4 -.->|Query/Update| DB3

    EF5 -->|Dispara| WK3
    EF5 -.->|Query/Update| DB4

    EF6 -->|Dispara| WK1
    EF6 -->|Dispara| WK2
    EF6 -.->|Query/Update| DB5
    EF6 -.->|Query/Update| DB1

    style W1 fill:#ff6b6b
    style W2 fill:#ff6b6b
    style W3 fill:#ffd93d
    style W4 fill:#ffd93d
    style W5 fill:#ffd93d
    style W6 fill:#6bcf7f
```

---

## Timeline de Execucao

```mermaid
gantt
    title Timeline de Execucao dos Workflows (10 minutos)
    dateFormat mm:ss
    axisFormat %M:%S

    section 1 Min
    Monitor Stuck Processes     :00:00, 01:00
    Monitor Stuck Processes     :01:00, 01:00
    Monitor Stuck Processes     :02:00, 01:00
    Monitor Stuck Processes     :03:00, 01:00
    Monitor Stuck Processes     :04:00, 01:00
    Monitor Stuck Processes     :05:00, 01:00
    Monitor Stuck Processes     :06:00, 01:00
    Monitor Stuck Processes     :07:00, 01:00
    Monitor Stuck Processes     :08:00, 01:00
    Monitor Stuck Processes     :09:00, 01:00

    section 3 Min
    Monitor Auto Restart Failed :00:00, 01:00
    Monitor Auto Restart Failed :03:00, 01:00
    Monitor Auto Restart Failed :06:00, 01:00
    Monitor Auto Restart Failed :09:00, 01:00

    section 5 Min
    Monitor Complex Health Check:00:00, 01:00
    Monitor Stuck Chunks        :00:00, 01:00
    Monitor Stuck Small Files   :00:00, 01:00
    Monitor Complex Health Check:05:00, 01:00
    Monitor Stuck Chunks        :05:00, 01:00
    Monitor Stuck Small Files   :05:00, 01:00

    section 10 Min
    Monitor Complex Recovery    :00:00, 01:00
```

---

## Maquina de Estados - Processos

```mermaid
stateDiagram-v2
    [*] --> pending
    pending --> queued: Inicia analise
    queued --> analyzing: Worker pega tarefa

    analyzing --> processing: Arquivo complexo (chunking)
    analyzing --> analyzing: Arquivo pequeno (continua)
    analyzing --> completed: Todos prompts OK

    processing --> consolidating: Todos chunks OK
    consolidating --> completed: Consolidacao OK

    analyzing --> stuck: > 5 min sem update
    queued --> stuck: > 3 min sem update
    processing --> stuck: > 15 min sem heartbeat
    consolidating --> stuck: > 15 min sem heartbeat

    stuck --> analyzing: Recovery (small files)
    stuck --> processing: Recovery (complex)
    stuck --> consolidating: Recovery (consolidation)
    stuck --> completed: Marca como completo

    completed --> [*]

    note right of stuck
        Detectado por:
        - Monitor Stuck Processes
        - Monitor Complex Recovery
        - Monitor Stuck Small Files
    end note

    note right of processing
        Monitorado por:
        - Monitor Auto Restart
        - Monitor Health Check
        - Monitor Stuck Chunks
    end note
```

---

## Maquina de Estados - Chunks

```mermaid
stateDiagram-v2
    [*] --> pending
    pending --> processing: Worker pega chunk
    processing --> completed: Processamento OK
    processing --> failed: Erro no processamento

    failed --> retry: retry_count < 30
    failed --> subdivided: Token limit exceeded
    failed --> dead_letter: retry_count >= 30

    retry --> pending: Aguarda nova tentativa

    subdivided --> [*]: Cria sub-chunks

    state subdivided {
        [*] --> create_subchunks
        create_subchunks --> subchunk_1
        create_subchunks --> subchunk_2
        create_subchunks --> subchunk_n
        subchunk_1 --> pending
        subchunk_2 --> pending
        subchunk_n --> pending
    }

    completed --> [*]
    dead_letter --> [*]: Requer intervencao manual

    note right of failed
        Tratado por:
        - Monitor Auto Restart (token limit)
        - Monitor Stuck Chunks (timeout)
        - Monitor Health Check (lock expirado)
    end note

    note right of subdivided
        Subdivide em chunks de 80 paginas
        Cria queue items para cada sub-chunk
        Dispara ate 3 workers
    end note
```

---

## Fluxo de Decisao para Recovery

```mermaid
graph TD
    Start([Chunk/Processo Travado]) --> Detect{Tipo de Problema?}

    Detect -->|Token Limit| TokenLimit[Monitor Auto Restart<br/>3 min]
    Detect -->|Timeout| Timeout[Monitor Stuck Chunks<br/>5 min]
    Detect -->|Heartbeat Parado| Heartbeat[Monitor Health Check<br/>5 min]
    Detect -->|Lock Expirado| Lock[Monitor Health Check<br/>5 min]
    Detect -->|Processo Stuck| Process[Monitor Complex Recovery<br/>10 min]

    TokenLimit --> CheckType{Token limit<br/>exceeded?}
    CheckType -->|Sim| Subdivide[Subdivide chunk<br/>80 paginas cada]
    CheckType -->|Nao| RetryChunk[Reseta para retry]

    Subdivide --> CreateSubchunks[Cria sub-chunks<br/>na DB]
    CreateSubchunks --> CreateQueue[Cria queue items<br/>para cada sub-chunk]
    CreateQueue --> SpawnWorkers[Dispara 3 workers]
    SpawnWorkers --> Success1([Recovery OK])

    Timeout --> GetStuckChunks[RPC: get_stuck_chunks]
    GetStuckChunks --> RecoverChunks[RPC: recover_stuck_chunks]
    RecoverChunks --> CheckCanSpawn{can_spawn_worker?}
    CheckCanSpawn -->|Sim| DispatchWorker[Dispara worker]
    CheckCanSpawn -->|Nao| WaitWorker[Aguarda worker atual]
    DispatchWorker --> Success2([Recovery OK])

    Heartbeat --> ReleaseExpired[RPC: release_expired_locks]
    ReleaseExpired --> CheckRetry{retry_count < 30?}
    CheckRetry -->|Sim| MoveRetry[Move para retry]
    CheckRetry -->|Nao| DeadLetter[Move para dead_letter]
    MoveRetry --> DispatchRetryWorker[Dispara worker]
    DispatchRetryWorker --> Success3([Recovery OK])
    DeadLetter --> Alert([Alerta Admin])

    Lock --> ReleaseExpired

    Process --> CheckPhase{Fase do Processo?}
    CheckPhase -->|Consolidating| CheckPending{Tem results<br/>pendentes?}
    CheckPhase -->|Processing| DispatchProcessWorker[Dispara process-worker]

    CheckPending -->|Sim| DispatchConsolidation[Dispara consolidation-worker]
    CheckPending -->|Nao| MarkComplete[Marca como completed]

    DispatchConsolidation --> Success4([Recovery OK])
    DispatchProcessWorker --> Success4
    MarkComplete --> Success4

    RetryChunk --> CheckCanSpawn
    WaitWorker --> Success2

    style TokenLimit fill:#ff6b6b
    style Timeout fill:#ffd93d
    style Heartbeat fill:#ffd93d
    style Lock fill:#ffd93d
    style Process fill:#6bcf7f
    style Alert fill:#ff4757
    style Success1 fill:#2ed573
    style Success2 fill:#2ed573
    style Success3 fill:#2ed573
    style Success4 fill:#2ed573
```

---

## Sequencia de Interacoes

### Workflow: Monitor Auto Restart Failed

```mermaid
sequenceDiagram
    participant GH as GitHub Actions
    participant EF as auto-restart-failed-chunks
    participant DB as Database
    participant WK as process-complex-worker

    GH->>EF: POST /functions/v1/auto-restart-failed-chunks
    activate EF

    EF->>DB: SELECT chunks WHERE token_validation_status = 'exceeded'
    DB-->>EF: failedChunks[] (max 10)

    loop Para cada chunk
        EF->>EF: Calcula numero de sub-chunks (80 pgs cada)

        loop Para cada sub-chunk
            EF->>DB: INSERT INTO process_chunks (sub-chunk)
            DB-->>EF: sub_chunk_id

            EF->>DB: SELECT prompts WHERE is_active = true
            DB-->>EF: prompts[]

            loop Para cada prompt
                EF->>DB: INSERT INTO processing_queue
            end
        end

        EF->>DB: UPDATE process_chunks SET status = 'subdivided'
        EF->>DB: UPDATE processing_queue SET status = 'completed'
    end

    EF->>WK: POST (spawn worker 1)
    EF->>WK: POST (spawn worker 2)
    EF->>WK: POST (spawn worker 3)

    EF-->>GH: 200 OK {total_subdivided, total_subchunks_created}
    deactivate EF
```

### Workflow: Monitor Stuck Chunks

```mermaid
sequenceDiagram
    participant GH as GitHub Actions
    participant EF as recover-stuck-chunks
    participant DB as Database
    participant WK as process-complex-worker

    GH->>EF: POST /functions/v1/recover-stuck-chunks<br/>{threshold_minutes: 10}
    activate EF

    EF->>DB: RPC: get_stuck_chunks(10)
    DB-->>EF: stuckChunks[] {chunk_id, minutes_stuck}

    EF->>EF: Log chunks travados

    EF->>DB: RPC: recover_stuck_chunks(10)
    DB->>DB: UPDATE processing_queue<br/>SET status = 'retry'<br/>WHERE locked_at < NOW() - 10 min
    DB-->>EF: {recovered_count, processo_ids[]}

    loop Para cada processo_id
        EF->>DB: RPC: can_spawn_worker(processo_id)
        DB-->>EF: true/false

        alt can_spawn = true
            EF->>WK: POST /process-complex-worker<br/>{processo_id}
            WK-->>EF: 200 OK
        else can_spawn = false
            EF->>EF: Skip (workers suficientes)
        end
    end

    EF-->>GH: 200 OK {recovered_count, workers_triggered}
    deactivate EF
```

### Workflow: Monitor Complex Health Check

```mermaid
sequenceDiagram
    participant GH as GitHub Actions
    participant EF as health-check-worker
    participant DB as Database
    participant WK as process-complex-worker

    GH->>EF: POST /functions/v1/health-check-worker
    activate EF

    EF->>DB: RPC: release_expired_locks()
    DB->>DB: UPDATE items WHERE locked_at < NOW() - 15 min
    DB-->>EF: {released_count, moved_to_retry, moved_to_dead_letter}

    EF->>DB: SELECT FROM complex_processing_status<br/>WHERE last_heartbeat < NOW() - 15 min
    DB-->>EF: unhealthyProcesses[]

    loop Para cada processo unhealthy
        EF->>DB: UPDATE complex_processing_status<br/>SET is_healthy = false

        EF->>DB: SELECT FROM processing_queue<br/>WHERE status IN ('pending', 'retry')
        DB-->>EF: pendingItems

        alt tem pendingItems
            EF->>WK: POST /process-complex-worker
        end
    end

    EF->>DB: SELECT status FROM processing_queue
    DB-->>EF: stats {pending, processing, retry, dead_letter}

    alt retry > 0
        EF->>DB: SELECT processo_ids WHERE status = 'retry'
        DB-->>EF: processo_ids[]

        loop Para cada processo_id
            EF->>WK: POST /process-complex-worker
        end
    end

    alt dead_letter > 0
        EF->>EF: Log ALERTA: items em dead_letter
    end

    EF-->>GH: 200 OK {expired_locks_released, unhealthy_processes}
    deactivate EF
```

---

## Estrategia de Escalacao

```mermaid
graph TD
    Start([Processamento Inicia]) --> Normal[Tentativa 0:<br/>Processamento Normal]
    Normal -->|Sucesso| Done([Completed])
    Normal -->|Falha| Check1{retry_count?}

    Check1 -->|< 3| Level1[Nivel 1: Auto-Restart<br/>Monitor Auto Restart - 3 min]
    Level1 --> Action1[Acao: Reseta para pending<br/>ou subdivide se token limit]
    Action1 --> Worker1[Dispara worker]
    Worker1 -->|Sucesso| Done
    Worker1 -->|Falha| Check2{retry_count?}

    Check2 -->|3-10| Level2[Nivel 2: Stuck Chunk Recovery<br/>Monitor Stuck Chunks - 5 min]
    Level2 --> Action2[Acao: RPC recover_stuck_chunks<br/>Reseta para retry]
    Action2 --> Worker2[Dispara worker se pode]
    Worker2 -->|Sucesso| Done
    Worker2 -->|Falha| Check3{retry_count?}

    Check3 -->|10-20| Level3[Nivel 3: Health Check<br/>Monitor Health Check - 5 min]
    Level3 --> Action3[Acao: RPC release_expired_locks<br/>Move para retry]
    Action3 --> Worker3[Dispara worker]
    Worker3 -->|Sucesso| Done
    Worker3 -->|Falha| Check4{retry_count?}

    Check4 -->|20-29| Level4[Nivel 4: Process Recovery<br/>Monitor Complex Recovery - 10 min]
    Level4 --> Action4[Acao: Reinicia processo completo<br/>Dispara consolidation se necessario]
    Action4 --> Worker4[Dispara worker/consolidation]
    Worker4 -->|Sucesso| Done
    Worker4 -->|Falha| Check5{retry_count?}

    Check5 -->|>= 30| Level5[Nivel 5: Dead Letter Queue]
    Level5 --> Action5[Acao: Move para dead_letter<br/>Alerta admin via Slack]
    Action5 --> Manual([Intervencao Manual<br/>Necessaria])

    style Start fill:#5f27cd
    style Level1 fill:#ff6b6b
    style Level2 fill:#ffd93d
    style Level3 fill:#ffd93d
    style Level4 fill:#6bcf7f
    style Level5 fill:#ff4757
    style Done fill:#2ed573
    style Manual fill:#ff4757
```

---

## Fluxos Detalhados por Workflow

### 1. Monitor Stuck Processes

```mermaid
graph TD
    Start([Executa a cada 1 min]) --> Query1[SELECT processos<br/>WHERE status = 'analyzing'<br/>AND analysis_started_at < NOW() - 5 min]

    Query1 --> Query2[SELECT processos<br/>WHERE status = 'queued'<br/>AND updated_at < NOW() - 3 min]

    Query2 --> Combine[Combina resultados]

    Combine --> Loop{Para cada<br/>processo}

    Loop -->|Sim| CheckPending[SELECT analysis_results<br/>WHERE status IN ('pending', 'processing')]

    CheckPending --> HasPending{Tem<br/>pendentes?}

    HasPending -->|Nao| MarkComplete[UPDATE processos<br/>SET status = 'completed']
    MarkComplete --> Result1[Adiciona a completed_count]
    Result1 --> Loop

    HasPending -->|Sim| MarkStuck[Classifica como 'stuck'<br/>needs_user_action = true]
    MarkStuck --> Result2[Adiciona a stuck_count]
    Result2 --> Loop

    Loop -->|Nao| Return[Retorna:<br/>- completed_count<br/>- stuck_count<br/>- stuck_processos[]]

    Return --> End([Fim])

    note1[OBSERVACAO:<br/>Este workflow NAO<br/>reinicia processos.<br/>Apenas detecta e reporta.]

    style Start fill:#ff6b6b
    style note1 fill:#fff3cd
    style End fill:#2ed573
```

### 2. Monitor Auto Restart Failed Chunks

```mermaid
graph TD
    Start([Executa a cada 3 min]) --> Query[SELECT process_chunks<br/>WHERE token_validation_status = 'exceeded'<br/>AND status = 'failed'<br/>AND subdivision_parent_id IS NULL<br/>LIMIT 10]

    Query --> CheckEmpty{Tem chunks?}
    CheckEmpty -->|Nao| ReturnEmpty[Retorna: count = 0]
    CheckEmpty -->|Sim| LoopChunks{Para cada<br/>chunk}

    LoopChunks -->|Sim| CalcSubchunks[Calcula numero de sub-chunks<br/>subChunkSize = 80 paginas]

    CalcSubchunks --> LoopSubchunks{Para cada<br/>sub-chunk}

    LoopSubchunks -->|Sim| CreateSubchunk[INSERT process_chunks<br/>- start_page<br/>- end_page<br/>- subdivision_parent_id<br/>- estimated_tokens]

    CreateSubchunk --> GetPrompts[SELECT analysis_prompts<br/>WHERE is_active = true]

    GetPrompts --> LoopPrompts{Para cada<br/>prompt}

    LoopPrompts -->|Sim| CreateQueueItem[INSERT processing_queue<br/>- chunk_id<br/>- prompt_id<br/>- priority = 10]

    CreateQueueItem --> LoopPrompts
    LoopPrompts -->|Nao| LoopSubchunks

    LoopSubchunks -->|Nao| MarkSubdivided[UPDATE process_chunks<br/>SET status = 'subdivided'<br/>WHERE id = chunk_id]

    MarkSubdivided --> UpdateQueue[UPDATE processing_queue<br/>SET status = 'completed'<br/>WHERE chunk_id = chunk_id]

    UpdateQueue --> AddResult[Adiciona a results[]]

    AddResult --> LoopChunks

    LoopChunks -->|Nao| SpawnWorkers[Dispara ate 3 workers:<br/>process-complex-worker]

    SpawnWorkers --> Return[Retorna:<br/>- total_subdivided<br/>- total_subchunks_created<br/>- results[]]

    Return --> End([Fim])
    ReturnEmpty --> End

    style Start fill:#ff6b6b
    style End fill:#2ed573
```

### 3. Monitor Complex Health Check

```mermaid
graph TD
    Start([Executa a cada 5 min]) --> ReleaseLocksRPC[RPC: release_expired_locks]

    ReleaseLocksRPC --> LogRelease[Log: locks liberados<br/>moved_to_retry<br/>moved_to_dead_letter]

    LogRelease --> QueryUnhealthy[SELECT complex_processing_status<br/>WHERE current_phase IN ('processing', 'queued')<br/>AND last_heartbeat < NOW() - 15 min]

    QueryUnhealthy --> CheckUnhealthy{Tem processos<br/>unhealthy?}

    CheckUnhealthy -->|Sim| LoopUnhealthy{Para cada<br/>processo}

    LoopUnhealthy -->|Sim| MarkUnhealthy[UPDATE complex_processing_status<br/>SET is_healthy = false]

    MarkUnhealthy --> CheckPending[SELECT processing_queue<br/>WHERE status IN ('pending', 'retry')]

    CheckPending --> HasPending{Tem<br/>pendentes?}

    HasPending -->|Sim| SpawnWorker1[Dispara process-complex-worker]
    SpawnWorker1 --> LoopUnhealthy

    HasPending -->|Nao| LoopUnhealthy

    LoopUnhealthy -->|Nao| QueryStats
    CheckUnhealthy -->|Nao| QueryStats[SELECT status<br/>FROM processing_queue]

    QueryStats --> CountStats[Conta por status:<br/>- pending<br/>- processing<br/>- retry<br/>- dead_letter]

    CountStats --> LogStats[Log estatisticas da fila]

    LogStats --> CheckRetry{retry > 0?}

    CheckRetry -->|Sim| GetRetryProcessos[SELECT DISTINCT processo_id<br/>WHERE status = 'retry'<br/>LIMIT 5]

    GetRetryProcessos --> LoopRetry{Para cada<br/>processo}

    LoopRetry -->|Sim| SpawnWorker2[Dispara process-complex-worker]
    SpawnWorker2 --> LoopRetry

    LoopRetry -->|Nao| CheckDeadLetter
    CheckRetry -->|Nao| CheckDeadLetter{dead_letter > 0?}

    CheckDeadLetter -->|Sim| LogDeadLetter[Log ALERTA:<br/>Lista primeiros 10 items<br/>com ID, processo, tentativas, erro]

    LogDeadLetter --> Return
    CheckDeadLetter -->|Nao| Return[Retorna:<br/>- expired_locks_released<br/>- unhealthy_processes]

    Return --> End([Fim])

    style Start fill:#ffd93d
    style End fill:#2ed573
```

### 4. Monitor Stuck Chunks

```mermaid
graph TD
    Start([Executa a cada 5 min]) --> GetStuckRPC[RPC: get_stuck_chunks<br/>threshold_minutes = 10]

    GetStuckRPC --> LogStuck[Log chunks travados:<br/>- chunk_id<br/>- status<br/>- attempt_number<br/>- minutes_stuck]

    LogStuck --> CheckEmpty{Tem chunks?}

    CheckEmpty -->|Nao| ReturnEmpty[Retorna: recovered_count = 0]

    CheckEmpty -->|Sim| RecoverRPC[RPC: recover_stuck_chunks<br/>threshold_minutes = 10]

    RecoverRPC --> GetResult[Recebe:<br/>- recovered_count<br/>- processo_ids[]]

    GetResult --> LogRecovered[Log: N chunks recuperados<br/>M processos afetados]

    LogRecovered --> LoopProcessos{Para cada<br/>processo_id}

    LoopProcessos -->|Sim| CanSpawnRPC[RPC: can_spawn_worker<br/>processo_id]

    CanSpawnRPC --> CheckCanSpawn{Pode spawnar?}

    CheckCanSpawn -->|Sim| SpawnWorker[Dispara process-complex-worker<br/>processo_id]
    SpawnWorker --> IncrementWorkers[workers_triggered++]
    IncrementWorkers --> LogSpawned[Log: Worker disparado]
    LogSpawned --> LoopProcessos

    CheckCanSpawn -->|Nao| LogSkip[Log: Processo ja tem workers suficientes]
    LogSkip --> LoopProcessos

    LoopProcessos -->|Nao| Return[Retorna:<br/>- stuck_found<br/>- recovered_count<br/>- processos_affected<br/>- workers_triggered<br/>- processo_ids[]]

    Return --> End([Fim])
    ReturnEmpty --> End

    style Start fill:#ffd93d
    style End fill:#2ed573
```

### 5. Monitor Stuck Small Files

```mermaid
graph TD
    Start([Executa a cada 5 min]) --> Query[SELECT analysis_results<br/>JOIN processos<br/>WHERE analysis_results.status = 'processing'<br/>AND processing_at < NOW() - 10 min<br/>AND processos.is_chunked = false<br/>AND processos.status = 'analyzing']

    Query --> CheckEmpty{Tem prompts?}

    CheckEmpty -->|Nao| ReturnEmpty[Retorna: recovered = 0]

    CheckEmpty -->|Sim| CreateSet[Cria Set para deduplic<br/>processedProcessos = new Set]

    CreateSet --> LoopPrompts{Para cada<br/>prompt}

    LoopPrompts -->|Sim| CheckDupe{processo_id<br/>ja processado?}

    CheckDupe -->|Sim| LoopPrompts

    CheckDupe -->|Nao| AddToSet[Adiciona a processedProcessos]

    AddToSet --> LogRecovering[Log: Recuperando processo<br/>- processo_id<br/>- file_name<br/>- prompt_title<br/>- processing_at]

    LogRecovering --> ResetPrompts[UPDATE analysis_results<br/>SET status = 'pending'<br/>processing_at = NULL<br/>WHERE processo_id = X]

    ResetPrompts --> SpawnWorker[Dispara process-next-prompt<br/>processo_id]

    SpawnWorker --> CheckSuccess{Sucesso?}

    CheckSuccess -->|Sim| AddRecovered[Adiciona a recovered[]<br/>action = 'processing_restarted']
    AddRecovered --> LoopPrompts

    CheckSuccess -->|Nao| AddFailed[Adiciona a failed[]<br/>com erro]
    AddFailed --> LoopPrompts

    LoopPrompts -->|Nao| Return[Retorna:<br/>- message<br/>- recovered[]<br/>- failed[]]

    Return --> End([Fim])
    ReturnEmpty --> End

    style Start fill:#ffd93d
    style End fill:#2ed573
```

### 6. Monitor Complex Recovery

```mermaid
graph TD
    Start([Executa a cada 10 min]) --> Query[SELECT complex_processing_status<br/>WHERE current_phase IN ('consolidating', 'processing')<br/>AND last_heartbeat < NOW() - 15 min]

    Query --> CheckEmpty{Tem processos?}

    CheckEmpty -->|Nao| ReturnEmpty[Retorna: recovered = 0]

    CheckEmpty -->|Sim| LoopProcessos{Para cada<br/>processo}

    LoopProcessos -->|Sim| LogRecovering[Log: Recuperando processo<br/>- processo_id<br/>- current_phase<br/>- last_heartbeat<br/>- chunks_completed/total]

    LogRecovering --> CheckPhase{Fase?}

    CheckPhase -->|consolidating| CheckPendingResults
    CheckPhase -->|processing + all chunks done| CheckPendingResults[SELECT analysis_results<br/>WHERE status IN ('pending', 'processing')]

    CheckPendingResults --> HasPending{Tem<br/>pendentes?}

    HasPending -->|Sim| SpawnConsolidation[Dispara consolidation-worker]
    SpawnConsolidation --> AddRecovered1[Adiciona a recovered[]<br/>action = 'consolidation_restarted']
    AddRecovered1 --> UpdateHeartbeat

    HasPending -->|Nao| MarkComplete[UPDATE processos<br/>SET status = 'completed'<br/>analysis_completed_at = NOW()]
    MarkComplete --> UpdateStatus[UPDATE complex_processing_status<br/>SET current_phase = 'completed'<br/>overall_progress_percent = 100]
    UpdateStatus --> AddRecovered2[Adiciona a recovered[]<br/>action = 'marked_completed']
    AddRecovered2 --> UpdateHeartbeat

    CheckPhase -->|processing| SpawnWorker[Dispara process-complex-worker]
    SpawnWorker --> AddRecovered3[Adiciona a recovered[]<br/>action = 'processing_restarted']
    AddRecovered3 --> UpdateHeartbeat[UPDATE complex_processing_status<br/>SET last_heartbeat = NOW()]

    UpdateHeartbeat --> LoopProcessos

    LoopProcessos -->|Nao| Return[Retorna:<br/>- message<br/>- recovered[]<br/>- failed[]]

    Return --> End([Fim])
    ReturnEmpty --> End

    style Start fill:#6bcf7f
    style End fill:#2ed573
```

---

## Coordenacao Entre Workflows

```mermaid
graph TD
    Event([Chunk X Falha<br/>Token Limit Exceeded]) --> T0[T+0:00<br/>Chunk marca status = 'failed']

    T0 --> T1[T+0:01<br/>Monitor Stuck Processes<br/>Detecta mas nao age]

    T1 --> T3[T+0:03<br/>Monitor Auto Restart<br/>Detecta token limit]

    T3 --> Action1[Subdivide chunk em<br/>sub-chunks de 80 pgs]
    Action1 --> State1[Chunk X agora<br/>status = 'subdivided']

    State1 --> T5a[T+0:05<br/>Monitor Stuck Chunks<br/>Ignora chunk X<br/>nao esta em 'processing']

    State1 --> T5b[T+0:05<br/>Monitor Health Check<br/>Verifica fila geral]

    T5b --> State2[Sub-chunks entram<br/>em 'pending']

    State2 --> Dispatch[Health Check<br/>dispara workers para<br/>sub-chunks]

    Dispatch --> T10[T+0:10<br/>Monitor Complex Recovery<br/>Verifica processo]

    T10 --> CheckDone{Todos chunks<br/>completados?}

    CheckDone -->|Sim| Consolidate[Dispara<br/>consolidation-worker]
    CheckDone -->|Nao| Continue[Continua<br/>processamento]

    Consolidate --> Success([Processo<br/>Concluido])

    style Event fill:#ff4757
    style T1 fill:#ff6b6b
    style T3 fill:#ff6b6b
    style T5a fill:#ffd93d
    style T5b fill:#ffd93d
    style T10 fill:#6bcf7f
    style Success fill:#2ed573
```

---

## Legenda de Cores

- **Vermelho** (ff6b6b): Workflows de alta prioridade (1-3 min)
- **Amarelo** (ffd93d): Workflows de media prioridade (5 min)
- **Verde** (6bcf7f): Workflows de baixa prioridade (10 min)
- **Verde Escuro** (2ed573): Estados de sucesso
- **Vermelho Escuro** (ff4757): Estados de erro/alerta

---

[Voltar: GitHub Actions Monitoring](./github-actions-monitoring.md) | [Proximo: README →](../README.md)
