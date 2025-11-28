# Guia de Teste - Otimizações de Processamento

## Como Testar as Otimizações

### 1. Preparação

Certifique-se de que:
- ✅ A migration foi aplicada no banco de dados Supabase
- ✅ O build do projeto foi feito com sucesso (`npm run build`)
- ✅ As edge functions foram deployadas (se necessário)

### 2. Teste com Documento de 3000 Páginas

#### 2.1. Upload do Documento

1. Faça login no sistema
2. Vá para a página de upload
3. Selecione um PDF com aproximadamente 3000 páginas
4. Inicie o upload

#### 2.2. Monitoramento no Console do Navegador

Abra o DevTools (F12) e monitore os logs. Você deverá ver:

```
⏱️ Tempo estimado: ~10-15 minutos
📦 Documento detectado com 3000 páginas
✅ Dividindo em 5 chunks de 600 páginas
🚀 Iniciando processamento complexo...
```

#### 2.3. Monitoramento no Banco de Dados

Execute estas queries no Supabase SQL Editor:

**Verificar status de processamento:**
```sql
SELECT
  processo_id,
  current_phase,
  current_active_workers,
  max_concurrent_workers,
  chunks_completed,
  total_chunks,
  overall_progress_percent,
  avg_chunk_processing_seconds
FROM complex_processing_status
WHERE processo_id = 'SEU_PROCESSO_ID'  -- Substituir pelo ID do processo
ORDER BY created_at DESC
LIMIT 1;
```

**Verificar workers ativos:**
```sql
SELECT
  processo_id,
  active_worker_ids,
  jsonb_array_length(active_worker_ids) as workers_count,
  last_heartbeat
FROM complex_processing_status
WHERE processo_id = 'SEU_PROCESSO_ID'
AND current_active_workers > 0;
```

**Verificar progresso da fila:**
```sql
SELECT
  status,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_time_seconds
FROM processing_queue
WHERE processo_id = 'SEU_PROCESSO_ID'
GROUP BY status;
```

#### 2.4. Monitoramento nos Logs do Supabase

1. Vá para Supabase Dashboard → Edge Functions
2. Abra os logs de `process-complex-worker`
3. Procure por múltiplos workers rodando simultaneamente:

```
[abc123] 🔄 Worker iniciado
[def456] 🔄 Worker iniciado
[ghi789] 🔄 Worker iniciado
[jkl012] 🔄 Worker iniciado
[mno345] 🔄 Worker iniciado
```

### 3. Verificação de Sucesso

#### 3.1. Tempo de Processamento

✅ **Sucesso**: Documento de 3000 páginas processa em **10-15 minutos**
⚠️ **Alerta**: Se levar mais de 20 minutos, verificar logs para erros
❌ **Falha**: Se levar mais de 30 minutos, algo está errado

#### 3.2. Workers Paralelos

Execute durante o processamento:
```sql
SELECT
  current_active_workers,
  max_concurrent_workers
FROM complex_processing_status
WHERE processo_id = 'SEU_PROCESSO_ID';
```

✅ **Sucesso**: `current_active_workers` deve estar entre 3-5 durante processamento
⚠️ **Alerta**: Se sempre 1, paralelização não está funcionando
❌ **Falha**: Se 0, processamento não iniciou

#### 3.3. Chunks Processados

```sql
SELECT
  total_chunks,
  chunks_completed,
  chunks_processing,
  chunks_pending
FROM complex_processing_status
WHERE processo_id = 'SEU_PROCESSO_ID';
```

✅ **Sucesso**: `total_chunks` deve ser ~5 (para 3000 páginas)
❌ **Falha**: Se `total_chunks` > 10, chunks ainda estão com 300 páginas

### 4. Teste de Métricas

Após completar o processamento:

```sql
SELECT
  avg_chunk_processing_seconds,
  total_chunks_completed,
  (chunks_completed::float / total_chunks * 100) as completion_percent
FROM complex_processing_status
WHERE processo_id = 'SEU_PROCESSO_ID';
```

✅ **Esperado**:
- `avg_chunk_processing_seconds`: 240-360 segundos (4-6 min)
- `total_chunks_completed`: 5
- `completion_percent`: 100

### 5. Comparação Antes/Depois

| Métrica | Antes (300p/chunk) | Depois (600p/chunk + 5 workers) |
|---------|-------------------|----------------------------------|
| Total de chunks | 10 | 5 |
| Total de tarefas | 90 | 45 |
| Workers paralelos | 1 | 5 |
| Tempo estimado | 120 min | 10-15 min |
| Tempo médio/chunk | 2-3 min | 4-6 min |

### 6. Troubleshooting

#### Problema: Workers não estão rodando em paralelo

**Verificar**:
```sql
SELECT max_concurrent_workers, current_active_workers
FROM complex_processing_status
WHERE processo_id = 'SEU_PROCESSO_ID';
```

**Solução**:
- Se `max_concurrent_workers = 0`: A migration não foi aplicada
- Se `current_active_workers = 0`: Nenhum worker foi disparado

#### Problema: Processamento muito lento

**Verificar logs** de `process-complex-worker`:
- Procurar por erros de API Gemini
- Verificar se há rate limiting (429 errors)
- Confirmar que chunks estão ACTIVE no Gemini

**Solução**:
- Reduzir workers: `UPDATE complex_processing_status SET max_concurrent_workers = 3`
- Verificar configuração da API Gemini

#### Problema: Chunks ainda com 300 páginas

**Verificar** no código:
```typescript
// src/utils/pdfSplitter.ts
const CHUNK_SIZE_NORMAL = 600; // Deve ser 600, não 300
```

**Solução**:
- Rebuild: `npm run build`
- Clear cache do navegador
- Fazer novo upload

### 7. Teste de Carga (Opcional)

Para testar com múltiplos documentos:

1. Upload de 2-3 documentos de 3000 páginas simultaneamente
2. Verificar distribuição de workers:

```sql
SELECT
  processo_id,
  current_active_workers,
  max_concurrent_workers,
  current_phase
FROM complex_processing_status
WHERE current_phase IN ('processing', 'consolidating')
ORDER BY created_at DESC;
```

✅ **Esperado**: Workers distribuídos entre processos
⚠️ **Alerta**: Se um processo monopoliza todos os workers

### 8. Validação Final

Após o processamento completar:

1. ✅ Verificar que todos os 9 prompts foram processados
2. ✅ Verificar que análise está completa e visível no frontend
3. ✅ Verificar que não há chunks travados na fila
4. ✅ Verificar que workers foram desregistrados

```sql
-- Verificar análises completas
SELECT COUNT(*) as completed_analyses
FROM analysis_results
WHERE processo_id = 'SEU_PROCESSO_ID'
AND status = 'completed';
-- Deve retornar 9

-- Verificar se não há tarefas travadas
SELECT status, COUNT(*)
FROM processing_queue
WHERE processo_id = 'SEU_PROCESSO_ID'
GROUP BY status;
-- Todas devem estar 'completed'

-- Verificar workers desregistrados
SELECT current_active_workers
FROM complex_processing_status
WHERE processo_id = 'SEU_PROCESSO_ID';
-- Deve retornar 0
```

## Resultado Esperado

Para um documento de **3000 páginas**:

- ⏱️ **Tempo**: 10-15 minutos (vs 120 minutos antes)
- 📊 **Chunks**: 5 (vs 10 antes)
- 👷 **Workers**: 5 paralelos (vs 1 antes)
- ✅ **Taxa de sucesso**: >95%
- 🚀 **Ganho**: ~90% mais rápido

## Ajustes Recomendados

Se após o teste você observar:

**1. Processamento muito rápido (<8 minutos)**
- Aumentar workers para 8:
```sql
UPDATE complex_processing_status
SET max_concurrent_workers = 8
WHERE processo_id = 'SEU_PROCESSO_ID';
```

**2. Rate limiting da API Gemini**
- Reduzir workers para 3:
```sql
UPDATE complex_processing_status
SET max_concurrent_workers = 3
WHERE processo_id = 'SEU_PROCESSO_ID';
```

**3. Uso alto de memória**
- Reduzir tamanho dos chunks ou workers

## Próximos Passos

Após validar o teste:
1. Monitorar por 1-2 dias com documentos reais
2. Ajustar `max_concurrent_workers` conforme necessário
3. Implementar dashboard visual (opcional)
4. Considerar auto-scaling baseado em carga (opcional)
