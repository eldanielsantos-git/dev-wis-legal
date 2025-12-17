# Frontend

Documentação do frontend React + TypeScript.

## 📋 Documentos Nesta Seção

### [Estrutura do Frontend](./structure.md)
Organização de pastas e arquivos do frontend.

**Tópicos:**
- Estrutura de diretórios
- Organização de componentes
- Organização de páginas
- Organização de serviços
- Organização de utils

---

### [Componentes Principais](./components.md)
Documentação dos principais componentes React.

**Tópicos:**
- Componentes de UI
- Componentes de análise
- Componentes de chat
- Componentes de subscription
- Componentes compartilhados

---

### [Hooks e Utilities](./hooks.md)
Custom hooks e funções utilitárias.

**Tópicos:**
- useAuth
- useAnalysisProgress
- useSubscriptionStatus
- useToast
- Outros hooks

---

### [Gerenciamento de Estado](./state-management.md)
Como o estado é gerenciado no frontend.

**Tópicos:**
- Context API
- AuthContext
- ThemeContext
- TokenBalanceContext
- NotificationContext

---

### [Roteamento](./routing.md)
Sistema de rotas e navegação.

**Tópicos:**
- React Router setup
- Rotas públicas
- Rotas protegidas
- Rotas admin
- Redirects

---

## 🎨 Estrutura de Arquivos

```
src/
├── components/       # Componentes reutilizáveis
│   ├── analysis-views/
│   ├── subscription/
│   ├── tags/
│   └── ...
├── pages/           # Páginas/rotas
│   ├── HomePage.tsx
│   ├── DashboardPage.tsx
│   └── ...
├── contexts/        # React contexts
│   ├── AuthContext.tsx
│   └── ...
├── hooks/           # Custom hooks
│   ├── useAuth.ts
│   └── ...
├── services/        # Serviços de API
│   ├── ProcessosService.ts
│   └── ...
├── utils/           # Funções utilitárias
│   ├── logger.ts
│   └── ...
└── types/           # TypeScript types
    └── ...
```

---

## 🧩 Principais Componentes

### Layout
- `Dashboard` - Layout principal
- `Sidebar` - Menu lateral
- `UserAvatarMenu` - Menu do usuário

### Análise
- `AnalysisCard` - Card de análise
- `AnalysisProgress` - Progresso da análise
- `ProcessoDetailPage` - Detalhes do processo
- Analysis Views (10 tipos)

### Chat
- `ChatInterface` - Interface de chat
- `ChatMessageUser` - Mensagem do usuário
- `ChatMessageAssistant` - Mensagem do assistente

### Subscription
- `SubscriptionStatus` - Status da assinatura
- `SubscriptionPlans` - Planos disponíveis
- `AddTokensSection` - Compra de tokens

---

## 🪝 Principais Hooks

### Autenticação
- `useAuth()` - Acesso ao contexto de autenticação

### Análise
- `useAnalysisProgress()` - Monitora progresso de análise
- `useProcessProgressPolling()` - Polling de status

### Subscription
- `useSubscriptionStatus()` - Status da assinatura
- `useSubscriptionPlans()` - Lista de planos
- `useTokenPackages()` - Pacotes de tokens

### UI
- `useToast()` - Notificações toast
- `useTypingEffect()` - Efeito de digitação
- `useResponsiveSidebar()` - Sidebar responsivo

---

## 🎯 Padrões e Convenções

### Naming
- Componentes: PascalCase (ex: `MyComponent.tsx`)
- Hooks: camelCase com prefixo `use` (ex: `useMyHook.ts`)
- Services: PascalCase com sufixo `Service` (ex: `MyService.ts`)
- Utils: camelCase (ex: `myUtil.ts`)

### Estrutura de Componente
```tsx
// Imports
import React from 'react';

// Types
interface Props {
  // ...
}

// Component
export function MyComponent({ prop }: Props) {
  // Hooks
  // State
  // Effects
  // Handlers

  // Render
  return (
    // JSX
  );
}
```

---

## 🔗 Links Relacionados

- [Arquitetura](../02-architecture/README.md)
- [API Reference](../06-api-reference/README.md)
- [Autenticação](../04-authentication/README.md)

---

[← Voltar ao Índice Principal](../README.md)
