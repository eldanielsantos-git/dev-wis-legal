# Visão Geral da Arquitetura

Arquitetura completa do sistema de análise de processos jurídicos.

## Arquitetura de Alto Nível

```
┌──────────────────────────────────────────────────────────────┐
│                      CLIENT LAYER                             │
│  ┌────────────────────────────────────────────────────────┐  │
│  │         React SPA (Single Page Application)            │  │
│  │  - React 18 + TypeScript                               │  │
│  │  - Vite (build tool)                                   │  │
│  │  - TailwindCSS (styling)                               │  │
│  │  - React Router (routing)                              │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────┬───────────────────────────────────────────┘
                   │ HTTPS / REST API
                   │
┌──────────────────▼───────────────────────────────────────────┐
│                   APPLICATION LAYER                           │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              Supabase Platform                         │  │
│  │                                                        │  │
│  │  ┌──────────────────────────────────────────────────┐ │  │
│  │  │         PostgreSQL Database                      │ │  │
│  │  │  - User data                                     │ │  │
│  │  │  - Processes & chunks                            │ │  │
│  │  │  - Analysis results                              │ │  │
│  │  │  - Chat history                                  │ │  │
│  │  │  - Tokens & subscriptions                        │ │  │
│  │  │  - Row Level Security (RLS)                      │ │  │
│  │  └──────────────────────────────────────────────────┘ │  │
│  │                                                        │  │
│  │  ┌──────────────────────────────────────────────────┐ │  │
│  │  │         Edge Functions (Deno Runtime)            │ │  │
│  │  │  - Analysis workers                              │ │  │
│  │  │  - Consolidation worker                          │ │  │
│  │  │  - Chat handler                                  │ │  │
│  │  │  - Webhook handlers                              │ │  │
│  │  │  - Email functions                               │ │  │
│  │  └──────────────────────────────────────────────────┘ │  │
│  │                                                        │  │
│  │  ┌──────────────────────────────────────────────────┐ │  │
│  │  │         Authentication (Supabase Auth)           │ │  │
│  │  │  - Email/Password                                │ │  │
│  │  │  - JWT tokens                                    │ │  │
│  │  │  - Session management                            │ │  │
│  │  └──────────────────────────────────────────────────┘ │  │
│  │                                                        │  │
│  │  ┌──────────────────────────────────────────────────┐ │  │
│  │  │         Storage (Supabase Storage)               │ │  │
│  │  │  - PDF files                                     │ │  │
│  │  │  - User avatars                                  │ │  │
│  │  └──────────────────────────────────────────────────┘ │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────┬───────────────┬───────────────┬───────────────────┘
           │               │               │
           │               │               │
┌──────────▼──────┐ ┌─────▼──────┐ ┌──────▼────────┐
│  Google Gemini  │ │   Stripe   │ │    Resend     │
│  Pro 1.5        │ │  Payments  │ │    Emails     │
│  - Analysis     │ │  - Subs    │ │  - Transac    │
│  - Chat         │ │  - Tokens  │ │  - Notif      │
│  - File API     │ │            │ │               │
└─────────────────┘ └────────────┘ └───────────────┘
```

---

## Camadas da Aplicação

### 1. Client Layer (Frontend)

**Tecnologias:**
- React 18 com TypeScript
- Vite para build
- TailwindCSS para styling
- React Router para rotas

**Responsabilidades:**
- Interface do usuário
- Validações client-side
- State management (Context API)
- Interação com APIs
- Feedback visual

**Principais Componentes:**
- Pages (rotas)
- Components (UI reutilizáveis)
- Contexts (estado global)
- Services (chamadas API)
- Utils (utilitários)

### 2. Application Layer (Backend)

**Supabase Platform:**

#### 2.1. PostgreSQL Database
- Armazenamento de todos os dados
- Triggers e functions para lógica de negócio
- RLS para segurança
- Indexes para performance

#### 2.2. Edge Functions
- Serverless functions em Deno
- Processamento assíncrono
- Integração com serviços externos
- Workers para análise

#### 2.3. Authentication
- Gerenciamento de usuários
- JWT tokens
- Refresh tokens
- Email verification

#### 2.4. Storage
- Upload de PDFs
- Armazenamento seguro
- Políticas de acesso

### 3. Integration Layer (Serviços Externos)

#### 3.1. Google Gemini
- Análise de processos
- Chat inteligente
- File API para uploads grandes
- Context caching

#### 3.2. Stripe
- Processamento de pagamentos
- Assinaturas recorrentes
- Venda de tokens avulsos
- Webhooks para eventos

#### 3.3. Resend
- Envio de emails transacionais
- Notificações
- Email templates

---

## Principais Componentes

### Frontend Components

```
src/
├── App.tsx                    # Root component
├── main.tsx                   # Entry point
│
├── pages/                     # Page components (routes)
│   ├── HomePage.tsx
│   ├── SignInPage.tsx
│   ├── DashboardPage.tsx
│   ├── ProcessoDetailPage.tsx
│   ├── ChatPage.tsx
│   ├── AdminUsersPage.tsx
│   └── ...
│
├── components/                # Reusable components
│   ├── FileUpload.tsx
│   ├── AnalysisCard.tsx
│   ├── ChatInterface.tsx
│   ├── ProcessoListItem.tsx
│   └── ...
│
├── contexts/                  # React contexts
│   ├── AuthContext.tsx
│   ├── ThemeContext.tsx
│   └── TokenBalanceContext.tsx
│
├── services/                  # API services
│   ├── ProcessosService.ts
│   ├── AnalysisService.ts
│   ├── TokenService.ts
│   └── ...
│
└── lib/                       # Libraries config
    ├── supabase.ts
    └── gemini.ts
```

### Backend Components (Edge Functions)

```
supabase/functions/
├── start-analysis/            # Inicia análise
├── upload-to-gemini/          # Upload para Gemini
├── process-next-prompt/       # Worker principal
├── consolidation-worker/      # Consolida resultados
├── chat-with-processo/        # Chat handler
├── stripe-webhook/            # Stripe events
├── stripe-checkout/           # Cria checkout
└── send-*.../                 # Email functions
```

### Database Tables

**Core:**
- `processos` - Processos judiciais
- `chunks` - Pedaços de texto
- `analysis_results` - Resultados de análise
- `chat_messages` - Mensagens do chat

**Auth:**
- `auth.users` - Usuários (Supabase)
- `user_preferences` - Preferências
- `user_achievements` - Conquistas

**Tokens:**
- `token_balance` - Saldo de tokens
- `token_transactions` - Transações
- `token_reservations` - Reservas
- `subscriptions` - Assinaturas Stripe

**Admin:**
- `analysis_prompts` - Prompts de análise
- `chat_system_prompts` - Prompts do chat
- `system_models` - Configuração de modelos

---

## Fluxos Principais

### 1. Autenticação

```
User Input (email/password)
    ↓
Frontend (AuthContext)
    ↓
Supabase Auth
    ↓
JWT Token
    ↓
Session Storage
    ↓
Authenticated State
```

### 2. Upload de Processo

```
User selects PDF
    ↓
Frontend validation
    ↓
Upload to Supabase Storage
    ↓
Create processo record
    ↓
Call start-analysis function
    ↓
Extract text (pdf.js)
    ↓
Create chunks
    ↓
Upload to Gemini File API
    ↓
Queue processing
```

### 3. Análise

```
Process in queue
    ↓
process-next-prompt worker
    ↓
Get next pending chunk/prompt
    ↓
Call Gemini API
    ↓
Save analysis result
    ↓
Update progress
    ↓
Repeat until all done
    ↓
Trigger consolidation
    ↓
Final result
```

### 4. Chat

```
User sends message
    ↓
Reserve tokens
    ↓
Call chat-with-processo
    ↓
Build context (process + history)
    ↓
Call Gemini API
    ↓
Stream response
    ↓
Save message
    ↓
Deduct tokens
```

---

## Decisões Arquiteturais Principais

### 1. Por que Supabase?

**Vantagens:**
- Backend-as-a-Service completo
- PostgreSQL gerenciado
- RLS nativo
- Edge Functions serverless
- Storage integrado
- Authentication integrado

**vs Alternativas:**
- Firebase: Menos controle, NoSQL
- Custom backend: Mais complexo de manter
- AWS: Mais configuração necessária

### 2. Por que Google Gemini?

**Vantagens:**
- Contexto longo (2M tokens)
- File API para PDFs grandes
- Context caching (economia)
- Bom custo/benefício
- Boa qualidade em português

**vs Alternativas:**
- OpenAI GPT-4: Contexto menor, mais caro
- Claude: Contexto menor
- Local LLM: Infraestrutura complexa

### 3. Sistema de Chunks

**Por que chunks?**
- PDFs grandes excedem limite de contexto
- Processamento paralelo
- Melhor controle de retry
- Granularidade de progresso

**Estratégia:**
- Dividir texto em pedaços de ~50k tokens
- Processar em paralelo
- Consolidar resultados

### 4. Processamento Assíncrono

**Por que workers?**
- Análise pode levar minutos/horas
- Não bloquear UI
- Retry automático
- Escalabilidade

**Implementação:**
- Edge Functions como workers
- Queue baseada em database
- Status tracking
- Recovery automático

---

## Padrões de Comunicação

### Frontend → Backend

**REST API via Supabase Client:**
```typescript
// CRUD Operations
const { data, error } = await supabase
  .from('processos')
  .select('*')
  .eq('user_id', userId);
```

**Edge Functions:**
```typescript
const { data, error } = await supabase.functions.invoke(
  'start-analysis',
  { body: { processoId } }
);
```

### Backend → External Services

**Google Gemini:**
```typescript
const response = await model.generateContent({
  contents: [{ role: 'user', parts: [{ text: prompt }] }]
});
```

**Stripe:**
```typescript
const session = await stripe.checkout.sessions.create({
  line_items: [{ price: priceId, quantity: 1 }]
});
```

---

## Segurança

### 1. Authentication
- JWT tokens via Supabase Auth
- Refresh tokens para long-lived sessions
- Email verification

### 2. Authorization
- Row Level Security (RLS) em todas as tabelas
- Políticas por operação (SELECT/INSERT/UPDATE/DELETE)
- Verificação de propriedade

### 3. API Security
- Rate limiting
- Input validation
- SQL injection prevention (via ORM)
- XSS prevention (React escaping)

### 4. Secrets Management
- Environment variables
- Supabase secrets para Edge Functions
- Nunca expor service role key

---

## Performance

### 1. Frontend
- Code splitting
- Lazy loading de componentes
- Memoization de componentes pesados
- Debounce em buscas

### 2. Backend
- Indexes no banco de dados
- Connection pooling
- Cached queries
- Context caching (Gemini)

### 3. Assets
- Image optimization
- PDF streaming (não carregar tudo na memória)
- Minification e bundling

---

## Escalabilidade

### Horizontal Scaling

**Frontend:**
- CDN para static assets
- Multiple replicas

**Backend:**
- Edge Functions auto-scale
- Supabase gerencia database scaling

### Vertical Scaling

**Database:**
- Supabase permite upgrade de plano
- Mais CPU/RAM conforme necessário

**Edge Functions:**
- Timeout configurável
- Memory configurável

---

## Monitoramento e Observabilidade

### Logs
- Frontend: Console errors
- Backend: Supabase logs
- Edge Functions: Structured logging

### Métricas
- Performance metrics
- Business metrics (processos, análises, tokens)
- Error rates

### Alertas
- Health checks automáticos
- Email notifications
- Processos travados
- Chunks falhados

---

## Links Relacionados

- [Fluxo de Dados](./data-flow.md)
- [Decisões Arquiteturais](./decisions.md)
- [Padrões e Convenções](./patterns.md)
- [Database Schema](../03-database/schema.md)
- [Sistema de Análise](../05-analysis/overview.md)

---

[← Voltar à Arquitetura](./README.md) | [Próximo: Fluxo de Dados →](./data-flow.md)
