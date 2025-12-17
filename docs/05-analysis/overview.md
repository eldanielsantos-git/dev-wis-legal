# Sistema de Análise - Overview

Core do sistema: processamento de PDFs e análise com IA.

## Pipeline Completo

```
1. Upload PDF → Supabase Storage
2. Extract text → pdf.js
3. Split into chunks → ~50k tokens cada
4. Upload to Gemini → File API
5. Process chunks → Parallel workers
6. Consolidate → Final results
```

## 10 Tipos de Análise

1. **Visão Geral do Processo** - Dados básicos, partes, timeline
2. **Resumo Estratégico** - Questões jurídicas principais
3. **Comunicações e Prazos** - Prazos processuais
4. **Riscos e Alertas** - Pontos críticos
5. **Estratégias Jurídicas** - Linhas de defesa/ataque
6. **Balanço Financeiro** - Valores em discussão
7. **Admissibilidade Recursal** - Análise de recursos
8. **Mapa de Preclusões** - Oportunidades perdidas
9. **Conclusões e Perspectivas** - Cenários possíveis
10. **Análise Forense** - Investigação profunda

## Arquitetura

### Edge Functions

- **start-analysis** - Inicia processamento
- **upload-to-gemini** - Upload para Gemini File API
- **process-next-prompt** - Worker principal (loop)
- **consolidation-worker** - Consolida resultados
- **chat-with-processo** - Chat interativo

### Database Tables

- `processos` - Processos e status
- `chunks` - Pedaços de texto
- `analysis_results` - Resultados parciais e finais
- `chat_messages` - Histórico de chat

## Fluxo Detalhado

### 1. Start Analysis

```typescript
// start-analysis Edge Function
async function startAnalysis(processoId: string) {
  // 1. Load PDF from storage
  const pdf = await loadPDF(processoId);

  // 2. Extract text
  const text = await extractText(pdf);

  // 3. Calculate tokens
  const totalTokens = countTokens(text);

  // 4. Check/Reserve tokens
  await reserveTokens(userId, totalTokens);

  // 5. Create chunks
  const chunks = splitIntoChunks(text);
  await saveChunks(processoId, chunks);

  // 6. Upload to Gemini
  const fileUri = await uploadToGemini(pdf);
  await updateProcesso(processoId, { gemini_file_uri: fileUri });

  // 7. Trigger worker
  await triggerWorker();
}
```

### 2. Process Worker

```typescript
// process-next-prompt Worker (runs in loop)
while (true) {
  // Get next pending chunk
  const chunk = await getNextPendingChunk();
  if (!chunk) break;

  // Mark as processing
  await markProcessing(chunk.id);

  try {
    // Build prompt
    const prompt = buildPrompt(chunk);

    // Call Gemini
    const response = await gemini.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { fileData: { fileUri: geminiFileUri } },
            { text: prompt }
          ]
        }
      ]
    });

    // Parse and save
    const result = parseJSON(response);
    await saveAnalysisResult(chunk.id, result);

    // Mark complete
    await markCompleted(chunk.id);

    // Update progress
    await updateProgress(processoId);
  } catch (error) {
    await handleError(chunk, error);
  }
}
```

### 3. Consolidation

Quando todos os chunks completam:

```typescript
// consolidation-worker
async function consolidate(processoId: string) {
  // Get all partial results
  const partials = await getPartialResults(processoId);

  // Group by analysis type
  const grouped = groupByType(partials);

  // For each type, consolidate
  for (const [type, results] of Object.entries(grouped)) {
    const consolidated = await consolidateWithGemini(type, results);
    await saveFinalResult(processoId, type, consolidated);
  }

  // Mark processo complete
  await markProcessoCompleted(processoId);

  // Deduct tokens
  await deductReservedTokens(processoId);

  // Send notification
  await sendCompletionEmail(userId);
}
```

## Chat System

```typescript
// chat-with-processo Edge Function
async function chat(processoId: string, message: string) {
  // 1. Reserve tokens
  await reserveTokens(userId, estimatedTokens);

  // 2. Build context
  const context = {
    systemPrompt: getSystemPrompt(),
    processData: await getProcessData(processoId),
    analysisResults: await getAnalysisResults(processoId),
    chatHistory: await getChatHistory(processoId, limit: 10),
    newMessage: message
  };

  // 3. Call Gemini
  const response = await gemini.generateContentStream(context);

  // 4. Stream response
  for await (const chunk of response.stream) {
    yield chunk.text();
  }

  // 5. Save messages
  await saveChatMessage(processoId, 'user', message);
  await saveChatMessage(processoId, 'assistant', fullResponse);

  // 6. Deduct tokens
  await deductTokens(userId, actualTokensUsed);
}
```

## Error Handling

### Retry Logic

```typescript
if (chunk.retry_count < 3) {
  await updateChunk(chunk.id, {
    status: 'pending',
    retry_count: chunk.retry_count + 1
  });
} else {
  // Move to dead letter queue
  await updateChunk(chunk.id, {
    status: 'failed',
    dead_letter_at: new Date()
  });
  await sendAdminNotification(chunk);
}
```

### Recovery

- **recover-stuck-processes** - Identifica e recupera processos travados
- **auto-restart-failed-chunks** - Reinicia chunks falhados
- **health-check-worker** - Monitora sistema

## Performance

**Tempos Médios:**
- Processo pequeno (< 100 páginas): 2-5 min
- Processo médio (100-500 páginas): 5-15 min
- Processo grande (500-1000 páginas): 15-30 min
- Processo muito grande (1000-5000 páginas): 30-120 min

**Otimizações:**
- Context caching (Gemini)
- Processamento paralelo
- Chunk size otimizado (~50k tokens)

---

[← Voltar ao Analysis](./README.md)
