# Chat com Arquivos Pequenos (< 1.000 paginas)

Este documento descreve o fluxo completo do sistema de chat para arquivos com menos de 1.000 paginas.

## Visao Geral

Arquivos pequenos utilizam uma metodologia simplificada onde o PDF completo e enviado em formato base64 diretamente para a API do Gemini. Isso permite respostas mais rapidas e menor complexidade de processamento.

## Criterios de Classificacao

Um arquivo e considerado "pequeno" quando:
- `total_pages < 1000`
- `is_chunked = false` (nao foi dividido em chunks)
- `COUNT(analysis_results.status='completed') < 7` (menos de 7 analises completadas)

## Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                    FLUXO DE CHAT - ARQUIVOS PEQUENOS            │
└─────────────────────────────────────────────────────────────────┘

                         MENSAGEM DE TEXTO
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     ChatPage.tsx                                 │
│  • Gerencia lista de processos                                  │
│  • Controla estado das mensagens                                │
│  • Chama edge function chat-with-processo                       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                 chat-with-processo (Edge Function)               │
│                                                                  │
│  1. Valida autenticacao                                         │
│  2. Verifica tokens disponiveis (min 100)                       │
│  3. Carrega processo com pdf_base64                             │
│  4. Busca system prompt 'small_file'                            │
│  5. Envia para Gemini (inlineData com base64)                   │
│  6. Limpa resposta (remove markdown, frases introdutorias)      │
│  7. Salva mensagens em chat_messages                            │
│  8. Debita tokens                                               │
│  9. Retorna resposta                                            │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Gemini API                                │
│                                                                  │
│  Model: gemini-2.0-flash                                        │
│  Method: generateContent                                        │
│  Content: [                                                     │
│    { inlineData: { mimeType: 'application/pdf', data: base64 }},│
│    { text: system_prompt },                                     │
│    { text: user_message }                                       │
│  ]                                                              │
│  Max Output Tokens: 8192                                        │
└─────────────────────────────────────────────────────────────────┘


                         MENSAGEM DE AUDIO
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ChatInterface.tsx                             │
│  • Detecta isComplexFile = false                                │
│  • Grava audio via useAudioRecorder hook                        │
│  • Converte para base64                                         │
│  • Chama edge function process-audio-message                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              process-audio-message (Edge Function)               │
│                                                                  │
│  1. Valida autenticacao                                         │
│  2. Transcricao do audio via Gemini                             │
│  3. Upload do audio para storage (chat-audios bucket)           │
│  4. Salva mensagem do usuario com transcricao                   │
│  5. Carrega processo com pdf_base64                             │
│  6. Busca system prompt 'audio'                                 │
│  7. Envia transcricao + PDF para Gemini                         │
│  8. Salva resposta da IA                                        │
│  9. Retorna { transcription, audio_url, response }              │
└─────────────────────────────────────────────────────────────────┘
```

## Edge Functions

### chat-with-processo

**Localizacao:** `supabase/functions/chat-with-processo/index.ts`

**Endpoint:**
```
POST /functions/v1/chat-with-processo
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "processo_id": "uuid",
  "message": "string"
}
```

**Resposta:**
```json
{
  "response": "string"
}
```

**Fluxo Detalhado:**

1. **Autenticacao**
   ```typescript
   const authHeader = req.headers.get('Authorization');
   const token = authHeader?.replace('Bearer ', '');
   const { data: { user } } = await supabase.auth.getUser(token);
   ```

2. **Verificacao de Tokens**
   ```typescript
   const { data: balance } = await supabase.rpc('get_user_token_balance', { p_user_id: user.id });
   if (balance < 100) throw new Error('Tokens insuficientes');
   ```

3. **Carregamento do Processo**
   ```typescript
   const { data: processo } = await supabase
     .from('processos')
     .select('*, pdf_base64')
     .eq('id', processo_id)
     .single();
   ```

4. **Determinacao do Prompt Type**
   ```typescript
   // Para arquivos pequenos:
   promptType = 'small_file';
   ```

5. **Busca do System Prompt**
   ```typescript
   const { data: prompt } = await supabase
     .from('chat_system_prompts')
     .select('*')
     .eq('prompt_type', promptType)
     .eq('is_active', true)
     .order('priority', { ascending: false })
     .limit(1)
     .single();
   ```

6. **Chamada ao Gemini**
   ```typescript
   const result = await model.generateContent({
     contents: [
       {
         role: 'user',
         parts: [
           { inlineData: { mimeType: 'application/pdf', data: processo.pdf_base64 } },
           { text: systemPrompt },
           { text: message }
         ]
       }
     ],
     generationConfig: { maxOutputTokens: 8192 }
   });
   ```

7. **Processamento da Resposta**
   ```typescript
   let response = result.response.text();
   response = cleanMarkdownFromResponse(response);
   response = removeIntroductoryPhrases(response);
   ```

8. **Persistencia**
   ```typescript
   // Salva mensagem do usuario
   await supabase.from('chat_messages').insert({
     processo_id, user_id, role: 'user', content: message
   });

   // Salva resposta da IA
   await supabase.from('chat_messages').insert({
     processo_id, user_id, role: 'assistant', content: response
   });
   ```

9. **Debito de Tokens**
   ```typescript
   const estimatedTokens = Math.ceil((message.length + response.length) / 4);
   await supabase.rpc('debit_user_tokens', {
     p_user_id: user.id,
     p_tokens_required: estimatedTokens,
     p_operation_type: 'chat'
   });
   ```

### process-audio-message

**Localizacao:** `supabase/functions/process-audio-message/index.ts`

**Endpoint:**
```
POST /functions/v1/process-audio-message
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

1. **Transcricao do Audio**
   ```typescript
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
   ```

2. **Upload para Storage**
   ```typescript
   const fileName = `${user.id}/${processo_id}/${Date.now()}.webm`;
   await supabase.storage
     .from('chat-audios')
     .upload(fileName, audioBuffer, { contentType: 'audio/webm' });

   const { data: { signedUrl } } = await supabase.storage
     .from('chat-audios')
     .createSignedUrl(fileName, 60 * 60 * 24 * 7); // 7 dias
   ```

3. **Salvamento da Mensagem do Usuario**
   ```typescript
   await supabase.from('chat_messages').insert({
     processo_id,
     user_id,
     role: 'user',
     content: transcription,
     audio_url: signedUrl,
     audio_duration,
     is_audio: true
   });
   ```

4. **Geracao da Resposta**
   ```typescript
   const responseResult = await model.generateContent({
     contents: [{
       role: 'user',
       parts: [
         { inlineData: { mimeType: 'application/pdf', data: processo.pdf_base64 } },
         { text: systemPrompt },
         { text: transcription }
       ]
     }]
   });
   ```

## System Prompts

### Prompt Type: small_file

Usado para mensagens de texto em arquivos pequenos.

**Variaveis Disponiveis:**
- `{{USUARIO_NOME}}` / `{user_full_name}` - Nome completo do usuario
- `{user_first_name}` - Primeiro nome
- `{user_last_name}` - Sobrenome
- `{user_email}` - Email
- `{user_oab}` - Numero da OAB
- `{user_cpf}` - CPF
- `{user_city}` - Cidade
- `{user_state}` - Estado
- `{user_phone}` - Telefone
- `{{DATA_HORA_ATUAL}}` - Data/hora atual (Sao Paulo)
- `{processo_name}` - Nome do arquivo
- `{total_pages}` - Total de paginas

**Exemplo de Prompt:**
```
Voce e um assistente juridico especializado em analise de processos judiciais brasileiros.

Usuario: {{USUARIO_NOME}}
Data/Hora: {{DATA_HORA_ATUAL}}
Processo: {processo_name} ({total_pages} paginas)

Analise o documento PDF anexado e responda as perguntas do usuario de forma clara e objetiva.
```

### Prompt Type: audio

Usado para mensagens de audio em arquivos pequenos.

**Caracteristicas:**
- Similar ao `small_file`
- Pode incluir instrucoes especificas para respostas mais conversacionais
- Contexto key: `chat_audio` (8192 tokens)

## Banco de Dados

### Tabela: chat_messages

```sql
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID REFERENCES processos(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  audio_url TEXT,
  audio_duration INTEGER,
  is_audio BOOLEAN DEFAULT false,
  feedback_chat TEXT CHECK (feedback_chat IN ('like', 'dislike')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chat messages"
  ON chat_messages FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own chat messages"
  ON chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());
```

### Tabela: chat_system_prompts

```sql
CREATE TABLE chat_system_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_type TEXT NOT NULL CHECK (prompt_type IN (
    'small_file', 'large_file_chunks', 'consolidated_analysis',
    'audio', 'audio_complex'
  )),
  system_prompt TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Tabela: chat_intro_prompts

```sql
CREATE TABLE chat_intro_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_text TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## Gerenciamento de Tokens

### Verificacao Pre-Envio

```typescript
// Em ChatInterface.tsx
const checkTokenAvailability = async () => {
  const balance = await TokenValidationService.getUserTokenBalance(user.id);
  if (balance < 100) {
    setShowNoTokensModal(true);
    return false;
  }
  return true;
};
```

### Calculo de Consumo

```typescript
// Formula de estimativa
const estimatedTokens = Math.ceil((messageLength + responseLength) / 4);
// Aproximadamente 4 caracteres = 1 token
```

### Contexto de Limite

```typescript
// Para arquivos pequenos
const contextKey = 'chat_standard';
const maxOutputTokens = 8192;

// Para audio
const contextKey = 'chat_audio';
const maxOutputTokens = 8192;
```

## Tratamento de Erros

### Erros Comuns

| Erro | Causa | Tratamento |
|------|-------|------------|
| `Tokens insuficientes` | Balance < 100 | Modal NoTokensModal |
| `PDF nao encontrado` | pdf_base64 null | Mensagem de erro + retry |
| `Gemini timeout` | PDF muito grande | Retry com backoff |
| `Prompt nao encontrado` | System prompt inativo | Fallback para prompt padrao |

### Retry Logic

```typescript
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
  try {
    const result = await model.generateContent(...);
    return result;
  } catch (error) {
    if (attempt === MAX_RETRIES - 1) throw error;
    await new Promise(r => setTimeout(r, RETRY_DELAY * (attempt + 1)));
  }
}
```

## Limpeza de Respostas

### cleanMarkdownFromResponse

```typescript
function cleanMarkdownFromResponse(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '')  // Remove code blocks
    .replace(/`[^`]*`/g, '')          // Remove inline code
    .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
    .replace(/\*([^*]+)\*/g, '$1')     // Remove italic
    .replace(/~~([^~]+)~~/g, '$1')     // Remove strikethrough
    .replace(/^#+\s*/gm, '')           // Remove headings
    .trim();
}
```

### removeIntroductoryPhrases

```typescript
function removeIntroductoryPhrases(text: string): string {
  const patterns = [
    /^(Com certeza|Claro|Vou elaborar|Vou explicar|Entendi|Certo)[,!.]?\s*/i,
    /^(Baseado no documento|De acordo com o processo)[,]?\s*/i
  ];

  for (const pattern of patterns) {
    text = text.replace(pattern, '');
  }

  return text;
}
```

## Metricas e Limites

| Metrica | Valor | Descricao |
|---------|-------|-----------|
| Max paginas | 999 | Limite para classificacao pequeno |
| Max output tokens | 8.192 | Limite de resposta Gemini |
| Min tokens requeridos | 100 | Para enviar mensagem |
| Max audio size | 10 MB | Limite de upload |
| Audio URL validade | 7 dias | Expiracao signed URL |
| Retry attempts | 3 | Tentativas em erro |

## Fluxo de Dados Completo

```
USUARIO ENVIA MENSAGEM
        │
        ▼
┌───────────────────┐
│   ChatPage.tsx    │
│   handleSend()    │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Verificar Tokens  │──── < 100 ────► Modal NoTokens
│ (100 minimo)      │
└─────────┬─────────┘
          │ >= 100
          ▼
┌───────────────────┐
│ Edge Function     │
│ chat-with-processo│
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Carregar Processo │
│ + pdf_base64      │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Buscar Prompt     │
│ type='small_file' │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Gemini API        │
│ inlineData(base64)│
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Limpar Resposta   │
│ (markdown, intro) │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Salvar Mensagens  │
│ chat_messages     │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Debitar Tokens    │
│ debit_user_tokens │
└─────────┬─────────┘
          │
          ▼
     RESPOSTA AO
      USUARIO
```
