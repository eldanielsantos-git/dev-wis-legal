# Fluxo de Parse de Conteúdo JSON para Texto

## Visão Geral

Este documento detalha o fluxo completo de processamento do conteúdo de análises forenses, desde a captura do JSON bruto retornado pela LLM até a renderização final em formato texto estruturado para o usuário.

---

## 1. Origem do Conteúdo

### 1.1. Geração pela LLM (Gemini)

**Localização:** `supabase/functions/process-next-prompt/index.ts`

O conteúdo é gerado pela LLM Gemini em resposta aos prompts de análise forense:

```typescript
// Linhas 440-467
const result = await model.generateContent([prompt, ...fileParts]);
const response = await result.response;
let text = response.text();

// O conteúdo pode vir em diferentes formatos:
// 1. JSON puro: { "campo": "valor" }
// 2. JSON com marcadores: ```json { "campo": "valor" } ```
// 3. Texto com prefixo: "Segue a análise: ```json { ... } ```"
// 4. Markdown formatado com títulos e listas
```

### 1.2. Limpeza Inicial no Backend

**Localização:** `supabase/functions/process-next-prompt/index.ts` (linhas 442-453)

Primeira etapa de limpeza antes de salvar no banco:

```typescript
text = text.trim();

// Remove marcador ```json do início
if (text.startsWith('```json')) {
  text = text.replace(/^```json\n?/, '');
}

// Remove marcador ``` do início
if (text.startsWith('```')) {
  text = text.replace(/^```\n?/, '');
}

// Remove marcador ``` do fim
if (text.endsWith('```')) {
  text = text.replace(/\n?```$/, '');
}

text = text.trim();
```

### 1.3. Armazenamento no Banco de Dados

**Tabela:** `analysis_results`
**Campo:** `result_content` (tipo: `text`)

```sql
CREATE TABLE analysis_results (
  id uuid PRIMARY KEY,
  processo_id uuid REFERENCES processos(id),
  prompt_id uuid REFERENCES analysis_prompts(id),
  prompt_title text NOT NULL,
  result_content text,  -- Conteúdo armazenado aqui
  execution_order integer NOT NULL,
  status text NOT NULL,
  -- ... outros campos
);
```

---

## 2. Limpeza Adicional no Banco (Migrations)

### 2.1. Migration de Limpeza Abrangente

**Localização:** `supabase/migrations/20251029003714_clean_json_markers_comprehensive_v2.sql`

Esta migration realiza limpeza retroativa de dados já salvos:

```sql
UPDATE analysis_results
SET result_content = TRIM(
  REGEXP_REPLACE(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        CASE
          -- Se contém ```json, remove tudo antes dele
          WHEN result_content LIKE '%```json%' THEN
            SUBSTRING(result_content FROM POSITION('```json' IN result_content))
          -- Se contém apenas ```, remove tudo antes dele
          WHEN result_content LIKE '%```%' THEN
            SUBSTRING(result_content FROM POSITION('```' IN result_content))
          ELSE result_content
        END,
        '^```json\n?', ''
      ),
      '^```\n?', ''
    ),
    '\n?```$', ''
  )
)
WHERE result_content IS NOT NULL;
```

**Operações realizadas:**
1. Remove texto introdutório antes do JSON (ex: "Com certeza! Segue a análise...")
2. Remove marcadores `\`\`\`json` do início
3. Remove marcadores `\`\`\`` do início e fim
4. Aplica `TRIM` para remover espaços extras

**Características:**
- Operação idempotente (pode ser executada múltiplas vezes)
- Não afeta conteúdo já limpo
- Preserva JSON válido

---

## 3. Recuperação dos Dados no Frontend

### 3.1. Service de Análise de Resultados

**Localização:** `src/services/AnalysisResultsService.ts`

```typescript
export interface AnalysisResult {
  id: string;
  processo_id: string;
  prompt_id: string;
  prompt_title: string;
  execution_order: number;
  result_content: string;  // Campo que contém o conteúdo
  status: 'pending' | 'running' | 'completed' | 'failed';
  execution_time_ms?: number;
  created_at: string;
}

static async getResultsByProcessoId(processoId: string): Promise<AnalysisResult[]> {
  const { data, error } = await supabase
    .from('analysis_results')
    .select('*')
    .eq('processo_id', processoId)
    .order('execution_order', { ascending: true });

  // Mapeamento dos dados
  const mappedResults = (data || []).map(item => ({
    id: item.id,
    processo_id: item.processo_id,
    prompt_id: item.prompt_id,
    prompt_title: item.prompt_title || 'Sem título',
    execution_order: item.execution_order || 0,
    result_content: item.result_content,  // Conteúdo bruto do banco
    status: item.status || 'pending',
    execution_time_ms: item.execution_time_ms,
    created_at: item.created_at
  }));

  return mappedResults;
}
```

### 3.2. Uso nas Páginas

**Localizações:**
- `src/pages/MyProcessDetailPage.tsx` (linhas 440, 489)
- `src/components/ChatMessageAssistant.tsx` (linhas 113, 116)

```typescript
// MyProcessDetailPage.tsx
<AnalysisContentRenderer content={result.result_content || ''} />

// ChatMessageAssistant.tsx
<AnalysisContentRenderer content={content} />
```

O conteúdo é passado diretamente para o componente renderizador sem tratamento intermediário.

---

## 4. Componente de Renderização

### 4.1. AnalysisContentRenderer

**Localização:** `src/components/AnalysisContentRenderer.tsx`

**Nome do componente:** `AnalysisContentRenderer`

Este é o componente principal e universal para renderizar todo o conteúdo de análises.

#### 4.1.1. Interface e Props

```typescript
interface AnalysisContentRendererProps {
  content: string;  // Conteúdo bruto do banco
}

export function AnalysisContentRenderer({ content }: AnalysisContentRendererProps)
```

#### 4.1.2. Responsabilidades

- Detecta automaticamente o tipo de conteúdo (JSON, Markdown, ou texto puro)
- Converte JSON em estruturas visuais legíveis
- Renderiza Markdown com formatação apropriada
- Garante que nenhum JSON seja exibido em formato bruto
- Adapta-se ao tema claro/escuro
- Suporta todos os 9 tipos de análise forense

---

## 5. Etapas de Parse e Tratamento

### 5.1. Função Principal: parseContent()

**Localização:** `src/components/AnalysisContentRenderer.tsx` (linhas 65-99)

```typescript
const parseContent = (text: string) => {
  let cleanedText = text.trim();

  // ETAPA 1: Remover marcadores de código
  if (cleanedText.startsWith('```json') || cleanedText.startsWith('```')) {
    cleanedText = cleanedText.replace(/^```json\n?/, '').replace(/^```\n?/, '');
    cleanedText = cleanedText.replace(/\n?```$/, '');
    cleanedText = cleanedText.trim();
  }

  // ETAPA 2: Detectar se parece JSON
  const looksLikeJSON = (str: string): boolean => {
    const trimmed = str.trim();
    return (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    );
  };

  // ETAPA 3: Tentar fazer parse do JSON
  if (looksLikeJSON(cleanedText)) {
    try {
      const parsed = JSON.parse(cleanedText);

      if (Array.isArray(parsed)) {
        return parsed;  // Retorna array
      }

      if (typeof parsed === 'object' && parsed !== null) {
        return parsed;  // Retorna objeto
      }
    } catch (e) {
      console.warn('[AnalysisContentRenderer] Failed to parse JSON-like content:', e);
    }
  }

  // ETAPA 4: Se não é JSON válido, retornar como string
  return cleanedText;
};
```

**Fluxo de decisão:**

```
Conteúdo bruto
    ↓
Remover marcadores ```json e ```
    ↓
Parece JSON? (inicia com { ou [)
    ↓ Sim                      ↓ Não
Tentar JSON.parse          Retornar string
    ↓                            ↓
Sucesso?                   Processar como Markdown
    ↓ Sim        ↓ Não
Retornar        Retornar
objeto/array    string
```

### 5.2. Detecção de Formato JSON

**Heurística utilizada:**

1. **Verificação estrutural:** Conteúdo inicia com `{` e termina com `}` OU inicia com `[` e termina com `]`
2. **Parse tentativo:** Usa `JSON.parse()` para validar se é JSON válido
3. **Fallback:** Se falhar, trata como texto/markdown

### 5.3. Tipos de Conteúdo Suportados

1. **JSON de objeto:** `{ "campo": "valor" }`
2. **JSON de array:** `[ "item1", "item2" ]`
3. **JSON complexo:** Objetos e arrays aninhados
4. **Markdown:** Títulos (# ## ###), listas (- *), numeração (1. 2.)
5. **Texto puro:** Parágrafos e quebras de linha

---

## 6. Renderização de Valores

### 6.1. Função renderValue()

**Localização:** `src/components/AnalysisContentRenderer.tsx` (linhas 101-242)

Esta função recursiva processa cada tipo de valor encontrado no conteúdo.

#### 6.1.1. Renderização de Valores Nulos

```typescript
if (value === null || value === undefined) {
  return <span style={{ color: colors.textSecondary }}>-</span>;
}
```

#### 6.1.2. Renderização de Strings

```typescript
if (typeof value === 'string') {
  if (value.trim() === '') {
    return <span style={{ color: colors.textSecondary }}>-</span>;
  }
  return (
    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
      {value}
    </p>
  );
}
```

**Características:**
- Preserva quebras de linha (`whitespace-pre-wrap`)
- Permite quebra de palavras longas (`break-words`)
- Usa cor do tema para texto

#### 6.1.3. Renderização de Números e Booleanos

```typescript
if (typeof value === 'number' || typeof value === 'boolean') {
  return <span style={{ color: textColor }}>{String(value)}</span>;
}
```

#### 6.1.4. Renderização de Arrays

**Tipos de array suportados:**

**A. Arrays de objetos complexos:**

```typescript
const hasComplexItems = value.some(item => typeof item === 'object' && !Array.isArray(item));

if (hasComplexItems) {
  return (
    <div className="space-y-4">
      {value.map((item, index) => (
        <div key={index} className="pl-4 border-l-2 pb-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded">
              {index + 1}
            </span>
          </div>
          <div>{renderValue(item, level + 1)}</div>
        </div>
      ))}
    </div>
  );
}
```

**Elementos visuais:**
- Badge numerado (1, 2, 3, ...)
- Borda lateral esquerda
- Espaçamento entre itens
- Renderização recursiva do conteúdo

**B. Arrays de strings:**

```typescript
const allStrings = value.every(item => typeof item === 'string');

if (allStrings) {
  return (
    <ul className="space-y-1.5 ml-0">
      {value.map((item, index) => (
        <li key={index} className="flex items-start space-x-2.5">
          <span className="flex-shrink-0 mt-2 w-1.5 h-1.5 rounded-full" />
          <p className="text-sm leading-relaxed">{item}</p>
        </li>
      ))}
    </ul>
  );
}
```

**Elementos visuais:**
- Bullet point circular
- Texto formatado
- Espaçamento consistente

**C. Arrays mistos:**

```typescript
return (
  <ul className="space-y-2 ml-0">
    {value.map((item, index) => (
      <li key={index} className="flex items-start space-x-2">
        <span className="flex-shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full" />
        <div className="flex-1">{renderValue(item, level + 1)}</div>
      </li>
    ))}
  </ul>
);
```

#### 6.1.5. Renderização de Objetos

```typescript
if (typeof value === 'object') {
  return (
    <div className={level > 0 ? 'space-y-3' : 'space-y-4'}>
      {Object.entries(value).map(([key, val]) => {
        // Formatar nome do campo
        const formattedKey = key
          .replace(/_/g, ' ')  // snake_case → espaços
          .replace(/([a-z])([A-Z])/g, '$1 $2')  // camelCase → espaços
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');  // Title Case

        // Verificar se está vazio
        const isEmpty =
          val === null ||
          val === undefined ||
          (typeof val === 'string' && val.trim() === '') ||
          (Array.isArray(val) && val.length === 0) ||
          (typeof val === 'object' && !Array.isArray(val) && Object.keys(val).length === 0);

        // Ocultar campos vazios
        if (isEmpty) {
          return null;
        }

        const isComplexValue = typeof val === 'object';

        return (
          <div
            key={key}
            className={level > 0 && isComplexValue ? 'pl-4 border-l-2' : ''}
          >
            <h4 className={`font-semibold mb-2 ${
              level === 0 ? 'text-base' : level === 1 ? 'text-sm' : 'text-xs'
            }`}>
              {formattedKey}
            </h4>
            <div>{renderValue(val, level + 1)}</div>
          </div>
        );
      })}
    </div>
  );
}
```

**Formatação de campos:**

| Entrada | Saída |
|---------|-------|
| `nome_completo` | "Nome Completo" |
| `dataInicio` | "Data Inicio" |
| `valor_total` | "Valor Total" |
| `numeroProcesso` | "Numero Processo" |

**Hierarquia visual:**

| Nível | Tamanho do Título | Borda Lateral |
|-------|-------------------|---------------|
| 0 | text-base (16px) | Não |
| 1 | text-sm (14px) | Sim (se complexo) |
| 2+ | text-xs (12px) | Sim (se complexo) |

**Campos vazios:**
- São automaticamente ocultados
- Não ocupam espaço na renderização
- Reduz poluição visual

---

## 7. Renderização de Markdown

### 7.1. Processamento de Texto Markdown

**Localização:** `src/components/AnalysisContentRenderer.tsx` (linhas 246-354)

Quando o conteúdo é identificado como string (não JSON), é processado como Markdown:

```typescript
if (typeof parsedContent === 'string') {
  const lines = parsedContent.split('\n');
  const formattedLines: JSX.Element[] = [];

  lines.forEach((line, index) => {
    const trimmedLine = line.trim();

    // Linha vazia
    if (trimmedLine === '') {
      formattedLines.push(<div key={index} className="h-2" />);
      return;
    }

    // Função para limpar markdown inline
    const cleanText = (text: string) => {
      return text
        .replace(/\*\*(.+?)\*\*/g, '$1')  // Negrito
        .replace(/\*(.+?)\*/g, '$1')       // Itálico
        .replace(/`(.+?)`/g, '$1')         // Código inline
        .replace(/~~(.+?)~~/g, '$1');      // Tachado
    };

    // Processar cada tipo de linha...
  });
}
```

### 7.2. Tipos de Linha Suportados

#### 7.2.1. Títulos Principais (H1)

```typescript
if (trimmedLine.startsWith('# ')) {
  formattedLines.push(
    <h2 className="text-xl font-bold mt-6 mb-3">
      {cleanText(trimmedLine.replace('# ', ''))}
    </h2>
  );
}
```

**Exemplo:**
```
# Visão Geral do Processo
```

#### 7.2.2. Subtítulos (H2)

```typescript
else if (trimmedLine.startsWith('## ')) {
  formattedLines.push(
    <h3 className="text-lg font-semibold mt-4 mb-2">
      {cleanText(trimmedLine.replace('## ', ''))}
    </h3>
  );
}
```

**Exemplo:**
```
## Identificação das Partes
```

#### 7.2.3. Subtítulos Menores (H3)

```typescript
else if (trimmedLine.startsWith('### ')) {
  formattedLines.push(
    <h4 className="text-base font-semibold mt-3 mb-2">
      {cleanText(trimmedLine.replace('### ', ''))}
    </h4>
  );
}
```

**Exemplo:**
```
### Parte Autora
```

#### 7.2.4. Listas com Bullets

```typescript
else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
  formattedLines.push(
    <div className="flex items-start space-x-2 mb-1">
      <span className="flex-shrink-0 mt-2 w-1.5 h-1.5 rounded-full" />
      <p className="text-sm leading-relaxed">
        {cleanText(trimmedLine.replace(/^[-*]\s/, ''))}
      </p>
    </div>
  );
}
```

**Exemplo:**
```
- Primeira observação
- Segunda observação
* Terceira observação
```

#### 7.2.5. Listas Numeradas

```typescript
else if (/^\d+\.\s/.test(trimmedLine)) {
  const match = trimmedLine.match(/^(\d+)\.\s(.+)$/);
  if (match) {
    formattedLines.push(
      <div className="flex items-start space-x-2 mb-1">
        <span className="flex-shrink-0 font-semibold">
          {match[1]}.
        </span>
        <p className="text-sm leading-relaxed">
          {cleanText(match[2])}
        </p>
      </div>
    );
  }
}
```

**Exemplo:**
```
1. Primeiro item
2. Segundo item
3. Terceiro item
```

#### 7.2.6. Texto em Negrito

```typescript
else if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**')) {
  formattedLines.push(
    <p className="font-bold text-sm mb-2">
      {cleanText(trimmedLine.replace(/\*\*/g, ''))}
    </p>
  );
}
```

**Exemplo:**
```
**Observação Importante**
```

#### 7.2.7. Parágrafos Normais

```typescript
else {
  formattedLines.push(
    <p className="text-sm leading-relaxed break-words mb-2">
      {cleanText(line)}
    </p>
  );
}
```

### 7.3. Limpeza de Markdown Inline

A função `cleanText()` remove marcadores de formatação mas preserva o texto:

| Marcador | Regex | Exemplo Antes | Exemplo Depois |
|----------|-------|---------------|----------------|
| Negrito | `\*\*(.+?)\*\*` | `**texto**` | `texto` |
| Itálico | `\*(.+?)\*` | `*texto*` | `texto` |
| Código | `` `(.+?)` `` | `` `código` `` | `código` |
| Tachado | `~~(.+?)~~` | `~~texto~~` | `texto` |

---

## 8. Suporte a Temas

### 8.1. Integração com ThemeContext

```typescript
const { theme } = useTheme();
const colors = getThemeColors(theme);
const textColor = theme === 'dark' ? '#FAFAFA' : colors.textPrimary;
```

### 8.2. Cores Adaptativas

**Tema Escuro:**
- Texto principal: `#FAFAFA`
- Texto secundário: `colors.textSecondary` (cinza claro)
- Fundo secundário: `colors.bgSecondary` (cinza escuro)
- Bordas: `colors.border` (cinza médio)

**Tema Claro:**
- Texto principal: `colors.textPrimary` (preto/cinza escuro)
- Texto secundário: `colors.textSecondary` (cinza médio)
- Fundo secundário: `colors.bgSecondary` (branco/cinza claro)
- Bordas: `colors.border` (cinza claro)

---

## 9. Casos de Uso

### 9.1. Análises Forenses (9 tipos)

O componente é usado para renderizar todos os 9 tipos de análise:

1. **Visão Geral do Processo**
2. **Resumo Estratégico**
3. **Comunicações e Prazos**
4. **Admissibilidade Recursal**
5. **Estratégias Jurídicas Recomendadas**
6. **Riscos e Alertas Processuais**
7. **Balanço Financeiro e Créditos Processuais**
8. **Mapa de Preclusões Processuais**
9. **Conclusões e Perspectivas Processuais**

### 9.2. Chat com Processo

**Localização:** `src/components/ChatMessageAssistant.tsx`

```typescript
<AnalysisContentRenderer content={content} />
```

Renderiza respostas do assistente em tempo real, com suporte a:
- Efeito de digitação progressiva
- Formatação Markdown
- JSON estruturado (se retornado pela LLM)

### 9.3. Análise Completa

Exibe todas as análises concatenadas em sequência, com formatação consistente.

---

## 10. Utilities de Suporte

### 10.1. contentParser.ts

**Localização:** `src/utils/contentParser.ts`

Versão alternativa/legada de parse, converte JSON para Markdown:

```typescript
export function parseContent(content: string): ParsedContent {
  let cleanedText = content.trim();

  // Remove marcadores
  if (cleanedText.startsWith('```json') || cleanedText.startsWith('```')) {
    cleanedText = cleanedText.replace(/^```json\n?/, '').replace(/^```\n?/, '');
    cleanedText = cleanedText.replace(/\n?```$/, '');
    cleanedText = cleanedText.trim();
  }

  // Detecta JSON
  if (looksLikeJSON(cleanedText)) {
    try {
      const parsed = JSON.parse(cleanedText);
      const markdown = convertJSONToMarkdown(parsed);
      return { type: 'text', value: markdown };
    } catch (e) {
      console.warn('[contentParser] Failed to parse JSON-like content:', e);
    }
  }

  return { type: 'text', value: cleanedText };
}
```

**Uso atual:** Não é usado ativamente, mantido para compatibilidade.

### 10.2. contentCleaner.ts

**Localização:** `src/utils/contentCleaner.ts`

Versão simplificada focada em limpeza:

```typescript
export function cleanContentForDisplay(content: string): string {
  let cleaned = content.trim();

  // Remove marcadores
  if (cleaned.startsWith('```json') || cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```json\n?/, '').replace(/^```\n?/, '');
    cleaned = cleaned.replace(/\n?```$/, '');
    cleaned = cleaned.trim();
  }

  // Tenta converter JSON para texto
  if (looksLikeJSON(cleaned)) {
    try {
      const parsed = JSON.parse(cleaned);
      return formatJSONToText(parsed);
    } catch (e) {
      return cleaned;
    }
  }

  // Remove markdown inline
  cleaned = cleaned.replace(/^#+\s*/gm, '');
  cleaned = cleaned.replace(/\*\*(.+?)\*\*/g, '$1');
  cleaned = cleaned.replace(/\*(.+?)\*/g, '$1');
  cleaned = cleaned.replace(/`(.+?)`/g, '$1');

  return cleaned;
}
```

**Uso atual:** Não é usado ativamente, pode ser removido.

---

## 11. Diagrama de Fluxo Completo

```
┌─────────────────────────────────────────────────────────────┐
│                      1. GERAÇÃO LLM                          │
│                                                              │
│  Gemini gera resposta em formato:                           │
│  - JSON puro                                                 │
│  - JSON com marcadores ```json                              │
│  - Markdown formatado                                        │
│  - Texto com prefixos                                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              2. LIMPEZA BACKEND (Edge Function)             │
│                                                              │
│  process-next-prompt/index.ts (linhas 442-453)             │
│  - Remove marcadores ```json e ```                          │
│  - Aplica trim()                                            │
│  - Salva em analysis_results.result_content                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│            3. ARMAZENAMENTO BANCO DE DADOS                  │
│                                                              │
│  Tabela: analysis_results                                   │
│  Campo: result_content (text)                               │
│  - Conteúdo limpo mas ainda pode ter marcadores residuais  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│          4. LIMPEZA ADICIONAL (Migration SQL)               │
│                                                              │
│  Migration: clean_json_markers_comprehensive_v2.sql         │
│  - Remove textos introdutórios                              │
│  - Remove TODOS os marcadores residuais                     │
│  - Operação retroativa em dados existentes                  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              5. RECUPERAÇÃO NO FRONTEND                     │
│                                                              │
│  AnalysisResultsService.getResultsByProcessoId()           │
│  - SELECT * FROM analysis_results                           │
│  - ORDER BY execution_order ASC                             │
│  - Retorna array de AnalysisResult                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                 6. USO NAS PÁGINAS                          │
│                                                              │
│  MyProcessDetailPage.tsx                                    │
│  ChatMessageAssistant.tsx                                   │
│  - Passa result_content para AnalysisContentRenderer        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│           7. COMPONENTE ANALYSISCONTENTRENDERER            │
│                                                              │
│  Etapa 7.1: parseContent()                                  │
│  - Remove marcadores finais (segurança adicional)           │
│  - Detecta se é JSON (inicia com { ou [)                   │
│  - Tenta JSON.parse()                                       │
│  - Retorna objeto, array ou string                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                8. DECISÃO DE RENDERIZAÇÃO                   │
│                                                              │
│  ┌─────────────┐      ┌──────────────┐      ┌────────────┐│
│  │ Objeto/Array│  ou  │   String     │  ou  │   Outro    ││
│  │     JSON    │      │   Markdown   │      │   Valor    ││
│  └──────┬──────┘      └──────┬───────┘      └─────┬──────┘│
│         │                    │                      │       │
│         ▼                    ▼                      ▼       │
│   renderValue()       Processar         renderValue()     │
│   (recursivo)          Markdown          (simples)        │
└─────────────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│            9. RENDERIZAÇÃO VISUAL FINAL                     │
│                                                              │
│  Se JSON:                                                   │
│  ├─ Arrays de objetos: Badges + bordas + recursão          │
│  ├─ Arrays de strings: Bullets + texto formatado           │
│  ├─ Objetos: Títulos hierárquicos + valores formatados     │
│  └─ Valores primitivos: Span com cor do tema               │
│                                                              │
│  Se Markdown:                                               │
│  ├─ # ## ###: Títulos com tamanhos apropriados             │
│  ├─ - * : Listas com bullets circulares                    │
│  ├─ 1. 2. 3.: Listas numeradas                             │
│  ├─ **: Negrito                                            │
│  └─ Parágrafos: Texto normal com quebra de linha          │
│                                                              │
│  Resultado: HTML formatado e estilizado                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 12. Garantias do Sistema

### 12.1. Nenhum JSON Bruto Visível

O sistema possui **múltiplas camadas de proteção** para garantir que JSON bruto nunca seja exibido:

1. **Camada 1:** Limpeza no backend (Edge Function)
2. **Camada 2:** Migration SQL retroativa
3. **Camada 3:** Parse no componente (parseContent)
4. **Camada 4:** Renderização estruturada (renderValue)

### 12.2. Formatação Consistente

- **Todos os 9 tipos de análise** usam o mesmo componente
- **Chat** usa o mesmo componente
- **Análise completa** usa o mesmo componente
- Garante experiência visual uniforme

### 12.3. Responsividade

- `break-words` e `overflow-wrap-anywhere` previnem overflow
- `whitespace-pre-wrap` preserva formatação de texto
- Hierarquia visual clara com tamanhos de fonte diferenciados
- Suporte a temas claro/escuro

### 12.4. Campos Vazios

- Automaticamente ocultados
- Reduz poluição visual
- Melhora legibilidade

---

## 13. Exemplos de Transformação

### Exemplo 1: JSON de Objeto

**Input (banco):**
```json
{
  "nome_completo": "João Silva",
  "cpf": "123.456.789-00",
  "endereco": {
    "rua": "Av. Principal",
    "numero": "123"
  }
}
```

**Output (renderizado):**
```
Nome Completo
João Silva

Cpf
123.456.789-00

Endereco
  Rua
  Av. Principal

  Numero
  123
```

### Exemplo 2: JSON de Array de Strings

**Input (banco):**
```json
[
  "Prazo para recurso: 15 dias",
  "Citação realizada em 10/01/2024",
  "Audiência marcada para 20/02/2024"
]
```

**Output (renderizado):**
```
• Prazo para recurso: 15 dias
• Citação realizada em 10/01/2024
• Audiência marcada para 20/02/2024
```

### Exemplo 3: JSON de Array de Objetos

**Input (banco):**
```json
[
  {
    "parte": "Autor",
    "nome": "João Silva",
    "tipo": "Pessoa Física"
  },
  {
    "parte": "Réu",
    "nome": "Empresa XYZ Ltda",
    "tipo": "Pessoa Jurídica"
  }
]
```

**Output (renderizado):**
```
┌─ 1 ─────────────────┐
│ Parte               │
│ Autor               │
│                     │
│ Nome                │
│ João Silva          │
│                     │
│ Tipo                │
│ Pessoa Física       │
└─────────────────────┘

┌─ 2 ─────────────────┐
│ Parte               │
│ Réu                 │
│                     │
│ Nome                │
│ Empresa XYZ Ltda    │
│                     │
│ Tipo                │
│ Pessoa Jurídica     │
└─────────────────────┘
```

### Exemplo 4: Markdown

**Input (banco):**
```markdown
# Visão Geral do Processo

## Identificação
- Número: 1234567-89.2024.8.01.0001
- Classe: Ação de Cobrança

## Partes
1. Autor: João Silva
2. Réu: Empresa XYZ

**Observação**: Processo em fase inicial
```

**Output (renderizado):**
```
[H1 grande] Visão Geral do Processo

[H2 médio] Identificação
• Número: 1234567-89.2024.8.01.0001
• Classe: Ação de Cobrança

[H2 médio] Partes
1. Autor: João Silva
2. Réu: Empresa XYZ

[Negrito] Observação: Processo em fase inicial
```

---

## 14. Considerações de Performance

### 14.1. Renderização Recursiva

- Usa `level` para limitar profundidade visual
- Não limita profundidade de parse (suporta JSON arbitrariamente aninhado)
- Keys únicas em cada elemento para otimização do React

### 14.2. Memoização

Não implementada atualmente, mas pode ser adicionada:

```typescript
const parsedContent = useMemo(() => parseContent(content), [content]);
```

### 14.3. Virtual Scrolling

Não necessário atualmente devido ao tamanho típico das análises.

---

## 15. Manutenção e Extensibilidade

### 15.1. Adicionando Novo Tipo de Formatação

Para adicionar suporte a um novo elemento Markdown:

```typescript
// Em parseContent, adicionar nova condição:
else if (trimmedLine.startsWith('> ')) {
  // Renderizar blockquote
  formattedLines.push(
    <blockquote className="border-l-4 pl-4 italic">
      {cleanText(trimmedLine.replace('> ', ''))}
    </blockquote>
  );
}
```

### 15.2. Modificando Estilos

Todos os estilos usam classes Tailwind e cores do tema:

```typescript
// Modificar tamanhos de fonte
className="text-xl font-bold"  // Para títulos principais
className="text-sm"  // Para texto normal

// Modificar cores
style={{ color: textColor }}  // Texto principal
style={{ color: colors.textSecondary }}  // Texto secundário
```

### 15.3. Debug e Logs

Para debugging, adicionar logs em pontos estratégicos:

```typescript
console.log('[AnalysisContentRenderer] Raw content:', content);
console.log('[AnalysisContentRenderer] Parsed content:', parsedContent);
console.log('[AnalysisContentRenderer] Type:', typeof parsedContent);
```

---

## 16. Checklist de Troubleshooting

### Problema: JSON está aparecendo bruto

**Verificar:**
1. ✅ Migration de limpeza foi executada?
2. ✅ Edge Function está limpando marcadores?
3. ✅ parseContent está detectando JSON?
4. ✅ JSON.parse não está falhando?

**Logs úteis:**
```typescript
console.warn('[AnalysisContentRenderer] Failed to parse JSON-like content:', e);
```

### Problema: Formatação incorreta

**Verificar:**
1. ✅ Quebras de linha estão preservadas?
2. ✅ Markdown está sendo processado?
3. ✅ cleanText está removendo marcadores corretamente?

### Problema: Campos não aparecem

**Verificar:**
1. ✅ Campos não estão vazios (null, '', [], {})?
2. ✅ Renderização recursiva está funcionando?
3. ✅ Keys duplicadas nos elementos?

---

## 17. Referências Rápidas

### Arquivos Principais

| Arquivo | Propósito | Linhas Importantes |
|---------|-----------|-------------------|
| `AnalysisContentRenderer.tsx` | Componente principal | 65-99 (parse), 101-242 (render) |
| `process-next-prompt/index.ts` | Limpeza backend | 442-467 |
| `clean_json_markers_*.sql` | Limpeza banco | Todo o arquivo |
| `AnalysisResultsService.ts` | Busca dados | 16-61 |

### Funções Principais

| Função | Localização | Propósito |
|--------|-------------|-----------|
| `parseContent()` | AnalysisContentRenderer.tsx:65 | Parse inicial do conteúdo |
| `renderValue()` | AnalysisContentRenderer.tsx:101 | Renderização recursiva |
| `cleanText()` | AnalysisContentRenderer.tsx:258 | Limpeza markdown inline |
| `looksLikeJSON()` | AnalysisContentRenderer.tsx:74 | Detecção de JSON |

### Tipos de Dados

| Interface | Arquivo | Uso |
|-----------|---------|-----|
| `AnalysisResult` | AnalysisResultsService.ts:3 | Dados do banco |
| `AnalysisContentRendererProps` | AnalysisContentRenderer.tsx:5 | Props do componente |

---

## 18. Conclusão

O fluxo de parse de conteúdo JSON para texto é robusto e multi-camadas, garantindo que:

1. **Nenhum JSON bruto** seja exibido ao usuário
2. **Formatação consistente** em todos os tipos de análise
3. **Suporte completo** a JSON, Markdown e texto puro
4. **Adaptação automática** ao tema do usuário
5. **Hierarquia visual clara** com bordas, badges e espaçamento
6. **Campos vazios** são ocultados automaticamente

O componente `AnalysisContentRenderer` é o coração do sistema, processando milhares de caracteres de análise forense e transformando-os em interfaces visuais legíveis e profissionais.
