# Instalação e Setup Local

Guia passo a passo para configurar o ambiente de desenvolvimento local.

## Pré-requisitos

Antes de começar, certifique-se de ter instalado:

### Obrigatórios

- **Node.js** 18.x ou superior
  - [Download Node.js](https://nodejs.org/)
  - Verificar instalação: `node --version`

- **npm** 9.x ou superior
  - Já vem com Node.js
  - Verificar instalação: `npm --version`

- **Git**
  - [Download Git](https://git-scm.com/)
  - Verificar instalação: `git --version`

### Recomendados

- **VS Code** ou editor de sua preferência
  - [Download VS Code](https://code.visualstudio.com/)

- **Extensões VS Code Recomendadas:**
  - ESLint
  - Prettier
  - TypeScript Vue Plugin (Volar)
  - Tailwind CSS IntelliSense

---

## Passo 1: Clone do Repositório

### Opção A: Clone Direto (Recomendado para Contribuidores)

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/seu-repositorio.git

# Entre no diretório
cd seu-repositorio
```

### Opção B: Fork + Clone (Recomendado para Desenvolvimento)

```bash
# 1. Faça fork do repositório no GitHub

# 2. Clone seu fork
git clone https://github.com/seu-usuario/seu-fork.git

# 3. Entre no diretório
cd seu-fork

# 4. Adicione o repositório original como upstream
git remote add upstream https://github.com/repo-original/repo-original.git

# 5. Verifique os remotes
git remote -v
# Deve mostrar:
# origin    https://github.com/seu-usuario/seu-fork.git (fetch)
# origin    https://github.com/seu-usuario/seu-fork.git (push)
# upstream  https://github.com/repo-original/repo-original.git (fetch)
# upstream  https://github.com/repo-original/repo-original.git (push)
```

---

## Passo 2: Instalação de Dependências

```bash
# Instale todas as dependências do projeto
npm install
```

### O que é instalado?

#### Dependências de Produção
- `react` + `react-dom` - Framework UI
- `react-router-dom` - Roteamento
- `@supabase/supabase-js` - Cliente Supabase
- `@google/generative-ai` - Google Gemini SDK
- `pdfjs-dist` - Processamento de PDF
- `pdf-lib` - Manipulação de PDF
- `lucide-react` - Ícones
- `recharts` - Gráficos
- `react-select` - Selects avançados

#### Dependências de Desenvolvimento
- `typescript` - TypeScript
- `vite` - Build tool
- `tailwindcss` - CSS framework
- `eslint` - Linter
- `@vitejs/plugin-react` - Plugin React para Vite

### Troubleshooting Instalação

#### Erro: `EACCES: permission denied`
```bash
# Solução: Use sudo (Linux/Mac) ou execute como administrador (Windows)
sudo npm install

# Ou configure npm para não usar sudo
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

#### Erro: `Error: Cannot find module`
```bash
# Limpe cache e reinstale
rm -rf node_modules
rm package-lock.json
npm cache clean --force
npm install
```

---

## Passo 3: Configuração de Variáveis de Ambiente

```bash
# Copie o arquivo de exemplo
cp .env.example .env
```

O arquivo `.env` deve conter as seguintes variáveis:

```env
# Supabase
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key

# Google Gemini
VITE_GEMINI_API_KEY=sua-gemini-api-key

# Stripe (opcional para desenvolvimento local)
VITE_STRIPE_PUBLIC_KEY=sua-stripe-public-key

# App Config
VITE_APP_NAME=ProcessIA
VITE_APP_URL=http://localhost:5173
```

Veja o próximo guia para detalhes de como obter essas credenciais:
[Configuração de Ambiente](./environment-setup.md)

---

## Passo 4: Verificação da Instalação

Execute o verificador de ambiente:

```bash
npm run check-env
```

Este script verifica se todas as variáveis de ambiente necessárias estão configuradas.

### Output Esperado:

```
✓ VITE_SUPABASE_URL está configurado
✓ VITE_SUPABASE_ANON_KEY está configurado
✓ VITE_GEMINI_API_KEY está configurado
✓ VITE_STRIPE_PUBLIC_KEY está configurado

✓ Todas as variáveis de ambiente estão configuradas!
```

---

## Passo 5: Executar o Projeto

### Modo Desenvolvimento

```bash
# Inicia o servidor de desenvolvimento
npm run dev
```

O projeto estará disponível em: `http://localhost:5173`

### Outros Comandos Úteis

```bash
# Build para produção
npm run build

# Preview do build
npm run preview

# Lint (verificar código)
npm run lint

# Type check (verificar tipos TypeScript)
npm run typecheck
```

---

## Estrutura de Diretórios

Após a instalação, você terá a seguinte estrutura:

```
projeto/
├── .env                    # Variáveis de ambiente (não commitado)
├── .env.example           # Exemplo de variáveis
├── .gitignore             # Arquivos ignorados pelo git
├── package.json           # Dependências e scripts
├── package-lock.json      # Lock de versões
├── tsconfig.json          # Configuração TypeScript
├── vite.config.ts         # Configuração Vite
├── tailwind.config.js     # Configuração Tailwind
├── index.html             # HTML principal
│
├── public/                # Arquivos estáticos
│   ├── _redirects         # Redirects (Netlify)
│   ├── robots.txt
│   └── sitemap.xml
│
├── src/                   # Código fonte
│   ├── main.tsx           # Entry point
│   ├── App.tsx            # Componente principal
│   ├── index.css          # Estilos globais
│   │
│   ├── components/        # Componentes React
│   ├── contexts/          # Contextos React
│   ├── hooks/             # Custom hooks
│   ├── pages/             # Páginas/rotas
│   ├── services/          # Serviços/APIs
│   ├── types/             # TypeScript types
│   ├── utils/             # Utilitários
│   └── lib/               # Bibliotecas (supabase, gemini)
│
├── supabase/              # Configurações Supabase
│   ├── functions/         # Edge Functions
│   └── migrations/        # Database migrations
│
├── docs/                  # Documentação
│
└── scripts/               # Scripts utilitários
```

---

## Configuração do Editor (VS Code)

### 1. Instale as Extensões Recomendadas

Ao abrir o projeto no VS Code, aceite instalar as extensões recomendadas.

### 2. Configurações Workspace

Crie `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "tailwindCSS.experimental.classRegex": [
    ["classNames\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"]
  ]
}
```

### 3. Snippets Úteis

Crie `.vscode/snippets.json` para snippets customizados de React/TypeScript.

---

## Configuração do Git

### 1. Configure seu usuário

```bash
git config user.name "Seu Nome"
git config user.email "seu@email.com"
```

### 2. Configure hooks (opcional)

```bash
# Pre-commit hook para lint
npx husky install
npx husky add .husky/pre-commit "npm run lint"
```

---

## Database Setup (Supabase)

### Opção A: Usar Supabase Cloud (Recomendado)

1. Acesse [https://app.supabase.com](https://app.supabase.com)
2. Crie um novo projeto
3. Copie as credenciais para `.env`
4. Execute as migrations via Dashboard

Veja detalhes em: [Configuração de Ambiente](./environment-setup.md)

### Opção B: Supabase Local (Avançado)

```bash
# Instale Supabase CLI
npm install -g supabase

# Inicie Supabase local
supabase init
supabase start

# As credenciais locais serão exibidas
```

---

## Verificação Final

Execute todos os checks para garantir que está tudo funcionando:

```bash
# 1. Verificar variáveis de ambiente
npm run check-env

# 2. Verificar TypeScript
npm run typecheck

# 3. Verificar Lint
npm run lint

# 4. Build de teste
npm run build

# 5. Executar dev server
npm run dev
```

Se todos os comandos executarem sem erros, sua instalação está completa!

---

## Próximos Passos

1. [Configure as variáveis de ambiente](./environment-setup.md)
2. [Siga o Quick Start](./quick-start.md)
3. [Entenda a arquitetura](../02-architecture/overview.md)

---

## Problemas Comuns

### Port 5173 já está em uso

```bash
# Mate o processo usando a porta
lsof -ti:5173 | xargs kill -9

# Ou use outra porta
npm run dev -- --port 3000
```

### Erro: Cannot find module 'vite'

```bash
# Reinstale dependências
rm -rf node_modules
npm install
```

### TypeScript errors no editor

```bash
# Reinicie o TypeScript server no VS Code
# Command Palette (Ctrl+Shift+P) → "TypeScript: Restart TS Server"
```

### Supabase connection error

Verifique se as URLs e keys no `.env` estão corretas e sem espaços extras.

---

## Suporte

Se encontrar problemas:

1. Verifique a [seção de Troubleshooting](../10-troubleshooting/common-issues.md)
2. Procure em [issues existentes](https://github.com/repo/issues)
3. Abra uma [nova issue](https://github.com/repo/issues/new)

---

[← Voltar ao Getting Started](./README.md) | [Próximo: Configuração de Ambiente →](./environment-setup.md)
