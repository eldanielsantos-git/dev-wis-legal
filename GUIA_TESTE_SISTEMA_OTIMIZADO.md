# 🧪 Guia de Teste - Sistema Otimizado para Arquivos Grandes

## 🎯 Objetivo
Testar o novo sistema de processamento com chunks otimizados (6 tiers) e auto-recovery.

---

## 📋 PASSO 1: Deletar Processo Antigo

### No Supabase SQL Editor:

```sql
-- Execute: DELETE_PROCESSO_8f2904f8.sql
-- Ou copie e cole o script abaixo:

DELETE FROM process_chunks WHERE processo_id = '8f2904f8-9245-45ca-8a63-72d37efbf3ec';
DELETE FROM processing_queue WHERE processo_id = '8f2904f8-9245-45ca-8a63-72d37efbf3ec';
DELETE FROM complex_processing_status WHERE processo_id = '8f2904f8-9245-45ca-8a63-72d37efbf3ec';
DELETE FROM analysis_results WHERE processo_id = '8f2904f8-9245-45ca-8a63-72d37efbf3ec';
DELETE FROM chat_messages WHERE processo_id = '8f2904f8-9245-45ca-8a63-72d37efbf3ec';
DELETE FROM processos WHERE id = '8f2904f8-9245-45ca-8a63-72d37efbf3ec';

-- Verificar (deve retornar 0):
SELECT COUNT(*) FROM processos WHERE id = '8f2904f8-9245-45ca-8a63-72d37efbf3ec';
```

✅ **Resultado esperado:** `0 processos restantes`

---

## 📤 PASSO 2: Upload de Novo Arquivo

### Teste Recomendado - Arquivo Médio (Tier 2):

**Tamanho ideal:** 2.000 - 5.000 páginas

**Por que começar com Tier 2?**
- ✅ Rápido o suficiente (~1-2 horas)
- ✅ Complexo o suficiente para testar chunks
- ✅ Valida auto-recovery
- ✅ Confirma sistema funcionando

**Configuração esperada:**
```
Arquivo: 3.500 páginas
├─ Tier: T2 (2k-5k páginas)
├─ Chunk Size: 150 páginas
├─ Overlap: 30 páginas
├─ Total Chunks: ~24 chunks
├─ Tokens/Chunk: ~225.000 (seguro!)
└─ Tempo Estimado: 1-1.5 horas
```

---

## 🔍 PASSO 3: Monitorar Processamento

### 3.1. Verificar Criação de Chunks

```sql
-- Ver chunks criados
SELECT
  id,
  chunk_index,
  start_page,
  end_page,
  pages_count,
  status,
  token_validation_status,
  estimated_tokens
FROM process_chunks
WHERE processo_id = 'SEU_PROCESSO_ID'
ORDER BY chunk_index;
```

**O que verificar:**
- ✅ `token_validation_status` = `'valid'` (todos os chunks)
- ✅ `estimated_tokens` < 850.000 (margem de segurança)
- ✅ `pages_count` = ~150 páginas por chunk

---

### 3.2. Acompanhar Status do Processo

```sql
-- Status geral
SELECT
  id,
  file_name,
  status,
  current_prompt_number,
  total_prompts,
  transcricao->>'totalPages' as total_pages,
  analysis_started_at,
  AGE(NOW(), analysis_started_at) as tempo_decorrido
FROM processos
WHERE id = 'SEU_PROCESSO_ID';
```

**Estados esperados:**
1. `uploading` → Upload do arquivo
2. `queued` → Chunks sendo criados
3. `analyzing` → Processamento em andamento
4. `completed` → ✅ Finalizado!

---

### 3.3. Monitorar Fila de Processamento

```sql
-- Ver progresso da fila
SELECT
  status,
  COUNT(*) as quantidade
FROM processing_queue
WHERE processo_id = 'SEU_PROCESSO_ID'
GROUP BY status;
```

**Distribuição esperada:**
```
pending      | X chunks aguardando
processing   | 3-5 workers ativos
completed    | Y chunks finalizados
dead_letter  | 0 (idealmente!)
```

---

### 3.4. Health Check Detalhado

```sql
-- Status complexo (se aplicável)
SELECT
  processo_id,
  current_phase,
  chunks_completed,
  total_chunks,
  overall_progress_percent,
  is_healthy,
  last_heartbeat,
  AGE(NOW(), last_heartbeat) as tempo_sem_heartbeat
FROM complex_processing_status
WHERE processo_id = 'SEU_PROCESSO_ID';
```

**Sinais de saúde:**
- ✅ `is_healthy` = true
- ✅ `tempo_sem_heartbeat` < 5 minutos
- ✅ `overall_progress_percent` aumentando

---

## 🚨 PASSO 4: Testar Auto-Recovery (Opcional)

Se quiser forçar um teste de recovery:

```sql
-- Forçar um chunk para 'exceeded' (simular erro)
UPDATE process_chunks
SET
  token_validation_status = 'exceeded',
  status = 'failed',
  error_message = 'Teste de auto-recovery'
WHERE processo_id = 'SEU_PROCESSO_ID'
  AND chunk_index = 0
LIMIT 1;
```

**O que deve acontecer:**
1. ⏰ Aguardar até 3 minutos
2. 🤖 GitHub Action detecta
3. ✂️ Edge function `auto-restart-failed-chunks` subdivide
4. 🔄 Novos sub-chunks de 80 páginas criados
5. 🚀 Workers retomam processamento

**Verificar subdivisão:**
```sql
-- Ver sub-chunks criados
SELECT
  id,
  chunk_index,
  subdivision_index,
  start_page,
  end_page,
  pages_count,
  status,
  subdivision_parent_id
FROM process_chunks
WHERE processo_id = 'SEU_PROCESSO_ID'
  AND subdivision_parent_id IS NOT NULL;
```

---

## 📊 PASSO 5: Verificar Logs

### 5.1. Logs das Edge Functions

**Supabase Dashboard:**
```
Edge Functions → process-complex-worker → Logs
Edge Functions → auto-restart-failed-chunks → Logs
Edge Functions → consolidation-worker → Logs
```

### 5.2. GitHub Actions

**Repositório → Actions:**
```
Monitor Complex Health Check (5 min)
Monitor Complex Recovery (10 min)
Monitor Auto Restart Failed (3 min)
```

**O que procurar:**
- ✅ Execuções regulares (sem falhas)
- ✅ Logs mostrando "Nenhum chunk com erro" (sinal positivo!)
- ✅ Workers disparados quando necessário

---

## ✅ PASSO 6: Confirmar Conclusão

### Verificar Processo Completo:

```sql
-- Resultado final
SELECT
  id,
  file_name,
  status,
  current_prompt_number,
  total_prompts,
  transcricao->>'totalPages' as total_pages,
  analysis_started_at,
  analysis_completed_at,
  AGE(analysis_completed_at, analysis_started_at) as tempo_total
FROM processos
WHERE id = 'SEU_PROCESSO_ID';
```

**Status esperado:** `completed` ✅

### Verificar Resultados de Análise:

```sql
-- Ver análises geradas
SELECT
  prompt_id,
  prompt_name,
  status,
  LENGTH(content) as tamanho_conteudo,
  processing_at
FROM analysis_results
WHERE processo_id = 'SEU_PROCESSO_ID'
ORDER BY prompt_id;
```

**O que verificar:**
- ✅ Todos os prompts com `status = 'completed'`
- ✅ Conteúdo gerado (tamanho > 0)
- ✅ Timestamps de processamento preenchidos

---

## 📈 Testes Progressivos Recomendados

### **Fase 1: Validação Básica** ✅
- Arquivo: 2.000-5.000 páginas (Tier 2)
- Objetivo: Confirmar sistema funcionando
- Tempo: 1-2 horas

### **Fase 2: Teste Médio** 🎯
- Arquivo: 5.000-10.000 páginas (Tier 3)
- Objetivo: Testar chunks menores (120 pgs)
- Tempo: 3-5 horas

### **Fase 3: Teste Grande** 🚀
- Arquivo: 15.000-25.000 páginas (Tier 4)
- Objetivo: Validar auto-recovery em escala
- Tempo: 8-12 horas

### **Fase 4: Teste Ultra (Opcional)** 💪
- Arquivo: 50.000+ páginas (Tier 5)
- Objetivo: Stress test do sistema
- Tempo: 20-30 horas
- ⚠️ Apenas se necessário!

---

## 🎯 Checklist de Sucesso

Após o teste, confirme:

- [ ] Processo criado sem erros
- [ ] Chunks com `token_validation_status = 'valid'`
- [ ] Processamento iniciou automaticamente
- [ ] Workers paralelos funcionando
- [ ] GitHub Actions executando regularmente
- [ ] Sem chunks em `dead_letter` queue
- [ ] Processo concluído com `status = 'completed'`
- [ ] Análises geradas corretamente
- [ ] Tempo de processamento dentro do esperado
- [ ] Zero intervenção manual necessária

---

## 🐛 Troubleshooting

### Problema: Chunks com status 'exceeded'

**Solução:**
- ✅ Aguardar 3 minutos
- ✅ GitHub Action detectará automaticamente
- ✅ Edge function subdividirá em 80 páginas

### Problema: Processo travado (sem progresso)

**Verificar:**
```sql
SELECT
  AGE(NOW(), last_heartbeat) as tempo_sem_heartbeat
FROM complex_processing_status
WHERE processo_id = 'SEU_PROCESSO_ID';
```

**Se > 10 minutos:**
- ✅ GitHub Action `monitor-complex-recovery` reiniciará automaticamente

### Problema: Workers não estão processando

**Verificar fila:**
```sql
SELECT status, COUNT(*)
FROM processing_queue
WHERE processo_id = 'SEU_PROCESSO_ID'
GROUP BY status;
```

**Disparar worker manualmente:**
```bash
curl -X POST \
  "$SUPABASE_URL/functions/v1/process-complex-worker" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"processo_id": "SEU_PROCESSO_ID"}'
```

---

## 📞 Suporte

Se encontrar problemas não cobertos por este guia:

1. **Verificar logs das Edge Functions** no Supabase Dashboard
2. **Verificar GitHub Actions** no repositório
3. **Executar queries de diagnóstico** acima
4. **Verificar documentação:** `ULTRA_LARGE_FILES_CONFIGURATION.md`

---

## 🎉 Resultado Esperado

**Sistema 100% automático:**
- ✅ Upload → Chunks → Processamento → Consolidação → Conclusão
- ✅ Zero intervenção manual
- ✅ Auto-recovery para qualquer problema
- ✅ Notificação ao usuário quando concluído

**Boa sorte com o teste!** 🚀

---

**Última atualização:** 2025-12-03
**Versão do Sistema:** 3.0.0 - Ultra Large Files Support
