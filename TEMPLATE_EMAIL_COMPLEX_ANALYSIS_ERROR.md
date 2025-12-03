# Template Email: Falha em Análise Complexa (Arquivos >1000 páginas)

## 📧 Informações do Template

- **Nome no Resend:** `falha-analise-complexa`
- **Template ID:** `f5256a8e-e0bd-4eaa-99f5-baf1e4b8ab3b`
- **Edge Function:** `send-admin-complex-analysis-error`
- **Tabela:** `complex_analysis_errors`

---

## 📝 Estrutura do Email

### **Saudação**
```
Olá, {{first_name_admin}}!
```

### **Título Principal**
```
Detectamos uma falha no processamento de arquivo grande.
```

### **Descrição**
```
Uma falha foi detectada durante o processamento de um arquivo com mais de 1.000 páginas em modo de análise complexa.
```

### **Subtítulo**
```
Confira os detalhes abaixo:
```

---

## 📦 **Box 1: Informações do Usuário**

**Título:** `Informações do Usuário`

**Variáveis:**
- `{{first_name}}` `{{last_name}}` - Nome completo do usuário
- **Email:** `{{user_email}}` - Email do usuário
- **Plano:** `{{plan_name}}` - Nome do plano de assinatura

**Exemplo:**
```
João Silva
Email: joao@example.com
Plano: Profissional Plus
```

---

## 📄 **Box 2: Informações do Arquivo Complexo**

**Título:** `Informações do Arquivo Complexo`

**Variáveis:**
- **Arquivo:** `{{file_name}}` - Nome do arquivo PDF
- **ID do Processo:** `{{processo_id}}` - UUID do processo
- **Total de Páginas:** `{{total_pages}}` páginas - Total de páginas do arquivo
- **Total de Chunks:** `{{total_chunks}}` lotes - Total de lotes criados
- **Chunk com Falha:** Lote `{{failed_chunk_index}}` de `{{total_chunks}}` - Índice do chunk que falhou
- **Páginas do Chunk:** `{{chunk_start_page}}` até `{{chunk_end_page}}` (`{{chunk_pages_count}}` páginas) - Range de páginas do chunk
- **Horário da Falha:** `{{error_datetime}}` - Data/hora formatada (DD/MM/YYYY às HH:MM)

**Exemplo:**
```
Arquivo: APAE 3.710 páginas.pdf
ID do Processo: 45be9142-eb43-41b6-b2aa-dfed91bc78ce
Total de Páginas: 3710 páginas
Total de Chunks: 10 lotes
Chunk com Falha: Lote 3 de 10
Páginas do Chunk: 801 até 1200 (400 páginas)
Horário da Falha: 03/12/2025 às 14:30
```

---

## ⚙️ **Box 3: Status do Processamento Complexo**

**Título:** `Status do Processamento Complexo`

**Variáveis:**
- **Fase Atual:** `{{current_phase}}` - Fase do processamento (Inicialização, Processamento de Chunks, Consolidação, Finalização)
- **Progresso Geral:** `{{chunks_completed}}` de `{{total_chunks}}` lotes concluídos (`{{progress_percent}}`%) - Progresso em porcentagem
- **Prompt em Processamento:** `{{prompt_title}}` (Etapa `{{execution_order}}` de `{{total_prompts}}`) - Prompt sendo processado
- **Chunks Bem-Sucedidos:** `{{chunks_succeeded}}` lotes - Total de chunks processados com sucesso
- **Chunks com Falha:** `{{chunks_failed}}` lote(s) - Total de chunks que falharam
- **Tempo de Processamento:** `{{processing_duration}}` - Duração antes da falha (formato: Xmin Ys ou Xs)

**Exemplo:**
```
Fase Atual: Processamento de Chunks
Progresso Geral: 2 de 10 lotes concluídos (20.0%)
Prompt em Processamento: Visão Geral do Processo (Etapa 1 de 9)
Chunks Bem-Sucedidos: 2 lotes
Chunks com Falha: 1 lote(s)
Tempo de Processamento: 5min 30s
```

---

## 🚨 **Box 4: Detalhes da Falha** (Background vermelho)

**Título:** `Detalhes da Falha`

**Variáveis:**
- **Tipo de Erro:** `{{error_type}}` - Tipo específico do erro (ex: TokenLimitExceeded, APIError, TimeoutError)
- **Gravidade:** `{{severity}}` - Nível de gravidade (LOW, MEDIUM, HIGH, CRITICAL)
- **Categoria:** `{{error_category}}` - Categoria do erro (ex: token_limit, api_error, timeout)
- **Mensagem:**
  ```
  {{error_message}}
  ```
  Mensagem detalhada do erro

**Exemplo:**
```
Tipo de Erro: TokenLimitExceeded
Gravidade: HIGH
Categoria: token_limit
Mensagem:
The input token count exceeds the maximum number of tokens allowed 1048576.
Chunk 3 contém 900.000 tokens estimados, excedendo o limite seguro de 850.000 tokens.
```

---

## 🔧 **Box 5: Informações Técnicas para Debugging** (Background cinza claro)

**Título:** `Informações Técnicas para Debugging`

**Variáveis:**
- **Worker ID:** `{{worker_id}}` - ID do worker que processou
- **Chunk ID:** `{{chunk_id}}` - UUID do chunk no banco
- **Tentativa Número:** `{{retry_attempt}}` de `{{max_retries}}` - Número da tentativa atual
- **Tokens Estimados:** `{{estimated_tokens}}` tokens - Tokens estimados do chunk
- **Status de Validação:** `{{token_validation_status}}` - Status da validação (valid, exceeded, pending)
- **Modelo LLM Usado:** `{{model_used}}` - Nome do modelo (ex: Gemini 2.5 Pro)
- **Gemini File URI:** `{{gemini_file_uri}}` - URI do arquivo no Gemini
- **Recovery Tentado:** `{{recovery_attempted}}` - Sim/Não

**Exemplo:**
```
Worker ID: worker-abc123
Chunk ID: 97c4ce17-8e5c-4da8-a8f4-d0b227eedc07
Tentativa Número: 2 de 3
Tokens Estimados: 900.000 tokens
Status de Validação: exceeded
Modelo LLM Usado: Gemini 2.5 Pro
Gemini File URI: https://generativelanguage.googleapis.com/v1beta/files/i97hw4p2gk3y
Recovery Tentado: Sim
```

---

## 📊 **Box 6: Ações Automáticas do Sistema** (Background azul claro)

**Título:** `Ações Automáticas do Sistema`

**Variáveis:**
- **Auto-Recovery Ativado:** `{{auto_recovery_enabled}}` - Sim/Não
- **Próxima Tentativa:** `{{next_retry_at}}` - Data/hora da próxima tentativa (DD/MM/YYYY às HH:MM) ou N/A
- **Subdivisão de Chunk:** `{{chunk_subdivision_triggered}}` - Sim/Não (se token limit foi excedido)
- **GitHub Action Monitorando:** `{{monitoring_active}}` - Sim (sempre ativo)

**Exemplo:**
```
Auto-Recovery Ativado: Sim
Próxima Tentativa: 03/12/2025 às 14:35
Subdivisão de Chunk: Sim
GitHub Action Monitorando: Sim
```

**Nota:** Se `chunk_subdivision_triggered = Sim`, significa que o sistema automaticamente dividirá o chunk problemático em chunks menores de 80 páginas.

---

## 🎯 **CTAs (Call to Action)**

### **Botão Principal** (Background preto)
```
Texto: Ver o Processo
Link: {{processo_detail_url}}
```

### **Link Secundário** (Texto com underline)
```
Texto: Ver Todos os Erros de Arquivos Grandes
Link: https://dev-app.wislegal.io/admin/complex-errors
```

---

## 📋 **Resumo de Todas as Variáveis**

### **Informações do Admin**
- `first_name_admin` - Nome do administrador recebendo o email

### **Informações do Usuário (3)**
- `first_name` - Primeiro nome do usuário
- `last_name` - Sobrenome do usuário
- `user_email` - Email do usuário
- `plan_name` - Nome do plano de assinatura

### **Informações do Arquivo (7)**
- `file_name` - Nome do arquivo
- `processo_id` - UUID do processo
- `total_pages` - Total de páginas (string)
- `total_chunks` - Total de chunks (string)
- `failed_chunk_index` - Índice do chunk com falha (string)
- `chunk_start_page` - Página inicial do chunk (string)
- `chunk_end_page` - Página final do chunk (string)
- `chunk_pages_count` - Total de páginas do chunk (string)
- `error_datetime` - Data/hora da falha (formatada)

### **Status de Processamento (7)**
- `current_phase` - Fase atual (traduzida)
- `chunks_completed` - Chunks concluídos (string)
- `progress_percent` - Progresso em % (string com %)
- `prompt_title` - Título do prompt
- `execution_order` - Ordem de execução (string)
- `total_prompts` - Total de prompts (string)
- `chunks_succeeded` - Chunks bem-sucedidos (string)
- `chunks_failed` - Chunks com falha (string)
- `processing_duration` - Duração formatada (Xmin Ys)

### **Detalhes da Falha (4)**
- `error_type` - Tipo do erro
- `severity` - Gravidade (UPPERCASE)
- `error_category` - Categoria do erro
- `error_message` - Mensagem completa do erro

### **Informações Técnicas (8)**
- `worker_id` - ID do worker
- `chunk_id` - UUID do chunk
- `retry_attempt` - Tentativa atual (string)
- `max_retries` - Máximo de tentativas (string)
- `estimated_tokens` - Tokens estimados (formatado com vírgulas)
- `token_validation_status` - Status de validação
- `model_used` - Modelo LLM usado
- `gemini_file_uri` - URI no Gemini
- `recovery_attempted` - Sim/Não

### **Ações Automáticas (4)**
- `auto_recovery_enabled` - Sim/Não
- `next_retry_at` - Data/hora da próxima tentativa
- `chunk_subdivision_triggered` - Sim/Não
- `monitoring_active` - Sim (fixo)

### **URLs (1)**
- `processo_detail_url` - Link para detalhes do processo

---

## 🎨 **Cores Recomendadas**

- **Background Falha:** `#FEF2F2` (vermelho claro)
- **Borda Falha:** `#DC2626` (vermelho)
- **Texto Falha:** `#991B1B` (vermelho escuro)
- **Background Técnico:** `#F3F4F6` (cinza claro)
- **Background Ações:** `#EFF6FF` (azul claro)
- **Botão Principal:** `#1D1C1B` (preto)

---

## 📊 **Total de Variáveis: 44**

**Agrupamento:**
- Informações do Admin: 1
- Informações do Usuário: 4
- Informações do Arquivo: 9
- Status de Processamento: 9
- Detalhes da Falha: 4
- Informações Técnicas: 9
- Ações Automáticas: 4
- URLs: 1
- **TOTAL: 41 variáveis**

---

## 🔗 **Integração com o Sistema**

### **Como Disparar o Email:**

```typescript
// No código da edge function que detecta o erro complexo:
await fetch(`${supabaseUrl}/functions/v1/send-admin-complex-analysis-error`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${supabaseServiceKey}`,
  },
  body: JSON.stringify({
    error_id: complexErrorId // UUID do erro em complex_analysis_errors
  })
});
```

### **Registro do Erro:**

```typescript
const { data: errorRecord } = await supabase
  .from('complex_analysis_errors')
  .insert({
    processo_id,
    user_id,
    chunk_id,
    error_type: 'TokenLimitExceeded',
    error_category: 'token_limit',
    error_message: 'Chunk exceeds token limit...',
    severity: 'high',
    current_phase: 'processing',
    failed_chunk_index: 3,
    chunk_start_page: 801,
    chunk_end_page: 1200,
    chunk_pages_count: 400,
    estimated_tokens: 900000,
    total_chunks: 10,
    chunks_completed: 2,
    chunks_succeeded: 2,
    chunks_failed: 1,
    progress_percent: 20.0
  })
  .select()
  .single();

// Disparar email
await fetch(`${supabaseUrl}/functions/v1/send-admin-complex-analysis-error`, {
  method: 'POST',
  body: JSON.stringify({ error_id: errorRecord.id })
});
```

---

## ✅ **Checklist de Implementação**

- [x] Tabela `complex_analysis_errors` criada
- [x] Edge function `send-admin-complex-analysis-error` deployada
- [x] Template ID configurado: `f5256a8e-e0bd-4eaa-99f5-baf1e4b8ab3b`
- [ ] Template HTML criado no Resend com todas as 41 variáveis
- [ ] Integração no código de processamento complexo
- [ ] Teste end-to-end com erro simulado
