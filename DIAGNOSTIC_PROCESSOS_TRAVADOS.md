# 🔍 Diagnóstico: Processos Travados em Loading

## ❌ Problema Confirmado

### Processos Afetados
```
a6d25c4e-af8b-4346-b891-b87d58fee82a
04b00ab1-502e-4a9d-a10d-35f40d6b01a3  
a2435445-9123-42b0-9f57-2e37f9903321
```

### Estado Atual no Banco
```sql
✅ processo.status = 'created'
✅ pdf_base64 disponível  
✅ 9 analysis_results criados
❌ Todos em 'pending' ou 'running' SEM conteúdo
❌ Cards mostram loading infinito no frontend
```

## 🎯 Causa Mais Provável

### GEMINI_API_KEY Não Configurada

A edge function `process-next-prompt` precisa da variável de ambiente `GEMINI_API_KEY` configurada como **secret** no Supabase.

**Sintoma:**
- Edge function inicia
- Adquire lock (muda para 'running')
- Tenta chamar Gemini API
- **Falha silenciosamente** (sem API key)
- Nunca completa
- Nunca libera o lock

## ✅ SOLUÇÃO DEFINITIVA

### Passo 1: Configurar GEMINI_API_KEY no Supabase

1. **Acesse o Supabase Dashboard:**
   - URL: https://supabase.com/dashboard/project/zvlqcxiwsrziuodiotar

2. **Vá para Edge Functions → Secrets:**
   - Menu lateral esquerdo: "Edge Functions"
   - Aba: "Secrets"

3. **Adicione o Secret:**
   ```
   Nome: GEMINI_API_KEY
   Valor: [SUA_API_KEY_DO_GEMINI]
   ```

4. **Salve e aguarde ~30 segundos** para propagar

### Passo 2: Limpar Processos Travados

Execute este SQL no Supabase SQL Editor:

```sql
-- Resetar completamente os 3 processos
UPDATE analysis_results
SET 
  status = 'pending',
  processing_at = NULL,
  completed_at = NULL,
  result_content = NULL,
  tokens_used = NULL,
  execution_time_ms = NULL,
  current_model_id = NULL,
  current_model_name = NULL,
  attempt_count = 0,
  failed_models = '[]'::jsonb,
  model_switched_at = NULL,
  error_message = NULL
WHERE processo_id IN (
  'a6d25c4e-af8b-4346-b891-b87d58fee82a',
  '04b00ab1-502e-4a9d-a10d-35f40d6b01a3',
  'a2435445-9123-42b0-9f57-2e37f9903321'
);

-- Resetar status dos processos
UPDATE processos
SET 
  status = 'created',
  analysis_started_at = NULL,
  analysis_completed_at = NULL,
  current_llm_model_id = NULL,
  current_llm_model_name = NULL,
  llm_model_switching = false,
  llm_switch_reason = NULL
WHERE id IN (
  'a6d25c4e-af8b-4346-b891-b87d58fee82a',
  '04b00ab1-502e-4a9d-a10d-35f40d6b01a3',
  'a2435445-9123-42b0-9f57-2e37f9903321'
);
```

### Passo 3: Reprocessar

1. **Acesse a página de detalhes** de um dos processos
2. O frontend automaticamente detecta `status = 'created'`
3. Chama `start-analysis`
4. Processamento inicia com a API key configurada
5. Cards desbloqueiam progressivamente

## 🔬 Como Verificar se API Key Está Configurada

No Supabase Dashboard:
- Edge Functions → Secrets
- Deve aparecer: `GEMINI_API_KEY` na lista

## 🚨 Problema Alternativo: Timeout

Se a API key estiver configurada mas ainda travar, pode ser timeout.

### Solução para Timeout:

Os processos são **pequenos** (< 1000 páginas), então usam **base64 inline**.

**Possível problema:**
- PDF muito grande para processar em 60 segundos
- Gemini API lenta

**Solução:**
1. Aguarde mais tempo (até 3 minutos por prompt)
2. Ou force uso da File API:

```sql
-- Forçar uso da File API (mais rápida)
UPDATE processos
SET 
  gemini_file_uri = 'placeholder',
  gemini_file_state = 'PENDING'
WHERE id IN (
  'a6d25c4e-af8b-4346-b891-b87d58fee82a',
  '04b00ab1-502e-4a9d-a10d-35f40d6b01a3',
  'a2435445-9123-42b0-9f57-2e37f9903321'
);
```

Depois chame a edge function `upload-to-gemini` para cada processo.

## 📊 Checklist de Diagnóstico

Execute estas queries para diagnosticar:

### 1. Estado dos Processos
```sql
SELECT 
  id,
  status,
  CASE WHEN pdf_base64 IS NULL THEN 'NO_PDF' ELSE 'HAS_PDF' END as pdf_status,
  gemini_file_uri IS NOT NULL as has_file_api
FROM processos
WHERE id IN (
  'a6d25c4e-af8b-4346-b891-b87d58fee82a',
  '04b00ab1-502e-4a9d-a10d-35f40d6b01a3',
  'a2435445-9123-42b0-9f57-2e37f9903321'
);
```

### 2. Estado dos Analysis Results
```sql
SELECT 
  processo_id,
  COUNT(*) as total,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
  COUNT(CASE WHEN status = 'running' THEN 1 END) as running,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
  COUNT(CASE WHEN result_content IS NOT NULL THEN 1 END) as with_content
FROM analysis_results
WHERE processo_id IN (
  'a6d25c4e-af8b-4346-b891-b87d58fee82a',
  '04b00ab1-502e-4a9d-a10d-35f40d6b01a3',
  'a2435445-9123-42b0-9f57-2e37f9903321'
)
GROUP BY processo_id;
```

### 3. Verificar Execuções (logs)
```sql
SELECT 
  processo_id,
  model_name,
  status,
  error_message,
  created_at
FROM analysis_executions
WHERE processo_id IN (
  'a6d25c4e-af8b-4346-b891-b87d58fee82a',
  '04b00ab1-502e-4a9d-a10d-35f40d6b01a3',
  'a2435445-9123-42b0-9f57-2e37f9903321'
)
ORDER BY created_at DESC
LIMIT 20;
```

## ✅ Resultado Esperado

Após configurar API key e reprocessar:

1. **Cards processam sequencialmente:**
   - Card 1: ⏳ Loading → ✅ Completado (clicável)
   - Card 2: 🔒 Bloqueado → ⏳ Loading → ✅ Completado
   - Card 3: 🔒 Bloqueado → ⏳ Loading → ✅ Completado
   - ...até Card 9

2. **Processo finaliza:**
   - Status muda para 'completed'
   - Todos os cards ficam disponíveis
   - Conteúdo visível

## 📞 Suporte

Se o problema persistir após configurar a API key:

1. Verifique logs no Supabase Dashboard:
   - Edge Functions → process-next-prompt → Logs
   
2. Procure por erros tipo:
   - "Missing Authorization"
   - "API key not valid"
   - "Timeout"
   - "Resource exhausted"

3. Compartilhe os logs para análise mais detalhada

---

**Próxima Ação:** Configure a GEMINI_API_KEY no Supabase e execute o SQL de reset.
