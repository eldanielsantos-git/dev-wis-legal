# Componentes e Utilitários Compartilhados - Análises

**Estruturas padronizadas para prevenir erros de parse e render.**

## Uso Opcional - NÃO Obrigatório

Essas estruturas **complementam** o código existente sem substituí-lo. Você pode:
- Continuar usando o código atual normalmente
- Adotar gradualmente os helpers onde necessário
- Refatorar apenas quando conveniente

## Estrutura Criada

```
src/
├── types/analysis.ts                     # Tipos TypeScript consolidados
├── utils/analysisHelpers.ts              # Helpers de parse/validação
└── components/analysis-views/shared/     # Componentes compartilhados
    ├── SeverityBadge.tsx                 # Badges unificados
    ├── SectionHeader.tsx                 # Títulos de seção
    ├── ErrorCard.tsx                     # Cards de erro padronizados
    ├── EmptyState.tsx                    # Estado vazio
    └── index.ts                          # Exports
```

## 1. analysisHelpers.ts - Parse Seguro

### Antes (manual em cada view):
```typescript
try {
  let cleanContent = content.trim();
  if (cleanContent.startsWith('```json')) {
    cleanContent = cleanContent.substring(7);
  }
  if (cleanContent.endsWith('```')) {
    cleanContent = cleanContent.substring(0, cleanContent.length - 3);
  }
  data = JSON.parse(cleanContent);
} catch (error) {
  return <div>Erro ao processar...</div>;
}
```

### Depois (helpers centralizados):
```typescript
import { parseAnalysisContent } from '../../utils/analysisHelpers';

const result = parseAnalysisContent<MyDataType>(content, 'expectedKey');

if (!result.success) {
  return <ErrorCard type="parse" message={result.error} rawContent={result.rawContent} />;
}

const data = result.data;
```

## 2. Componentes Compartilhados

### SeverityBadge - Badges Unificados
```typescript
import { SeverityBadge } from './shared';

// Antes: código duplicado em cada view
<span className={`inline-flex px-2 py-1 text-xs font-medium rounded border ${getGravidadeBadge(alerta.gravidade)}`}>
  {alerta.gravidade}
</span>

// Depois: componente reutilizável
<SeverityBadge variant={alerta.gravidade} type="gravidade" />
<SeverityBadge variant={alerta.urgencia} type="urgencia" />
<SeverityBadge variant={risco} type="risco" />
```

### ErrorCard - Erros Padronizados
```typescript
import { ErrorCard } from './shared';

// Parse error
<ErrorCard
  type="parse"
  message="Não foi possível fazer parse do JSON"
  rawContent={content}
/>

// Structure error
<ErrorCard
  type="structure"
  message="Estrutura inválida: esperava chave 'riscosAlertasProcessuais'"
  details={`Chaves encontradas: ${Object.keys(data).join(', ')}`}
/>
```

### SectionHeader - Títulos Consistentes
```typescript
import { SectionHeader } from './shared';

<SectionHeader title="Título Principal" level={1} />
<SectionHeader title="Seção" level={2} />
<SectionHeader title="Subseção" level={3} />
```

### EmptyState - Estado Vazio
```typescript
import { EmptyState } from './shared';

{items.length === 0 && <EmptyState message="Nenhum alerta encontrado" />}
```

## 3. Tipos TypeScript

```typescript
import type {
  BaseCampo,
  BaseSecao,
  GravidadeNivel,
  RiscoNivel,
  AnalysisParseResult
} from '../../types/analysis';

interface MySecao extends BaseSecao {
  listaAlertas?: Alerta[];
}
```

## Exemplo Completo: Refatoração de View

### Antes:
```typescript
export function MyAnalysisView({ content }: Props) {
  let data: MyData | null = null;

  try {
    let cleanContent = content.trim();
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.substring(7);
    }
    if (cleanContent.endsWith('```')) {
      cleanContent = cleanContent.substring(0, cleanContent.length - 3);
    }
    data = JSON.parse(cleanContent);
  } catch (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800">Erro ao processar os dados.</p>
      </div>
    );
  }

  if (!data?.myData) {
    return (
      <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-yellow-800">Estrutura inválida.</p>
      </div>
    );
  }

  const { myData } = data;

  return (
    <div>
      <h1 className="text-2xl font-bold">{myData.titulo}</h1>
      {/* ... resto do render ... */}
    </div>
  );
}
```

### Depois:
```typescript
import { parseAnalysisContent } from '../../utils/analysisHelpers';
import { ErrorCard, SectionHeader } from './shared';

export function MyAnalysisView({ content }: Props) {
  const result = parseAnalysisContent<{ myData: MyData }>(content, 'myData');

  if (!result.success) {
    return <ErrorCard type="parse" message={result.error} rawContent={result.rawContent} />;
  }

  const { myData } = result.data!;

  return (
    <div>
      <SectionHeader title={myData.titulo} level={1} />
      {/* ... resto do render ... */}
    </div>
  );
}
```

## Benefícios

1. **Código mais limpo**: Menos duplicação
2. **Consistência**: Mesmos erros, mesmos badges
3. **Manutenção**: Mudanças em um lugar só
4. **TypeScript**: Tipos seguros
5. **Opcional**: Adote no seu ritmo

## Diretrizes

- ✅ Use onde fizer sentido
- ✅ Mantenha código existente funcionando
- ✅ Refatore gradualmente
- ❌ Não force uso obrigatório
- ❌ Não mude visual existente
