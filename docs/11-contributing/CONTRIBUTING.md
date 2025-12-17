# Guia de Contribuição

Obrigado por seu interesse em contribuir com o projeto! Este guia vai ajudá-lo a começar.

## Índice

- [Código de Conduta](#código-de-conduta)
- [Como Contribuir](#como-contribuir)
- [Setup do Ambiente](#setup-do-ambiente)
- [Processo de Desenvolvimento](#processo-de-desenvolvimento)
- [Padrões de Código](#padrões-de-código)
- [Commits](#commits)
- [Pull Requests](#pull-requests)
- [Testes](#testes)
- [Documentação](#documentação)

---

## Código de Conduta

Este projeto segue um código de conduta. Ao participar, você concorda em manter um ambiente respeitoso e colaborativo.

### Nossas Expectativas

- Use linguagem acolhedora e inclusiva
- Respeite pontos de vista e experiências diferentes
- Aceite críticas construtivas graciosamente
- Foque no que é melhor para a comunidade
- Mostre empatia com outros membros

---

## Como Contribuir

Existem várias formas de contribuir:

### Reportar Bugs
- Use o template de bug report
- Inclua passos para reproduzir
- Adicione screenshots/logs se possível

### Sugerir Features
- Use o template de feature request
- Explique o problema que resolve
- Descreva a solução proposta

### Melhorar Documentação
- Corrigir typos
- Adicionar exemplos
- Clarificar explicações
- Traduzir documentação

### Contribuir com Código
- Corrigir bugs
- Implementar features
- Melhorar performance
- Adicionar testes

---

## Setup do Ambiente

### Pré-requisitos

- Node.js 18+ e npm
- Git
- Conta no Supabase
- Conta no Google AI Studio
- Conta no Stripe (para testes de pagamento)

### Instalação

```bash
# 1. Fork o repositório no GitHub

# 2. Clone seu fork
git clone https://github.com/seu-usuario/seu-fork.git
cd seu-fork

# 3. Adicione o repositório original como upstream
git remote add upstream https://github.com/repo-original.git

# 4. Instale dependências
npm install

# 5. Configure variáveis de ambiente
cp .env.example .env
# Edite o .env com suas credenciais

# 6. Execute o projeto
npm run dev
```

### Configuração do Supabase

1. Crie um projeto no [Supabase](https://app.supabase.com)
2. Copie a URL e anon key para o `.env`
3. Execute as migrations:
```bash
# Via Supabase Dashboard → SQL Editor
# Copie e execute cada arquivo de supabase/migrations/
```

### Configuração do Google Gemini

1. Acesse [Google AI Studio](https://aistudio.google.com)
2. Crie uma API key
3. Adicione ao `.env`:
```
VITE_GEMINI_API_KEY=sua-key
```

### Configuração do Stripe

1. Acesse [Stripe Dashboard](https://dashboard.stripe.com)
2. Use as test keys
3. Configure webhook para local testing:
```bash
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook
```

---

## Processo de Desenvolvimento

### 1. Crie um Branch

```bash
# Sempre crie um branch a partir da main atualizada
git checkout main
git pull upstream main
git checkout -b tipo/descricao-curta

# Exemplos:
git checkout -b feat/add-docx-support
git checkout -b fix/token-calculation-bug
git checkout -b docs/update-api-reference
```

### 2. Faça suas Alterações

- Siga os padrões de código
- Adicione testes se aplicável
- Atualize documentação se necessário
- Teste localmente

### 3. Commit

```bash
# Adicione arquivos
git add .

# Commit com mensagem descritiva
git commit -m "feat(analysis): add DOCX file support"
```

### 4. Push

```bash
# Push para seu fork
git push origin tipo/descricao-curta
```

### 5. Abra um Pull Request

- Vá até seu fork no GitHub
- Clique em "New Pull Request"
- Preencha o template de PR
- Aguarde review

---

## Padrões de Código

### TypeScript

```typescript
// Use tipos explícitos
function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}

// Use interfaces para objetos
interface User {
  id: string;
  email: string;
  name: string;
}

// Use type para unions/intersections
type Status = 'pending' | 'processing' | 'completed';
```

### React Components

```typescript
// Use function components
interface Props {
  title: string;
  onClose: () => void;
}

export function MyComponent({ title, onClose }: Props) {
  // Hooks primeiro
  const [state, setState] = useState('');

  // Effects
  useEffect(() => {
    // ...
  }, []);

  // Handlers
  const handleClick = () => {
    // ...
  };

  // Render
  return (
    <div>
      {/* JSX */}
    </div>
  );
}
```

### Naming Conventions

```typescript
// Componentes: PascalCase
MyComponent.tsx

// Hooks: camelCase com 'use'
useMyHook.ts

// Services: PascalCase com 'Service'
MyService.ts

// Utils: camelCase
myUtil.ts

// Constants: UPPER_SNAKE_CASE
const MAX_RETRIES = 3;

// Private functions: prefix com _
function _internalHelper() { }
```

### File Organization

```
src/
├── components/
│   ├── ComponentName/
│   │   ├── ComponentName.tsx
│   │   ├── ComponentName.test.tsx
│   │   └── index.ts
│   └── shared/
├── pages/
│   ├── PageName/
│   │   ├── PageName.tsx
│   │   └── index.ts
├── services/
│   └── ServiceName.ts
└── utils/
    └── utilName.ts
```

### CSS/Tailwind

```tsx
// Prefira Tailwind classes
<div className="flex items-center gap-4 p-4 bg-white rounded-lg shadow">

// Agrupe classes logicamente
<div className={`
  flex items-center justify-between
  p-4 rounded-lg
  bg-white dark:bg-gray-800
  shadow-md hover:shadow-lg
  transition-shadow duration-200
`}>

// Use classnames para condicionais
<div className={classNames(
  'base-classes',
  condition && 'conditional-classes',
  {
    'active': isActive,
    'disabled': isDisabled,
  }
)}>
```

---

## Commits

Seguimos [Conventional Commits](https://www.conventionalcommits.org/).

### Formato

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: Nova feature
- `fix`: Bug fix
- `docs`: Documentação
- `style`: Formatação (sem mudança de lógica)
- `refactor`: Refatoração
- `perf`: Melhoria de performance
- `test`: Adicionar/modificar testes
- `chore`: Manutenção/ferramentas
- `ci`: CI/CD changes

### Scopes (opcional)

- `analysis` - Sistema de análise
- `chat` - Sistema de chat
- `auth` - Autenticação
- `subscription` - Assinaturas
- `tokens` - Sistema de tokens
- `ui` - Interface do usuário
- `db` - Database
- `api` - APIs/Edge Functions

### Exemplos

```bash
# Feature simples
git commit -m "feat(analysis): add DOCX support"

# Bug fix
git commit -m "fix(tokens): correct balance calculation"

# Breaking change
git commit -m "feat(api)!: change response format

BREAKING CHANGE: API now returns data in new format"

# Com body
git commit -m "refactor(chat): improve message handling

- Extract message validation to separate function
- Add error handling for edge cases
- Improve type safety"
```

---

## Pull Requests

### Checklist

Antes de abrir um PR, verifique:

- [ ] Código compila sem erros
- [ ] Testes passam (`npm test`)
- [ ] Lint passa (`npm run lint`)
- [ ] Type check passa (`npm run typecheck`)
- [ ] Documentação atualizada
- [ ] CHANGELOG.md atualizado (se aplicável)
- [ ] Commit messages seguem convenção
- [ ] Branch está atualizado com main

### Template de PR

```markdown
## Descrição
[Descrição clara do que foi feito]

## Tipo de Mudança
- [ ] Bug fix
- [ ] Nova feature
- [ ] Breaking change
- [ ] Documentação

## Motivação
[Por que esta mudança é necessária?]

## Como Testar
1. [Passo 1]
2. [Passo 2]
3. [Passo 3]

## Screenshots
[Se aplicável]

## Checklist
- [ ] Testes adicionados/atualizados
- [ ] Documentação atualizada
- [ ] Código revisado pessoalmente
- [ ] Sem warnings de lint
- [ ] Type check passa

## Issues Relacionadas
Closes #123
Related to #456
```

### Processo de Review

1. **Automated Checks**: CI roda automaticamente
2. **Code Review**: Pelo menos 1 aprovação necessária
3. **Testing**: Reviewer testa as mudanças
4. **Feedback**: Discussão e ajustes se necessário
5. **Merge**: Após aprovação, PR é mergeado

---

## Testes

### Rodando Testes

```bash
# Todos os testes
npm test

# Watch mode
npm test -- --watch

# Coverage
npm test -- --coverage

# Teste específico
npm test -- MyComponent.test.tsx
```

### Escrevendo Testes

```typescript
// Component test
import { render, screen } from '@testing-library/react';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent title="Test" />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('calls onClose when button clicked', () => {
    const handleClose = jest.fn();
    render(<MyComponent onClose={handleClose} />);

    fireEvent.click(screen.getByRole('button'));
    expect(handleClose).toHaveBeenCalled();
  });
});
```

---

## Documentação

### Quando Documentar

- Novas features
- APIs públicas
- Mudanças de comportamento
- Configurações complexas

### Onde Documentar

- **README.md** - Overview do projeto
- **docs/** - Documentação detalhada
- **Código** - JSDoc para funções/componentes complexos
- **CHANGELOG.md** - Histórico de mudanças

### Estilo de Documentação

```typescript
/**
 * Calcula o custo total de uma análise baseado no número de tokens.
 *
 * @param tokens - Número de tokens a serem utilizados
 * @param modelType - Tipo do modelo ('simple' | 'complex')
 * @returns O custo calculado em créditos
 *
 * @example
 * ```ts
 * const cost = calculateCost(1000, 'simple');
 * console.log(cost); // 10
 * ```
 */
function calculateCost(tokens: number, modelType: string): number {
  // Implementation
}
```

---

## Perguntas?

Se tiver dúvidas:

1. Verifique a [documentação completa](../README.md)
2. Procure em [issues existentes](https://github.com/repo/issues)
3. Abra uma [nova issue](https://github.com/repo/issues/new)

---

**Obrigado por contribuir!**
