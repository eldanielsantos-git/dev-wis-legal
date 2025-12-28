# Processamento de Arquivos Pequenos (até 1.000 páginas)

## Visao Geral da Arquitetura

Este documento descreve detalhadamente o fluxo completo de processamento de arquivos PDF com ate 1.000 paginas no sistema. Este tipo de arquivo e classificado como **Tier SMALL** e utiliza um pipeline simplificado de processamento direto, sem necessidade de chunking ou paralelizacao.

---

## 1. Diagrama de Fluxo de Alto Nivel

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        UPLOAD E PROCESSAMENTO SMALL                          │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌──────────┐     ┌──────────────┐     ┌────────────────┐     ┌──────────────┐
    │  Usuario │────▶│  FileUpload  │────▶│ ProcessosService│────▶│   Supabase   │
    │          │     │  Component   │     │                │     │   Storage    │
    └──────────┘     └──────────────┘     └────────────────┘     └──────────────┘
                                                  │
                                                  ▼
                     ┌────────────────────────────────────────────────┐
                     │           VALIDACOES PRE-UPLOAD                │
                     │  • Validacao de tokens (TokenValidationService)│
                     │  • Verificacao de paginas (getPDFPageCount)    │
                     │  • Calculo de tokens necessarios               │
                     └────────────────────────────────────────────────┘
                                                  │
                                                  ▼
                     ┌────────────────────────────────────────────────┐
                     │              UPLOAD DO ARQUIVO                 │
                     │  • Storage: bucket 'processos'                 │
                     │  • Path: {userId}/{processoId}/original.pdf    │
                     │  • Criacao do registro em 'processos'          │
                     └────────────────────────────────────────────────┘
                                                  │
                                                  ▼
                     ┌────────────────────────────────────────────────┐
                     │           UPLOAD PARA GEMINI FILE API          │
                     │  • Edge Function: upload-to-gemini             │
                     │  • Aguarda estado ACTIVE                       │
                     │  • Salva URI do arquivo no banco               │
                     └────────────────────────────────────────────────┘
                                                  │
                                                  ▼
                     ┌────────────────────────────────────────────────┐
                     │            START ANALYSIS                      │
                     │  • Edge Function: start-analysis               │
                     │  • Cria registros em analysis_results          │
                     │  • Inicia processamento sequencial             │
                     └────────────────────────────────────────────────┘
                                                  │
                                                  ▼
                     ┌────────────────────────────────────────────────┐
                     │         PROCESS NEXT PROMPT (LOOP)             │
                     │  • Executa cada prompt sequencialmente         │
                     │  • Salva resultado em analysis_results         │
                     │  • Chama proximo prompt ate completar          │
                     └────────────────────────────────────────────────┘
                                                  │
                                                  ▼
                     ┌────────────────────────────────────────────────┐
                     │            FINALIZACAO                         │
                     │  • Status: 'completed'                         │
                     │  • Notificacao ao usuario                      │
                     │  • Email de confirmacao                        │
                     │  • Notificacao administrativa (Slack)          │
                     └────────────────────────────────────────────────┘
```

---

## 2. Componentes do Frontend

### 2.1. FileUpload.tsx

**Localizacao:** `src/components/FileUpload.tsx`

**Responsabilidades:**
- Interface de upload drag-and-drop
- Validacao de tipo de arquivo (somente PDF)
- Contagem de paginas usando pdf-lib
- Verificacao de tokens antes do upload
- Exibicao de progresso de upload
- Tratamento de erros de validacao

**Funcoes Principais:**

| Funcao | Descricao |
|--------|-----------|
| `handleFileSelect` | Processa arquivo selecionado, conta paginas |
| `validateFile` | Valida tipo, tamanho e extensao do arquivo |
| `getPDFPageCount` | Usa pdf-lib para contar paginas do PDF |
| `checkTokens` | Verifica tokens disponiveis via TokenValidationService |
| `handleUpload` | Inicia upload chamando ProcessosService |

**Validacoes Executadas:**
1. Arquivo e do tipo `application/pdf`
2. Extensao e `.pdf`
3. Tamanho dentro do limite permitido
4. Usuario tem tokens suficientes para processar

### 2.2. AppHomePage.tsx

**Localizacao:** `src/pages/AppHomePage.tsx`

**Responsabilidades:**
- Coordena o fluxo de upload
- Gerencia estado do processamento
- Exibe modais de progresso
- Trata interrupcoes de upload

**Estados Gerenciados:**
- `isUploading`: Upload em andamento
- `uploadProgress`: Percentual de progresso
- `selectedFile`: Arquivo selecionado
- `pageCount`: Numero de paginas do PDF
- `processingInProgress`: Analise em andamento

---

## 3. Servicos do Frontend

### 3.1. ProcessosService.ts

**Localizacao:** `src/services/ProcessosService.ts`

**Funcao Principal:** `uploadAndAnalyze`

Esta funcao orquestra todo o fluxo de upload e analise para arquivos pequenos:

```typescript
async uploadAndAnalyze(
  file: File,
  userId: string,
  pageCount: number,
  onProgress?: (progress: number) => void,
  backgroundMode?: boolean
): Promise<UploadResult>
```

**Etapas Executadas:**

1. **Verificacao de Tier:**
   ```typescript
   const isComplex = isComplexProcessing(pageCount);
   // Para arquivos pequenos: isComplex = false
   ```

2. **Criacao do Registro:**
   - Insere registro na tabela `processos`
   - Status inicial: `uploading`
   - Salva metadados: file_name, file_size, total_pages

3. **Upload para Supabase Storage:**
   - Bucket: `processos`
   - Path: `{userId}/{processoId}/original.pdf`
   - Monitoramento de progresso via `onProgress`

4. **Upload para Gemini File API:**
   - Chama edge function `upload-to-gemini`
   - Aguarda confirmacao de upload
   - Salva `gemini_file_uri` no banco

5. **Inicio da Analise:**
   - Chama edge function `start-analysis`
   - Passa: `processo_id`, `gemini_file_uri`, `pageCount`

### 3.2. TokenValidationService.ts

**Localizacao:** `src/services/TokenValidationService.ts`

**Constantes:**
```typescript
const TOKENS_PER_PAGE = 5500;
```

**Funcoes Principais:**

| Funcao | Descricao |
|--------|-----------|
| `calculateTokensFromPages` | pageCount * 5500 |
| `calculatePagesFromTokens` | Math.floor(tokens / 5500) |
| `checkTokensBeforeUpload` | Verifica saldo antes de upload |
| `getTokenBalance` | Retorna saldo atual do usuario |

**Verificacoes de Token:**
1. Consulta view `user_token_balance`
2. Soma `plan_tokens` + `extra_tokens`
3. Subtrai `tokens_used`
4. Compara com tokens necessarios

### 3.3. TierSystemService.ts

**Localizacao:** `src/services/TierSystemService.ts`

**Deteccao de Tier:**
```typescript
static detectTier(totalPages: number): TierName {
  if (totalPages <= 1000) return 'SMALL';
  if (totalPages <= 2000) return 'MEDIUM';
  if (totalPages <= 5000) return 'LARGE';
  if (totalPages <= 10000) return 'VERY_LARGE';
  if (totalPages <= 20000) return 'HIGH_LARGE';
  return 'ULTRA_LARGE';
}
```

**Configuracao para SMALL:**
- Max Parallel Workers: 1
- Timeout: 15 minutos
- Checkpoints: Desabilitado
- Hierarchy: Desabilitado

---

## 4. Edge Functions (Backend)

### 4.1. upload-to-gemini

**Localizacao:** `supabase/functions/upload-to-gemini/index.ts`

**Fluxo:**
1. Recebe `processo_id` via POST
2. Busca arquivo do Supabase Storage
3. Faz upload para Google AI File Manager
4. Aguarda processamento (estado ACTIVE)
5. Atualiza `processos` com URI do Gemini

**Campos Atualizados:**
- `gemini_file_uri`
- `gemini_file_name`
- `gemini_file_mime_type`
- `gemini_file_state`
- `gemini_file_uploaded_at`
- `gemini_file_expires_at`
- `use_file_api = true`
- `pdf_base64` (para fallback)

**Retry Logic:**
- 3 tentativas de upload
- Backoff exponencial: 2s, 4s, 6s
- Timeout de processamento: 5 minutos

### 4.2. start-analysis

**Localizacao:** `supabase/functions/start-analysis/index.ts`

**Responsabilidades:**
1. Recebe processo_id e pageCount
2. Busca prompts ativos da tabela `analysis_prompts`
3. Cria registros em `analysis_results` para cada prompt
4. Inicia processamento do primeiro prompt
5. Encadeia chamadas para proximos prompts

**Criacao de Analysis Results:**
```typescript
for (const prompt of prompts) {
  await supabase.from('analysis_results').insert({
    processo_id,
    prompt_id: prompt.id,
    prompt_title: prompt.title,
    prompt_content: prompt.prompt_content,
    system_prompt: prompt.system_prompt,
    execution_order: prompt.execution_order,
    status: 'pending',
  });
}
```

**Atualizacao do Processo:**
- `status: 'analyzing'`
- `analysis_started_at: now()`
- `current_prompt_number: 1`
- `total_prompts: prompts.length`

### 4.3. process-next-prompt

**Localizacao:** `supabase/functions/process-next-prompt/index.ts`

**Fluxo de Processamento:**

1. **Busca Proximo Prompt Pendente:**
   ```sql
   SELECT * FROM analysis_results
   WHERE processo_id = ? AND status = 'pending'
   ORDER BY execution_order ASC
   LIMIT 1
   ```

2. **Busca Modelos Ativos:**
   - Tabela: `admin_system_models`
   - Ordenado por prioridade
   - Fallback entre modelos

3. **Chamada ao Gemini:**
   ```typescript
   const result = await geminiModel.generateContent({
     contents: [{
       role: 'user',
       parts: [
         { fileData: { mimeType: 'application/pdf', fileUri } },
         { text: promptContent }
       ]
     }],
     generationConfig: {
       temperature: 0.2,
       maxOutputTokens: configuredMaxTokens
     }
   });
   ```

4. **Processamento da Resposta:**
   - Remove marcadores de codigo (```json)
   - Valida JSON usando `json-validator.ts`
   - Sanitiza caracteres invalidos

5. **Salvamento do Resultado:**
   - Atualiza `analysis_results` com:
     - `status: 'completed'`
     - `result_content`
     - `tokens_used`
     - `execution_time_ms`
     - `completed_at`

6. **Encadeamento:**
   - Se ha mais prompts: chama recursivamente
   - Se ultimo prompt: finaliza processo

**Tratamento de Erros:**
- Retry automatico em erros recuperaveis
- Troca de modelo em caso de falha
- Notificacao administrativa em erros criticos

### 4.4. json-validator.ts

**Localizacao:** `supabase/functions/process-next-prompt/json-validator.ts`

**Funcoes de Validacao:**
- `sanitizeJsonString`: Remove caracteres invalidos
- `fixCommonJsonErrors`: Corrige erros comuns de JSON
- `validateAndParseJson`: Valida e parseia JSON
- `extractJsonFromText`: Extrai JSON de texto misto

---

## 5. Tabelas do Banco de Dados

### 5.1. processos

**Schema Principal:**

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | Primary Key |
| user_id | uuid | FK para user_profiles |
| file_name | text | Nome original do arquivo |
| file_path | text | Path no Storage |
| file_size | bigint | Tamanho em bytes |
| status | enum | uploading, analyzing, completed, error |
| total_pages | integer | Numero total de paginas |
| is_chunked | boolean | false para arquivos pequenos |
| gemini_file_uri | text | URI do arquivo no Gemini |
| gemini_file_state | text | ACTIVE, PROCESSING, FAILED |
| analysis_started_at | timestamptz | Inicio da analise |
| analysis_completed_at | timestamptz | Fim da analise |
| current_prompt_number | integer | Prompt atual |
| total_prompts | integer | Total de prompts |
| tokens_consumed | bigint | Tokens consumidos |

**Campos de Resultado:**
- `visao_geral_processo` (jsonb)
- `resumo_estrategico` (jsonb)
- `comunicacoes_prazos` (jsonb)
- `admissibilidade_recursal` (jsonb)
- `estrategias_juridicas` (jsonb)
- `riscos_alertas` (jsonb)
- `balanco_financeiro` (jsonb)
- `mapa_preclusoes` (jsonb)
- `conclusoes_perspectivas` (jsonb)

### 5.2. analysis_prompts

**Schema:**

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | Primary Key |
| title | text | Titulo do prompt |
| prompt_content | text | Conteudo do prompt |
| system_prompt | text | Prompt do sistema |
| execution_order | integer | Ordem de execucao |
| is_active | boolean | Prompt ativo |

### 5.3. analysis_results

**Schema:**

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | Primary Key |
| processo_id | uuid | FK para processos |
| prompt_id | uuid | FK para analysis_prompts |
| prompt_title | text | Titulo do prompt |
| result_content | text | Resultado da analise |
| status | text | pending, running, completed |
| tokens_used | integer | Tokens consumidos |
| execution_time_ms | integer | Tempo de execucao |
| current_model_id | uuid | Modelo usado |
| current_model_name | text | Nome do modelo |
| attempt_count | integer | Tentativas realizadas |

### 5.4. admin_system_models

**Schema:**

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | Primary Key |
| display_name | text | Nome de exibicao |
| system_model | text | ID do modelo (ex: gemini-2.0-flash) |
| llm_provider | text | gemini, openai |
| temperature | numeric | Temperatura (0.0 - 1.0) |
| max_tokens | integer | Max output tokens |
| priority | integer | Prioridade (menor = maior prioridade) |
| is_active | boolean | Modelo ativo |

### 5.5. token_limits_config

**Schema:**

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | Primary Key |
| context_key | text | Chave do contexto |
| max_output_tokens | integer | Limite de tokens |
| is_active | boolean | Configuracao ativa |

---

## 6. Fluxo de Status

```
uploading ──▶ analyzing ──▶ completed
    │              │
    ▼              ▼
  error          error
```

**Estados Detalhados:**

| Status | Descricao | Proxima Acao |
|--------|-----------|--------------|
| uploading | Upload em andamento | Aguardar upload-to-gemini |
| analyzing | Analise em andamento | Aguardar prompts |
| completed | Analise concluida | Exibir resultados |
| error | Erro no processamento | Verificar logs |

---

## 7. Sistema de Tokens

### 7.1. Calculo de Tokens

```
Tokens Necessarios = Paginas × 5.500
```

**Exemplos:**
- 100 paginas = 550.000 tokens
- 500 paginas = 2.750.000 tokens
- 1.000 paginas = 5.500.000 tokens

### 7.2. Views de Saldo

**user_token_balance:**
```sql
SELECT
  user_id,
  plan_tokens,
  extra_tokens,
  tokens_used,
  (plan_tokens + extra_tokens - tokens_used) as total_available_tokens
FROM token_balances
```

### 7.3. Debito de Tokens

O debito ocorre ao final do processamento bem-sucedido:
1. Calcula tokens reais usados
2. Atualiza `stripe_subscriptions.tokens_used`
3. Registra transacao em `token_transactions`

---

## 8. Tratamento de Erros

### 8.1. Erros Recuperaveis

| Erro | Acao |
|------|------|
| Rate Limit (429) | Retry com backoff |
| Service Unavailable (503) | Retry com backoff |
| Timeout | Retry com timeout maior |
| Token Limit Exceeded | Troca de modelo |

### 8.2. Erros Nao Recuperaveis

| Erro | Acao |
|------|------|
| Arquivo corrompido | Notifica usuario |
| Tokens insuficientes | Bloqueia upload |
| Todos modelos falharam | Notifica admin |

### 8.3. Notificacoes

**Para Usuario:**
- Notificacao in-app via tabela `notifications`
- Email de conclusao ou erro

**Para Administrador:**
- Notificacao Slack via `send-admin-notification`
- Registro em `complex_analysis_errors`

---

## 9. Monitoramento

### 9.1. GitHub Actions

**monitor-stuck-processes.yml:**
- Frequencia: A cada 1 minuto
- Funcao: Detecta processos travados
- Edge Function: `process-stuck-processos`

**Criterios de Deteccao:**
- Status `analyzing` por mais de 15 minutos
- Sem atualizacao de `updated_at`

### 9.2. Metricas Coletadas

| Metrica | Tabela | Campo |
|---------|--------|-------|
| Tempo de processamento | processos | analysis_started_at, analysis_completed_at |
| Tokens consumidos | processos | tokens_consumed |
| Erros por prompt | analysis_results | error_message |
| Modelo utilizado | analysis_results | current_model_name |

---

## 10. Seguranca

### 10.1. Row Level Security (RLS)

**Politicas em `processos`:**
```sql
CREATE POLICY "Users can view own processos"
  ON processos FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own processos"
  ON processos FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
```

### 10.2. Storage Policies

```sql
CREATE POLICY "Users can upload to own folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'processos' AND (storage.foldername(name))[1] = auth.uid()::text);
```

### 10.3. Edge Functions

- Autenticacao via `Authorization: Bearer {token}`
- Service Role Key para operacoes administrativas
- Validacao de `user_id` em todas as operacoes

---

## 11. Performance

### 11.1. Metricas Tipicas

| Metrica | Valor Tipico |
|---------|--------------|
| Upload para Storage | 2-10 segundos |
| Upload para Gemini | 10-30 segundos |
| Processamento por prompt | 30-120 segundos |
| Total (500 paginas) | 5-10 minutos |

### 11.2. Otimizacoes

1. **Cache de Configuracoes:**
   - TTL de 60 segundos para tier configs
   - TTL de 60 segundos para feature flags

2. **Processamento Sequencial:**
   - Garante consistencia de resultados
   - Evita sobrecarga do Gemini API

3. **Connection Pooling:**
   - Reutilizacao de conexoes Supabase
   - Keep-alive para WebSocket

---

## 12. Diagrama de Sequencia Detalhado

```
Usuario          Frontend           ProcessosService      Storage       upload-to-gemini    start-analysis    process-next-prompt
   │                 │                     │                 │                │                   │                    │
   │─Select File────▶│                     │                 │                │                   │                    │
   │                 │─Count Pages────────▶│                 │                │                   │                    │
   │                 │◀─Page Count─────────│                 │                │                   │                    │
   │                 │─Check Tokens────────▶│                 │                │                   │                    │
   │                 │◀─Token Result───────│                 │                │                   │                    │
   │◀─Show Preview───│                     │                 │                │                   │                    │
   │                 │                     │                 │                │                   │                    │
   │─Click Upload───▶│                     │                 │                │                   │                    │
   │                 │─uploadAndAnalyze───▶│                 │                │                   │                    │
   │                 │                     │─Create Record──▶│                │                   │                    │
   │                 │                     │◀─processo_id────│                │                   │                    │
   │                 │                     │─Upload File────────────────────▶│                │                   │                    │
   │◀─Progress 50%───│                     │◀─Upload Complete─────────────────│                │                   │                    │
   │                 │                     │─POST processo_id─────────────────────────────────▶│                   │                    │
   │                 │                     │                 │◀─Download File──│                   │                    │
   │                 │                     │                 │─Upload to Gemini│                   │                    │
   │                 │                     │                 │◀─gemini_file_uri│                   │                    │
   │                 │                     │◀─URI Saved──────────────────────────────────────────│                   │                    │
   │◀─Progress 75%───│                     │                 │                │                   │                    │
   │                 │                     │─POST start─────────────────────────────────────────────────────────────▶│                    │
   │                 │                     │                 │                │                   │─Create Results────▶│                    │
   │                 │                     │                 │                │                   │─Call process-next──────────────────────▶│
   │                 │                     │                 │                │                   │                    │─Process Prompt 1─▶│
   │                 │                     │                 │                │                   │                    │◀─Save Result──────│
   │                 │                     │                 │                │                   │                    │─Process Prompt 2─▶│
   │                 │                     │                 │                │                   │                    │         ...        │
   │                 │                     │                 │                │                   │                    │─Process Prompt N─▶│
   │                 │                     │                 │                │                   │                    │◀─Finalize─────────│
   │◀─Analysis Done──│                     │◀─Notification───────────────────────────────────────────────────────────────────────────────────│
   │                 │                     │                 │                │                   │                    │
```

---

## 13. Checklist de Validacoes

### Pre-Upload:
- [ ] Arquivo e PDF valido
- [ ] Extensao .pdf
- [ ] Tamanho dentro do limite
- [ ] Usuario autenticado
- [ ] Tokens suficientes disponiveis
- [ ] Contagem de paginas <= 1000

### Durante Upload:
- [ ] Registro criado em `processos`
- [ ] Arquivo salvo no Storage
- [ ] URI do Gemini obtida
- [ ] Estado ACTIVE confirmado

### Durante Analise:
- [ ] Registros criados em `analysis_results`
- [ ] Modelo ativo disponivel
- [ ] Cada prompt processado com sucesso
- [ ] Resultados salvos corretamente

### Pos-Analise:
- [ ] Status atualizado para `completed`
- [ ] Tokens debitados
- [ ] Notificacao enviada ao usuario
- [ ] Email de confirmacao enviado
