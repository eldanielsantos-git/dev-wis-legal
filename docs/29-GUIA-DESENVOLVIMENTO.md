# 29 - Guia de Desenvolvimento

## 📋 Pré-requisitos

### Software Necessário

```bash
# Node.js 18+
node --version  # v18.0.0 ou superior

# npm 9+
npm --version  # 9.0.0 ou superior

# Git
git --version
```

### Contas Necessárias

1. **Supabase** (https://supabase.com)
   - Criar projeto
   - Obter URL e Anon Key

2. **Google Cloud Platform** (https://console.cloud.google.com)
   - Criar projeto
   - Ativar APIs: Document AI, Gemini, Cloud Storage
   - Criar Service Account
   - Baixar JSON de credenciais

3. **Stripe** (https://stripe.com)
   - Conta de desenvolvedor
   - API Keys (test mode)

## 🚀 Setup do Projeto

### 1. Clone do Repositório

```bash
git clone https://github.com/seu-usuario/wislegal.git
cd wislegal
```

### 2. Instalação de Dependências

```bash
npm install
```

### 3. Configuração de Variáveis de Ambiente

#### Frontend (.env)
```bash
cp .env.example .env
```

Editar `.env`:
```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Edge Functions (Supabase Dashboard)

Acessar: Supabase Dashboard → Settings → Edge Functions → Environment Variables

```env
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
GEMINI_API_KEY=AIzaSy...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
```

### 4. Configuração do Banco de Dados

```bash
# Executar migrações
npx supabase db push

# Verificar
npx supabase db diff
```

### 5. Deploy de Edge Functions

```bash
# Deploy todas as functions
npx supabase functions deploy

# Ou uma específica
npx supabase functions deploy start-analysis
```

### 6. Iniciar Desenvolvimento

```bash
npm run dev
```

Acessar: http://localhost:5173

## 📁 Estrutura do Projeto

```
wislegal/
├── docs/                      # Documentação completa
├── public/                    # Assets estáticos
│   ├── _redirects
│   ├── robots.txt
│   └── sitemap.xml
├── src/
│   ├── components/            # Componentes React (40+)
│   │   ├── subscription/
│   │   └── ...
│   ├── contexts/              # React Contexts
│   │   ├── AuthContext.tsx
│   │   ├── ThemeContext.tsx
│   │   └── NotificationContext.tsx
│   ├── data/                  # Dados estáticos
│   │   └── brazilianLocations.ts
│   ├── hooks/                 # Custom hooks
│   │   ├── useAuth.ts
│   │   ├── useToast.ts
│   │   └── ...
│   ├── lib/                   # Configurações
│   │   ├── supabase.ts
│   │   └── gemini.ts
│   ├── pages/                 # Páginas (25+)
│   │   ├── HomePage.tsx
│   │   ├── SignInPage.tsx
│   │   └── ...
│   ├── services/              # Lógica de negócio
│   │   ├── ProcessosService.ts
│   │   ├── AnalysisService.ts
│   │   └── ...
│   ├── types/                 # TypeScript types
│   │   └── billing.ts
│   ├── utils/                 # Utilitários
│   │   ├── contentParser.ts
│   │   └── ...
│   ├── workers/               # Web Workers
│   │   └── pdf-processor.worker.ts
│   ├── App.tsx                # App principal
│   ├── main.tsx               # Entry point
│   └── index.css              # Estilos globais
├── supabase/
│   ├── functions/             # Edge Functions (15)
│   │   ├── start-analysis/
│   │   ├── process-next-prompt/
│   │   └── ...
│   └── migrations/            # SQL migrations (100+)
├── .env                       # Variáveis de ambiente
├── .env.example               # Template de .env
├── .gitignore
├── eslint.config.js           # ESLint config
├── index.html                 # HTML principal
├── package.json               # Dependências
├── postcss.config.js          # PostCSS config
├── tailwind.config.js         # Tailwind config
├── tsconfig.json              # TypeScript config
├── tsconfig.app.json
├── tsconfig.node.json
└── vite.config.ts             # Vite config
```

## 🛠️ Comandos Úteis

### Development
```bash
# Iniciar dev server
npm run dev

# Build para produção
npm run build

# Preview do build
npm run preview

# Type checking
npm run typecheck

# Linting
npm run lint
```

### Supabase
```bash
# Login
npx supabase login

# Link projeto
npx supabase link

# Status do projeto
npx supabase status

# Criar migration
npx supabase migration new nome_da_migration

# Aplicar migrations
npx supabase db push

# Reset database (CUIDADO!)
npx supabase db reset

# Logs de Edge Function
npx supabase functions logs start-analysis

# Deploy Edge Function
npx supabase functions deploy start-analysis
```

### Database
```bash
# Conectar ao PostgreSQL
psql -h db.xxx.supabase.co -U postgres

# Backup
pg_dump -h db.xxx.supabase.co -U postgres > backup.sql

# Restore
psql -h db.xxx.supabase.co -U postgres < backup.sql
```

## 🔧 Workflow de Desenvolvimento

### 1. Criar Branch

```bash
git checkout -b feature/nova-funcionalidade
```

### 2. Desenvolver Feature

```typescript
// Criar componente
src/components/NovoComponente.tsx

// Criar serviço (se necessário)
src/services/NovoService.ts

// Adicionar tipos (se necessário)
src/types/novo.ts

// Criar página (se necessário)
src/pages/NovaPagina.tsx
```

### 3. Testar

```bash
# Type check
npm run typecheck

# Lint
npm run lint

# Build
npm run build

# Testar localmente
npm run preview
```

### 4. Commit

```bash
git add .
git commit -m "feat: adiciona nova funcionalidade"
```

Convenções de commit:
- `feat:` Nova funcionalidade
- `fix:` Correção de bug
- `docs:` Documentação
- `style:` Formatação
- `refactor:` Refatoração
- `test:` Testes
- `chore:` Manutenção

### 5. Push e Pull Request

```bash
git push origin feature/nova-funcionalidade
```

## 🎨 Convenções de Código

### TypeScript

```typescript
// ✅ BOM: Tipagem explícita
interface Props {
  title: string;
  onClick: () => void;
  isActive?: boolean;
}

function Component({ title, onClick, isActive = false }: Props) {
  // ...
}

// ❌ RUIM: Any types
function Component(props: any) {
  // ...
}
```

### Naming

```typescript
// Componentes: PascalCase
MyComponent.tsx

// Serviços: PascalCase + Service
ProcessosService.ts

// Hooks: camelCase + use
useMyHook.ts

// Utils: camelCase
myUtilFunction.ts

// Constantes: UPPER_SNAKE_CASE
const MAX_FILE_SIZE = 3 * 1024 * 1024 * 1024;

// Variáveis: camelCase
const userName = 'João';
```

### Componentes

```tsx
// ✅ BOM: Componente funcional com tipos
interface MyComponentProps {
  title: string;
  onSubmit: (data: FormData) => void;
}

export function MyComponent({ title, onSubmit }: MyComponentProps) {
  const [data, setData] = useState<FormData | null>(null);

  return (
    <div>
      <h1>{title}</h1>
      <button onClick={() => onSubmit(data!)}>Submit</button>
    </div>
  );
}

// ❌ RUIM: Sem tipos, arrow function desnecessária
export const MyComponent = (props) => {
  return <div>...</div>;
};
```

### Imports

```typescript
// ✅ BOM: Imports organizados
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/contexts/AuthContext';
import { ProcessosService } from '@/services/ProcessosService';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';

import type { Processo } from '@/lib/supabase';

// ❌ RUIM: Imports desordenados
import { Button } from '@/components/Button';
import type { Processo } from '@/lib/supabase';
import React from 'react';
import { ProcessosService } from '@/services/ProcessosService';
```

## 🐛 Debugging

### Frontend

```typescript
// Console logs estruturados
console.log('[ComponentName] Ação', { data, estado });

// Erro
console.error('[ComponentName] Erro:', error);

// Warning
console.warn('[ComponentName] Aviso:', message);
```

### Edge Functions

```typescript
// Logs aparecem no dashboard Supabase
console.log('Processando:', processo_id);
console.error('Erro:', error.message);
```

### React DevTools

1. Instalar extensão React DevTools
2. Inspecionar componentes
3. Ver props e state
4. Profiling de performance

### Network Tab

1. Abrir DevTools (F12)
2. Aba Network
3. Filtrar por XHR/Fetch
4. Inspecionar requests/responses

## 🧪 Testes

### Type Checking

```bash
npm run typecheck
```

### Linting

```bash
npm run lint

# Auto-fix
npm run lint -- --fix
```

### Manual Testing Checklist

- [ ] Upload de PDF pequeno (<50MB)
- [ ] Upload de PDF grande (>50MB)
- [ ] Análise completa end-to-end
- [ ] Chat com processo
- [ ] Notificações em tempo real
- [ ] Sistema de tokens
- [ ] Checkout Stripe
- [ ] Responsividade mobile
- [ ] Dark mode / Light mode
- [ ] Logout e relogin

## 📊 Monitoramento Local

### Console do Browser

```javascript
// Ver WebSocket connections
// DevTools → Network → WS

// Ver localStorage
console.log(localStorage);

// Ver sessionStorage
console.log(sessionStorage);
```

### Supabase Dashboard

- **Database**: Ver tabelas e dados
- **Auth**: Ver usuários
- **Storage**: Ver arquivos
- **Edge Functions**: Ver logs
- **API Docs**: Ver endpoints disponíveis

## 🚀 Deploy

### Build de Produção

```bash
npm run build
```

Saída: pasta `dist/`

### Variáveis de Ambiente Produção

Garantir que `.env` contém valores de **produção**:
```env
VITE_SUPABASE_URL=https://producao.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key-producao>
```

### Deploy Edge Functions

```bash
# Deploy todas
npx supabase functions deploy

# Verificar logs
npx supabase functions logs start-analysis --tail
```

### Checklist Pre-Deploy

- [ ] `npm run typecheck` sem erros
- [ ] `npm run lint` sem warnings
- [ ] `npm run build` com sucesso
- [ ] Testar build com `npm run preview`
- [ ] Edge Functions deployadas
- [ ] Variáveis de ambiente configuradas
- [ ] Migrations aplicadas

## 🔗 Recursos Úteis

### Documentação Externa

- **React**: https://react.dev
- **TypeScript**: https://www.typescriptlang.org/docs
- **Tailwind CSS**: https://tailwindcss.com/docs
- **Supabase**: https://supabase.com/docs
- **Vite**: https://vitejs.dev
- **Google Gemini**: https://ai.google.dev/docs
- **Stripe**: https://stripe.com/docs

### Documentação Interna

- **[README.md](./README.md)** - Índice geral
- **[01-VISAO-GERAL.md](./01-VISAO-GERAL.md)** - Visão do sistema
- **[02-ARQUITETURA.md](./02-ARQUITETURA.md)** - Arquitetura
- **[04-BANCO-DE-DADOS.md](./04-BANCO-DE-DADOS.md)** - Database schema

## 💡 Dicas e Tricks

### Hot Reload Rápido

Vite tem hot reload muito rápido. Salve o arquivo e veja mudanças instantâneas.

### Console Shortcuts

```javascript
// Limpar console
clear()

// Ver objeto formatado
console.table(data)

// Medir performance
console.time('operacao')
// ... código ...
console.timeEnd('operacao')
```

### VS Code Extensions Recomendadas

- **ESLint** - Linting
- **Prettier** - Formatação
- **Tailwind CSS IntelliSense** - Autocomplete Tailwind
- **TypeScript** - Suporte TypeScript
- **GitLens** - Git super powers

### VS Code Settings

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

## 🆘 Problemas Comuns

### Erro: "Cannot find module"

```bash
# Reinstalar dependências
rm -rf node_modules package-lock.json
npm install
```

### Erro de TypeScript

```bash
# Rebuild types
npm run typecheck
```

### Edge Function não atualiza

```bash
# Redeploy forçado
npx supabase functions deploy nome-function --force
```

### WebSocket não conecta

Verificar:
1. URL do Supabase está correta
2. Anon key está correta
3. RLS policies permitem leitura

---

**Bem-vindo ao desenvolvimento do WisLegal!**
