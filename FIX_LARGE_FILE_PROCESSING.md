# Correção: Processamento de Arquivos Grandes Travado

## Problema Identificado

Arquivos com mais de 1000 páginas (7+ chunks) ficam travados em processamento infinito, com todos os cards mostrando apenas o spinner de loading.

### Causa Raiz

1. **Timeout da Edge Function**: A função `process-next-prompt` tenta processar todos os chunks sequencialmente dentro de uma única chamada, excedendo o timeout de 10-15 minutos das Edge Functions

2. **Prompts não consolidados**: O sistema usa duas estratégias:
   - Arquivos pequenos: `process-next-prompt` processa diretamente
   - Arquivos grandes: `process-complex-worker` → `processing_queue` → `consolidation-worker`

   No caso do processo `565e97f1-004e-4f4c-90fd-9f25c73cd1bd`:
   - ✅ 63 chunks foram processados com sucesso (7 chunks × 9 prompts)
   - ❌ `consolidation-worker` nunca foi disparado para combinar os resultados
   - ❌ `analysis_results` ficaram travados em status `running` por 15+ horas

3. **Erro de schema**: Edge Functions estavam usando colunas antigas:
   - ❌ `model_id` → ✅ `current_model_id`
   - ❌ `model_name` → ✅ `current_model_name`

## Correções Aplicadas

### 1. Edge Functions Corrigidas

#### `process-next-prompt/index.ts`
```typescript
// Linhas 512, 624, 811
- model_id: model.id,
- model_name: modelName,
+ current_model_id: model.id,
+ current_model_name: modelName,
```

#### `consolidation-worker/index.ts`
```typescript
// Linha 205-206
- model_id: model.id,
- model_name: model.name,
+ current_model_id: model.id,
+ current_model_name: model.name,
```

### 2. Processo Resetado

```sql
-- Resetar prompts travados
UPDATE analysis_results
SET
  status = 'pending',
  processing_at = NULL,
  error_message = 'Reset automático: prompt travado por mais de 15 horas'
WHERE processo_id = '565e97f1-004e-4f4c-90fd-9f25c73cd1bd'
  AND status = 'running';

-- Atualizar status do processo
UPDATE processos
SET status = 'analyzing'
WHERE id = '565e97f1-004e-4f4c-90fd-9f25c73cd1bd';
```

## Ações Necessárias

### 1. Deploy das Edge Functions (URGENTE)

```bash
# Deploy process-next-prompt
supabase functions deploy process-next-prompt --no-verify-jwt

# Deploy consolidation-worker
supabase functions deploy consolidation-worker --no-verify-jwt
```

### 2. Disparar Consolidação Manual

Para o processo `565e97f1-004e-4f4c-90fd-9f25c73cd1bd`, executar:

```bash
#!/bin/bash
PROCESSO_ID="565e97f1-004e-4f4c-90fd-9f25c73cd1bd"

# IDs dos prompts em ordem
PROMPTS=(
  "9065c2e6-5bf5-458f-88e8-0ab87ffe98bd"  # Visão Geral
  "1b15497a-5bb4-4385-8cb0-490923233342"  # Resumo Estratégico
  "73d1347a-328d-403f-8aa2-fa480b139b2e"  # Comunicações
  "0c384898-cd31-47c8-ab4a-c90a8334170d"  # Admissibilidade
  "67f2e124-4f61-42e0-821d-bd4dadf8c453"  # Estratégias
  "7cb0cecf-c501-4b27-930f-d1325df99ea6"  # Riscos
  "e008ca8f-f295-4ad7-8195-f24727a31802"  # Balanço
  "89299276-b853-4ef5-b266-b90453fb870b"  # Preclusões
  "548de98c-ad25-4d9c-a7e9-ccdd40a02bb0"  # Conclusões
)

for PROMPT_ID in "${PROMPTS[@]}"; do
  curl -X POST \
    "${SUPABASE_URL}/functions/v1/consolidation-worker" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"processo_id\": \"${PROCESSO_ID}\", \"prompt_id\": \"${PROMPT_ID}\"}" &
  sleep 2
done

wait
echo "✅ Consolidação disparada para todos os prompts"
```

## Melhorias Futuras Recomendadas

1. **Auto-trigger de consolidação**: O `process-complex-worker` deveria disparar automaticamente o `consolidation-worker` quando todos os chunks de um prompt forem processados

2. **Detection de stuck prompts**: Criar uma Edge Function agendada (cron) para detectar e resetar prompts travados automaticamente após 30 minutos

3. **Melhor feedback no frontend**: Mostrar status real do processamento:
   - Chunks processados: X/7
   - Aguardando consolidação
   - Consolidando resultados

4. **Timeout configurável**: Permitir configurar timeout por tipo de análise

## Status Atual

- ✅ Frontend buildado com sucesso
- ✅ Código corrigido localmente
- ⏳ **PENDENTE**: Deploy das Edge Functions
- ⏳ **PENDENTE**: Disparar consolidação manual
- ⏳ **PENDENTE**: Testar com novo arquivo grande

## Verificação

Após deploy e consolidação, verificar:

```sql
-- Ver status dos prompts
SELECT
  prompt_title,
  execution_order,
  status,
  LENGTH(result_content) as content_length,
  completed_at
FROM analysis_results
WHERE processo_id = '565e97f1-004e-4f4c-90fd-9f25c73cd1bd'
ORDER BY execution_order;

-- Ver chunks processados
SELECT
  COUNT(*) as total,
  COUNT(CASE WHEN result_data IS NOT NULL THEN 1 END) as with_results
FROM processing_queue
WHERE processo_id = '565e97f1-004e-4f4c-90fd-9f25c73cd1bd';
```

Resultado esperado:
- ✅ 9 prompts com status `completed`
- ✅ 9 prompts com `result_content` preenchido
- ✅ Processo com status `completed`
- ✅ Cards mostram conteúdo ao invés de spinner
