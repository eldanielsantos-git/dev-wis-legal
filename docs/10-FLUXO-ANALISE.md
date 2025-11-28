# 10 - Fluxo Completo de Análise

## 📋 Visão Geral

Este documento detalha o fluxo end-to-end de processamento e análise de um documento jurídico no WisLegal, desde o upload inicial até a análise forense completa.

## 🔄 Diagrama de Fluxo Completo

```
┌──────────────────┐
│  1. User Upload  │
└────────┬─────────┘
         │
         ↓
┌──────────────────────────────┐
│  2. Frontend Validation      │
│  - Formato (PDF only)        │
│  - Tamanho máximo            │
│  - Contagem de páginas       │
└────────┬─────────────────────┘
         │
         ↓
┌──────────────────────────────┐
│  3. Create Processo Record   │
│  - Status: 'uploading'       │
│  - Gerar UUID                │
│  - Associar user_id          │
└────────┬─────────────────────┘
         │
         ├───────────────┬──────────────────┐
         │               │                  │
         ↓               ↓                  ↓
    Pequeno         Médio               Grande
    (<50MB)        (50-500MB)         (>500MB)
         │               │                  │
         ↓               ↓                  ↓
   Upload Direto   Upload Direto      Chunking
   para GCS        para GCS           Inteligente
         │               │                  │
         └───────────────┴──────────────────┘
                        │
                        ↓
┌──────────────────────────────────────┐
│  4. Storage & Database               │
│  - Upload para Google Cloud Storage  │
│  - Converter para Base64             │
│  - Armazenar no PostgreSQL           │
│  - Status: 'created'                 │
└────────┬─────────────────────────────┘
         │
         ↓
┌──────────────────────────────────────┐
│  5. Edge Function: start-analysis    │
│  - Validar processo                  │
│  - Status: 'analyzing'               │
└────────┬─────────────────────────────┘
         │
         ↓
┌──────────────────────────────────────┐
│  6. Upload para Gemini File API      │
│  - POST para /upload/v1beta/files    │
│  - Aguardar state = 'ACTIVE'         │
│  - Salvar file_uri no banco          │
└────────┬─────────────────────────────┘
         │
         ↓
┌──────────────────────────────────────┐
│  7. Loop: process-next-prompt        │
│  (Executado 9 vezes sequencialmente) │
│                                       │
│  Para cada prompt:                   │
│  ┌────────────────────────────────┐  │
│  │ 7.1. Buscar próximo prompt     │  │
│  │ 7.2. Carregar modelo ativo     │  │
│  │ 7.3. Chamar Gemini API         │  │
│  │ 7.4. Parsing JSON (5 tentativas)│ │
│  │ 7.5. Salvar resultado          │  │
│  │ 7.6. Atualizar progresso       │  │
│  │ 7.7. Debitar tokens            │  │
│  │ 7.8. Criar notificação         │  │
│  └────────────────────────────────┘  │
└────────┬─────────────────────────────┘
         │
         ↓
┌──────────────────────────────────────┐
│  8. Finalização                      │
│  - Status: 'completed'               │
│  - analysis_completed_at = NOW()     │
│  - Notificação ao usuário            │
│  - Análise disponível                │
└──────────────────────────────────────┘
```

## 📝 Detalhamento por Etapa

### Etapa 1: User Upload

**Componente:** `FileUpload.tsx`

**Ações do Usuário:**
1. Clica em "Novo Processo" ou área de upload
2. Seleciona arquivo PDF (ou drag & drop)
3. Confirma upload

**Validações Frontend:**
```typescript
// Formato
if (!file.type.includes('pdf')) {
  throw new Error('Apenas arquivos PDF são aceitos');
}

// Tamanho (3GB máximo)
if (file.size > 3 * 1024 * 1024 * 1024) {
  throw new Error('Arquivo muito grande (máx 3GB)');
}

// Contagem de páginas
const pageCount = await countPdfPages(file);
if (pageCount === 0) {
  throw new Error('PDF inválido ou vazio');
}
```

### Etapa 2: Frontend Validation

**Serviço:** `ProcessosService.ts`

**Método:** `countPdfPages(file: File)`

```typescript
const arrayBuffer = await file.arrayBuffer();
const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
return pdf.numPages;
```

**Decisão de Estratégia:**
```typescript
if (pageCount <= 50) {
  strategy = 'direct_upload';
} else if (pageCount <= 1000) {
  strategy = 'standard_upload';
} else {
  strategy = 'chunked_upload';
  chunksCount = Math.ceil(pageCount / 1000);
}
```

### Etapa 3: Create Processo Record

**Método:** `ProcessosService.uploadAndStartProcessing()`

**SQL Executado:**
```sql
INSERT INTO processos (
  id,
  user_id,
  file_name,
  file_size,
  status,
  transcricao
) VALUES (
  $1,  -- UUID gerado
  $2,  -- user.id do auth
  $3,  -- file.name
  $4,  -- file.size
  'uploading',
  jsonb_build_object('totalPages', $5)
);
```

### Etapa 4: Storage & Database

**Upload para GCS:**
```typescript
const fileName = `${user.id}/${Date.now()}-${sanitizedFileName}`;

const { data, error } = await supabase.storage
  .from('processos')
  .upload(fileName, file, {
    cacheControl: '3600',
    upsert: false
  });
```

**Conversão Base64:**
```typescript
const reader = new FileReader();
reader.readAsDataURL(file);
const base64 = reader.result.split(',')[1];
```

**Estratégia de Armazenamento:**

#### Arquivos Pequenos (<50MB)
```sql
UPDATE processos
SET
  pdf_base64 = $1,
  is_chunked = FALSE
WHERE id = $2;
```

#### Arquivos Grandes (>50MB)
```sql
-- Divide em chunks de 40MB
INSERT INTO pdf_chunks (processo_id, chunk_number, chunk_data)
VALUES
  ($1, 1, $2),
  ($1, 2, $3),
  ...;

UPDATE processos
SET
  is_chunked = TRUE,
  total_chunks = $N
WHERE id = $1;
```

### Etapa 5: Edge Function - start-analysis

**Arquivo:** `supabase/functions/start-analysis/index.ts`

**Validações:**
```typescript
// 1. Processo existe?
const { data: processo } = await supabase
  .from('processos')
  .select('*')
  .eq('id', processo_id)
  .single();

if (!processo) {
  throw new Error('Processo não encontrado');
}

// 2. Status correto?
if (processo.status !== 'created') {
  throw new Error('Processo já está sendo processado');
}

// 3. Usuário tem tokens?
const hasTokens = await checkTokenAvailability(
  processo.user_id,
  ESTIMATED_TOKENS
);

if (!hasTokens) {
  throw new Error('Tokens insuficientes');
}
```

**Atualização de Status:**
```sql
UPDATE processos
SET
  status = 'analyzing',
  analysis_started_at = NOW(),
  total_prompts = 9
WHERE id = $1;
```

### Etapa 6: Upload para Gemini File API

**Arquivo:** `supabase/functions/upload-to-gemini/index.ts`

**Processo:**
```typescript
// 1. Recuperar PDF
let pdfBuffer: ArrayBuffer;

if (processo.is_chunked) {
  // Reconstituir de chunks
  const { data: chunks } = await supabase
    .from('pdf_chunks')
    .select('chunk_data')
    .eq('processo_id', processo_id)
    .order('chunk_number');

  const base64 = chunks.map(c => c.chunk_data).join('');
  pdfBuffer = Buffer.from(base64, 'base64');
} else {
  // Direto do campo
  pdfBuffer = Buffer.from(processo.pdf_base64, 'base64');
}

// 2. Upload para Gemini
const formData = new FormData();
formData.append('file', new Blob([pdfBuffer]), 'processo.pdf');

const response = await fetch(
  `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
  { method: 'POST', body: formData }
);

const { file } = await response.json();

// 3. Polling até ACTIVE
while (file.state === 'PROCESSING') {
  await new Promise(r => setTimeout(r, 2000));

  const statusResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/${file.name}?key=${apiKey}`
  );
  const status = await statusResponse.json();

  if (status.state === 'ACTIVE') break;
  if (status.state === 'FAILED') throw new Error('Upload falhou');
}

// 4. Salvar URI
await supabase
  .from('processos')
  .update({
    gemini_file_uri: file.uri,
    gemini_file_name: file.name
  })
  .eq('id', processo_id);
```

### Etapa 7: Loop - process-next-prompt

**Arquivo:** `supabase/functions/process-next-prompt/index.ts`

**Executado 9 vezes sequencialmente** (um prompt por vez)

#### 7.1. Buscar Próximo Prompt

```sql
SELECT *
FROM analysis_prompts
WHERE is_active = TRUE
  AND execution_order = (
    SELECT current_prompt_number + 1
    FROM processos
    WHERE id = $1
  )
ORDER BY execution_order
LIMIT 1;
```

#### 7.2. Carregar Modelo Ativo

```sql
SELECT *
FROM admin_system_models
WHERE is_active = TRUE
ORDER BY priority DESC
LIMIT 1;
```

#### 7.3. Chamar Gemini API

```typescript
const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [
          { fileData: { fileUri: gemini_file_uri } },
          { text: prompt.content }
        ]
      }],
      generationConfig: {
        temperature: 0.2,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json'
      }
    })
  }
);

const result = await response.json();
const textResponse = result.candidates[0].content.parts[0].text;
```

#### 7.4. Parsing JSON (5 Estratégias)

```typescript
function parseJSONResponse(text: string): any {
  // Estratégia 1: JSON puro
  try {
    return JSON.parse(text);
  } catch {}

  // Estratégia 2: Remove markdown
  try {
    const cleaned = text.replace(/```json\n?|\n?```/g, '');
    return JSON.parse(cleaned);
  } catch {}

  // Estratégia 3: Extrai primeiro objeto
  try {
    const match = text.match(/\{[\s\S]*\}/);
    return JSON.parse(match[0]);
  } catch {}

  // Estratégia 4: Extrai até citations_index
  try {
    const match = text.match(/\{[\s\S]*"citations_index"[\s\S]*?\]/);
    return JSON.parse(match[0] + '}');
  } catch {}

  // Estratégia 5: Fallback
  return {
    error: 'Parsing failed',
    raw_response: text.substring(0, 500)
  };
}
```

#### 7.5. Salvar Resultado

```sql
INSERT INTO analysis_results (
  processo_id,
  prompt_id,
  execution_order,
  result,
  status,
  model_name,
  tokens_used,
  execution_time_ms
) VALUES ($1, $2, $3, $4, 'completed', $5, $6, $7);

-- Também atualiza campo legacy no processos
UPDATE processos
SET
  visao_geral_processo = $result  -- se execution_order = 1
WHERE id = $processo_id;
```

#### 7.6. Atualizar Progresso

```sql
UPDATE processos
SET
  current_prompt_number = current_prompt_number + 1,
  updated_at = NOW()
WHERE id = $1;
```

#### 7.7. Debitar Tokens

```sql
-- Atualiza subscription
UPDATE stripe_subscriptions
SET tokens_used = tokens_used + $tokens
WHERE customer_id = (
  SELECT customer_id FROM stripe_customers
  WHERE user_id = $user_id
);

-- Log de auditoria
INSERT INTO token_usage_logs (
  user_id,
  processo_id,
  operation_type,
  tokens_used,
  model_name
) VALUES ($1, $2, 'analysis', $3, $4);
```

#### 7.8. Notificação (se último prompt)

```sql
-- Se current_prompt_number = total_prompts
INSERT INTO notifications (
  user_id,
  type,
  message,
  processo_id
) VALUES (
  $user_id,
  'success',
  'Análise concluída: ' || $file_name,
  $processo_id
);
```

### Etapa 8: Finalização

**Quando:** `current_prompt_number = total_prompts`

**SQL:**
```sql
UPDATE processos
SET
  status = 'completed',
  analysis_completed_at = NOW()
WHERE id = $1;
```

**Notificação Push:**
```typescript
// Via Supabase Realtime
// Frontend recebe automaticamente via subscription
```

**Som de Notificação:**
```typescript
// Frontend: notificationSound.ts
const audio = new Audio('/notification.mp3');
audio.play();
```

## ⏱️ Tempo de Processamento

### Por Tamanho de Documento

| Páginas | Tier | Upload | OCR | Análise IA | Total |
|---------|------|--------|-----|------------|-------|
| 1-50 | T1 | 5s | - | 2min | ~2min |
| 51-200 | T2 | 10s | - | 3min | ~3min |
| 201-500 | T3 | 20s | - | 4min | ~4.5min |
| 501-1000 | T4 | 40s | - | 5min | ~6min |
| 1001-5000 | T5 | 2min | - | 10min | ~12min |

## 🔄 Fluxo de Retry

### Em Caso de Falha

```typescript
// process-next-prompt com retry
for (let attempt = 1; attempt <= 3; attempt++) {
  try {
    await processPrompt();
    break; // Sucesso
  } catch (error) {
    if (attempt === 3) {
      // Marca como erro após 3 tentativas
      await markAsError(error);
    } else {
      // Aguarda antes de retentar (backoff exponencial)
      await sleep(1000 * attempt);
    }
  }
}
```

## 🔗 Próximos Documentos

- **[11-SISTEMA-PROMPTS.md](./11-SISTEMA-PROMPTS.md)** - Prompts de IA
- **[06-INTEGRACOES-GCP.md](./06-INTEGRACOES-GCP.md)** - Google Cloud

---

**Fluxo completo: Upload → Análise → Insights**
