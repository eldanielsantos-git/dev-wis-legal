# Chat com Arquivos Grandes (>= 1.000 paginas)

Este documento descreve o fluxo completo do sistema de chat para arquivos com 1.000 ou mais paginas, incluindo o modo de analises consolidadas.

## Visao Geral

Arquivos grandes utilizam metodologias mais sofisticadas para fornecer contexto ao modelo de IA. O sistema detecta automaticamente a complexidade e escolhe a melhor estrategia entre tres opcoes:

1. **Chunks via Gemini File API** - PDFs divididos em partes menores
2. **Analises Consolidadas** - Contexto baseado em 7+ analises completadas
3. **Hibrido** - Combina chunks com analises quando disponivel

## Criterios de Classificacao

Um arquivo e considerado "grande/complexo" quando QUALQUER uma das condicoes e verdadeira:

```typescript
const isComplexFile =
  (total_pages >= 1000) ||
  (analysisCount >= 7) ||
  (is_chunked && total_chunks_count > 0);
```

| Criterio | Condicao | Metodologia Resultante |
|----------|----------|------------------------|
| **Paginas** | `total_pages >= 1000` | `large_file_chunks` |
| **Analises** | `completed_analyses >= 7` | `consolidated_analysis` |
| **Chunked** | `is_chunked = true` | `large_file_chunks` |

## Hierarquia de Decisao

O sistema prioriza as metodologias na seguinte ordem:

```
1. Se 7+ analises completadas:
   └─► consolidated_analysis (MAIOR PRIORIDADE)

2. Senao, se is_chunked e total_chunks_count > 0:
   └─► large_file_chunks

3. Senao:
   └─► small_file (fallback)
```

## Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                 FLUXO DE CHAT - ARQUIVOS GRANDES                │
└─────────────────────────────────────────────────────────────────┘

                         MENSAGEM DO USUARIO
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ChatInterface.tsx                             │
│                                                                  │
│  Deteccao de Complexidade:                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ isComplexFile =                                         │    │
│  │   (total_pages >= 1000) ||                             │    │
│  │   (analysisCount >= 7) ||                              │    │
│  │   (is_chunked && total_chunks_count > 0)               │    │
│  └─────────────────────────────────────────────────────────┘    │
└────────────────────────────┬────────────────────────────────────┘
                             │
            ┌────────────────┴────────────────┐
            │                                 │
            ▼                                 ▼
      TEXTO                              AUDIO
            │                                 │
            ▼                                 ▼
┌───────────────────────┐        ┌───────────────────────┐
│  chat-with-processo   │        │ chat-audio-complex    │
│                       │        │        -files         │
│  Determina promptType:│        │                       │
│  • consolidated_analys│        │  Processa audio:      │
│  • large_file_chunks  │        │  • Transcricao        │
│                       │        │  • Upload storage     │
└───────────┬───────────┘        │  • Contexto chunks/   │
            │                    │    analises           │
            │                    └───────────┬───────────┘
            │                                │
            └────────────┬───────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Gemini API                                │
│                                                                  │
│  Metodologia 1: large_file_chunks                               │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ contents: [                                             │    │
│  │   { fileData: { fileUri: 'gemini://chunk_1_uri' } },   │    │
│  │   { fileData: { fileUri: 'gemini://chunk_2_uri' } },   │    │
│  │   { fileData: { fileUri: 'gemini://chunk_N_uri' } },   │    │
│  │   { text: chunk_metadata },                            │    │
│  │   { text: system_prompt },                             │    │
│  │   { text: user_message }                               │    │
│  │ ]                                                       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Metodologia 2: consolidated_analysis                           │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ contents: [                                             │    │
│  │   { text: "Analise 1: Visao Geral\n..." },             │    │
│  │   { text: "Analise 2: Riscos\n..." },                  │    │
│  │   { text: "Analise N: ...\n..." },                     │    │
│  │   { text: system_prompt },                             │    │
│  │   { text: user_message }                               │    │
│  │ ]                                                       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Max Output Tokens: 16384                                       │
└─────────────────────────────────────────────────────────────────┘
```

## Metodologias Detalhadas

### Metodologia 1: Large File Chunks

Usada quando o PDF foi dividido em chunks e carregado no Gemini File API.

**Quando e usada:**
- `is_chunked = true`
- `total_chunks_count > 0`
- Menos de 7 analises completadas

**Fonte de Dados:**
```sql
SELECT
  chunk_index,
  start_page,
  end_page,
  pages_count,
  gemini_file_uri
FROM process_chunks
WHERE processo_id = ?
  AND status = 'completed'
ORDER BY chunk_index;
```

**Estrutura do Contexto:**
```typescript
const contents = [
  // Chunks como fileData
  ...chunks.map(chunk => ({
    fileData: { fileUri: chunk.gemini_file_uri }
  })),

  // Metadata dos chunks
  {
    text: chunks.map(c =>
      `Chunk ${c.chunk_index}: Paginas ${c.start_page}-${c.end_page}`
    ).join('\n')
  },

  // System prompt
  { text: systemPrompt },

  // Mensagem do usuario
  { text: userMessage }
];
```

**Vantagens:**
- Contexto completo do documento
- Preserva formatacao original
- Permite referencia a paginas especificas

**Desvantagens:**
- Maior consumo de tokens
- Requer chunks carregados no Gemini

### Metodologia 2: Consolidated Analysis

Usada quando existem 7 ou mais analises completadas para o processo.

**Quando e usada:**
- `COUNT(analysis_results.status='completed') >= 7`
- Tem MAIOR prioridade que chunks

**Fonte de Dados:**
```sql
SELECT
  prompt_title,
  result_content,
  execution_order
FROM analysis_results
WHERE processo_id = ?
  AND status = 'completed'
ORDER BY execution_order;
```

**Estrutura do Contexto:**
```typescript
const analysisContext = analysisResults.map(result =>
  `## ${result.prompt_title}\n\n${result.result_content}`
).join('\n\n---\n\n');

const contents = [
  // Analises formatadas como texto
  { text: analysisContext },

  // System prompt
  { text: systemPrompt },

  // Mensagem do usuario
  { text: userMessage }
];
```

**Vantagens:**
- Contexto pre-processado e estruturado
- Menor consumo de tokens
- Respostas mais especializadas
- Nao requer chunks no Gemini

**Desvantagens:**
- Depende da qualidade das analises
- Pode perder detalhes especificos do documento

## Edge Functions

### chat-with-processo (Texto)

**Localizacao:** `supabase/functions/chat-with-processo/index.ts`

**Fluxo para Arquivos Grandes:**

```typescript
// 1. Verificar quantidade de analises
const { data: analysisResults } = await supabase
  .from('analysis_results')
  .select('*')
  .eq('processo_id', processo_id)
  .eq('status', 'completed')
  .order('execution_order');

// 2. Determinar tipo de prompt
let promptType: string;
if (analysisResults && analysisResults.length >= 7) {
  promptType = 'consolidated_analysis';
} else if (processo.is_chunked && processo.total_chunks_count > 0) {
  promptType = 'large_file_chunks';
} else {
  promptType = 'small_file';
}

// 3. Construir contexto baseado no tipo
if (promptType === 'consolidated_analysis') {
  // Usar analises como contexto
  const analysisContext = analysisResults
    .map(r => `## ${r.prompt_title}\n\n${r.result_content}`)
    .join('\n\n---\n\n');

  parts.push({ text: analysisContext });

} else if (promptType === 'large_file_chunks') {
  // Carregar chunks do Gemini File API
  const { data: chunks } = await supabase
    .from('process_chunks')
    .select('*')
    .eq('processo_id', processo_id)
    .eq('status', 'completed')
    .order('chunk_index');

  // Adicionar fileData para cada chunk
  for (const chunk of chunks) {
    parts.push({
      fileData: { fileUri: chunk.gemini_file_uri }
    });
  }

  // Adicionar metadata
  const metadata = chunks
    .map(c => `Chunk ${c.chunk_index}: Paginas ${c.start_page}-${c.end_page}`)
    .join('\n');
  parts.push({ text: metadata });
}

// 4. Gerar resposta com limite aumentado
const result = await model.generateContent({
  contents: [{ role: 'user', parts }],
  generationConfig: { maxOutputTokens: 16384 }
});
```

### chat-audio-complex-files (Audio)

**Localizacao:** `supabase/functions/chat-audio-complex-files/index.ts`

**Endpoint:**
```
POST /functions/v1/chat-audio-complex-files
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "processo_id": "uuid",
  "audio_data": "base64 (WebM)",
  "audio_duration": number
}
```

**Resposta:**
```json
{
  "transcription": "string",
  "audio_url": "string (signed URL)",
  "response": "string"
}
```

**Fluxo Detalhado:**

```typescript
// 1. Transcricao do audio
const transcriptionResult = await model.generateContent({
  contents: [{
    role: 'user',
    parts: [
      { inlineData: { mimeType: 'audio/webm', data: audio_data } },
      { text: 'Transcreva o audio em portugues brasileiro.' }
    ]
  }]
});
const transcription = transcriptionResult.response.text();

// 2. Upload para storage
const fileName = `${user.id}/${processo_id}/${Date.now()}.webm`;
await supabase.storage
  .from('chat-audios')
  .upload(fileName, audioBuffer);

// 3. Salvar mensagem do usuario
await supabase.from('chat_messages').insert({
  processo_id, user_id, role: 'user',
  content: transcription,
  audio_url: signedUrl,
  is_audio: true
});

// 4. Determinar contexto (igual ao texto)
const analysisCount = await getCompletedAnalysisCount(processo_id);
let contextParts = [];

if (analysisCount >= 7) {
  // Usar analises consolidadas
  const analyses = await getCompletedAnalyses(processo_id);
  contextParts.push({
    text: analyses.map(a => `## ${a.prompt_title}\n${a.result_content}`).join('\n\n')
  });
} else if (processo.is_chunked) {
  // Usar chunks do Gemini
  const chunks = await getProcessChunks(processo_id);
  for (const chunk of chunks) {
    contextParts.push({ fileData: { fileUri: chunk.gemini_file_uri } });
  }
}

// 5. Buscar system prompt para audio_complex
const prompt = await getSystemPrompt('audio_complex');

// 6. Gerar resposta
const result = await model.generateContent({
  contents: [{
    role: 'user',
    parts: [
      ...contextParts,
      { text: prompt.system_prompt },
      { text: transcription }
    ]
  }],
  generationConfig: { maxOutputTokens: 16384 }
});

// 7. Salvar e retornar
await supabase.from('chat_messages').insert({
  processo_id, user_id, role: 'assistant',
  content: result.response.text()
});

return { transcription, audio_url: signedUrl, response: result.response.text() };
```

## System Prompts

### Prompt Type: large_file_chunks

Usado para texto em arquivos divididos em chunks.

**Caracteristicas:**
- Instrucoes para navegar entre chunks
- Referencias a metadados de paginas
- Contexto key: `chat_complex_files` (16384 tokens)

**Variaveis Adicionais:**
- `{chunks_count}` - Numero de chunks
- `{total_pages}` - Total de paginas

**Exemplo:**
```
Voce e um assistente juridico especializado em analise de processos judiciais extensos.

Usuario: {{USUARIO_NOME}}
Data/Hora: {{DATA_HORA_ATUAL}}
Processo: {processo_name}
Total de Paginas: {total_pages}
Chunks: {chunks_count}

O documento foi dividido em multiplos chunks para processamento. Cada chunk contem uma faixa de paginas.
Ao responder:
- Cite o numero da pagina quando relevante
- Considere o contexto entre chunks
- Se a informacao cruza chunks, mencione isso
```

### Prompt Type: consolidated_analysis

Usado quando 7+ analises estao disponiveis.

**Caracteristicas:**
- Instrucoes para usar analises pre-existentes
- Referencia a tipos de analise disponiveis
- Contexto key: `chat_complex_files` (16384 tokens)

**Exemplo:**
```
Voce e um assistente juridico com acesso a analises detalhadas deste processo.

Usuario: {{USUARIO_NOME}}
Data/Hora: {{DATA_HORA_ATUAL}}
Processo: {processo_name}

Voce tem acesso as seguintes analises ja realizadas:
- Visao Geral do Processo
- Riscos e Alertas
- Estrategias Juridicas
- Comunicacoes e Prazos
- Mapa de Preclusoes
- Admissibilidade Recursal
- Balanco Financeiro

Use estas analises para responder as perguntas do usuario de forma precisa e fundamentada.
Cite qual analise voce esta referenciando quando apropriado.
```

### Prompt Type: audio_complex

Usado para audio em arquivos grandes.

**Caracteristicas:**
- Combina instrucoes de audio com contexto complexo
- Pode ser mais conversacional
- Contexto key: `chat_audio_complex` (16384 tokens)

## Banco de Dados

### Tabela: process_chunks

Armazena informacoes dos chunks para arquivos grandes.

```sql
CREATE TABLE process_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID REFERENCES processos(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  start_page INTEGER NOT NULL,
  end_page INTEGER NOT NULL,
  pages_count INTEGER NOT NULL,
  storage_path TEXT,
  gemini_file_uri TEXT,
  gemini_file_name TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'uploading', 'completed', 'failed')),
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  uploaded_at TIMESTAMPTZ,

  UNIQUE(processo_id, chunk_index)
);

-- Indices para performance
CREATE INDEX idx_process_chunks_processo_id ON process_chunks(processo_id);
CREATE INDEX idx_process_chunks_status ON process_chunks(status);
```

### Tabela: analysis_results

Armazena resultados das analises (usado para contexto consolidado).

```sql
CREATE TABLE analysis_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID REFERENCES processos(id) ON DELETE CASCADE,
  prompt_id UUID REFERENCES analysis_prompts(id),
  prompt_title TEXT NOT NULL,
  result_content TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'running', 'completed', 'failed'
  )),
  execution_order INTEGER NOT NULL,
  tokens_used INTEGER,
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Indice para contagem rapida
CREATE INDEX idx_analysis_results_completed ON analysis_results(processo_id, status)
  WHERE status = 'completed';
```

### Tabela: token_limits_config

Configuracao de limites de tokens por contexto.

```sql
CREATE TABLE token_limits_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  context_key TEXT UNIQUE NOT NULL,
  max_output_tokens INTEGER NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Valores padrao para arquivos grandes
INSERT INTO token_limits_config (context_key, max_output_tokens, description) VALUES
  ('chat_complex_files', 16384, 'Chat texto com arquivos grandes'),
  ('chat_audio_complex', 16384, 'Chat audio com arquivos grandes');
```

## Fluxo de Deteccao no Frontend

```typescript
// ChatInterface.tsx - Linhas 242-259

// Carregar dados do processo
const { data: processoData } = await supabase
  .from('processos')
  .select('total_pages, is_chunked, total_chunks_count')
  .eq('id', processoId)
  .single();

// Contar analises completadas
const { count: analysisCount } = await supabase
  .from('analysis_results')
  .select('*', { count: 'exact', head: true })
  .eq('processo_id', processoId)
  .eq('status', 'completed');

// Determinar complexidade
const isComplexFile =
  (processoData && processoData.total_pages >= 1000) ||
  (analysisCount && analysisCount >= 7) ||
  (processoData && processoData.is_chunked && processoData.total_chunks_count > 0);

// Selecionar edge function para audio
const audioEndpoint = isComplexFile
  ? 'chat-audio-complex-files'
  : 'process-audio-message';
```

## Gerenciamento de Tokens

### Limites por Contexto

| Contexto | Max Output Tokens | Descricao |
|----------|-------------------|-----------|
| `chat_complex_files` | 16.384 | Texto, arquivos grandes |
| `chat_audio_complex` | 16.384 | Audio, arquivos grandes |

### Calculo de Consumo

O consumo de tokens e maior para arquivos grandes devido ao contexto expandido:

```typescript
// Estimativa base
const baseTokens = Math.ceil((message.length + response.length) / 4);

// Fator de contexto para arquivos grandes
const contextFactor = isComplexFile ? 1.5 : 1.0;

// Tokens finais
const estimatedTokens = Math.ceil(baseTokens * contextFactor);
```

## Comparativo de Performance

| Aspecto | Chunks | Consolidated Analysis |
|---------|--------|----------------------|
| **Latencia** | Maior (carrega N chunks) | Menor (texto pre-processado) |
| **Precisao** | Alta (documento completo) | Media (depende das analises) |
| **Custo tokens** | Alto | Medio |
| **Referencia paginas** | Sim | Indireta |
| **Requer pre-processamento** | Sim (upload chunks) | Sim (7+ analises) |

## Tratamento de Erros

### Erros Especificos para Arquivos Grandes

| Erro | Causa | Tratamento |
|------|-------|------------|
| `Chunks nao encontrados` | Upload incompleto | Aguardar processamento |
| `Gemini File API expired` | URI expirou (48h) | Re-upload dos chunks |
| `Analises insuficientes` | < 7 completadas | Fallback para chunks |
| `Context too large` | Muitos chunks | Limitar chunks enviados |

### Fallback Strategy

```typescript
async function getContextForChat(processo_id: string) {
  // 1. Tentar analises consolidadas (maior prioridade)
  const analyses = await getCompletedAnalyses(processo_id);
  if (analyses.length >= 7) {
    return { type: 'consolidated', data: analyses };
  }

  // 2. Tentar chunks
  const chunks = await getCompletedChunks(processo_id);
  if (chunks.length > 0) {
    return { type: 'chunks', data: chunks };
  }

  // 3. Fallback para PDF base64 (se < 1000 paginas)
  const processo = await getProcesso(processo_id);
  if (processo.pdf_base64 && processo.total_pages < 1000) {
    return { type: 'base64', data: processo.pdf_base64 };
  }

  // 4. Erro - sem contexto disponivel
  throw new Error('Nenhum contexto disponivel para chat');
}
```

## Diagrama de Estados

```
                    PROCESSO CRIADO
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│              CLASSIFICACAO INICIAL                   │
│                                                      │
│   total_pages < 1000?                               │
│   ├── SIM ─► SMALL FILE (chat normal)               │
│   └── NAO ─► LARGE FILE (inicia chunking)           │
└────────────────────────┬────────────────────────────┘
                         │
                         ▼ (Large File)
┌─────────────────────────────────────────────────────┐
│              CHUNKING E UPLOAD                       │
│                                                      │
│   • Dividir PDF em chunks                           │
│   • Upload para Gemini File API                     │
│   • Registrar URIs em process_chunks                │
└────────────────────────┬────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│              ANALISE DO PROCESSO                     │
│                                                      │
│   • Executar 10 prompts de analise                  │
│   • Cada resultado salvo em analysis_results        │
│   • Contagem incrementa progressivamente            │
└────────────────────────┬────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│              CHAT DISPONIVEL                         │
│                                                      │
│   completed_analyses >= 7?                          │
│   ├── SIM ─► consolidated_analysis                  │
│   └── NAO ─► large_file_chunks                      │
└─────────────────────────────────────────────────────┘
```

## Metricas e Limites

| Metrica | Valor | Descricao |
|---------|-------|-----------|
| Min paginas (grande) | 1.000 | Limite inferior |
| Min analises (consolidated) | 7 | Para usar contexto de analises |
| Max output tokens | 16.384 | Limite de resposta |
| Max chunks por request | 20 | Limite pratico Gemini |
| Chunk TTL (Gemini) | 48 horas | Tempo de vida do fileUri |
| Audio max size | 10 MB | Limite de upload |

## Logs e Debugging

O sistema utiliza emojis padronizados para facilitar debug:

```typescript
// chat-with-processo
console.log('🔍 Verificando tipo de arquivo:', { total_pages, is_chunked, analysis_count });
console.log('📊 Prompt type selecionado:', promptType);
console.log('📁 Chunks carregados:', chunks?.length || 0);
console.log('📝 Analises disponiveis:', analysisResults?.length || 0);
console.log('🤖 Chamando Gemini com', parts.length, 'partes');
console.log('✅ Resposta gerada com sucesso');

// chat-audio-complex-files
console.log('🎤 Transcricao iniciada');
console.log('📤 Audio uploaded:', signedUrl);
console.log('🔄 Determinando contexto para arquivo complexo');
console.log('✨ Resposta de audio complexo gerada');
```
