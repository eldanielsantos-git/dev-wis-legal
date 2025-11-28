# ✅ Implementação de System Prompt para Análises Forenses

## 🎯 Objetivo

Adicionar suporte a **system prompt** (system_instruction) separado do prompt de conteúdo, permitindo melhor controle sobre o comportamento da LLM nas 9 análises forenses.

## 📋 Motivação

**Antes:** Todo o contexto (instruções do sistema + tarefa específica) estava em um único campo `prompt_content`.

**Problema:**
- Mistura de instruções gerais com instruções específicas
- Difícil ajustar comportamento global sem modificar cada prompt
- Não aproveitava o padrão `systemInstruction` do Gemini API

**Agora:** Separação clara:
- `system_prompt`: Instruções fundamentais sobre o papel e comportamento da IA
- `prompt_content`: Instruções específicas da tarefa de análise

---

## 🗄️ Mudanças no Banco de Dados

### 1. Tabela `analysis_prompts`

**Migration:** `add_system_prompt_to_analysis_prompts.sql`

```sql
ALTER TABLE analysis_prompts
ADD COLUMN IF NOT EXISTS system_prompt TEXT;

COMMENT ON COLUMN analysis_prompts.system_prompt IS 
'Instruções fundamentais do sistema enviadas como system_instruction para a LLM. Define o papel, comportamento e diretrizes gerais da IA para esta análise específica.';
```

### 2. Função `acquire_next_prompt_lock`

**Migration:** `add_system_prompt_to_acquire_lock_function.sql`

Atualizada para retornar `system_prompt` junto com `prompt_content`:

```sql
CREATE OR REPLACE FUNCTION acquire_next_prompt_lock(...)
RETURNS TABLE (
  ...
  prompt_content text,
  system_prompt text,  -- ✅ NOVO
  ...
)
```

---

## 💻 Mudanças no Frontend

### 1. Service (`AnalysisPromptsService.ts`)

**Interface atualizada:**
```typescript
export interface AnalysisPrompt {
  id: string;
  title: string;
  prompt_content: string;
  system_prompt?: string | null;  // ✅ NOVO
  execution_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

**Métodos atualizados:**
```typescript
static async createPrompt(
  title: string,
  promptContent: string,
  executionOrder: number,
  systemPrompt?: string  // ✅ NOVO
)

static async updatePrompt(
  promptId: string,
  title: string,
  promptContent: string,
  executionOrder: number,
  systemPrompt?: string  // ✅ NOVO
)
```

### 2. Interface Admin (`AdminForensicPromptsPage.tsx`)

**Form Data:**
```typescript
const [formData, setFormData] = useState({
  execution_order: 1,
  title: '',
  prompt_content: '',
  system_prompt: ''  // ✅ NOVO
});
```

**Novo Campo no Formulário:**
```tsx
<div className="w-full max-w-full">
  <label>System Prompt (Opcional)</label>
  <textarea
    value={formData.system_prompt}
    onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
    rows={6}
    placeholder="Instruções fundamentais do sistema (ex: Você é um especialista jurídico...)"
  />
  <p>
    {formData.system_prompt.length} caracteres • Define o papel e comportamento da IA
  </p>
</div>
```

**Visualização Expandida:**
```tsx
{prompt.system_prompt && (
  <div className="mb-4">
    <h4>System Prompt:</h4>
    <pre>{prompt.system_prompt}</pre>
    <p>{prompt.system_prompt.length} caracteres • Enviado como system_instruction</p>
  </div>
)}
```

---

## ⚙️ Mudanças nas Edge Functions

### 1. `process-next-prompt/index.ts`

**3 locais de chamada do Gemini atualizados:**

#### A. Chunk Processing (arquivos grandes):
```typescript
const chunkResult = await geminiModel.generateContent({
  contents: [{ role: 'user', parts: chunkParts }],
  systemInstruction: nextResult.system_prompt || undefined,  // ✅ NOVO
  generationConfig: {
    temperature,
    maxOutputTokens: maxTokens,
  },
});
```

#### B. File API (arquivos médios):
```typescript
const result = await geminiModel.generateContent({
  contents: [{ role: 'user', parts }],
  systemInstruction: nextResult.system_prompt || undefined,  // ✅ NOVO
  generationConfig: {
    temperature,
    maxOutputTokens: maxTokens,
  },
});
```

#### C. Base64 Inline (arquivos pequenos):
```typescript
const result = await geminiModel.generateContent({
  contents: [
    {
      role: 'user',
      parts: [
        {
          inlineData: {
            mimeType: 'application/pdf',
            data: base64Data,
          },
        },
        { text: nextResult.prompt_content },
      ],
    },
  ],
  systemInstruction: nextResult.system_prompt || undefined,  // ✅ NOVO
  generationConfig: {
    temperature,
    maxOutputTokens: maxTokens,
  },
});
```

### 2. `consolidation-worker/index.ts`

**SELECT atualizado:**
```typescript
.select('id, prompt_id, prompt_title, prompt_content, system_prompt, execution_order, status')  // ✅ system_prompt adicionado
```

**Chamada do Gemini:**
```typescript
const result = await geminiModel.generateContent({
  contents: [{ role: 'user', parts: [{ text: consolidationPrompt }] }],
  systemInstruction: analysisResult.system_prompt || undefined,  // ✅ NOVO
  generationConfig: {
    temperature: 0.1,
    maxOutputTokens: model.maxTokens,
  },
});
```

---

## 📊 Como Usar

### 1. Na Interface Admin

1. Acesse **Admin > Prompts Forenses**
2. Clique em um prompt para editar
3. Preencha o campo **"System Prompt (Opcional)"**
4. Salve

### 2. Exemplo de System Prompt

```
Você é um Perito Jurídico Processual especializado em análise técnico-documental e reconstrução de autos, com domínio em Direito Material e Processual Cível, Trabalhista e Tributário.

DIRETRIZES FUNDAMENTAIS:
1. Seja preciso e técnico nas análises
2. Cite sempre as fontes (páginas e documentos)
3. Use linguagem jurídica apropriada
4. Mantenha imparcialidade absoluta
5. Fundamente todas as conclusões em dados concretos do processo

IMPORTANTE:
- NUNCA invente informações
- SEMPRE indique "Não identificado" se não encontrar dados
- Mantenha estrutura JSON rigorosa
- Priorize clareza e utilidade prática para advogados
```

### 3. Exemplo de Prompt Content

```
1. Visão Geral do Processo

Você é um Perito Jurídico Processual especializado...

Sua missão nesta etapa é realizar uma análise técnica...

CONTEXTO E OBJETIVO DESTA ETAPA
Esta é a Etapa 1 de 9 da análise completa dos autos...

[... resto do prompt específico da tarefa ...]
```

---

## 🔍 Fluxo Completo

### 1. Admin Cadastra/Edita Prompt
```
Admin Interface → AnalysisPromptsService.updatePrompt() → 
database.analysis_prompts.update(system_prompt)
```

### 2. Processo Inicia Análise
```
start-analysis → cria 9 analysis_results com prompt_content + system_prompt copiados
```

### 3. Worker Processa Prompt
```
process-next-prompt → acquire_next_prompt_lock() → retorna system_prompt + prompt_content
```

### 4. Chamada para Gemini
```typescript
geminiModel.generateContent({
  systemInstruction: system_prompt,  // Instruções gerais
  contents: [{
    role: 'user',
    parts: [{ text: prompt_content }]  // Tarefa específica
  }]
})
```

### 5. Consolidação (Arquivos Grandes)
```
consolidation-worker → busca system_prompt do analysis_result → 
envia junto com consolidationPrompt
```

---

## ✅ Benefícios da Implementação

### 1. Separação de Responsabilidades
- **System Prompt:** "Quem você é" e "como você deve agir"
- **Prompt Content:** "O que você deve fazer"

### 2. Facilidade de Ajuste
- Alterar comportamento global? → Editar system_prompt
- Ajustar tarefa específica? → Editar prompt_content
- Sem necessidade de modificar ambos

### 3. Melhor Controle da LLM
- System instruction tem maior "peso" na API do Gemini
- Define personalidade consistente ao longo da conversa
- Reduz chance de "drift" no comportamento

### 4. Reutilização
- Mesmo system_prompt pode ser usado em vários prompts
- Exemplo: Todos os 9 prompts podem compartilhar as diretrizes fundamentais
- Cada um tem seu prompt_content específico

### 5. Conformidade com Best Practices
- Segue o padrão recomendado pela Google/Gemini API
- Aproveitamelhor os recursos da LLM
- Resulta em outputs mais consistentes

---

## 📝 Status da Implementação

### ✅ Completo

1. ✅ Migration do banco de dados
2. ✅ Atualização da função `acquire_next_prompt_lock`
3. ✅ Interface Service (`AnalysisPromptsService`)
4. ✅ Interface Admin (`AdminForensicPromptsPage`)
5. ✅ Edge function `process-next-prompt` (3 locais)
6. ✅ Edge function `consolidation-worker`
7. ✅ Build do frontend
8. ✅ Documentação completa

### ⏳ Pendente de Deploy

**Edge Functions precisam ser deployadas manualmente:**

```bash
# Deploy process-next-prompt
supabase functions deploy process-next-prompt --no-verify-jwt

# Deploy consolidation-worker
supabase functions deploy consolidation-worker --no-verify-jwt
```

**Nota:** Os arquivos já estão atualizados no repositório, apenas aguardando deploy.

### 📋 Próximos Passos Sugeridos

1. **Deploy das Edge Functions** (manual via Supabase CLI)
2. **Criar System Prompts Padrão** para os 9 prompts existentes
3. **Testar** com um processo real
4. **Documentar Boas Práticas** para criação de system prompts

---

## 🎯 Exemplo de Uso Completo

### Prompt 1: Visão Geral do Processo

**System Prompt:**
```
Você é um Perito Jurídico especializado em análise processual.

IDENTIDADE:
- Expert em reconstrução de autos
- Domínio em Direito Processual Cível, Trabalhista e Tributário
- Analista técnico-documental certificado

COMPORTAMENTO:
1. Precisão técnica absoluta
2. Fundamentação em dados concretos
3. Imparcialidade total
4. Clareza e objetividade

FORMATO:
- Sempre retorne JSON válido
- Cite páginas e documentos
- Use "Não identificado" quando não houver dados
- Mantenha hierarquia estruturada
```

**Prompt Content:**
```
1. Visão Geral do Processo

Sua missão é extrair e organizar dados essenciais:
- Dados do processo (número, vara, instância)
- Partes envolvidas
- Linha do tempo
- Fase processual
- Documentos analisados

[... instruções específicas da tarefa ...]
```

**Resultado:**
- LLM recebe contexto claro de quem ela é (system_prompt)
- Recebe instruções específicas do que fazer (prompt_content)
- Gera análise consistente com a "personalidade" definida

---

## 🔧 Troubleshooting

### System Prompt não está sendo usado?

1. Verificar se edge function foi deployada:
   ```bash
   curl -X POST "${SUPABASE_URL}/functions/v1/process-next-prompt" ...
   # Verificar nos logs do Supabase se system_prompt está presente
   ```

2. Verificar se prompt tem system_prompt cadastrado:
   ```sql
   SELECT id, title, system_prompt IS NOT NULL as has_system_prompt
   FROM analysis_prompts
   ORDER BY execution_order;
   ```

3. Verificar se análise copiou o system_prompt:
   ```sql
   SELECT id, prompt_title, system_prompt IS NOT NULL as has_system_prompt
   FROM analysis_results
   WHERE processo_id = '<processo-id>'
   ORDER BY execution_order;
   ```

### Análise retorna erro "systemInstruction is not defined"?

- Versão antiga do `@google/generative-ai`
- Atualizar para versão >= 0.24.1:
  ```typescript
  import { GoogleGenerativeAI } from 'npm:@google/generative-ai@0.24.1';
  ```

---

## 📚 Referências

- [Gemini API - System Instructions](https://ai.google.dev/gemini-api/docs/system-instructions)
- [Best Practices for Prompting](https://ai.google.dev/gemini-api/docs/prompting-strategies)
- [Separating System vs User Content](https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/design-prompts)

---

## ✅ Conclusão

Sistema completo de **system prompt separado** implementado com sucesso!

**Benefícios:**
- ✅ Melhor controle sobre comportamento da LLM
- ✅ Facilidade de ajuste e manutenção
- ✅ Conformidade com best practices
- ✅ Reutilização de instruções gerais
- ✅ Outputs mais consistentes

**Próximo Passo:** Deploy das edge functions e criação dos system prompts padrão para os 9 prompts forenses.
