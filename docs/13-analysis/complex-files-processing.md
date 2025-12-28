# Processamento de Arquivos Complexos (acima de 1.000 paginas)

## Visao Geral da Arquitetura

Este documento descreve detalhadamente o fluxo completo de processamento de arquivos PDF com mais de 1.000 paginas. Estes arquivos sao classificados em diferentes **Tiers** (MEDIUM, LARGE, VERY_LARGE, HIGH_LARGE, ULTRA_LARGE) e utilizam um pipeline avancado com chunking, processamento paralelo, filas de trabalho e consolidacao de resultados.

---

## 1. Sistema de Tiers

### 1.1. Classificacao de Tiers

| Tier | Paginas | Chunk Size | Workers Paralelos | Timeout | Checkpoints |
|------|---------|------------|-------------------|---------|-------------|
| SMALL | 1-1000 | N/A | 1 | 15 min | Nao |
| MEDIUM | 1001-2000 | 400 paginas | 3 | 20 min | Nao |
| LARGE | 2001-5000 | 180 paginas | 4 | 25 min | Sim |
| VERY_LARGE | 5001-10000 | 180 paginas | 5 | 30 min | Sim |
| HIGH_LARGE | 10001-20000 | 180 paginas | 5 | 35 min | Sim |
| ULTRA_LARGE | 20001+ | 100 paginas | 6 | 40 min | Sim |

### 1.2. Configuracao de Chunks

**Localização:** `src/utils/pdfSplitter.ts`

```typescript
const LARGE_FILE_THRESHOLD = 1000;
const CHUNK_SIZE_MEDIUM = 400;      // 1001-2000 paginas
const CHUNK_SIZE_LARGE = 180;       // 2001-10000 paginas
const CHUNK_SIZE_HIGH_LARGE = 180;  // 10001-20000 paginas
const CHUNK_SIZE_ULTRA_LARGE = 100; // >20000 paginas
const OVERLAP_PAGES = 75;           // Overlap entre chunks
```

### 1.3. Calculo de Chunks

```
Chunks Totais = ceil(Total Paginas / Chunk Size)
```

**Exemplos:**
- 2.000 paginas / 400 = 5 chunks (MEDIUM)
- 5.000 paginas / 180 = 28 chunks (LARGE)
- 15.000 paginas / 180 = 84 chunks (HIGH_LARGE)
- 30.000 paginas / 100 = 300 chunks (ULTRA_LARGE)

---

## 2. Diagrama de Fluxo de Alto Nivel

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                            PROCESSAMENTO DE ARQUIVOS COMPLEXOS                                       │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ FASE 1: UPLOAD E CHUNKING                                                                            │
│                                                                                                       │
│   ┌──────────┐     ┌──────────────┐     ┌────────────────┐     ┌──────────────────┐                 │
│   │ Usuario  │────▶│  FileUpload  │────▶│   pdfSplitter  │────▶│ Storage (chunks) │                 │
│   │          │     │              │     │                │     │                  │                 │
│   └──────────┘     └──────────────┘     └────────────────┘     └──────────────────┘                 │
│                                                │                                                     │
│                                                ▼                                                     │
│                                    ┌───────────────────────┐                                        │
│                                    │  Registro de Chunks   │                                        │
│                                    │  em process_chunks    │                                        │
│                                    └───────────────────────┘                                        │
└──────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                │
                                                ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ FASE 2: INICIALIZACAO                                                                                │
│                                                                                                       │
│   ┌────────────────────────┐     ┌─────────────────────────┐     ┌───────────────────────┐          │
│   │  start-analysis-complex │────▶│ complex_processing_status│────▶│   analysis_results   │          │
│   │                        │     │       (criacao)         │     │      (criacao)       │          │
│   └────────────────────────┘     └─────────────────────────┘     └───────────────────────┘          │
│                │                                                                                     │
│                ▼                                                                                     │
│   ┌────────────────────────┐                                                                        │
│   │  upload-chunks-worker  │                                                                        │
│   │  (disparo assincrono)  │                                                                        │
│   └────────────────────────┘                                                                        │
└──────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                │
                                                ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ FASE 3: UPLOAD PARA GEMINI                                                                           │
│                                                                                                       │
│   ┌─────────────────────────────────────────────────────────────────────────────────────────┐        │
│   │                            upload-chunks-worker                                          │        │
│   │                                                                                          │        │
│   │   Para cada chunk:                                                                       │        │
│   │   ┌──────────────┐    ┌──────────────────┐    ┌───────────────────┐                     │        │
│   │   │ Download do  │───▶│ Upload para      │───▶│ Aguarda estado    │                     │        │
│   │   │ Storage      │    │ Gemini File API  │    │ ACTIVE            │                     │        │
│   │   └──────────────┘    └──────────────────┘    └───────────────────┘                     │        │
│   │                                                       │                                  │        │
│   │                                                       ▼                                  │        │
│   │                                            ┌───────────────────┐                        │        │
│   │                                            │ Atualiza          │                        │        │
│   │                                            │ process_chunks    │                        │        │
│   │                                            │ com gemini_uri    │                        │        │
│   │                                            └───────────────────┘                        │        │
│   └─────────────────────────────────────────────────────────────────────────────────────────┘        │
│                                                       │                                              │
│                                                       ▼                                              │
│                                            ┌───────────────────────┐                                │
│                                            │  Cria processing_queue │                                │
│                                            │  (chunks x prompts)   │                                │
│                                            └───────────────────────┘                                │
└──────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                │
                                                ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ FASE 4: PROCESSAMENTO PARALELO                                                                       │
│                                                                                                       │
│   ┌─────────────────────────────────────────────────────────────────────────────────────────┐        │
│   │                          process-complex-worker (N workers)                              │        │
│   │                                                                                          │        │
│   │   Worker 1              Worker 2              Worker 3              Worker N            │        │
│   │   ┌───────────┐        ┌───────────┐        ┌───────────┐        ┌───────────┐        │        │
│   │   │ acquire   │        │ acquire   │        │ acquire   │        │ acquire   │        │        │
│   │   │ queue     │        │ queue     │        │ queue     │        │ queue     │        │        │
│   │   │ item      │        │ item      │        │ item      │        │ item      │        │        │
│   │   └─────┬─────┘        └─────┬─────┘        └─────┬─────┘        └─────┬─────┘        │        │
│   │         │                    │                    │                    │              │        │
│   │         ▼                    ▼                    ▼                    ▼              │        │
│   │   ┌───────────┐        ┌───────────┐        ┌───────────┐        ┌───────────┐        │        │
│   │   │ Process   │        │ Process   │        │ Process   │        │ Process   │        │        │
│   │   │ chunk via │        │ chunk via │        │ chunk via │        │ chunk via │        │        │
│   │   │ Gemini    │        │ Gemini    │        │ Gemini    │        │ Gemini    │        │        │
│   │   └─────┬─────┘        └─────┬─────┘        └─────┬─────┘        └─────┬─────┘        │        │
│   │         │                    │                    │                    │              │        │
│   │         ▼                    ▼                    ▼                    ▼              │        │
│   │   ┌───────────┐        ┌───────────┐        ┌───────────┐        ┌───────────┐        │        │
│   │   │ Save      │        │ Save      │        │ Save      │        │ Save      │        │        │
│   │   │ result    │        │ result    │        │ result    │        │ result    │        │        │
│   │   └───────────┘        └───────────┘        └───────────┘        └───────────┘        │        │
│   └─────────────────────────────────────────────────────────────────────────────────────────┘        │
└──────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                │
                                                ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ FASE 5: CONSOLIDACAO                                                                                 │
│                                                                                                       │
│   ┌─────────────────────────────────────────────────────────────────────────────────────────┐        │
│   │                              consolidation-worker                                        │        │
│   │                                                                                          │        │
│   │   Para cada prompt:                                                                      │        │
│   │   ┌────────────────────┐    ┌────────────────────┐    ┌────────────────────┐           │        │
│   │   │ Coleta resultados  │───▶│ Monta contexto     │───▶│ Chama Gemini para  │           │        │
│   │   │ de todos chunks    │    │ consolidado        │    │ consolidar         │           │        │
│   │   └────────────────────┘    └────────────────────┘    └────────────────────┘           │        │
│   │                                                               │                         │        │
│   │                                                               ▼                         │        │
│   │                                                    ┌────────────────────┐              │        │
│   │                                                    │ Salva resultado    │              │        │
│   │                                                    │ em analysis_results│              │        │
│   │                                                    └────────────────────┘              │        │
│   └─────────────────────────────────────────────────────────────────────────────────────────┘        │
└──────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                │
                                                ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ FASE 6: FINALIZACAO                                                                                  │
│                                                                                                       │
│   ┌────────────────┐    ┌────────────────┐    ┌────────────────┐    ┌────────────────┐              │
│   │ Status:        │───▶│ Notificacao    │───▶│ Email ao       │───▶│ Notificacao    │              │
│   │ 'completed'    │    │ in-app         │    │ usuario        │    │ Slack admin    │              │
│   └────────────────┘    └────────────────┘    └────────────────┘    └────────────────┘              │
└──────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Componentes do Frontend

### 3.1. pdfSplitter.ts

**Localizacao:** `src/utils/pdfSplitter.ts`

**Interface PDFChunk:**
```typescript
interface PDFChunk {
  file: File;
  startPage: number;
  endPage: number;
  totalPages: number;
  chunkIndex: number;
  totalChunks: number;
  overlapStartPage: number | null;
  overlapEndPage: number | null;
}
```

**Funcoes Principais:**

| Funcao | Descricao |
|--------|-----------|
| `getPDFPageCount` | Conta paginas usando pdf-lib |
| `splitPDFIntoChunks` | Divide PDF em chunks |
| `splitPDFIntoChunksWithOverlap` | Divide com overlap de 75 paginas |
| `shouldSplitPDF` | Verifica se precisa dividir (>= 1000) |
| `isComplexProcessing` | Retorna true se >= 1000 paginas |
| `determineChunkSize` | Calcula tamanho do chunk por tier |
| `getChunkConfiguration` | Retorna configuracao completa |

**Algoritmo de Chunking:**
```typescript
async function splitPDFIntoChunks(file: File, withOverlap: boolean = false): Promise<PDFChunk[]> {
  const pdfDoc = await PDFDocument.load(await file.arrayBuffer());
  const totalPages = pdfDoc.getPageCount();

  if (totalPages < 1000) {
    return [{ file, startPage: 1, endPage: totalPages, ... }];
  }

  const chunkSize = determineChunkSize(totalPages);
  const chunks: PDFChunk[] = [];
  let currentPage = 0;

  while (currentPage < totalPages) {
    const overlapStart = withOverlap && currentPage > 0
      ? Math.max(0, currentPage - OVERLAP_PAGES)
      : null;

    const chunkDoc = await PDFDocument.create();
    // Copia paginas do chunk
    // Salva como novo PDF
    chunks.push(chunkInfo);
    currentPage += chunkSize;
  }

  return chunks;
}
```

### 3.2. ProcessosService.ts (Fluxo Complexo)

**Fluxo para Arquivos Complexos:**

```typescript
async uploadAndAnalyze(...) {
  const isComplex = isComplexProcessing(pageCount);

  if (isComplex) {
    // 1. Divide PDF em chunks
    const chunks = await splitPDFIntoChunksWithOverlap(file);

    // 2. Cria registro principal
    const { data: processo } = await supabase
      .from('processos')
      .insert({
        file_name,
        file_size,
        user_id,
        status: 'uploading',
        is_chunked: true,
        total_chunks: chunks.length,
        total_pages: pageCount,
        tier_name: TierSystemService.detectTier(pageCount),
      })
      .select()
      .single();

    // 3. Upload de cada chunk para Storage
    for (const chunk of chunks) {
      const chunkPath = `${userId}/${processoId}/chunks/chunk_${chunk.chunkIndex}.pdf`;

      await supabase.storage
        .from('processos')
        .upload(chunkPath, chunk.file);

      // 4. Registra chunk no banco
      await supabase
        .from('process_chunks')
        .insert({
          processo_id: processoId,
          chunk_index: chunk.chunkIndex,
          total_chunks: chunk.totalChunks,
          start_page: chunk.startPage,
          end_page: chunk.endPage,
          pages_count: chunk.endPage - chunk.startPage + 1,
          file_path: chunkPath,
          file_size: chunk.file.size,
          status: 'pending',
        });
    }

    // 5. Inicia processamento complexo
    await fetch(`${SUPABASE_URL}/functions/v1/start-analysis-complex`, {
      method: 'POST',
      body: JSON.stringify({ processo_id: processoId, pageCount }),
    });
  }
}
```

### 3.3. ComplexProcessingProgress.tsx

**Localizacao:** `src/components/ComplexProcessingProgress.tsx`

**Estados Monitorados:**
- `current_phase`: Fase atual do processamento
- `chunks_uploaded`: Chunks enviados ao Gemini
- `chunks_completed`: Chunks processados
- `chunks_failed`: Chunks com erro
- `overall_progress_percent`: Progresso geral
- `total_prompts_processed`: Prompts consolidados

**Fases Exibidas:**
1. `uploading_chunks` - Upload dos chunks
2. `chunks_uploaded` - Upload concluido
3. `processing` - Processando chunks
4. `consolidating` - Consolidando resultados
5. `completed` - Finalizado

---

## 4. Edge Functions (Backend)

### 4.1. start-analysis-complex

**Localizacao:** `supabase/functions/start-analysis-complex/index.ts`

**Responsabilidades:**
1. Recebe `processo_id` e `pageCount`
2. Detecta tier baseado em paginas
3. Cria registro em `complex_processing_status`
4. Cria registros em `analysis_results` para cada prompt
5. Dispara `upload-chunks-worker` assincronamente

**Criacao do Status de Processamento:**
```typescript
await supabase.from('complex_processing_status').insert({
  processo_id,
  total_chunks: chunksCount,
  chunks_uploaded: 0,
  chunks_queued: 0,
  chunks_processing: 0,
  chunks_completed: 0,
  chunks_failed: 0,
  current_phase: 'uploading_chunks',
  started_at: new Date().toISOString(),
  tier_name: tierName,
  max_concurrent_workers: tierConfig.maxParallelWorkers,
});
```

**Disparo Assincrono:**
```typescript
fetch(`${supabaseUrl}/functions/v1/upload-chunks-worker`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${serviceKey}` },
  body: JSON.stringify({ processo_id }),
}).catch(err => console.error('Erro ao disparar worker:', err));
```

### 4.2. upload-chunks-worker

**Localizacao:** `supabase/functions/upload-chunks-worker/index.ts`

**Fluxo Detalhado:**

1. **Busca Chunks Pendentes:**
   ```typescript
   const { data: chunks } = await supabase
     .from('process_chunks')
     .select('*')
     .eq('processo_id', processo_id)
     .order('chunk_index', { ascending: true });
   ```

2. **Para Cada Chunk:**
   ```typescript
   for (const chunk of chunks) {
     // Pula se ja foi enviado
     if (chunk.gemini_file_uri && chunk.gemini_file_state === 'ACTIVE') {
       skippedCount++;
       continue;
     }

     // Download do Storage
     const { data: fileData } = await supabase.storage
       .from('processos')
       .download(chunk.file_path);

     // Upload para Gemini com retry
     for (let attempt = 1; attempt <= 3; attempt++) {
       try {
         const tempPath = `/tmp/${chunk.id}_chunk.pdf`;
         await Deno.writeFile(tempPath, new Uint8Array(await fileData.arrayBuffer()));

         const uploadResult = await fileManager.uploadFile(tempPath, {
           mimeType: 'application/pdf',
           displayName: `chunk_${chunk.chunk_index}.pdf`,
         });

         // Aguarda processamento se necessario
         if (uploadResult.file.state === 'PROCESSING') {
           await waitForFileProcessing(fileManager, uploadResult.file.name);
         }

         // Atualiza chunk com URI
         await supabase.from('process_chunks').update({
           gemini_file_uri: uploadResult.file.uri,
           gemini_file_name: uploadResult.file.name,
           gemini_file_state: 'ACTIVE',
         }).eq('id', chunk.id);

         break;
       } catch (error) {
         if (attempt === 3) throw error;
         await delay(attempt * 2000);
       }
     }
   }
   ```

3. **Criacao da Fila de Processamento:**
   ```typescript
   const { data: prompts } = await supabase
     .from('analysis_prompts')
     .select('*')
     .eq('is_active', true)
     .order('execution_order', { ascending: true });

   const queueItems = [];
   for (const chunk of chunks) {
     for (const prompt of prompts) {
       queueItems.push({
         processo_id,
         chunk_id: chunk.id,
         prompt_id: prompt.id,
         queue_type: 'chunk_processing',
         priority: prompt.execution_order,
         status: 'pending',
         prompt_content: prompt.prompt_content,
         context_data: {
           chunk_index: chunk.chunk_index,
           total_chunks: chunk.total_chunks,
           start_page: chunk.start_page,
           end_page: chunk.end_page,
           prompt_title: prompt.title,
         },
         max_attempts: 3,
       });
     }
   }

   await supabase.from('processing_queue').insert(queueItems);
   ```

4. **Dispara Workers de Processamento:**
   ```typescript
   fetch(`${supabaseUrl}/functions/v1/process-complex-worker`, {
     method: 'POST',
     body: JSON.stringify({ processo_id }),
   });
   ```

### 4.3. process-complex-worker

**Localizacao:** `supabase/functions/process-complex-worker/index.ts`

**Arquitetura de Worker:**

```
┌─────────────────────────────────────────────────────────────────┐
│                    process-complex-worker                        │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 1. Adquire item da fila com lock (acquire_next_queue_item) │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│                              ▼                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 2. Registra worker (register_worker)                       │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│                              ▼                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 3. Inicia heartbeat interval (30s)                         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│                              ▼                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 4. Aguarda chunk ACTIVE no Gemini (retry loop)             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│                              ▼                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 5. Carrega contexto de chunks anteriores                   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│                              ▼                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 6. Processa com Gemini (retry entre modelos)               │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│                              ▼                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 7. Gera resumo contextual para proximo chunk               │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│                              ▼                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 8. Salva resultado e completa item da fila                 │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│                              ▼                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 9. Verifica se todos chunks do prompt estao completos      │ │
│  │    Se sim: dispara consolidation-worker                    │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│                              ▼                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 10. Verifica se pode disparar mais workers (can_spawn)     │ │
│  │     Se sim: dispara novo worker                            │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**Funcoes RPC Utilizadas:**

| Funcao | Descricao |
|--------|-----------|
| `acquire_next_queue_item` | Adquire proximo item com lock |
| `register_worker` | Registra worker ativo |
| `update_queue_heartbeat` | Atualiza heartbeat |
| `complete_queue_item` | Marca item como completo |
| `fail_queue_item` | Marca item como falha |
| `unregister_worker` | Remove registro do worker |
| `can_spawn_worker` | Verifica se pode criar mais workers |
| `get_chunk_context` | Busca contexto de chunks anteriores |
| `update_complex_processing_progress` | Atualiza progresso geral |

**Processamento com Gemini:**
```typescript
const models = await getActiveModels(supabase);

for (let modelIndex = 0; modelIndex < models.length; modelIndex++) {
  const model = models[modelIndex];

  try {
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const geminiModel = genAI.getGenerativeModel({ model: model.modelId });

    const parts = [
      {
        fileData: {
          mimeType: 'application/pdf',
          fileUri: chunk.gemini_file_uri,
        },
      },
      { text: finalPrompt },
    ];

    const result = await geminiModel.generateContent({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: model.temperature,
        maxOutputTokens: model.maxTokens,
      },
    });

    text = result.response.text();
    usedModel = model;
    break; // Sucesso, sai do loop

  } catch (modelError) {
    // Tenta proximo modelo
    if (isRetryableError(modelError)) continue;
    throw modelError;
  }
}
```

**Geracao de Contexto:**
```typescript
async function generateContextSummary(supabase, geminiModel, chunkResult, chunkIndex) {
  const summaryPrompt = `Crie um resumo executivo conciso (max 1500 tokens) com:
    1. Principais pontos identificados
    2. Entidades mencionadas (nomes, datas, valores)
    3. Topicos principais
    4. Contexto para analise das proximas secoes

    TEXTO DO CHUNK ${chunkIndex + 1}:
    ${chunkResult}`;

  const result = await geminiModel.generateContent(summaryPrompt);
  return result.response.text().trim();
}
```

### 4.4. consolidation-worker

**Localizacao:** `supabase/functions/consolidation-worker/index.ts`

**Responsabilidades:**
1. Coleta resultados de todos os chunks
2. Consolida por prompt
3. Gera resultado final unificado
4. Finaliza processo quando todos prompts consolidados

**Fluxo de Consolidacao:**

```typescript
// 1. Busca todos os chunks processados
const { data: chunks } = await supabase
  .from('process_chunks')
  .select('chunk_index, context_summary, processing_result')
  .eq('processo_id', processo_id)
  .order('chunk_index', { ascending: true });

// 2. Monta contexto consolidado
const allSummaries = chunks
  .filter(c => c.processing_result?.result)
  .map(c => `=== CHUNK ${c.chunk_index + 1} ===\n${c.processing_result.result}`)
  .join('\n\n');

// 3. Busca prompts pendentes
const { data: analysisResults } = await supabase
  .from('analysis_results')
  .select('*')
  .eq('processo_id', processo_id)
  .in('status', ['pending', 'running'])
  .order('execution_order', { ascending: true });

// 4. Consolida cada prompt
for (const analysisResult of analysisResults) {
  const fullPrompt = `${analysisResult.system_prompt}\n\n${analysisResult.prompt_content}\n\nDOCUMENTO EM LOTES:\n${allSummaries}`;

  const result = await generativeModel.generateContent(fullPrompt);
  const text = result.response.text();

  await supabase
    .from('analysis_results')
    .update({
      status: 'completed',
      result_content: text,
      tokens_used: tokensUsed,
      completed_at: new Date().toISOString(),
    })
    .eq('id', analysisResult.id);
}

// 5. Verifica se todos prompts foram consolidados
const allCompleted = allResults.every(r => r.status === 'completed');

if (allCompleted) {
  await supabase
    .from('processos')
    .update({
      status: 'completed',
      analysis_completed_at: new Date().toISOString(),
    })
    .eq('id', processo_id);

  // Envia notificacoes
  await sendNotifications(processo_id);
}
```

---

## 5. Tabelas do Banco de Dados

### 5.1. process_chunks

**Schema:**

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | Primary Key |
| processo_id | uuid | FK para processos |
| chunk_index | integer | Indice do chunk (0-based) |
| total_chunks | integer | Total de chunks |
| start_page | integer | Pagina inicial |
| end_page | integer | Pagina final |
| pages_count | integer | Quantidade de paginas |
| file_path | text | Path no Storage |
| file_size | bigint | Tamanho em bytes |
| gemini_file_uri | text | URI do Gemini |
| gemini_file_name | text | Nome no Gemini |
| gemini_file_state | text | ACTIVE, PROCESSING |
| gemini_file_uploaded_at | timestamptz | Data upload |
| gemini_file_expires_at | timestamptz | Data expiracao |
| status | text | pending, processing, completed, error |
| context_summary | jsonb | Resumo contextual |
| processing_result | jsonb | Resultado do processamento |
| processing_time_seconds | integer | Tempo de processamento |
| tokens_used | integer | Tokens consumidos |
| retry_count | integer | Tentativas realizadas |
| last_error | text | Ultimo erro |
| overlap_start_page | integer | Inicio do overlap |
| overlap_end_page | integer | Fim do overlap |
| tier_name | text | Tier do processamento |
| priority | integer | Prioridade na fila |

### 5.2. processing_queue

**Schema:**

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | Primary Key |
| processo_id | uuid | FK para processos |
| chunk_id | uuid | FK para process_chunks |
| prompt_id | uuid | FK para analysis_prompts |
| queue_type | text | chunk_processing, consolidation |
| priority | integer | Prioridade (menor = maior) |
| queue_position | bigint | Posicao na fila |
| status | text | pending, processing, completed, failed, retry |
| context_data | jsonb | Dados de contexto |
| prompt_content | text | Conteudo do prompt |
| attempt_number | integer | Tentativa atual |
| max_attempts | integer | Max tentativas |
| processing_started_at | timestamptz | Inicio processamento |
| processing_completed_at | timestamptz | Fim processamento |
| last_heartbeat | timestamptz | Ultimo heartbeat |
| worker_id | text | ID do worker |
| lock_acquired_at | timestamptz | Lock adquirido |
| lock_expires_at | timestamptz | Lock expira |
| result_data | jsonb | Resultado |
| tokens_used | integer | Tokens usados |
| error_message | text | Mensagem de erro |
| error_count | integer | Contagem de erros |

### 5.3. complex_processing_status

**Schema:**

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | Primary Key |
| processo_id | uuid | FK para processos |
| total_chunks | integer | Total de chunks |
| chunks_uploaded | integer | Chunks enviados |
| chunks_queued | integer | Chunks na fila |
| chunks_processing | integer | Chunks processando |
| chunks_completed | integer | Chunks completos |
| chunks_failed | integer | Chunks com erro |
| current_phase | text | Fase atual |
| current_chunk_index | integer | Chunk atual |
| started_at | timestamptz | Inicio |
| estimated_completion_at | timestamptz | Estimativa fim |
| average_chunk_time_seconds | integer | Media por chunk |
| upload_progress_percent | integer | % upload |
| processing_progress_percent | integer | % processamento |
| overall_progress_percent | integer | % total |
| last_heartbeat | timestamptz | Ultimo heartbeat |
| is_healthy | boolean | Sistema saudavel |
| health_check_message | text | Mensagem health |
| total_tokens_used | bigint | Total tokens |
| total_prompts_processed | integer | Prompts processados |
| total_retries | integer | Total retries |
| max_concurrent_workers | integer | Max workers |
| current_active_workers | integer | Workers ativos |
| active_worker_ids | jsonb | IDs dos workers |
| tier_name | text | Nome do tier |
| metadata | jsonb | Metadados extras |

### 5.4. complex_analysis_errors

**Schema:**

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | Primary Key |
| processo_id | uuid | FK para processos |
| user_id | uuid | FK para user_profiles |
| chunk_id | uuid | FK para process_chunks |
| error_type | text | Tipo do erro |
| error_category | text | Categoria |
| error_message | text | Mensagem |
| error_details | jsonb | Detalhes |
| severity | text | low, medium, high, critical |
| stack_trace | text | Stack trace |
| current_phase | text | Fase do erro |
| worker_id | text | Worker que falhou |
| model_used | text | Modelo usado |
| retry_attempt | integer | Tentativa |
| recovery_attempted | boolean | Tentou recuperar |
| recovery_successful | boolean | Recuperou |
| admin_notified | boolean | Admin notificado |
| occurred_at | timestamptz | Data/hora |

---

## 6. GitHub Actions (Cron Jobs)

### 6.1. monitor-stuck-chunks.yml

**Frequencia:** A cada 5 minutos
**Edge Function:** `recover-stuck-chunks`

**Proposito:**
- Detecta chunks travados (status processing > 10 min)
- Reseta status para retry automatico
- Envia notificacao se necessario

### 6.2. monitor-stuck-processes.yml

**Frequencia:** A cada 1 minuto
**Edge Function:** `process-stuck-processos`

**Proposito:**
- Detecta processos travados
- Verifica se todos chunks estao completos
- Forca finalizacao se necessario

### 6.3. monitor-complex-health-check.yml

**Frequencia:** A cada 5 minutos
**Edge Function:** `health-check-worker`

**Proposito:**
- Verifica saude do sistema de processamento
- Detecta workers inativos
- Monitora filas travadas

### 6.4. monitor-auto-restart-failed.yml

**Frequencia:** A cada 3 minutos
**Edge Function:** `auto-restart-failed-chunks`

**Proposito:**
- Detecta chunks com status `failed`
- Reinicia chunks com retry < max_attempts
- Reporta chunks que excederam tentativas

### 6.5. monitor-complex-recovery.yml

**Frequencia:** A cada 10 minutos
**Edge Function:** `recover-stuck-processes`

**Proposito:**
- Recuperacao mais profunda de processos travados
- Analisa estado de toda a fila
- Pode reiniciar processamento do zero se necessario

### 6.6. monitor-stuck-small-files.yml

**Frequencia:** A cada 5 minutos
**Edge Function:** `detect-stuck-processes-small-files`

**Proposito:**
- Detecta arquivos pequenos que ficaram travados
- Diferencia de arquivos complexos
- Timeout menor para arquivos pequenos

---

## 7. Sistema de Filas e Locks

### 7.1. Aquisicao de Item da Fila

**Funcao RPC:** `acquire_next_queue_item`

```sql
CREATE FUNCTION acquire_next_queue_item(
  p_worker_id text,
  p_lock_duration_minutes integer DEFAULT 15
) RETURNS TABLE(
  queue_item_id uuid,
  processo_id uuid,
  chunk_id uuid,
  prompt_id uuid,
  prompt_content text,
  context_data jsonb,
  attempt_number integer,
  prompt_title text
) AS $$
BEGIN
  RETURN QUERY
  WITH next_item AS (
    SELECT pq.*
    FROM processing_queue pq
    WHERE pq.status IN ('pending', 'retry')
    AND (pq.lock_expires_at IS NULL OR pq.lock_expires_at < NOW())
    ORDER BY pq.priority ASC, pq.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  UPDATE processing_queue
  SET
    status = 'processing',
    worker_id = p_worker_id,
    lock_acquired_at = NOW(),
    lock_expires_at = NOW() + (p_lock_duration_minutes || ' minutes')::interval,
    processing_started_at = NOW(),
    attempt_number = COALESCE(attempt_number, 0) + 1,
    last_heartbeat = NOW()
  FROM next_item
  WHERE processing_queue.id = next_item.id
  RETURNING
    processing_queue.id,
    processing_queue.processo_id,
    processing_queue.chunk_id,
    processing_queue.prompt_id,
    processing_queue.prompt_content,
    processing_queue.context_data,
    processing_queue.attempt_number,
    processing_queue.context_data->>'prompt_title';
END;
$$ LANGUAGE plpgsql;
```

### 7.2. Sistema de Heartbeat

**Funcao RPC:** `update_queue_heartbeat`

```sql
CREATE FUNCTION update_queue_heartbeat(
  p_queue_item_id uuid,
  p_worker_id text
) RETURNS void AS $$
BEGIN
  UPDATE processing_queue
  SET
    last_heartbeat = NOW(),
    lock_expires_at = NOW() + INTERVAL '15 minutes'
  WHERE id = p_queue_item_id
  AND worker_id = p_worker_id
  AND status = 'processing';
END;
$$ LANGUAGE plpgsql;
```

**Intervalo:** 30 segundos

### 7.3. Controle de Workers Paralelos

**Funcao RPC:** `can_spawn_worker`

```sql
CREATE FUNCTION can_spawn_worker(p_processo_id uuid)
RETURNS boolean AS $$
DECLARE
  v_max_workers integer;
  v_active_workers integer;
  v_pending_items integer;
BEGIN
  SELECT max_concurrent_workers, current_active_workers
  INTO v_max_workers, v_active_workers
  FROM complex_processing_status
  WHERE processo_id = p_processo_id;

  SELECT COUNT(*)
  INTO v_pending_items
  FROM processing_queue
  WHERE processo_id = p_processo_id
  AND status IN ('pending', 'retry');

  RETURN v_pending_items > 0
    AND v_active_workers < v_max_workers;
END;
$$ LANGUAGE plpgsql;
```

---

## 8. Tratamento de Erros e Recuperacao

### 8.1. Tipos de Erros

| Tipo | Categoria | Acao |
|------|-----------|------|
| Rate Limit | retryable | Retry com backoff |
| Service Unavailable | retryable | Retry com backoff |
| Token Limit Exceeded | retryable | Troca de modelo |
| Invalid Argument | retryable | Troca de modelo |
| File Not Found | non_retryable | Marca como erro |
| Authentication Error | non_retryable | Marca como erro |

### 8.2. Retry Logic

```typescript
function isRetryableError(error: any): boolean {
  const errorStr = error?.message?.toLowerCase() || '';
  const statusCode = error?.status;

  return (
    statusCode === 503 ||
    statusCode === 429 ||
    statusCode === 500 ||
    errorStr.includes('overloaded') ||
    errorStr.includes('rate limit') ||
    errorStr.includes('timeout') ||
    errorStr.includes('resource_exhausted') ||
    errorStr.includes('invalid argument') ||
    errorStr.includes('too large') ||
    errorStr.includes('token limit')
  );
}
```

### 8.3. Fallback entre Modelos

```typescript
const models = await getActiveModels(supabase);
// Ordenados por prioridade

for (const model of models) {
  try {
    const result = await processWithModel(model);
    return result;
  } catch (error) {
    if (isRetryableError(error) && hasMoreModels) {
      notifyModelSwitch(fromModel, toModel, reason);
      continue;
    }
    throw error;
  }
}
```

### 8.4. Recuperacao de Chunks Travados

**Edge Function:** `recover-stuck-chunks`

```typescript
// Busca chunks travados
const { data: stuckChunks } = await supabase
  .from('process_chunks')
  .select('*')
  .eq('status', 'processing')
  .lt('updated_at', new Date(Date.now() - 10 * 60 * 1000).toISOString());

for (const chunk of stuckChunks) {
  if (chunk.retry_count < 3) {
    // Reset para retry
    await supabase
      .from('process_chunks')
      .update({
        status: 'pending',
        retry_count: chunk.retry_count + 1,
      })
      .eq('id', chunk.id);

    // Tambem reseta itens da fila
    await supabase
      .from('processing_queue')
      .update({ status: 'retry' })
      .eq('chunk_id', chunk.id)
      .eq('status', 'processing');
  } else {
    // Marca como falha permanente
    await supabase
      .from('process_chunks')
      .update({ status: 'failed' })
      .eq('id', chunk.id);

    // Notifica admin
    await notifyAdmin('chunk_failed', chunk);
  }
}
```

---

## 9. Notificacoes

### 9.1. Notificacoes ao Usuario

**Via tabela `notifications`:**
```typescript
await supabase.from('notifications').insert({
  user_id: processo.user_id,
  type: 'analysis_completed',
  message: 'Analise de documento complexo concluida com sucesso',
  processo_id: processo_id,
});
```

### 9.2. Email ao Usuario

**Edge Function:** `send-email-process-completed`

```typescript
await fetch(`${supabaseUrl}/functions/v1/send-email-process-completed`, {
  method: 'POST',
  body: JSON.stringify({ processo_id }),
});
```

### 9.3. Notificacao Administrativa (Slack)

**Helper:** `notifyAdminSafe`

```typescript
notifyAdminSafe({
  type: 'analysis_completed',
  title: 'Analise Concluida',
  message: `${userName} | ${fileName} | ${duration}`,
  severity: 'success',
  metadata: {
    processo_id,
    file_name,
    user_email,
    chunks_count,
    prompts_consolidated,
  },
});
```

---

## 10. Metricas e Monitoramento

### 10.1. Metricas Coletadas

| Metrica | Tabela | Campos |
|---------|--------|--------|
| Tempo por chunk | process_chunks | processing_time_seconds |
| Tokens por chunk | process_chunks | tokens_used |
| Workers ativos | complex_processing_status | current_active_workers |
| Progresso geral | complex_processing_status | overall_progress_percent |
| Erros por processo | complex_analysis_errors | count(*) |
| Retries totais | complex_processing_status | total_retries |

### 10.2. Health Check

**Edge Function:** `health-check-worker`

Verifica:
- Filas com itens travados
- Workers sem heartbeat
- Chunks sem progresso
- Processos em status inconsistente

### 10.3. Dashboard de Monitoramento

**Dados disponiveis via `complex_processing_status`:**
- Fase atual do processamento
- Chunks: total, uploaded, processing, completed, failed
- Workers: max, ativos
- Progresso percentual
- Tempo estimado de conclusao
- Historico de erros

---

## 11. Performance e Otimizacoes

### 11.1. Estimativas de Tempo

| Tier | Paginas | Chunks | Tempo Estimado |
|------|---------|--------|----------------|
| MEDIUM | 2.000 | 5 | ~90 min |
| LARGE | 5.000 | 28 | ~4 horas |
| VERY_LARGE | 10.000 | 56 | ~7 horas |
| HIGH_LARGE | 20.000 | 112 | ~10 horas |
| ULTRA_LARGE | 30.000 | 300 | ~15 horas |

### 11.2. Paralelizacao

- MEDIUM: 3 workers paralelos
- LARGE: 4 workers paralelos
- VERY_LARGE+: 5-6 workers paralelos

### 11.3. Overlap de Chunks

```
┌────────────────┐
│   Chunk 1      │
│  Paginas 1-400 │
└───────┬────────┘
        │ Overlap (75 pags)
┌───────▼────────┐
│   Chunk 2      │
│ Paginas 326-725│
└───────┬────────┘
        │ Overlap (75 pags)
┌───────▼────────┐
│   Chunk 3      │
│ Paginas 651-1050│
└────────────────┘
```

**Beneficios:**
- Contexto continuo entre chunks
- Evita perda de informacao em quebras
- Melhora qualidade da consolidacao

---

## 12. Seguranca

### 12.1. RLS para process_chunks

```sql
CREATE POLICY "Users can view own chunks"
  ON process_chunks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM processos
      WHERE processos.id = process_chunks.processo_id
      AND processos.user_id = auth.uid()
    )
  );
```

### 12.2. Service Role Key

- Usado apenas em edge functions
- Nunca exposto ao frontend
- Permite bypass de RLS para operacoes de sistema

### 12.3. Isolamento de Workers

- Cada worker tem ID unico
- Locks previnem processamento duplicado
- Heartbeat detecta workers mortos

---

## 13. Diagrama de Sequencia Completo

```
Usuario       Frontend        ProcessosService       Storage        start-complex     upload-worker      process-worker      consolidation
   │              │                  │                  │                │                  │                   │                  │
   │─Upload PDF──▶│                  │                  │                │                  │                   │                  │
   │              │─Split PDF───────▶│                  │                │                  │                   │                  │
   │              │◀─Chunks Array────│                  │                │                  │                   │                  │
   │              │                  │─Create Processo─▶│                │                  │                   │                  │
   │              │                  │                  │                │                  │                   │                  │
   │              │                  │─Upload Chunk 1──────────────────▶│                │                  │                   │                  │
   │              │                  │─Upload Chunk 2──────────────────▶│                │                  │                   │                  │
   │              │                  │─Upload Chunk N──────────────────▶│                │                  │                   │                  │
   │◀─Progress───│                  │                  │                │                  │                   │                  │
   │              │                  │                  │                │                  │                   │                  │
   │              │                  │─POST start-analysis-complex──────────────────────▶│                  │                   │                  │
   │              │                  │                  │                │─Create Status───│                  │                   │                  │
   │              │                  │                  │                │─Create Results──│                  │                   │                  │
   │              │                  │                  │                │─Fire upload-worker (async)────────▶│                   │                  │
   │              │                  │◀─Started─────────────────────────│                  │                   │                  │
   │              │                  │                  │                │                  │                   │                  │
   │              │                  │                  │                │                  │─Download chunks──│                   │                  │
   │              │                  │                  │◀───────────────────────────────────│                   │                  │
   │              │                  │                  │                │                  │─Upload to Gemini─│                   │                  │
   │              │                  │                  │                │                  │─Update URIs──────│                   │                  │
   │              │                  │                  │                │                  │─Create Queue─────│                   │                  │
   │              │                  │                  │                │                  │─Fire workers (async)────────────────▶│                  │
   │              │                  │                  │                │                  │                   │                  │
   │              │                  │                  │                │                  │                   │─Acquire item────│                  │
   │              │                  │                  │                │                  │                   │─Process chunk──│                  │
   │              │                  │                  │                │                  │                   │─Save result─────│                  │
   │              │                  │                  │                │                  │                   │─Check complete──│                  │
   │              │                  │                  │                │                  │                   │    │            │                  │
   │              │                  │                  │                │                  │                   │    │ All chunks │                  │
   │              │                  │                  │                │                  │                   │    │ complete   │                  │
   │              │                  │                  │                │                  │                   │    ▼            │                  │
   │              │                  │                  │                │                  │                   │─Fire consolidation───────────────▶│
   │              │                  │                  │                │                  │                   │                  │                  │
   │              │                  │                  │                │                  │                   │                  │─Collect results─│
   │              │                  │                  │                │                  │                   │                  │─Consolidate─────│
   │              │                  │                  │                │                  │                   │                  │─Save final──────│
   │              │                  │                  │                │                  │                   │                  │─Update status───│
   │              │                  │                  │                │                  │                   │                  │─Send notifs─────│
   │◀─Notification─────────────────────────────────────────────────────────────────────────────────────────────────────────────────│
   │              │                  │                  │                │                  │                   │                  │
```

---

## 14. Checklist de Validacoes

### Pre-Upload:
- [ ] Arquivo e PDF valido
- [ ] Contagem de paginas >= 1000
- [ ] Usuario autenticado
- [ ] Tokens suficientes
- [ ] Tier identificado corretamente

### Durante Chunking:
- [ ] Todos chunks criados
- [ ] Arquivos salvos no Storage
- [ ] Registros em process_chunks
- [ ] Overlap calculado corretamente

### Durante Upload para Gemini:
- [ ] Cada chunk enviado com sucesso
- [ ] Estado ACTIVE confirmado
- [ ] URIs salvas no banco
- [ ] Fila de processamento criada

### Durante Processamento:
- [ ] Workers respeitando limite
- [ ] Heartbeats atualizados
- [ ] Resultados salvos por chunk
- [ ] Contexto propagado entre chunks

### Durante Consolidacao:
- [ ] Todos chunks de cada prompt completos
- [ ] Resultado consolidado gerado
- [ ] Tokens contabilizados
- [ ] Status atualizado

### Pos-Processamento:
- [ ] Status 'completed'
- [ ] Tokens debitados
- [ ] Notificacao enviada
- [ ] Email enviado
- [ ] Slack notificado

---

## 15. Pagina de Detalhe do Processo (ProcessoDetailPage)

Apos o upload do arquivo complexo, o usuario e automaticamente redirecionado para a pagina de detalhe do processo (`/lawsuits-detail/:id`). Esta pagina fornece acompanhamento em tempo real do processamento paralelo e exibe os resultados consolidados.

### 15.1. Componente Principal

**Localizacao:** `src/pages/ProcessoDetailPage.tsx`

**Responsabilidades:**
- Exibir informacoes do processo (nome, data, paginas, tamanho)
- Monitorar status em tempo real via Realtime Subscriptions
- Exibir progresso de processamento por fase
- Mostrar progresso de chunks (para arquivos complexos)
- Mostrar transcricao quando disponivel
- Permitir edicao do nome do arquivo
- Tocar som de notificacao ao concluir

### 15.2. Grid de Estatisticas

A pagina exibe um grid com 4 cards de estatisticas:

| Card | Informacao | Fonte |
|------|------------|-------|
| Data Upload | Data e hora do upload | `processo.created_at` |
| Paginas | Total de paginas do PDF | `processo.transcricao.totalPages` |
| Caracteres | Total de caracteres extraidos | Soma de `process_content[].content.length` |
| Tempo | Duracao do processamento | `processo.processing_duration_seconds` |

### 15.3. Sistema de Atualizacoes em Tempo Real

**Realtime Subscription para Processo:**
```typescript
const processoChannel = supabase.channel(`processo-detail-${processoId}`)
  .on('postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'processos', filter: `id=eq.${processoId}` },
    (payload) => {
      setProcesso(prev => ({ ...prev, ...payload.new }));
    }
  )
  .subscribe();
```

**Polling Adaptativo (useProcessProgressPolling):**

| Status | Intervalo Inicial | Intervalo Maximo |
|--------|-------------------|------------------|
| queuing | 2s | 10s |
| processing_batch | 3s | 20s |
| finalizing | 3s | 15s |
| processing_forensic | 4s | 20s |

**Algoritmo de Backoff:**
- Se nao ha atualizacoes, incrementa `idleCount`
- `idleCount > 6`: intervalo = 20s
- `idleCount > 12`: intervalo = 30s
- `idleCount > 24`: para o polling (processo travado)

### 15.4. Progresso de Processamento Complexo (ComplexProcessingProgress)

**Localizacao:** `src/components/ComplexProcessingProgress.tsx`

Para arquivos complexos, este componente exibe informacoes detalhadas das fases:

**Dados Monitorados:**
- `current_phase`: Fase atual (uploading_chunks, processing, consolidating, etc)
- `chunks_uploaded`: Chunks enviados ao Gemini
- `chunks_completed`: Chunks processados
- `chunks_failed`: Chunks com erro
- `overall_progress_percent`: Progresso geral
- `total_prompts_processed`: Prompts consolidados
- `current_active_workers`: Workers ativos no momento
- `max_concurrent_workers`: Limite de workers paralelos

**Visualizacao por Fase:**

| Fase | Exibicao |
|------|----------|
| uploading_chunks | Barra de progresso + contagem de uploads |
| chunks_uploaded | Confirmacao de uploads completos |
| processing | Progresso por chunk + workers ativos |
| consolidating | Progresso de consolidacao por prompt |
| completed | Resumo final + metricas |

### 15.5. Contador de Tokens (ProcessTokenCounter)

**Localizacao:** `src/components/ProcessTokenCounter.tsx`

Exibe:
- Total de tokens estimados para o documento
- Prompt atual sendo processado
- Total de prompts a serem executados
- Status do processamento

**Calculo para Arquivos Complexos:**
```typescript
const tokensEstimated = totalPages * 5500;
// Distribuido entre chunks
const tokensPerChunk = tokensEstimated / totalChunks;
```

### 15.6. Indicadores de Progresso

**ProcessStatusBadge:**
- Exibe badge colorido com status atual
- Estados: `queuing`, `analyzing`, `completed`, `error`

**ProcessStatusProgress:**
- Barra de progresso percentual
- Indicador de etapa atual
- Informacoes de `progress_info`

### 15.7. Progresso das Etapas de Analise (AnalysisStagesProgress)

**Localizacao:** `src/components/AnalysisStagesProgress.tsx`

Este componente exibe o status de cada prompt de analise individualmente. Para arquivos complexos, reflete o status da consolidacao.

**Busca de Dados:**
```typescript
const { data } = await supabase
  .from('analysis_results')
  .select('id, execution_order, prompt_title, status, processing_at, completed_at, error_message')
  .eq('processo_id', processoId)
  .order('execution_order', { ascending: true });
```

**Estados por Etapa:**

| Status | Icone | Cor | Label |
|--------|-------|-----|-------|
| completed | CheckCircle2 | Verde (#10B981) | Concluido |
| running/processing | Loader (animado) | Azul (#3B82F6) | Processando |
| failed/error | XCircle | Vermelho (#EF4444) | Erro |
| pending | Clock | Cinza (#6B7280) | Pendente |

**Comportamento para Arquivos Complexos:**
- Durante processamento de chunks: todas etapas mostram "Pendente"
- Durante consolidacao: etapas mudam para "Processando" sequencialmente
- Apos consolidacao: todas etapas mostram "Concluido"

**Atualizacao:**
- Polling a cada 1000ms (1 segundo)
- Realtime subscription para atualizacoes instantaneas
- Calculo de percentual de progresso: `(completed / total) * 100`

### 15.8. Exibicao de Transcricao

Quando o processo e concluido, a transcricao completa fica disponivel:

**Condicao de Exibicao:**
```typescript
const hasValidTranscription = processo &&
  (processo.status === 'completed' || processo.status === 'error') &&
  processo.process_content &&
  processo.process_content.length > 0;
```

**Funcionalidades:**
- Expansao/Colapso da transcricao
- Copia para clipboard
- Download como arquivo `.txt`
- Navegacao por paginas
- Para arquivos complexos: conteudo consolidado de todos os chunks

### 15.9. Notificacoes Sonoras

**Funcao:** `playCompletionSound()`

**Localizacao:** `src/utils/notificationSound.ts`

**Gatilho:**
```typescript
useEffect(() => {
  if (previousStatus && previousStatus !== 'completed' && processo.status === 'completed') {
    playCompletionSound();
  }
}, [processo?.status]);
```

Tambem disponivel: `playErrorSound()` para notificar erros.

### 15.10. Fluxo de Transicao de Status (Arquivos Complexos)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                TRANSICOES DE STATUS NA PAGINA (ARQUIVOS COMPLEXOS)               │
└─────────────────────────────────────────────────────────────────────────────────┘

    Usuario visualiza pagina
             │
             ▼
    ┌────────────────────┐
    │     uploading      │──── Upload do arquivo original
    └────────┬───────────┘
             │
             ▼
    ┌────────────────────┐     ┌─────────────────────────────────┐
    │  uploading_chunks  │────▶│ ComplexProcessingProgress       │
    │                    │     │ • Barra de upload de chunks     │
    └────────┬───────────┘     │ • X de Y chunks enviados        │
             │                 └─────────────────────────────────┘
             ▼
    ┌────────────────────┐     ┌─────────────────────────────────┐
    │    processing      │────▶│ ComplexProcessingProgress       │
    │                    │     │ • Workers ativos: N             │
    │                    │     │ • Chunks completos: X de Y      │
    └────────┬───────────┘     │ • Barra de progresso            │
             │                 └─────────────────────────────────┘
             ▼
    ┌────────────────────┐     ┌─────────────────────────────────┐
    │   consolidating    │────▶│ AnalysisStagesProgress          │
    │                    │     │ • Prompt 1: Processando         │
    └────────┬───────────┘     │ • Prompt 2: Pendente...         │
             │                 └─────────────────────────────────┘
             │
             ├───────────────────────────────────────────────────┐
             ▼                                                   ▼
    ┌────────────────────┐                           ┌────────────────────┐
    │    completed       │                           │      error         │
    │                    │                           │                    │
    │ • Som tocado       │                           │ • Som de erro      │
    │ • Transcricao      │                           │ • Mensagem erro    │
    │   consolidada      │                           │ • Detalhes chunk   │
    │ • Resultados       │                           │   que falhou       │
    │   de analise       │                           │ • Opcao retry      │
    └────────────────────┘                           └────────────────────┘
```

### 15.11. Tratamento de Erros na Pagina

**Processo Nao Encontrado:**
```typescript
if (!processoData) {
  setProcessoNotFound(true);
  // Redireciona para pagina 404
}
```

**Erro com Transcricao Valida:**
- Exibe aviso amarelo informando que analise pode prosseguir
- Permite visualizar transcricao consolidada

**Erro sem Transcricao:**
- Exibe card vermelho com mensagem de erro
- Mostra `progress_info.error_message`
- Para arquivos complexos: indica qual chunk falhou

**Chunks com Falha:**
- Exibe contagem de chunks que falharam
- Mostra tentativas de retry realizadas
- Indica se limite de tentativas foi atingido

### 15.12. Service de Resultados (AnalysisResultsService)

**Localizacao:** `src/services/AnalysisResultsService.ts`

**Interface AnalysisResult:**
```typescript
interface AnalysisResult {
  id: string;
  processo_id: string;
  prompt_id: string;
  prompt_title: string;
  execution_order: number;
  result_content: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  execution_time_ms?: number;
  current_model_id?: string;
  current_model_name?: string;
  tokens_used?: number;
  completed_at?: string;
}
```

**Funcoes:**

| Funcao | Descricao |
|--------|-----------|
| `getResultsByProcessoId` | Busca todos os resultados de analise (consolidados) |
| `subscribeToResultsChanges` | Cria subscription realtime |

**Subscription Realtime:**
```typescript
const channel = supabase
  .channel(`analysis-results-${processoId}`)
  .on('postgres_changes',
    { event: '*', schema: 'public', table: 'analysis_results', filter: `processo_id=eq.${processoId}` },
    (payload) => callback()
  )
  .subscribe();
```

### 15.13. Diagrama de Componentes da Pagina (Arquivos Complexos)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        ProcessoDetailPage (Arquivo Complexo)                      │
│                                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │ Header                                                                       │ │
│  │  • Botao Voltar                                                              │ │
│  │  • Nome do arquivo (editavel)                                                │ │
│  │  • Status icon + texto                                                       │ │
│  │  • Badge de Tier (MEDIUM/LARGE/VERY_LARGE/etc)                              │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │ Stats Grid (4 cards)                                                         │ │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │ │
│  │  │ Data Upload  │ │ Paginas      │ │ Caracteres   │ │ Tempo        │       │ │
│  │  │              │ │ + Chunks     │ │              │ │ + Est. Total │       │ │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘       │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │ ProcessTokenCounter                                                          │ │
│  │  • Tokens estimados (total para arquivo)                                     │ │
│  │  • Prompt atual / Total                                                      │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │ ComplexProcessingProgress (durante processamento)                            │ │
│  │  ┌─────────────────────────────────────────────────────────────────────┐   │ │
│  │  │ Fase Atual: [uploading_chunks | processing | consolidating]          │   │ │
│  │  │                                                                       │   │ │
│  │  │ ┌─────────────────────────────────────────────────────────────┐      │   │ │
│  │  │ │ Chunks: [##########----------] 10/20                         │      │   │ │
│  │  │ └─────────────────────────────────────────────────────────────┘      │   │ │
│  │  │                                                                       │   │ │
│  │  │ Workers Ativos: 4/5  |  Falhas: 0  |  Retries: 2                    │   │ │
│  │  └─────────────────────────────────────────────────────────────────────┘   │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │ Transcricao Consolidada (se completed)                                       │ │
│  │  • Toggle expandir/colapsar                                                  │ │
│  │  • Botoes copiar/baixar                                                      │ │
│  │  • Lista de paginas com conteudo (de todos os chunks)                        │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │ Progress Section (se analyzing/consolidating)                                │ │
│  │  ┌─────────────────────┐  ┌─────────────────────┐                          │ │
│  │  │ ProcessStatusBadge  │  │ ProcessStatusProgress│                          │ │
│  │  └─────────────────────┘  └─────────────────────┘                          │ │
│  │                                                                              │ │
│  │  ┌─────────────────────────────────────────────────────────────────────┐   │ │
│  │  │ AnalysisStagesProgress (Consolidacao)                                │   │ │
│  │  │  • Etapa 1: Visao Geral - [status]                                   │   │ │
│  │  │  • Etapa 2: Resumo Estrategico - [status]                            │   │ │
│  │  │  • ...                                                                │   │ │
│  │  │  • Etapa 9: Conclusoes - [status]                                    │   │ │
│  │  └─────────────────────────────────────────────────────────────────────┘   │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │ Error Section (se error)                                                     │ │
│  │  • Mensagem de erro                                                          │ │
│  │  • Chunk(s) que falhou(aram)                                                 │ │
│  │  • Tentativas realizadas                                                     │ │
│  │  • Botao de retry (se aplicavel)                                             │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 15.14. Subscriptions Especificas para Processamento Complexo

Para arquivos complexos, alem das subscriptions padrao, ha monitoramento adicional:

**Subscription para complex_processing_status:**
```typescript
const statusChannel = supabase.channel(`complex-status-${processoId}`)
  .on('postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'complex_processing_status', filter: `processo_id=eq.${processoId}` },
    (payload) => {
      updateComplexProgress(payload.new);
    }
  )
  .subscribe();
```

**Subscription para process_chunks:**
```typescript
const chunksChannel = supabase.channel(`chunks-${processoId}`)
  .on('postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'process_chunks', filter: `processo_id=eq.${processoId}` },
    (payload) => {
      updateChunkProgress(payload.new);
    }
  )
  .subscribe();
```

### 15.15. Hooks Utilizados

| Hook | Proposito |
|------|-----------|
| `useState` | Estados locais (processo, loading, chunks, etc) |
| `useEffect` | Carregamento inicial, subscriptions |
| `useRef` | Referencia para status anterior |
| `useMemo` | Calculo otimizado de totalChars |
| `useProcessProgressPolling` | Polling adaptativo |
| `useTheme` | Tema claro/escuro |

### 15.16. Responsividade

A pagina e totalmente responsiva com breakpoints:

| Breakpoint | Comportamento |
|------------|---------------|
| Mobile (< 640px) | Grid 2 colunas, texto menor, padding reduzido |
| Tablet (640-1024px) | Grid 2-4 colunas |
| Desktop (> 1024px) | Grid 4 colunas, layout expandido |

**Classes Tailwind:**
- `grid-cols-2 lg:grid-cols-4`
- `text-xs sm:text-sm`
- `p-3 sm:p-4`
- `w-3.5 h-3.5 sm:w-4 sm:h-4`

### 15.17. Metricas Exibidas para Arquivos Complexos

| Metrica | Fonte | Descricao |
|---------|-------|-----------|
| Chunks Totais | `processo.total_chunks` | Quantidade de partes do PDF |
| Chunks Completos | `complex_processing_status.chunks_completed` | Partes ja processadas |
| Chunks com Erro | `complex_processing_status.chunks_failed` | Partes que falharam |
| Workers Ativos | `complex_processing_status.current_active_workers` | Workers processando agora |
| Progresso Geral | `complex_processing_status.overall_progress_percent` | Percentual total |
| Tempo Estimado | `complex_processing_status.estimated_completion_at` | Previsao de conclusao |
| Tier | `processo.tier_name` | Classificacao do arquivo |
