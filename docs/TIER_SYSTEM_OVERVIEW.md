# Sistema Tier-Aware para Processamento de Arquivos Grandes

## 📋 Visão Geral

O **Sistema Tier-Aware** é uma arquitetura escalável projetada para processar arquivos PDF de qualquer tamanho (de 1 página até 100.000+ páginas) de forma eficiente, confiável e recuperável.

### 🎯 Problema Resolvido

**ANTES:** Arquivos grandes (>1000 páginas) falhavam por:
- Timeout dos workers (15 min fixo para todos os tamanhos)
- Falta de checkpoints (reinício do zero em caso de falha)
- Consolidação não escalável (tentava processar tudo de uma vez)
- Sem priorização (todos os processos tratados igualmente)

**DEPOIS:** Sistema inteligente que:
- ✅ Detecta automaticamente o tamanho do arquivo
- ✅ Aplica configurações específicas por tier (timeout, chunks, workers)
- ✅ Cria checkpoints regulares para recovery
- ✅ Usa consolidação hierárquica para arquivos massivos
- ✅ Permite rollback instantâneo via feature flags

---

## 🏗️ Arquitetura

### Níveis de Tier (5 tiers)

| Tier | Páginas | Timeout | Workers | Checkpoints | Hierarquia | Subdivisão |
|------|---------|---------|---------|-------------|------------|------------|
| **SMALL** | 1-1000 | 15min | 1 | ❌ | ❌ | ❌ |
| **MEDIUM** | 1001-2000 | 20min | 2 | ❌ | ❌ | ❌ |
| **LARGE** | 2001-5000 | 25min | 3 | ✅ | ✅ | ❌ |
| **VERY_LARGE** | 5001-10000 | 30min | 4 | ✅ | ✅ | ✅ |
| **MASSIVE** | 10001+ | 35min | 5 | ✅ | ✅ | ✅ |

### Fluxo de Processamento

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. UPLOAD DO PDF                                                │
│    └─> Usuário faz upload (Frontend → Supabase Storage)        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. DETECÇÃO DE TIER (tier-aware-chunking)                      │
│    └─> Conta páginas → Detecta tier → Aplica config            │
│    └─> Atualiza processos.tier_name                            │
│    └─> Cria checkpoint inicial (se tier >= LARGE)              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. VERIFICAÇÃO DE FEATURE FLAGS                                │
│    └─> Tier system enabled? → SIM/NÃO                          │
│    └─> Tier específico enabled? → SIM/NÃO                      │
│    └─> Se NÃO: usa fluxo legado (backward compatible)          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. ROTEAMENTO (start-analysis-unified)                         │
│    ├─> SMALL + flags OFF → start-analysis (legado rápido)      │
│    ├─> SMALL + flags ON → start-analysis (mantém fluxo)        │
│    └─> MEDIUM-MASSIVE → start-analysis-complex + tier-aware    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. PROCESSAMENTO PARALELO (tier-aware-worker)                  │
│    └─> N workers paralelos (N = tier.max_parallel_chunks)      │
│    └─> Cada worker:                                            │
│        ├─> Cria checkpoint (se tier >= LARGE)                  │
│        ├─> Processa chunk com timeout tier-specific            │
│        ├─> Atualiza métricas                                   │
│        └─> Envia heartbeat                                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. CONSOLIDAÇÃO (hierarchical-consolidation-worker)            │
│    ├─> SMALL/MEDIUM: Consolidação simples (1 nível)            │
│    └─> LARGE+: Consolidação hierárquica (múltiplos níveis)     │
│        └─> Nível 0: Chunks individuais                         │
│        └─> Nível 1: Grupos de 5 chunks                         │
│        └─> Nível 2: Grupos de branches                         │
│        └─> Nível 3: Resultado final                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 7. RECOVERY AUTOMÁTICO (unified-recovery-coordinator)          │
│    └─> Executa a cada 15 min via GitHub Actions                │
│    └─> Detecta processos travados com timeout tier-aware       │
│    └─> Respeita max_retries por tier                           │
│    └─> Reinicia automaticamente ou marca como failed           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🗄️ Tabelas do Sistema

### 1. `feature_flags`
**Controle de rollout gradual**

```sql
flag_name                    | enabled | enabled_for_users
-----------------------------|---------|-----------------
tier_system_enabled          | false   | []
tier_system_small            | false   | []
tier_system_medium           | false   | []
tier_system_large            | false   | []
tier_system_very_large       | false   | []
tier_system_massive          | false   | []
```

**Uso:**
- Habilitar para 1 admin: `enabled_for_users = ['<uuid>']`
- Habilitar para 5% users: SQL com sample aleatório
- Habilitar globalmente: `enabled = true`

### 2. `processing_tier_config`
**Configuração por tier**

Campos principais:
- `chunk_size_pages`: Tamanho do chunk em páginas
- `max_parallel_chunks`: Workers paralelos
- `timeout_minutes`: Timeout por chunk
- `consolidation_timeout_minutes`: Timeout consolidação
- `max_retries`: Tentativas máximas
- `requires_checkpointing`: Criar checkpoints?
- `subdivision_enabled`: Permitir subdivisão?

### 3. `consolidation_tree`
**Árvore de consolidação hierárquica**

Estrutura:
- `level 0`: Chunks individuais (50 chunks)
- `level 1`: Grupos de 5 chunks (10 nós)
- `level 2`: Grupos de branches (2 nós)
- `level 3`: Resultado final (1 nó raiz)

### 4. `processing_checkpoints`
**Pontos de recuperação**

Tipos:
- `chunking`: Checkpoint durante chunking
- `analysis`: Checkpoint durante análise
- `consolidation`: Checkpoint durante consolidação

Expiração: 7 dias (auto-cleanup)

### 5. `tier_processing_metrics`
**Métricas de performance**

Rastreamento:
- Duração total
- Chunks completados/failed/retried
- Níveis de consolidação usados
- Checkpoints criados
- Status final (completed/failed/timeout)

---

## 🔧 Edge Functions

### Entry Points

#### 1. `start-analysis-unified`
**Ponto de entrada unificado para TODAS as análises**

```typescript
// Fluxo de decisão
if (!tierSystemEnabled) {
  return legacyFlow();
}

const tier = detectTier(totalPages);

if (tier === 'SMALL' || !tierEnabled) {
  return legacyFlow(); // Mantém velocidade existente
}

return tierAwareFlow(); // Novo fluxo escalável
```

**Uso no frontend:**
```typescript
// ANTES
await supabase.functions.invoke('start-analysis', { processo_id });
await supabase.functions.invoke('start-analysis-complex', { processo_id });

// DEPOIS (unificado)
await supabase.functions.invoke('start-analysis-unified', { processo_id });
```

### Core Workers

#### 2. `tier-aware-chunking`
Detecta tier e aplica configuração

#### 3. `tier-aware-worker`
Wrapper que adiciona tier-awareness ao worker existente

#### 4. `hierarchical-consolidation-worker`
Consolidação em árvore para arquivos massivos

### Management

#### 5. `checkpoint-manager`
CRUD de checkpoints + cleanup

#### 6. `smart-subdivision`
Subdivide chunks grandes que falham

#### 7. `unified-recovery-coordinator`
Recovery unificado com tier-awareness

#### 8. `tier-analytics`
Métricas e recomendações de otimização

---

## 🚦 Feature Flags: Guia de Uso

### Estratégia de Rollout (12 semanas)

#### Semana 1-4: Staging
```sql
-- Staging: Apenas observação (nenhuma flag ativa)
SELECT * FROM feature_flags WHERE enabled = true;
-- Resultado: 0 rows
```

#### Semana 5-6: Produção (Tabelas Only)
```sql
-- Deploy migrations para prod
-- TODAS as flags ainda OFF
SELECT tier_name FROM processing_tier_config;
-- Resultado: 5 tiers configurados, nenhum ativo via flag
```

#### Semana 7-8: Produção (Functions Deployed)
```sql
-- Deploy functions para prod
-- TODAS as flags ainda OFF
-- Sistema novo existe mas não é usado
```

#### Semana 9: Canary (1 Admin User)
```sql
-- Habilitar para 1 admin user apenas
UPDATE feature_flags
SET enabled = true, enabled_for_users = ARRAY['<admin-uuid>']::UUID[]
WHERE flag_name = 'tier_system_enabled';

-- Habilitar tier MEDIUM para testes
UPDATE feature_flags
SET enabled = true
WHERE flag_name = 'tier_system_medium';
```

#### Semana 10: Beta (5% Users)
```sql
-- Selecionar 5% dos users aleatoriamente
WITH sample_users AS (
  SELECT id FROM user_profiles
  WHERE is_admin = false
  ORDER BY random()
  LIMIT (SELECT COUNT(*) * 0.05 FROM user_profiles WHERE is_admin = false)
)
UPDATE feature_flags
SET enabled_for_users = (SELECT array_agg(id) FROM sample_users)
WHERE flag_name = 'tier_system_enabled';

-- Habilitar tiers MEDIUM e LARGE
UPDATE feature_flags
SET enabled = true
WHERE flag_name IN ('tier_system_medium', 'tier_system_large');
```

#### Semana 11: Gradual Rollout
```sql
-- 25% → 50% → 75% → 100%
-- Aumentar enabled_for_users progressivamente
-- Ou habilitar globalmente:
UPDATE feature_flags
SET enabled = true, enabled_for_users = NULL
WHERE flag_name = 'tier_system_enabled';
```

#### Semana 12: Full Release
```sql
-- Habilitar todos os tiers
UPDATE feature_flags
SET enabled = true
WHERE flag_name LIKE 'tier_system_%';
```

### Rollback Instantâneo

**Rollback total (< 1 segundo):**
```sql
UPDATE feature_flags SET enabled = false WHERE flag_name = 'tier_system_enabled';
```

**Rollback de tier específico:**
```sql
UPDATE feature_flags SET enabled = false WHERE flag_name = 'tier_system_large';
```

---

## 📊 Monitoramento

### Queries Úteis

#### 1. Status atual do sistema
```sql
SELECT
  flag_name,
  enabled,
  array_length(enabled_for_users, 1) as user_count
FROM feature_flags
WHERE flag_name LIKE 'tier_system_%'
ORDER BY flag_name;
```

#### 2. Processos por tier (últimos 7 dias)
```sql
SELECT
  tier_name,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'completed') as completed,
  COUNT(*) FILTER (WHERE status = 'error') as failed,
  ROUND(AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/60), 2) as avg_minutes
FROM processos
WHERE created_at > NOW() - INTERVAL '7 days'
  AND tier_name IS NOT NULL
GROUP BY tier_name
ORDER BY tier_name;
```

#### 3. Métricas detalhadas por tier
```sql
SELECT
  tier_name,
  COUNT(*) as processes,
  AVG(duration_minutes) as avg_duration,
  AVG(total_retries) as avg_retries,
  COUNT(*) FILTER (WHERE final_status = 'completed') as completed,
  COUNT(*) FILTER (WHERE final_status = 'failed') as failed,
  ROUND(100.0 * COUNT(*) FILTER (WHERE final_status = 'completed') / COUNT(*), 2) as success_rate
FROM tier_processing_metrics
WHERE processing_started_at > NOW() - INTERVAL '7 days'
GROUP BY tier_name
ORDER BY tier_name;
```

#### 4. Checkpoints ativos
```sql
SELECT
  checkpoint_type,
  COUNT(*) as total,
  AVG(progress_percentage) as avg_progress
FROM processing_checkpoints
WHERE expires_at > NOW()
GROUP BY checkpoint_type;
```

#### 5. Consolidation tree stats
```sql
SELECT
  level,
  COUNT(*) as nodes,
  COUNT(*) FILTER (WHERE status = 'completed') as completed,
  COUNT(*) FILTER (WHERE status = 'failed') as failed
FROM consolidation_tree
GROUP BY level
ORDER BY level;
```

### Dashboard Recomendado

Métricas chave para acompanhar:
1. **Taxa de sucesso por tier** (objetivo: >95%)
2. **Tempo médio de processamento** (comparar com estimado)
3. **Taxa de retry** (objetivo: <1.5 por processo)
4. **Processos ativos por tier** (detectar bottlenecks)
5. **Checkpoints criados vs expirados** (eficiência do sistema)

---

## 🔒 Garantias de Segurança

### 1. Zero Breaking Changes
- ✅ SMALL tier (1-1000 páginas) usa fluxo legado
- ✅ Flags OFF = sistema legado 100%
- ✅ Todas as 32 functions existentes intocadas
- ✅ 291 migrations anteriores preservadas

### 2. Backward Compatibility
- ✅ Colunas novas são nullable
- ✅ Queries antigas continuam funcionando
- ✅ Frontend antigo continua funcionando
- ✅ Rollback não perde dados

### 3. Data Integrity
- ✅ Checkpoints salvam estado completo
- ✅ Métricas rastreiam tudo
- ✅ Recovery automático a cada 15 min
- ✅ Consolidation tree preserva todos os chunks

---

## 🧪 Testing

### Test Cases Obrigatórios

#### 1. Tier Detection
```typescript
// Test: SMALL tier detection
const processo = { total_pages: 500 };
const tier = detectTier(500);
assert(tier === 'SMALL');

// Test: LARGE tier detection
const tier = detectTier(3000);
assert(tier === 'LARGE');
```

#### 2. Feature Flags
```typescript
// Test: Flags OFF → Legacy flow
const result = await startAnalysisUnified(processo_id);
assert(result.flow === 'legacy_simple');

// Test: Flags ON → Tier-aware flow
const result = await startAnalysisUnified(processo_id);
assert(result.flow === 'tier_aware');
```

#### 3. Checkpoints
```typescript
// Test: Checkpoint creation for LARGE tier
const checkpoint = await createCheckpoint(processo_id, 'analysis');
assert(checkpoint !== null);

// Test: Checkpoint retrieval
const latest = await getLatestCheckpoint(processo_id);
assert(latest.progress_percentage > 0);
```

#### 4. Recovery
```typescript
// Test: Stuck process detection
const stuck = await findStuckProcesses();
assert(stuck.length >= 0);

// Test: Recovery with retry limit
const recovered = await recoverProcess(processo_id);
assert(recovered.action !== 'max_retries_exceeded');
```

---

## 📚 Referências

- **Migrations:** `supabase/migrations/20251205170000_*`
- **Functions:** `supabase/functions/{tier-aware-*,hierarchical-*,checkpoint-*}`
- **Workflow:** `.github/workflows/unified-tier-aware-recovery.yml`
- **Admin UI:** `src/pages/AdminTierManagementPage.tsx` (FASE 1)
- **Documentation:** Este arquivo + `docs/05-EDGE-FUNCTIONS.md`

---

## 🆘 Troubleshooting

### Problema: Processo travado no tier LARGE
**Solução:**
1. Verificar `complex_processing_status.last_heartbeat`
2. Se > timeout do tier, recovery automático vai pegar
3. Ou forçar recovery: `curl .../unified-recovery-coordinator`

### Problema: Tier não está sendo aplicado
**Solução:**
1. Verificar feature flags: `SELECT * FROM feature_flags WHERE flag_name LIKE 'tier%'`
2. Verificar se processo tem `tier_name`: `SELECT tier_name FROM processos WHERE id = '<id>'`
3. Verificar logs do `tier-aware-chunking`

### Problema: Consolidação falhando
**Solução:**
1. Verificar `consolidation_tree` para ver onde parou
2. Verificar se todos os chunks completaram: `SELECT status FROM process_chunks WHERE processo_id = '<id>'`
3. Tentar `hierarchical-consolidation-worker` manualmente

### Problema: Rollback não funcionou
**Solução:**
1. Verificar se flag foi desabilitada: `SELECT enabled FROM feature_flags WHERE flag_name = 'tier_system_enabled'`
2. Processos em andamento vão completar com tier-aware, novos usarão legado
3. Para forçar: restart dos workers

---

## ✅ Checklist de Deploy

**Pre-Deploy:**
- [ ] Backup do banco
- [ ] Feature flags criadas e OFF
- [ ] Tier configs populadas
- [ ] Indexes criados

**Deploy:**
- [ ] Migrations aplicadas
- [ ] Edge functions deployed
- [ ] Workflow ativado
- [ ] Admin UI deployada

**Post-Deploy:**
- [ ] Testar tier detection (staging)
- [ ] Testar feature flags ON/OFF
- [ ] Testar recovery manual
- [ ] Monitorar métricas 24h

**Rollout:**
- [ ] Canary (1 admin user)
- [ ] Beta (5% users)
- [ ] Gradual (25% → 50% → 75%)
- [ ] Full release (100%)
