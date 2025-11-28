# 02 - Arquitetura do Sistema

## 📋 Visão Geral Arquitetural

O WisLegal utiliza uma arquitetura **serverless moderna** baseada em microsserviços, combinando:
- Frontend SPA (Single Page Application) em React
- Backend serverless com Supabase (PostgreSQL + Edge Functions)
- Integrações com Google Cloud Platform
- Sistema de pagamentos via Stripe

## 🏗️ Arquitetura em Camadas

```
┌────────────────────────────────────────────────────────────────┐
│                    CAMADA DE APRESENTAÇÃO                       │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              React 18 + TypeScript + Vite                 │  │
│  │  - Components (40+)                                       │  │
│  │  - Pages (25+)                                            │  │
│  │  - Contexts (Auth, Theme, Notifications)                 │  │
│  │  - Hooks (Custom React Hooks)                            │  │
│  │  - Services (API Communication)                          │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬───────────────────────────────────┘
                             │ HTTPS / REST / WebSocket
┌────────────────────────────┴───────────────────────────────────┐
│                    CAMADA DE APLICAÇÃO                          │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Supabase Edge Functions (Deno)               │  │
│  │  - start-analysis                                         │  │
│  │  - process-next-prompt                                    │  │
│  │  - upload-to-gemini                                       │  │
│  │  - chat-with-processo                                     │  │
│  │  - process-audio-message                                  │  │
│  │  - stripe-checkout                                        │  │
│  │  - stripe-webhook                                         │  │
│  │  - create-upload-url                                      │  │
│  │  - get-billing-analytics                                  │  │
│  │  - delete-user-account                                    │  │
│  │  - cancel-subscription                                    │  │
│  │  - sync-stripe-*                                          │  │
│  │  - populate-pdf-base64                                    │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬───────────────────────────────────┘
                             │ SQL / Realtime
┌────────────────────────────┴───────────────────────────────────┐
│                      CAMADA DE DADOS                            │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                PostgreSQL (Supabase)                      │  │
│  │  - processos (tabela central)                            │  │
│  │  - paginas (texto OCR por página)                        │  │
│  │  - analysis_prompts (prompts versionados)                │  │
│  │  - analysis_results (resultados de análise)              │  │
│  │  - analysis_executions (tracking de execuções)           │  │
│  │  - user_profiles (perfis de usuários)                    │  │
│  │  - stripe_* (dados de billing)                           │  │
│  │  - token_* (sistema de tokens)                           │  │
│  │  - notifications (notificações)                          │  │
│  │  - chat_messages (histórico de chat)                     │  │
│  │  - admin_system_models (modelos de IA)                   │  │
│  │  - pdf_chunks (chunks de PDFs grandes)                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Supabase Storage (Backup)                    │  │
│  │  - Bucket: processos (PDFs originais)                    │  │
│  │  - Bucket: avatars (fotos de perfil)                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                Supabase Realtime                          │  │
│  │  - WebSocket para updates em tempo real                  │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬───────────────────────────────────┘
                             │ External APIs
┌────────────────────────────┴───────────────────────────────────┐
│                  CAMADA DE INTEGRAÇÕES                          │
│                                                                 │
│  ┌──────────────────┬──────────────────┬────────────────────┐  │
│  │  Google Cloud    │   Stripe API     │  Supabase Auth    │  │
│  │  - Document AI   │   - Checkout     │  - Email/Password │  │
│  │  - Gemini 2.0    │   - Subscriptions│  - OAuth Google   │  │
│  │  - Cloud Storage │   - Webhooks     │  - Session Mgmt   │  │
│  │  - Speech-to-Text│   - Coupons      │  - Password Reset │  │
│  └──────────────────┴──────────────────┴────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## 🎯 Princípios Arquiteturais

### 1. Serverless First
- **Sem servidores para gerenciar**: Toda a infraestrutura é gerenciada
- **Auto-scaling**: Escala automaticamente com demanda
- **Pay-per-use**: Custo baseado em uso real
- **Deploy instantâneo**: Edge Functions implantadas em segundos

### 2. Real-time by Default
- **WebSockets**: Atualizações instantâneas via Supabase Realtime
- **Reactive UI**: Interface responde a mudanças automaticamente
- **Live Updates**: Progresso de análise em tempo real
- **Notifications**: Sistema de notificações push

### 3. Security by Design
- **Row Level Security**: Isolamento de dados por usuário
- **Authentication**: Supabase Auth com múltiplos providers
- **Encryption**: Dados sensíveis criptografados
- **API Keys**: Gerenciamento seguro de credenciais

### 4. Performance Oriented
- **Lazy Loading**: Componentes carregados sob demanda
- **Code Splitting**: Bundle otimizado por rota
- **Caching**: Cache estratégico de dados
- **CDN**: Assets servidos via CDN
- **Web Workers**: Processamento pesado em background

### 5. Developer Experience
- **TypeScript**: Type safety em todo o código
- **Hot Reload**: Desenvolvimento rápido com Vite
- **Linting**: ESLint para qualidade de código
- **Git Flow**: Versionamento estruturado

## 🔧 Stack Tecnológico Detalhado

### Frontend Layer

#### Core Technologies
```json
{
  "react": "18.3.1",
  "typescript": "5.5.3",
  "vite": "5.4.2",
  "tailwindcss": "3.4.1"
}
```

#### UI Libraries
```json
{
  "lucide-react": "0.344.0",      // Ícones
  "react-select": "5.10.2",       // Select avançado
  "recharts": "3.2.1"             // Gráficos
}
```

#### PDF Processing
```json
{
  "pdfjs-dist": "4.4.168",        // Visualização
  "pdf-lib": "1.17.1"             // Manipulação
}
```

#### Routing & Navigation
```json
{
  "react-router-dom": "7.9.4"     // Roteamento SPA
}
```

### Backend Layer

#### Supabase Platform
- **PostgreSQL 15**: Banco de dados relacional
- **PostgREST**: API REST automática
- **Realtime**: WebSocket server
- **Storage**: Armazenamento de arquivos
- **Auth**: Autenticação e autorização
- **Edge Functions**: Deno runtime serverless

#### Edge Functions Runtime
- **Deno**: Runtime moderno e seguro
- **TypeScript Native**: Suporte nativo a TS
- **Web Standards**: APIs web padrão
- **NPM Compatibility**: Acesso a pacotes NPM

### Database Layer

#### PostgreSQL Extensions
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

#### Index Strategy
- **B-tree**: Índices padrão para chaves primárias
- **GIN**: Índices para buscas em JSONB
- **Composite**: Índices compostos para queries complexas

### Integration Layer

#### Google Cloud Platform
```typescript
{
  serviceAccount: {
    type: "service_account",
    project_id: "PROJECT_ID",
    private_key: "PRIVATE_KEY",
    client_email: "SERVICE_ACCOUNT_EMAIL"
  },
  apis: {
    documentAI: "Document AI API v1",
    gemini: "Gemini 2.0 Flash",
    cloudStorage: "Cloud Storage v1",
    speechToText: "Speech-to-Text v1"
  }
}
```

#### Stripe Integration
```typescript
{
  apiVersion: "2023-10-16",
  features: [
    "checkout.sessions",
    "subscriptions",
    "webhooks",
    "coupons",
    "customers",
    "invoices"
  ]
}
```

## 🔄 Fluxo de Comunicação

### 1. Request Flow (Frontend → Backend)

```
┌──────────┐
│ Browser  │
└────┬─────┘
     │ 1. User Action
     ↓
┌────────────────┐
│ React Component│
└────┬───────────┘
     │ 2. Service Call
     ↓
┌──────────────┐
│ API Service  │
└────┬─────────┘
     │ 3. HTTP/WS
     ↓
┌────────────────────┐
│ Supabase Platform  │
│ - API Gateway      │
│ - Auth Middleware  │
└────┬───────────────┘
     │ 4. RLS Check
     ↓
┌────────────────┐
│ PostgreSQL     │
│ - Query Data   │
│ - Apply RLS    │
└────┬───────────┘
     │ 5. Return Data
     ↓
┌──────────────┐
│ Edge Function│ (if needed)
└────┬─────────┘
     │ 6. Process
     ↓
┌────────────────┐
│ External API   │ (if needed)
└────┬───────────┘
     │ 7. Response
     ↓
Back to Browser
```

### 2. Realtime Flow (Database → Frontend)

```
┌────────────┐
│ PostgreSQL │
│ - INSERT   │
│ - UPDATE   │
│ - DELETE   │
└────┬───────┘
     │ 1. Change Event
     ↓
┌────────────────────┐
│ Realtime Server    │
│ - Listen to WAL    │
│ - Filter by RLS    │
└────┬───────────────┘
     │ 2. WebSocket Push
     ↓
┌────────────────┐
│ Supabase Client│
│ - Subscribe    │
└────┬───────────┘
     │ 3. Callback
     ↓
┌──────────────┐
│ React State  │
│ - Update     │
└────┬─────────┘
     │ 4. Re-render
     ↓
┌──────────┐
│ Browser  │
└──────────┘
```

### 3. Analysis Flow (Completo)

```
User Upload PDF
       ↓
┌──────────────────────┐
│ FileUpload Component │
│ - Validate           │
│ - Count Pages        │
└──────┬───────────────┘
       │
       ↓
┌──────────────────────┐
│ ProcessosService     │
│ - Create Process     │
│ - Upload to GCS      │
│ - Store Base64       │
└──────┬───────────────┘
       │
       ↓
┌──────────────────────────┐
│ Edge Function:           │
│ start-analysis           │
│ - Update status          │
│ - Trigger processing     │
└──────┬───────────────────┘
       │
       ↓
┌──────────────────────────┐
│ Edge Function:           │
│ upload-to-gemini         │
│ - Upload PDF to File API │
│ - Store file_uri         │
└──────┬───────────────────┘
       │
       ↓
┌──────────────────────────┐
│ Loop: process-next-prompt│
│ (9 iterations)           │
│                          │
│ For each prompt:         │
│  1. Load prompt          │
│  2. Call Gemini API      │
│  3. Parse JSON response  │
│  4. Save to DB           │
│  5. Update progress      │
└──────┬───────────────────┘
       │
       ↓
┌──────────────────────┐
│ Status: completed    │
│ - Notify user        │
│ - Analysis available │
└──────────────────────┘
```

## 🔐 Segurança em Profundidade

### Camada 1: Autenticação
```typescript
// Supabase Auth + RLS
const { data: { user } } = await supabase.auth.getUser();

// Row Level Security automático
const { data } = await supabase
  .from('processos')
  .select('*')
  .eq('user_id', user.id); // RLS força este filtro
```

### Camada 2: Row Level Security
```sql
-- Política: Usuários veem apenas seus processos
CREATE POLICY "Users can view own processos"
  ON processos FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
```

### Camada 3: Edge Functions Authorization
```typescript
// Service Role para operações privilegiadas
const supabase = createClient(
  supabaseUrl,
  supabaseServiceKey // Apenas em Edge Functions
);
```

### Camada 4: API Keys Management
```typescript
// Environment Variables (nunca hardcoded)
const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
```

## 📊 Padrões de Arquitetura

### 1. Repository Pattern
```typescript
// Centraliza acesso a dados
export class ProcessosService {
  static async getProcessoById(id: string): Promise<Processo> {
    const { data } = await supabase
      .from('processos')
      .select('*')
      .eq('id', id)
      .single();
    return data;
  }
}
```

### 2. Context Pattern
```typescript
// Compartilha estado globalmente
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  return (
    <AuthContext.Provider value={{ user }}>
      {children}
    </AuthContext.Provider>
  );
}
```

### 3. Custom Hooks Pattern
```typescript
// Encapsula lógica reutilizável
export function useAnalysisProgress(processoId: string) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const subscription = supabase
      .channel(`processo_${processoId}`)
      .on('postgres_changes', callback)
      .subscribe();

    return () => subscription.unsubscribe();
  }, [processoId]);

  return progress;
}
```

### 4. Service Layer Pattern
```typescript
// Separa lógica de negócio
export class AnalysisService {
  static async startAnalysis(processoId: string) {
    // Lógica complexa encapsulada
  }
}
```

## 🚀 Deployment Architecture

### Build Process
```bash
# 1. Type checking
npm run typecheck

# 2. Linting
npm run lint

# 3. Build
npm run build
# Output: dist/ folder

# 4. Edge Functions
supabase functions deploy
```

### Hosting
```
┌─────────────────────┐
│   CDN (Cloudflare)  │
│   - Static Assets   │
│   - dist/ files     │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  Supabase Platform  │
│  - Edge Functions   │
│  - Database         │
│  - Storage          │
│  - Realtime         │
└─────────────────────┘
```

### Environment Variables
```env
# Frontend (.env)
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# Edge Functions (Supabase Dashboard)
SUPABASE_SERVICE_ROLE_KEY=eyJ...
GEMINI_API_KEY=AIza...
STRIPE_SECRET_KEY=sk_...
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account"...}
```

## 📈 Escalabilidade

### Horizontal Scaling
- **Edge Functions**: Auto-scale com demanda
- **PostgreSQL**: Connection pooling
- **Storage**: Distribuído globalmente
- **CDN**: Cache em múltiplas regiões

### Vertical Optimization
- **Índices**: Queries otimizadas com índices
- **Chunking**: PDFs grandes divididos
- **Lazy Loading**: Componentes sob demanda
- **Memoization**: Cache de computações

### Performance Monitoring
```typescript
// Tracking de performance
const startTime = Date.now();
await processAnalysis(processoId);
const duration = Date.now() - startTime;

await supabase
  .from('analysis_executions')
  .insert({
    processo_id: processoId,
    execution_time_ms: duration
  });
```

## 🔗 Próximos Documentos

- **[03-ESTRUTURA-PROJETO.md](./03-ESTRUTURA-PROJETO.md)** - Organização do código
- **[04-BANCO-DE-DADOS.md](./04-BANCO-DE-DADOS.md)** - Schema detalhado
- **[05-EDGE-FUNCTIONS.md](./05-EDGE-FUNCTIONS.md)** - Funções serverless

---

**Arquitetura moderna, serverless e escalável**
