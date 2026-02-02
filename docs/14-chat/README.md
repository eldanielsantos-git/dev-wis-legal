# 14. Sistema de Chat com Processos

Esta secao contem documentacao tecnica detalhada sobre o sistema de chat interativo com processos juridicos.

## Documentos Disponiveis

### 1. [Chat com Arquivos Pequenos](./chat-small-files.md)

Documentacao completa do fluxo de chat para arquivos com ate 999 paginas.

**Conteudo:**
- Metodologia de contexto (PDF completo em base64)
- Edge functions utilizadas
- Fluxo de mensagens de texto
- Fluxo de mensagens de audio
- Sistema de prompts
- Gerenciamento de tokens
- Tabelas do banco de dados

### 2. [Chat com Arquivos Grandes](./chat-large-files.md)

Documentacao completa do fluxo de chat para arquivos com 1.000+ paginas ou com 7+ analises completadas.

**Conteudo:**
- Tres metodologias de contexto (Chunks, Analises Consolidadas, Hibrido)
- Edge functions utilizadas
- Integracao com Gemini File API
- Sistema de prompts especializados
- Gerenciamento de tokens
- Diferenciacao automatica de complexidade

## Visao Geral da Arquitetura

```
                    ┌─────────────────────────────────────┐
                    │       MENSAGEM DO USUARIO           │
                    │       (Texto ou Audio)              │
                    └─────────────────┬───────────────────┘
                                      │
                                      ▼
                    ┌─────────────────────────────────────┐
                    │   DETECCAO DE COMPLEXIDADE          │
                    │   (ChatInterface.tsx)               │
                    └─────────────────┬───────────────────┘
                                      │
                          ┌───────────┴───────────┐
                          │                       │
                          ▼                       ▼
            ┌─────────────────────┐   ┌─────────────────────┐
            │   ARQUIVO PEQUENO   │   │   ARQUIVO GRANDE    │
            │   (< 1.000 paginas) │   │   (>= 1.000 paginas │
            │                     │   │    OU 7+ analises)  │
            └──────────┬──────────┘   └──────────┬──────────┘
                       │                         │
          ┌────────────┼────────────┐ ┌──────────┼──────────┐
          │            │            │ │          │          │
          ▼            ▼            ▼ ▼          ▼          ▼
     ┌─────────┐ ┌──────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
     │  Texto  │ │  Audio   │ │  Texto  │ │ Audio   │ │Consolid.│
     │         │ │          │ │ Chunks  │ │ Complex │ │ Analise │
     └────┬────┘ └────┬─────┘ └────┬────┘ └────┬────┘ └────┬────┘
          │           │            │           │           │
          ▼           ▼            ▼           ▼           ▼
     ┌─────────────────────────────────────────────────────────┐
     │                    GEMINI API                            │
     │   • inlineData (base64) - Arquivos Pequenos             │
     │   • fileData (File API) - Chunks de Arquivos Grandes    │
     │   • text (analises) - Contexto Consolidado              │
     └─────────────────────────────────────────────────────────┘
```

## Criterios de Complexidade

O sistema utiliza tres criterios para determinar se um arquivo e complexo:

| Criterio | Condicao | Resultado |
|----------|----------|-----------|
| **Paginas** | `total_pages >= 1000` | COMPLEXO |
| **Analises** | `COUNT(status='completed') >= 7` | COMPLEXO |
| **Chunked** | `is_chunked = true AND total_chunks_count > 0` | COMPLEXO |

**Logica:** Se QUALQUER criterio for verdadeiro, o arquivo e tratado como complexo.

## Principais Diferencas entre Fluxos

| Aspecto | Arquivos Pequenos | Arquivos Grandes |
|---------|-------------------|------------------|
| Paginas | < 1.000 | >= 1.000 |
| Contexto | PDF completo (base64) | Chunks ou Analises |
| Max Output Tokens | 8.192 | 16.384 |
| Edge Function Texto | `chat-with-processo` | `chat-with-processo` |
| Edge Function Audio | `process-audio-message` | `chat-audio-complex-files` |
| System Prompt | `small_file` / `audio` | `large_file_chunks` / `audio_complex` / `consolidated_analysis` |
| Gemini API | `inlineData` | `fileData` |

## Componentes Principais

### Frontend
- `ChatPage.tsx` - Pagina principal do chat
- `ChatInterface.tsx` - Interface interativa de mensagens
- `ChatMessageUser.tsx` - Renderizacao de mensagens do usuario
- `ChatMessageAssistant.tsx` - Renderizacao de mensagens da IA

### Services
- `ChatIntroPromptsService.ts` - Prompts iniciais sugeridos
- `ChatSystemPromptsService.ts` - Prompts de sistema por tipo

### Edge Functions
- `chat-with-processo` - Chat de texto (ambos os tipos)
- `process-audio-message` - Audio para arquivos pequenos
- `chat-audio-complex-files` - Audio para arquivos grandes

### Banco de Dados
- `chat_messages` - Historico de mensagens
- `chat_system_prompts` - Prompts de sistema
- `chat_intro_prompts` - Prompts iniciais
- `analysis_results` - Resultados de analise (contexto consolidado)
- `process_chunks` - Chunks de PDF (contexto chunked)
- `token_limits_config` - Limites de tokens por contexto

## Fluxo de Tokens

### Verificacao Pre-Mensagem
- Minimo de 100 tokens necessarios para enviar mensagem
- Verificacao via `TokenValidationService`

### Debito de Tokens
- Formula: `tokens = ceil((mensagem.length + resposta.length) / 4)`
- Debito via RPC `debit_user_tokens`
- Registro em `token_usage_history`

### Limites por Contexto

| Contexto | Max Output Tokens | Uso |
|----------|-------------------|-----|
| `chat_standard` | 8.192 | Texto, arquivos pequenos |
| `chat_complex_files` | 16.384 | Texto, arquivos grandes |
| `chat_audio` | 8.192 | Audio, arquivos pequenos |
| `chat_audio_complex` | 16.384 | Audio, arquivos grandes |

## Processamento de Respostas

Todas as respostas da IA passam por limpeza:

1. **cleanMarkdownFromResponse()** - Remove formatacao markdown
   - Blocos de codigo
   - Negrito/italico
   - Headings

2. **removeIntroductoryPhrases()** - Remove frases introdutorias
   - "Com certeza..."
   - "Claro..."
   - "Vou elaborar..."
