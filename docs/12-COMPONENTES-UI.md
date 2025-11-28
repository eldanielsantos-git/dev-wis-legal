# 12 - Componentes UI

## 📋 Visão Geral

O WisLegal possui **40+ componentes React** organizados de forma modular e reutilizável. Todos os componentes são escritos em TypeScript com tipagem estrita.

## 📂 Organização dos Componentes

```
src/components/
├── Layout Components
│   ├── Sidebar.tsx
│   ├── SidebarWis.tsx
│   ├── Footer.tsx
│   └── FooterWis.tsx
│
├── Process Components
│   ├── ProcessoCard.tsx
│   ├── ProcessoListItem.tsx
│   ├── ProcessStatusBadge.tsx
│   ├── ProcessStatusIndicator.tsx
│   ├── ProcessStatusProgress.tsx
│   └── ProcessingProgress.tsx
│
├── Analysis Components
│   ├── AnalysisCard.tsx
│   ├── AnalysisContentRenderer.tsx
│   └── AnalysisProgress.tsx
│
├── Chat Components
│   ├── ChatInterface.tsx
│   ├── ChatMessageUser.tsx
│   ├── ChatMessageAssistant.tsx
│   ├── ChatProcessList.tsx
│   └── AudioRecordingAnimation.tsx
│
├── Subscription Components
│   ├── subscription/
│   │   ├── SubscriptionPlans.tsx
│   │   ├── SubscriptionStatus.tsx
│   │   ├── TokenBreakdownCard.tsx
│   │   ├── AddTokensSection.tsx
│   │   └── SuccessPage.tsx
│
├── Notification Components
│   ├── NotificationBadge.tsx
│   ├── ToastNotification.tsx
│   └── ToastContainer.tsx
│
├── User Components
│   ├── UserAvatar.tsx
│   └── UserAvatarMenu.tsx
│
├── Upload Components
│   └── FileUpload.tsx
│
├── UI Components
│   ├── LoadingSpinner.tsx
│   ├── ErrorModal.tsx
│   ├── ConfirmDeleteModal.tsx
│   ├── CancelSubscriptionModal.tsx
│   ├── UpgradeModal.tsx
│   ├── StatusCard.tsx
│   ├── TokenUsageCard.tsx
│   ├── TokenAvailabilityInfo.tsx
│   └── Dashboard.tsx
│
└── Search Components
    └── IntelligentSearch.tsx
```

## 🎯 Componentes Principais

### 1. FileUpload

**Propósito:** Componente de upload de PDF com validação e preview.

**Features:**
- Drag & drop
- Validação de formato (apenas PDF)
- Validação de tamanho
- Contagem de páginas automática
- Preview do nome do arquivo
- Estados de loading

**Props:**
```typescript
interface FileUploadProps {
  onFileSelect: (file: File, pageCount: number) => void;
  isUploading: boolean;
  disabled?: boolean;
}
```

**Uso:**
```tsx
<FileUpload
  onFileSelect={handleFileSelect}
  isUploading={uploading}
  disabled={!hasTokens}
/>
```

### 2. ProcessoCard

**Propósito:** Card visual de processo na listagem.

**Features:**
- Thumbnail do PDF
- Nome do processo editável
- Status badge animado
- Progress bar (se em análise)
- Ações (visualizar, deletar)
- Timestamp formatado

**Props:**
```typescript
interface ProcessoCardProps {
  processo: Processo;
  onClick: () => void;
  onDelete: (id: string) => void;
  onRename?: (id: string, newName: string) => void;
}
```

**Layout:**
```tsx
<div className="card">
  <StatusBadge status={processo.status} />
  <h3>{processo.file_name}</h3>
  <ProgressBar current={3} total={9} />
  <div className="actions">
    <button>Visualizar</button>
    <button>Deletar</button>
  </div>
</div>
```

### 3. AnalysisCard

**Propósito:** Exibe resultado de uma análise específica.

**Features:**
- Título da análise
- Conteúdo renderizado (JSON → UI)
- Estado de loading/typing effect
- Exportação para DOCX
- Colapsar/expandir

**Props:**
```typescript
interface AnalysisCardProps {
  title: string;
  content: any;
  isLoading: boolean;
  onExport?: () => void;
}
```

**Renderização Dinâmica:**
```tsx
{content && typeof content === 'object' && (
  <div>
    {Object.entries(content).map(([key, value]) => (
      <div key={key}>
        <strong>{formatKey(key)}:</strong>
        <ContentRenderer value={value} />
      </div>
    ))}
  </div>
)}
```

### 4. ChatInterface

**Propósito:** Interface completa de chat com IA.

**Features:**
- Lista de mensagens scrollável
- Input de texto com Enter to send
- Gravação de áudio com animação
- Indicador de typing (assistant)
- Auto-scroll para última mensagem
- Feedback buttons (👍👎)

**Props:**
```typescript
interface ChatInterfaceProps {
  processoId: string;
  messages: ChatMessage[];
  onSendMessage: (content: string) => void;
  onSendAudio: (audioBlob: Blob) => void;
  isLoading: boolean;
}
```

**Estrutura:**
```tsx
<div className="chat-container">
  <div className="messages">
    {messages.map(msg => (
      msg.role === 'user'
        ? <ChatMessageUser {...msg} />
        : <ChatMessageAssistant {...msg} />
    ))}
  </div>
  <div className="input-area">
    <textarea />
    <button>Enviar</button>
    <AudioRecorder />
  </div>
</div>
```

### 5. SubscriptionPlans

**Propósito:** Exibe planos de assinatura com preços.

**Features:**
- Cards responsivos
- Destaque do plano recomendado
- Lista de features por plano
- Botões de checkout
- Comparação visual

**Planos:**
```typescript
const plans = [
  {
    id: 'basic',
    name: 'Básico',
    price: 'R$ 99',
    tokens: 10000,
    features: [
      '10.000 tokens/mês',
      'Até 50 processos',
      'Análise padrão',
      'Chat básico'
    ]
  },
  {
    id: 'professional',
    name: 'Profissional',
    price: 'R$ 299',
    tokens: 50000,
    features: [
      '50.000 tokens/mês',
      'Processos ilimitados',
      'Análise avançada',
      'Chat ilimitado',
      'Suporte prioritário'
    ],
    recommended: true
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Sob consulta',
    tokens: Infinity,
    features: [
      'Tokens customizados',
      'Tudo do Professional',
      'API access',
      'Integração personalizada',
      'Account manager'
    ]
  }
];
```

### 6. ProcessingProgress

**Propósito:** Mostra progresso de análise em tempo real.

**Features:**
- Progress bar animada
- Lista de prompts com status
- Tempo estimado restante
- Animação de loading
- WebSocket updates

**Estado:**
```typescript
interface ProgressState {
  currentPrompt: number;
  totalPrompts: number;
  status: string;
  prompts: {
    title: string;
    status: 'pending' | 'running' | 'completed';
  }[];
}
```

**Visualização:**
```tsx
<div className="progress-container">
  <ProgressBar value={current/total * 100} />
  <p>{current} de {total} análises concluídas</p>

  <ul className="prompts-list">
    {prompts.map(prompt => (
      <li className={prompt.status}>
        {prompt.status === 'completed' && '✓'}
        {prompt.status === 'running' && '⏳'}
        {prompt.title}
      </li>
    ))}
  </ul>
</div>
```

### 7. UserAvatarMenu

**Propósito:** Menu dropdown do usuário.

**Features:**
- Avatar com foto ou iniciais
- Nome do usuário
- Email
- Links para perfil, configurações, assinatura
- Botão de logout
- Badge de admin (se aplicável)

**Menu Items:**
```tsx
[
  { label: 'Meu Perfil', icon: User, href: '/profile' },
  { label: 'Assinatura', icon: CreditCard, href: '/signature' },
  { label: 'Tokens', icon: Coins, href: '/tokens' },
  { label: 'Notificações', icon: Bell, href: '/notifications' },
  { divider: true },
  { label: 'Admin', icon: Settings, href: '/admin-settings', adminOnly: true },
  { divider: true },
  { label: 'Sair', icon: LogOut, action: 'logout' }
]
```

### 8. TokenUsageCard

**Propósito:** Exibe uso de tokens visualmente.

**Features:**
- Gráfico de uso (circular ou barra)
- Tokens usados / total
- Percentual de uso
- Cores baseadas em thresholds (verde, amarelo, vermelho)
- Link para comprar mais tokens

**Cálculo de Cor:**
```typescript
const getColor = (percentage: number) => {
  if (percentage >= 90) return 'red';
  if (percentage >= 75) return 'yellow';
  return 'green';
};
```

### 9. NotificationBadge

**Propósito:** Badge de contador de notificações não lidas.

**Features:**
- Contador numérico
- Animação de entrada
- Limite visual (99+)
- Cor de destaque

**Lógica:**
```tsx
const displayCount = unreadCount > 99 ? '99+' : unreadCount;

return (
  <div className="relative">
    <Bell />
    {unreadCount > 0 && (
      <span className="badge">{displayCount}</span>
    )}
  </div>
);
```

### 10. ErrorModal

**Propósito:** Modal de exibição de erros.

**Features:**
- Título do erro
- Mensagem detalhada
- Stack trace (dev mode)
- Ação de retry ou close
- Overlay escuro

**Uso:**
```tsx
<ErrorModal
  isOpen={!!error}
  onClose={() => setError(null)}
  title="Erro ao processar"
  message={error?.message}
  onRetry={handleRetry}
/>
```

## 🎨 Padrões de Design

### Composição de Componentes
```tsx
// ✅ BOM: Componentes pequenos e compostos
<ProcessoCard>
  <ProcessoCard.Header />
  <ProcessoCard.Body />
  <ProcessoCard.Actions />
</ProcessoCard>

// ❌ RUIM: Componente monolítico
<ProcessoCard withHeader withBody withActions />
```

### Props Naming
```tsx
// ✅ BOM: Props claras e consistentes
interface Props {
  onClose: () => void;
  onChange: (value: string) => void;
  isLoading: boolean;
  hasError: boolean;
}

// ❌ RUIM: Props inconsistentes
interface Props {
  close: Function;
  changed: any;
  loading: any;
  error: any;
}
```

### Conditional Rendering
```tsx
// ✅ BOM: Lógica clara
{isLoading && <Spinner />}
{error && <ErrorMessage error={error} />}
{data && <DataDisplay data={data} />}

// ❌ RUIM: Ternários aninhados
{isLoading ? <Spinner /> : error ? <Error /> : data ? <Data /> : null}
```

## 🔄 Componentes com Estado

### Uso de Hooks
```tsx
function ProcessoDetail({ processoId }: Props) {
  // Estados locais
  const [processo, setProcesso] = useState<Processo | null>(null);
  const [loading, setLoading] = useState(true);

  // Contextos
  const { user } = useAuth();
  const { showToast } = useToast();

  // Custom hooks
  const progress = useAnalysisProgress(processoId);

  // Effects
  useEffect(() => {
    loadProcesso();
  }, [processoId]);

  return <div>...</div>;
}
```

## 📱 Responsividade

### Breakpoints Tailwind
```tsx
// Mobile-first approach
<div className="
  p-4             // mobile
  md:p-6          // tablet
  lg:p-8          // desktop
  xl:p-12         // large
">
  <h1 className="
    text-xl        // mobile
    md:text-2xl    // tablet
    lg:text-3xl    // desktop
  ">
    Título
  </h1>
</div>
```

### Grid Responsivo
```tsx
<div className="
  grid
  grid-cols-1        // mobile: 1 coluna
  md:grid-cols-2     // tablet: 2 colunas
  lg:grid-cols-3     // desktop: 3 colunas
  xl:grid-cols-4     // large: 4 colunas
  gap-4
">
  {items.map(item => <Card key={item.id} {...item} />)}
</div>
```

## ♿ Acessibilidade

### Semantic HTML
```tsx
// ✅ BOM: Semântica correta
<button onClick={handleClick}>Clique aqui</button>
<nav><ul><li><a href="/">Home</a></li></ul></nav>

// ❌ RUIM: Divs para tudo
<div onClick={handleClick}>Clique aqui</div>
<div><div><div>Home</div></div></div>
```

### ARIA Labels
```tsx
<button
  aria-label="Fechar modal"
  aria-pressed={isOpen}
  onClick={onClose}
>
  <X />
</button>
```

### Keyboard Navigation
```tsx
<input
  onKeyDown={(e) => {
    if (e.key === 'Enter') handleSubmit();
    if (e.key === 'Escape') handleCancel();
  }}
/>
```

## 🔗 Próximos Documentos

- **[13-PAGINAS-ROTAS.md](./13-PAGINAS-ROTAS.md)** - Páginas e rotas
- **[21-DESIGN-SYSTEM.md](./21-DESIGN-SYSTEM.md)** - Design system

---

**40+ componentes modulares e reutilizáveis**
