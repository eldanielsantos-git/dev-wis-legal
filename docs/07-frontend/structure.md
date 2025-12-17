# Estrutura do Frontend

Organização de arquivos e pastas do frontend React.

## Estrutura de Diretórios

```
src/
├── main.tsx                 # Entry point
├── App.tsx                  # Root component + Router
├── index.css                # Global styles (Tailwind)
│
├── components/              # Componentes reutilizáveis
│   ├── AchievementBadge.tsx
│   ├── AnalysisCard.tsx
│   ├── ChatInterface.tsx
│   ├── FileUpload.tsx
│   ├── LoadingSpinner.tsx
│   ├── analysis-views/     # Componentes de análise
│   │   ├── VisaoGeralProcessoView.tsx
│   │   ├── ResumoEstrategicoView.tsx
│   │   └── ... (8 outros)
│   ├── subscription/       # Componentes de assinatura
│   │   ├── SubscriptionPlans.tsx
│   │   ├── SubscriptionStatus.tsx
│   │   └── AddTokensSection.tsx
│   └── tags/               # Sistema de tags
│       ├── ProcessoTag.tsx
│       └── TagFilterPanel.tsx
│
├── pages/                   # Páginas/rotas
│   ├── HomePage.tsx
│   ├── SignInPage.tsx
│   ├── SignUpPage.tsx
│   ├── DashboardPage.tsx
│   ├── MyProcessesPage.tsx
│   ├── ProcessoDetailPage.tsx
│   ├── ChatPage.tsx
│   ├── TokensPage.tsx
│   ├── SubscriptionPage.tsx
│   ├── ProfilePage.tsx
│   └── Admin.../           # Admin pages
│       ├── AdminUsersPage.tsx
│       ├── AdminTokenManagementPage.tsx
│       └── ...
│
├── contexts/                # React Contexts
│   ├── AuthContext.tsx
│   ├── ThemeContext.tsx
│   ├── TokenBalanceContext.tsx
│   └── NotificationContext.tsx
│
├── hooks/                   # Custom hooks
│   ├── useAuth.ts
│   ├── useAnalysisProgress.ts
│   ├── useSubscriptionStatus.ts
│   ├── useTokenPackages.ts
│   ├── useToast.ts
│   └── useTypingEffect.ts
│
├── services/                # API Services
│   ├── ProcessosService.ts
│   ├── AnalysisService.ts
│   ├── TokenService.ts
│   ├── NotificationsService.ts
│   └── ...
│
├── utils/                   # Utilitários
│   ├── logger.ts
│   ├── contentParser.ts
│   ├── jsonValidator.ts
│   └── ...
│
├── types/                   # TypeScript types
│   ├── analysis.ts
│   └── billing.ts
│
└── lib/                     # Configuração de libs
    ├── supabase.ts
    └── gemini.ts
```

## Principais Componentes

### Layout

- **App.tsx** - Root component, router setup
- **Dashboard.tsx** - Layout principal com sidebar
- **Sidebar.tsx** - Menu lateral
- **Footer.tsx** - Rodapé

### Análise

- **FileUpload.tsx** - Upload de PDF
- **AnalysisCard.tsx** - Card de resultado
- **AnalysisProgress.tsx** - Barra de progresso
- **ProcessoDetailPage.tsx** - Detalhes do processo
- **Analysis Views** (10) - Cada tipo de análise

### Chat

- **ChatInterface.tsx** - Interface principal
- **ChatMessageUser.tsx** - Mensagem do usuário
- **ChatMessageAssistant.tsx** - Mensagem do assistente

### Subscription

- **SubscriptionPlans.tsx** - Lista de planos
- **SubscriptionStatus.tsx** - Status atual
- **AddTokensSection.tsx** - Compra de tokens

## Principais Hooks

### useAuth
```typescript
const { user, loading, signIn, signOut } = useAuth();
```

### useAnalysisProgress
```typescript
const { progress, status } = useAnalysisProgress(processoId);
```

### useSubscriptionStatus
```typescript
const { subscription, loading } = useSubscriptionStatus();
```

### useToast
```typescript
const { toast } = useToast();
toast.success('Análise concluída!');
toast.error('Erro ao processar');
```

## Serviços

### ProcessosService
```typescript
ProcessosService.getAll()
ProcessosService.getById(id)
ProcessosService.create(data)
ProcessosService.delete(id)
```

### AnalysisService
```typescript
AnalysisService.startAnalysis(processoId)
AnalysisService.getResults(processoId)
```

### TokenService
```typescript
TokenService.getBalance()
TokenService.getTransactions()
TokenService.purchaseTokens(packageId)
```

## Roteamento

```typescript
// App.tsx
<Routes>
  <Route path="/" element={<HomePage />} />
  <Route path="/signin" element={<SignInPage />} />
  <Route path="/signup" element={<SignUpPage />} />

  {/* Protected routes */}
  <Route element={<ProtectedRoute />}>
    <Route path="/dashboard" element={<DashboardPage />} />
    <Route path="/processos" element={<MyProcessesPage />} />
    <Route path="/processos/:id" element={<ProcessoDetailPage />} />
    <Route path="/chat/:id" element={<ChatPage />} />
    <Route path="/tokens" element={<TokensPage />} />
    <Route path="/subscription" element={<SubscriptionPage />} />
  </Route>

  {/* Admin routes */}
  <Route element={<AdminRoute />}>
    <Route path="/admin/users" element={<AdminUsersPage />} />
    <Route path="/admin/tokens" element={<AdminTokenManagementPage />} />
  </Route>
</Routes>
```

---

[← Voltar ao Frontend](./README.md)
