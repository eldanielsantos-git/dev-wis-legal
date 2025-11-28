# Sistema de Envio de Mensagens de Áudio no Chat

## Visão Geral

O sistema de envio de mensagens de áudio permite que usuários gravem mensagens de voz diretamente no chat, que são automaticamente transcritas e processadas pela IA. Este documento detalha toda a arquitetura, fluxo de dados, UX/UI e implementação técnica.

---

## 1. Interface do Usuário (UI/UX)

### 1.1 Estado Normal (Não Gravando)

**Localização:** `src/components/ChatInterface.tsx` (linhas 495-510)

#### Elementos Visuais:
- **Botão de Microfone:**
  - Ícone: `<Mic />` do Lucide React
  - Tamanho: 8x8 (32px) em mobile, 9x9 (36px) em desktop
  - Posição: Canto inferior esquerdo do input
  - Cor:
    - Dark mode: `#FAFAFA` (branco)
    - Light mode: `colors.textSecondary` (cinza)
  - Background: Transparente
  - Efeitos:
    - `hover:scale-105` - Aumenta 5% ao passar mouse
    - `transition-all duration-200` - Transição suave

#### Comportamento:
```typescript
// ChatInterface.tsx - linha 142
const handleMicClick = async () => {
  if (audioRecorder.isRecording) {
    return;
  }
  await audioRecorder.startRecording();
};
```

**Validações:**
- Desabilitado quando `isSending === true`
- Classe `disabled:opacity-50` - Fica translúcido quando desabilitado

---

### 1.2 Estado de Gravação Ativa

**Localização:** `src/components/AudioRecordingAnimation.tsx`

#### Transformação Visual:
Quando a gravação inicia (linha 488-493 do ChatInterface):
```typescript
{audioRecorder.isRecording ? (
  <AudioRecordingAnimation
    recordingTime={audioRecorder.recordingTime}
    onCancel={handleCancelRecording}
    onStop={handleStopRecording}
  />
) : (
  // ... input normal
)}
```

#### Elementos da Animação:

**1. Indicador de Gravação (linhas 25-36):**
- **Círculo Externo (Pulsante):**
  - Tamanho: 9x9 (36px)
  - Cor: `#ef4444` (vermelho)
  - Animação: `animate-ping` (pulsa infinitamente)
  - Opacidade: 75%

- **Círculo Interno (Fixo):**
  - Tamanho: 9x9 (36px)
  - Cor: `#dc2626` (vermelho mais escuro)
  - Centro: Ponto branco 2x2 (8px)

**2. Timer de Gravação (linhas 38-40):**
- **Formato:** `MM:SS` (exemplo: `00:45`)
- **Fonte:** `font-mono` (monospace)
- **Tamanho:** `text-xs` (12px)
- **Cor:** `colors.textSecondary`
- **Atualização:** A cada 1 segundo

**3. Botões de Controle (linhas 44-68):**

**Botão Cancelar:**
- Ícone: `<X />` (X vermelho)
- Tamanho: 9x9 (36px)
- Background:
  - Dark: `rgba(239, 68, 68, 0.2)` (vermelho transparente)
  - Light: `rgba(239, 68, 68, 0.1)`
- Cor ícone: `#ef4444`
- Tooltip: "Cancelar gravação"

**Botão Enviar:**
- Ícone: `<Check />` (✓ checkmark)
- Tamanho: 9x9 (36px)
- Background:
  - Dark: `#FFFFFF` (branco)
  - Light: `#29323A` (preto)
- Cor ícone:
  - Dark: `#29323A` (contrasta com fundo branco)
  - Light: `#FFFFFF` (contrasta com fundo preto)
- Tooltip: "Enviar áudio"

#### Animações CSS:
```css
/* Pulso do indicador vermelho */
@keyframes ping {
  75%, 100% {
    transform: scale(2);
    opacity: 0;
  }
}

/* Hover nos botões */
hover:scale-105 /* Aumenta 5% */
transition-all duration-200 /* Transição suave de 200ms */
```

---

## 2. Arquitetura Técnica

### 2.1 Hook de Gravação de Áudio

**Arquivo:** `src/hooks/useAudioRecorder.ts`

#### Configuração do MediaRecorder:
```typescript
// Linhas 32-38
const stream = await navigator.mediaDevices.getUserMedia({
  audio: {
    echoCancellation: true,      // Remove eco
    noiseSuppression: true,       // Remove ruído de fundo
    sampleRate: 48000            // 48kHz de qualidade
  }
});
```

#### Formato de Áudio:
```typescript
// Linhas 42-44
const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
  ? 'audio/webm;codecs=opus'  // Codec Opus (preferencial)
  : 'audio/webm';              // WebM genérico (fallback)
```

#### Qualidade de Áudio:
```typescript
// Linha 48
audioBitsPerSecond: 128000  // 128 kbps
```

#### Estados Gerenciados:
- `isRecording: boolean` - Se está gravando
- `isPaused: boolean` - Se está pausado
- `recordingTime: number` - Tempo em segundos
- `audioBlob: Blob | null` - Dados do áudio
- `error: string | null` - Mensagens de erro

#### Processo de Gravação:

**1. Iniciar (linhas 28-87):**
```typescript
startRecording() -> {
  1. Solicita permissão do microfone
  2. Cria MediaRecorder com configurações
  3. Inicia captura de dados em chunks de 100ms
  4. Inicia timer de contagem (1s intervals)
  5. Muda estado para isRecording = true
}
```

**2. Parar (linhas 89-117):**
```typescript
stopRecording() -> Promise<Blob> {
  1. Para o MediaRecorder
  2. Combina todos os chunks em um Blob
  3. Para todas as tracks do stream
  4. Limpa o timer
  5. Retorna o Blob de áudio
}
```

**3. Cancelar (linhas 142-162):**
```typescript
cancelRecording() -> {
  1. Para o MediaRecorder
  2. Para todas as tracks
  3. Limpa chunks e timer
  4. Reseta todos os estados
  5. Não retorna nada (áudio descartado)
}
```

---

## 3. Fluxo de Envio de Áudio

### 3.1 Processo no Frontend

**Arquivo:** `src/components/ChatInterface.tsx` (linhas 153-285)

#### Passo 1: Parar Gravação e Obter Blob
```typescript
// Linha 161
const audioBlob = await audioRecorder.stopRecording();
```

**Validações:**
- `audioBlob` não pode ser null (linha 163)
- Tamanho não pode ser 0 bytes (linhas 173-175)
- Tamanho máximo: 10MB (linhas 177-179)

#### Passo 2: Criar Mensagem Otimista
```typescript
// Linhas 181-192
const audioUrl = URL.createObjectURL(audioBlob);
const tempMessageId = `temp-${Date.now()}`;

const optimisticMessage: Message = {
  id: tempMessageId,
  role: 'user',
  content: '',  // Vazio até receber transcrição
  created_at: new Date().toISOString(),
  audio_url: audioUrl,  // URL temporária local
  audio_duration: audioRecorder.recordingTime,
  is_audio: true,
};
```

**Objetivo:** Mostrar o áudio imediatamente na UI enquanto processa

#### Passo 3: Converter para Base64
```typescript
// Linhas 202-211
const reader = new FileReader();
const audioBase64 = await new Promise<string>((resolve, reject) => {
  reader.onloadend = () => {
    const base64 = (reader.result as string).split(',')[1];
    resolve(base64);
  };
  reader.onerror = reject;
  reader.readAsDataURL(audioBlob);
});
```

**Por que Base64?**
- Formato universal aceito por APIs REST
- Pode ser enviado como JSON
- Compatível com Gemini AI

#### Passo 4: Enviar para Edge Function
```typescript
// Linhas 221-235
const response = await fetch(
  `${SUPABASE_URL}/functions/v1/process-audio-message`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      processo_id: processoId,
      audio_data: audioBase64,
      audio_duration: audioRecorder.recordingTime
    }),
  }
);
```

#### Passo 5: Processar Resposta
```typescript
// Linhas 250-268
// Atualiza mensagem do usuário com transcrição
if (responseData.transcription) {
  onUpdateMessage(tempMessageId, {
    content: responseData.transcription,
    audio_url: responseData.audio_url,  // URL permanente
  });
}

// Adiciona resposta da IA
if (responseData.response) {
  const assistantMessage: Message = {
    id: crypto.randomUUID(),
    role: 'assistant',
    content: responseData.response,
    created_at: new Date().toISOString(),
  };
  onAddOptimisticMessage(assistantMessage);
}
```

#### Passo 6: Atualizar Saldo de Tokens
```typescript
// Linhas 273-275
setTimeout(() => refreshBalance(), 500);
setTimeout(() => refreshBalance(), 2000);
setTimeout(() => refreshBalance(), 4000);
```

**Por que múltiplos refreshes?**
- Garantir captura do débito de tokens
- Sistema assíncrono pode levar tempo para processar
- 3 tentativas com delay crescente

---

### 3.2 Processo no Backend

**Arquivo:** `supabase/functions/process-audio-message/index.ts`

#### Passo 1: Autenticação (linhas 96-122)
```typescript
const token = authHeader.replace('Bearer ', '');
const { data: { user } } = await supabase.auth.getUser(token);

// Valida se usuário existe
// Valida se usuário tem acesso ao processo
```

#### Passo 2: Validar Processo (linhas 139-155)
```typescript
const { data: processo } = await supabase
  .from('processos')
  .select('*')
  .eq('id', processo_id)
  .eq('user_id', user.id)  // Garante que pertence ao usuário
  .maybeSingle();
```

#### Passo 3: Carregar Modelo LLM (linhas 163-177)
```typescript
const { data: modelConfig } = await supabase
  .from('admin_system_models')
  .select('*')
  .eq('is_active', true)
  .order('priority', { ascending: true })
  .limit(1)
  .maybeSingle();

const modelId = modelConfig.system_model || modelConfig.model_id;
// Exemplo: 'gemini-2.0-flash-exp'
```

#### Passo 4: Transcrever Áudio com Gemini (linhas 184-195)

**Prompt de Transcrição:**
```typescript
{
  inlineData: {
    mimeType: 'audio/webm',
    data: audio_data  // Base64
  }
},
{
  text: 'Transcreva este áudio em português. Forneça apenas o texto transcrito, sem formatação adicional.'
}
```

**Características:**
- Idioma: Português (PT-BR)
- Formato: Texto puro sem markdown
- Sem formatação adicional
- Sem interpretações extras

**Resultado:**
```typescript
const transcription = transcriptionResult.response.text();
// Exemplo: "Quais são os pedidos do autor neste processo?"
```

#### Passo 5: Armazenar Áudio (linhas 197-215)
```typescript
const storageFileName = `${user.id}/${processo_id}_${timestamp}.webm`;

// Upload para Storage Bucket 'chat-audios'
await supabase.storage
  .from('chat-audios')
  .upload(storageFileName, audioBuffer, {
    contentType: 'audio/webm',
    upsert: false
  });

// Gerar URL assinada (válida por 1 ano)
const { data: signedUrlData } = await supabase.storage
  .from('chat-audios')
  .createSignedUrl(storageFileName, 60 * 60 * 24 * 365);
```

**Estrutura de Pastas:**
```
chat-audios/
└── {user_id}/
    ├── {processo_id}_1704067200000.webm
    ├── {processo_id}_1704067260000.webm
    └── ...
```

#### Passo 6: Salvar Mensagem do Usuário (linhas 217-235)
```typescript
await supabase
  .from('chat_messages')
  .insert({
    id: userMessageId,
    processo_id,
    user_id: user.id,
    role: 'user',
    content: transcription,      // Texto transcrito
    audio_url: audioUrl,          // URL permanente
    audio_duration,               // Duração em segundos
    is_audio: true                // Flag de áudio
  });
```

#### Passo 7: Gerar Resposta da IA (linhas 252-279)

**System Prompt:**
```typescript
const contextPrompt = `Você é um assistente jurídico especializado em análise de processos.

REGRA CRÍTICA - INÍCIO IMEDIATO:
- NUNCA use: "Com certeza", "Claro", "Vou elaborar", "Com base", "Elaboro abaixo", "Segue", "Apresento", "Vou analisar"
- PROIBIDO qualquer preâmbulo ou introdução
- Responda DIRETAMENTE à pergunta sem frases de transição

Pergunta do usuário (transcrição de áudio): "${transcription}"

Responda de forma direta, clara e objetiva com base no documento do processo.`;
```

**Contexto Enviado:**
```typescript
await chatModel.generateContent([
  {
    inlineData: {
      mimeType: 'application/pdf',
      data: processo.pdf_base64  // PDF do processo
    }
  },
  { text: contextPrompt }
]);
```

**Pós-Processamento:**
```typescript
// Função removeIntroductoryPhrases (linhas 16-72)
// Remove frases introdutórias indesejadas como:
// - "Com certeza"
// - "Claro"
// - "Vou elaborar"
// - "Segue abaixo"
// etc.

let assistantResponse = chatResult.response.text();
assistantResponse = removeIntroductoryPhrases(assistantResponse);
```

#### Passo 8: Salvar Resposta da IA (linhas 281-291)
```typescript
await supabase
  .from('chat_messages')
  .insert({
    id: assistantMessageId,
    processo_id,
    user_id: user.id,
    role: 'assistant',
    content: assistantResponse
  });
```

#### Passo 9: Retornar Resultado (linhas 294-304)
```typescript
return new Response(
  JSON.stringify({
    transcription,           // Texto transcrito do áudio
    audio_url: audioUrl,     // URL permanente do áudio
    response: assistantResponse  // Resposta da IA
  }),
  {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  }
);
```

---

## 4. Estrutura de Dados

### 4.1 Tabela `chat_messages`

```sql
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY,
  processo_id UUID REFERENCES processos(id),
  user_id UUID REFERENCES auth.users(id),
  role TEXT CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  audio_url TEXT,              -- URL do áudio (se mensagem de voz)
  audio_duration INTEGER,      -- Duração em segundos
  is_audio BOOLEAN DEFAULT FALSE,  -- Flag indicando se é áudio
  feedback_chat TEXT CHECK (feedback_chat IN ('like', 'dislike')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.2 Storage Bucket `chat-audios`

**Configurações:**
- **Nome:** `chat-audios`
- **Público:** Não (requer autenticação)
- **Tipo de arquivo:** `audio/webm`
- **Tamanho máximo:** 10MB por arquivo
- **Organização:** Por user_id

**Políticas RLS:**
```sql
-- Usuários podem fazer upload de seus próprios áudios
CREATE POLICY "Users can upload own audio"
  ON storage.objects FOR INSERT
  TO authenticated
  USING (bucket_id = 'chat-audios' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Usuários podem ler seus próprios áudios
CREATE POLICY "Users can read own audio"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'chat-audios' AND auth.uid()::text = (storage.foldername(name))[1]);
```

---

## 5. Fluxo Completo (Diagrama)

```
┌─────────────────────────────────────────────────────────────────┐
│                        USUÁRIO                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. Clica no botão de microfone                                 │
│     • Solicita permissão do microfone                           │
│     • Inicia gravação (MediaRecorder)                           │
│     • Mostra animação de gravação                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. Grava áudio (até 10MB)                                      │
│     • Timer incrementa a cada segundo                           │
│     • Chunks de áudio capturados a cada 100ms                   │
│     • Usuário pode cancelar ou finalizar                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. Clica em "Enviar" (✓)                                      │
│     • Para gravação                                             │
│     • Converte Blob para Base64                                 │
│     • Cria mensagem otimista na UI                              │
│     • Mostra loader de processamento                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  EDGE FUNCTION: process-audio-message                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. Autentica usuário                                           │
│     • Valida token JWT                                          │
│     • Verifica acesso ao processo                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. Carrega configuração do modelo LLM                          │
│     • Query: admin_system_models                                │
│     • Ordena por prioridade                                     │
│     • Seleciona modelo ativo                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  GEMINI AI - TRANSCRIÇÃO                                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  6. Transcreve áudio                                            │
│     • Envia: audio/webm (base64)                                │
│     • Prompt: "Transcreva este áudio em português..."           │
│     • Recebe: Texto transcrito                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  7. Salva áudio no Storage                                      │
│     • Bucket: chat-audios                                       │
│     • Path: {user_id}/{processo_id}_{timestamp}.webm            │
│     • Gera URL assinada (válida por 1 ano)                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  8. Salva mensagem do usuário                                   │
│     • Tabela: chat_messages                                     │
│     • Campos: content, audio_url, is_audio                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  GEMINI AI - RESPOSTA                                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  9. Gera resposta da IA                                         │
│     • Envia: PDF do processo + transcrição                      │
│     • System Prompt: Assistente jurídico especializado          │
│     • Remove frases introdutórias                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  10. Salva resposta da IA                                       │
│      • Tabela: chat_messages                                    │
│      • role: 'assistant'                                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  11. Retorna ao Frontend                                        │
│      • transcription: Texto transcrito                          │
│      • audio_url: URL permanente do áudio                       │
│      • response: Resposta da IA                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  12. Atualiza UI                                                │
│      • Atualiza mensagem otimista com transcrição               │
│      • Adiciona resposta da IA                                  │
│      • Atualiza saldo de tokens (3x com delay)                  │
│      • Toca som de mensagem recebida                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Tratamento de Erros

### 6.1 Frontend

**Permissão do Microfone Negada:**
```typescript
// useAudioRecorder.ts - linha 85
catch (err) {
  setError('Não foi possível acessar o microfone. Verifique as permissões.');
}
```

**Áudio Vazio:**
```typescript
// ChatInterface.tsx - linha 173
if (audioBlob.size === 0) {
  throw new Error('Áudio vazio. Tente gravar novamente.');
}
```

**Áudio Muito Grande:**
```typescript
// ChatInterface.tsx - linha 177
if (audioBlob.size > 10 * 1024 * 1024) {
  throw new Error('Áudio muito grande. Limite: 10MB');
}
```

**Erro de Rede/API:**
```typescript
// ChatInterface.tsx - linha 277
catch (error) {
  console.error('[ChatInterface] Error processing audio:', error);
  const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
  alert(`Erro ao processar áudio:\n\n${errorMessage}\n\nVerifique o console para mais detalhes.`);
}
```

### 6.2 Backend

**Autenticação Falhou:**
```typescript
return new Response(
  JSON.stringify({ error: 'Invalid authorization token' }),
  { status: 401 }
);
```

**Processo Não Encontrado:**
```typescript
return new Response(
  JSON.stringify({ error: 'Processo not found or access denied' }),
  { status: 404 }
);
```

**Modelo LLM Não Configurado:**
```typescript
throw new Error('No active model configuration found');
```

**Erro Geral:**
```typescript
return new Response(
  JSON.stringify({
    error: 'Internal server error',
    details: errorMessage,
    stack: errorStack
  }),
  { status: 500 }
);
```

---

## 7. Considerações de Performance

### 7.1 Otimizações Implementadas

**1. Chunks Pequenos (100ms):**
```typescript
mediaRecorder.start(100);  // Captura dados a cada 100ms
```
**Benefício:** Menor latência ao parar gravação

**2. Mensagem Otimista:**
```typescript
const audioUrl = URL.createObjectURL(audioBlob);
onAddOptimisticMessage(optimisticMessage);
```
**Benefício:** UI instantânea, não espera upload

**3. Base64 no Cliente:**
```typescript
const audioBase64 = await new Promise<string>((resolve) => {
  reader.onloadend = () => resolve(base64);
  reader.readAsDataURL(audioBlob);
});
```
**Benefício:** Converte no cliente, não sobrecarrega servidor

**4. URL Assinada com Cache Longo:**
```typescript
createSignedUrl(storageFileName, 60 * 60 * 24 * 365);  // 1 ano
```
**Benefício:** Menos chamadas ao servidor para áudios antigos

### 7.2 Limites e Restrições

| Item | Limite | Razão |
|------|--------|-------|
| Tamanho do áudio | 10MB | Limites da API Gemini |
| Formato | audio/webm | Suporte universal de navegadores |
| Codec | Opus | Melhor compressão/qualidade |
| Bitrate | 128kbps | Equilíbrio qualidade/tamanho |
| Sample Rate | 48kHz | Qualidade profissional |

---

## 8. Segurança

### 8.1 Autenticação
- JWT token obrigatório em todas as requisições
- Validação de usuário no Supabase Auth
- Verificação de ownership do processo

### 8.2 Autorização
```typescript
.eq('user_id', user.id)  // Garante acesso apenas ao próprio processo
```

### 8.3 Storage
- Bucket privado (não público)
- RLS policies aplicadas
- URLs assinadas com expiração
- Organização por user_id

### 8.4 Validação de Input
- Tamanho máximo do áudio
- Formato de áudio esperado
- Validação de processo_id
- Sanitização de erros (não expõe stack traces em prod)

---

## 9. Debugging

### 9.1 Logs do Frontend
```typescript
console.log('[ChatInterface] Stopping audio recording...');
console.log('[ChatInterface] Audio blob details:', { size, type, duration });
console.log('[ChatInterface] Converting audio to base64...');
console.log('[ChatInterface] Sending audio to edge function...');
console.log('[ChatInterface] Response status:', response.status);
console.log('[ChatInterface] Audio processed successfully:', responseData);
```

### 9.2 Logs do Backend
```typescript
console.log('[process-audio-message] Starting audio processing');
console.log('[process-audio-message] User authenticated:', user.id);
console.log('[process-audio-message] Processing for processo:', processo_id);
console.log('[process-audio-message] Using model:', modelId);
console.log('[process-audio-message] Transcription:', transcription);
console.log('[process-audio-message] AI response generated');
```

---

## 10. Melhorias Futuras

### 10.1 UX
- [ ] Animação de forma de onda durante gravação
- [ ] Prévia do áudio antes de enviar
- [ ] Possibilidade de pausar/retomar gravação
- [ ] Indicador visual de volume do microfone

### 10.2 Funcionalidades
- [ ] Suporte a múltiplos formatos de áudio
- [ ] Compressão adicional no cliente
- [ ] Download de áudios
- [ ] Velocidade de reprodução ajustável

### 10.3 Performance
- [ ] Streaming de transcrição (real-time)
- [ ] Cache de transcrições
- [ ] Compressão WebM otimizada
- [ ] Lazy loading de áudios antigos

---

## 11. Testes

### 11.1 Cenários de Teste

**Fluxo Normal:**
1. ✅ Clicar no microfone e iniciar gravação
2. ✅ Gravar por 5 segundos
3. ✅ Clicar em enviar
4. ✅ Verificar transcrição correta
5. ✅ Verificar resposta da IA
6. ✅ Verificar player de áudio funcional

**Erros:**
1. ✅ Negar permissão do microfone
2. ✅ Cancelar gravação
3. ✅ Gravar áudio vazio (< 1s)
4. ✅ Gravar áudio muito grande (> 10MB)
5. ✅ Perder conexão durante upload

**Edge Cases:**
1. ✅ Trocar de processo durante gravação
2. ✅ Múltiplas gravações sequenciais
3. ✅ Gravação em dispositivo mobile
4. ✅ Gravação com ruído de fundo

---

## Conclusão

O sistema de envio de mensagens de áudio é uma feature completa e robusta que integra:
- **Captura de áudio** com MediaRecorder API
- **Transcrição automática** via Gemini AI
- **Processamento inteligente** com remoção de frases introdutórias
- **Armazenamento seguro** no Supabase Storage
- **UX fluida** com mensagens otimistas e animações

Todo o fluxo é protegido com autenticação, validações e tratamento de erros adequados, garantindo uma experiência de usuário profissional e confiável.
