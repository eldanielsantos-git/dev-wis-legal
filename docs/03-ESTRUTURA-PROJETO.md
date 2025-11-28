# 03 - Estrutura do Projeto

## 📋 Visão Geral

Este documento detalha a organização completa do código-fonte do WisLegal, explicando a estrutura de pastas, convenções de nomenclatura e princípios de arquitetura utilizados.

## 📂 Estrutura Completa

```
wislegal/
│
├── docs/                              # 📚 Documentação técnica completa
│   ├── README.md                      # Índice geral da documentação
│   ├── 01-VISAO-GERAL.md
│   ├── 02-ARQUITETURA.md
│   ├── 03-ESTRUTURA-PROJETO.md
│   ├── 04-BANCO-DE-DADOS.md
│   ├── 05-EDGE-FUNCTIONS.md
│   ├── 06-INTEGRACOES-GCP.md
│   ├── 07-AUTENTICACAO.md
│   ├── 08-SEGURANCA-RLS.md
│   ├── 09-FLUXO-UPLOAD.md
│   ├── 10-FLUXO-ANALISE.md
│   ├── 11-SISTEMA-PROMPTS.md
│   ├── 12-COMPONENTES-UI.md
│   ├── 13-PAGINAS-ROTAS.md
│   ├── 14-CONTEXTS-HOOKS.md
│   ├── 15-SISTEMA-TOKENS.md
│   ├── 16-SISTEMA-NOTIFICACOES.md
│   ├── 17-SISTEMA-CHAT.md
│   ├── 18-PAINEL-ADMIN.md
│   ├── 19-SERVICOS.md
│   ├── 20-UTILITARIOS.md
│   ├── 21-DESIGN-SYSTEM.md
│   ├── 22-UX-PATTERNS.md
│   ├── 23-UI-GUIDELINES.md
│   ├── 24-PERFORMANCE.md
│   ├── 25-TESTES-QA.md
│   ├── 26-DEPLOY-DEVOPS.md
│   ├── 27-MONITORAMENTO.md
│   ├── 28-TROUBLESHOOTING.md
│   ├── 29-GUIA-DESENVOLVIMENTO.md
│   └── 30-API-REFERENCE.md
│
├── public/                            # 🌐 Assets públicos estáticos
│   ├── _redirects                     # Netlify redirects
│   ├── robots.txt                     # SEO: robots
│   └── sitemap.xml                    # SEO: sitemap
│
├── src/                               # 💻 Código-fonte principal
│   │
│   ├── components/                    # 🧩 Componentes React (40+)
│   │   ├── AnalysisCard.tsx          # Card de análise forense
│   │   ├── AnalysisContentRenderer.tsx  # Renderiza conteúdo JSON
│   │   ├── AnalysisProgress.tsx      # Progresso de análise
│   │   ├── AudioRecordingAnimation.tsx  # Animação de gravação
│   │   ├── CancelSubscriptionModal.tsx  # Modal de cancelamento
│   │   ├── ChatInterface.tsx         # Interface completa de chat
│   │   ├── ChatMessageAssistant.tsx  # Mensagem da IA
│   │   ├── ChatMessageUser.tsx       # Mensagem do usuário
│   │   ├── ChatProcessList.tsx       # Lista de processos para chat
│   │   ├── ConfirmDeleteModal.tsx    # Modal de confirmação
│   │   ├── Dashboard.tsx             # Dashboard principal
│   │   ├── ErrorModal.tsx            # Modal de erro
│   │   ├── FileUpload.tsx            # Upload de arquivos
│   │   ├── Footer.tsx                # Rodapé padrão
│   │   ├── FooterWis.tsx             # Rodapé WisLegal
│   │   ├── IntelligentSearch.tsx     # Busca inteligente
│   │   ├── LoadingSpinner.tsx        # Spinner de loading
│   │   ├── NotificationBadge.tsx     # Badge de notificações
│   │   ├── ProcessingProgress.tsx    # Progresso de processamento
│   │   ├── ProcessoCard.tsx          # Card de processo
│   │   ├── ProcessoListItem.tsx      # Item de lista
│   │   ├── ProcessStatusBadge.tsx    # Badge de status
│   │   ├── ProcessStatusIndicator.tsx  # Indicador de status
│   │   ├── ProcessStatusProgress.tsx  # Progresso por status
│   │   ├── Sidebar.tsx               # Sidebar principal
│   │   ├── SidebarWis.tsx            # Sidebar WisLegal
│   │   ├── StatusCard.tsx            # Card de status
│   │   ├── ToastContainer.tsx        # Container de toasts
│   │   ├── ToastNotification.tsx     # Toast individual
│   │   ├── TokenAvailabilityInfo.tsx  # Info de tokens
│   │   ├── TokenUsageCard.tsx        # Card de uso de tokens
│   │   ├── UpgradeModal.tsx          # Modal de upgrade
│   │   ├── UserAvatar.tsx            # Avatar do usuário
│   │   ├── UserAvatarMenu.tsx        # Menu do avatar
│   │   └── subscription/             # 💳 Componentes de assinatura
│   │       ├── AddTokensSection.tsx
│   │       ├── SubscriptionPlans.tsx
│   │       ├── SubscriptionStatus.tsx
│   │       ├── SuccessPage.tsx
│   │       └── TokenBreakdownCard.tsx
│   │
│   ├── contexts/                      # 🌐 React Contexts
│   │   ├── AuthContext.tsx           # Autenticação global
│   │   ├── NotificationContext.tsx   # Notificações globais
│   │   └── ThemeContext.tsx          # Tema (dark/light)
│   │
│   ├── data/                          # 📊 Dados estáticos
│   │   └── brazilianLocations.ts     # Estados e cidades BR
│   │
│   ├── hooks/                         # 🪝 Custom React Hooks
│   │   ├── useAnalysisProgress.ts    # Hook de progresso
│   │   ├── useAudioRecorder.ts       # Hook de gravação
│   │   ├── useAuth.ts                # Hook de autenticação
│   │   ├── usePDFWorker.ts           # Hook de PDF worker
│   │   ├── useProcessProgressPolling.ts  # Polling de progresso
│   │   ├── useResponsiveSidebar.ts   # Hook de sidebar responsiva
│   │   ├── useSequentialTyping.tsx   # Efeito de digitação
│   │   ├── useSubscriptionStatus.ts  # Status de assinatura
│   │   ├── useToast.ts               # Hook de toasts
│   │   ├── useTypingEffect.ts        # Efeito de digitação
│   │   └── useTypingEffectChat.ts    # Efeito de digitação chat
│   │
│   ├── lib/                           # 🔧 Configurações de bibliotecas
│   │   ├── gemini.ts                 # Config Gemini AI
│   │   └── supabase.ts               # Config Supabase + Types
│   │
│   ├── pages/                         # 📄 Páginas da aplicação (25+)
│   │   ├── AdminForensicPromptsPage.tsx  # Admin: Gestão de prompts
│   │   ├── AdminIntegrityPage.tsx    # Admin: Integridade do sistema
│   │   ├── AdminQuotaManagementPage.tsx  # Admin: Gestão de quotas
│   │   ├── AdminSettingsPage.tsx     # Admin: Configurações
│   │   ├── AdminStripeDiagnosticPage.tsx  # Admin: Diagnóstico Stripe
│   │   ├── AdminSystemModelsPage.tsx # Admin: Modelos de IA
│   │   ├── AdminTokenCreditsAuditPage.tsx  # Admin: Auditoria tokens
│   │   ├── AdminTokenManagementPage.tsx  # Admin: Gestão tokens
│   │   ├── AdminUsersPage.tsx        # Admin: Gestão usuários
│   │   ├── AppHomePage.tsx           # Home da aplicação
│   │   ├── ChatPage.tsx              # Chat com processo
│   │   ├── ChatProcessSelectionPage.tsx  # Seleção de processo
│   │   ├── CookiesPage.tsx           # Política de cookies
│   │   ├── ForgotPasswordPage.tsx    # Esqueci senha
│   │   ├── HomePage.tsx              # Landing page
│   │   ├── MyProcessDetailPage.tsx   # Detalhe do processo
│   │   ├── MyProcessesPage.tsx       # Lista de processos
│   │   ├── NotificationsPage.tsx     # Notificações
│   │   ├── PrivacyPage.tsx           # Política de privacidade
│   │   ├── ProcessoDetailPage.tsx    # Detalhe do processo (alt)
│   │   ├── ProfilePage.tsx           # Perfil do usuário
│   │   ├── ResetPasswordPage.tsx     # Reset de senha
│   │   ├── SignInPage.tsx            # Login
│   │   ├── SignUpPage.tsx            # Cadastro
│   │   ├── SubscriptionPage.tsx      # Assinaturas
│   │   ├── TermsPage.tsx             # Termos de uso
│   │   └── TokensPage.tsx            # Gestão de tokens
│   │
│   ├── services/                      # 🛠️ Lógica de negócio (10+)
│   │   ├── AdminSystemModelsService.ts  # Gestão de modelos
│   │   ├── AnalysisPromptsService.ts # Gestão de prompts
│   │   ├── AnalysisResultsService.ts # Resultados de análise
│   │   ├── AnalysisService.ts        # Análises forenses
│   │   ├── BillingAnalyticsService.ts  # Analytics de billing
│   │   ├── IntegrityValidationService.ts  # Validação sistema
│   │   ├── NotificationsService.ts   # Notificações
│   │   ├── ProcessosService.ts       # CRUD de processos
│   │   ├── TokenService.ts           # Sistema de tokens
│   │   ├── TokenTrackingHelper.ts    # Tracking de tokens
│   │   └── TokenValidationService.ts # Validação de tokens
│   │
│   ├── types/                         # 📝 Definições TypeScript
│   │   └── billing.ts                # Types de billing
│   │
│   ├── utils/                         # 🔨 Utilitários
│   │   ├── contentCleaner.ts         # Limpeza de conteúdo
│   │   ├── contentParser.ts          # Parse de conteúdo
│   │   ├── markdownToXml.ts          # Conversão MD → XML
│   │   ├── nativeDocxGenerator.ts    # Geração de DOCX
│   │   ├── notificationSound.ts      # Sons de notificação
│   │   ├── pdfSplitter.ts            # Divisão de PDFs
│   │   └── themeUtils.ts             # Utilitários de tema
│   │
│   ├── workers/                       # 👷 Web Workers
│   │   └── pdf-processor.worker.ts   # Processamento de PDF
│   │
│   ├── App.tsx                        # 🚀 Componente raiz
│   ├── main.tsx                       # 🎬 Entry point
│   ├── index.css                      # 🎨 Estilos globais
│   ├── stripe-config.ts               # ⚙️ Config Stripe
│   └── vite-env.d.ts                  # 📦 Types Vite
│
├── supabase/                          # 🗄️ Backend Supabase
│   │
│   ├── functions/                     # ⚡ Edge Functions (15)
│   │   ├── cancel-subscription/
│   │   │   └── index.ts
│   │   ├── chat-with-processo/
│   │   │   └── index.ts
│   │   ├── create-upload-url/
│   │   │   └── index.ts
│   │   ├── delete-user-account/
│   │   │   └── index.ts
│   │   ├── get-billing-analytics/
│   │   │   ├── index.ts
│   │   │   └── _shared/
│   │   │       └── cors.ts
│   │   ├── populate-pdf-base64/
│   │   │   └── index.ts
│   │   ├── process-audio-message/
│   │   │   └── index.ts
│   │   ├── process-next-prompt/
│   │   │   ├── index.ts
│   │   │   └── index_old.ts (backup)
│   │   ├── start-analysis/
│   │   │   └── index.ts
│   │   ├── stripe-checkout/
│   │   │   └── index.ts
│   │   ├── stripe-webhook/
│   │   │   └── index.ts
│   │   ├── sync-stripe-coupons/
│   │   │   └── index.ts
│   │   ├── sync-stripe-extra-tokens/
│   │   │   └── index.ts
│   │   ├── sync-stripe-subscription/
│   │   │   └── index.ts
│   │   └── upload-to-gemini/
│   │       └── index.ts
│   │
│   └── migrations/                    # 🗃️ SQL Migrations (100+)
│       ├── 20250114000000_optimize_indexes.sql
│       ├── 20250929020927_lucky_paper.sql
│       ├── 20251003201219_create_paginas_table.sql
│       ├── 20251004182731_create_forensic_analysis_tables.sql
│       ├── 20251008212350_create_token_management_system.sql
│       ├── 20251028000000_cleanup_v2_database.sql
│       ├── 20251028000001_create_analysis_tables.sql
│       ├── 20251029020415_add_gemini_file_api_fields.sql
│       ├── 20251029120000_add_priority_system_to_models.sql
│       └── ... (100+ arquivos)
│
├── dist/                              # 📦 Build de produção (gerado)
│   ├── assets/                        # JS e CSS bundled
│   ├── index.html
│   ├── _redirects
│   ├── robots.txt
│   └── sitemap.xml
│
├── .github/                           # 🤖 GitHub Actions
│   └── workflows/
│       ├── cron.yml
│       └── monitor-docai.yml
│
├── .env                               # 🔒 Variáveis de ambiente (git-ignored)
├── .env.example                       # 📋 Template de .env
├── .gitignore                         # 🚫 Arquivos ignorados pelo Git
├── eslint.config.js                   # 🔍 Configuração ESLint
├── index.html                         # 🌐 HTML principal
├── package.json                       # 📦 Dependências e scripts
├── package-lock.json                  # 🔒 Lock de dependências
├── postcss.config.js                  # 🎨 Config PostCSS
├── README.md                          # 📖 README principal
├── tailwind.config.js                 # 🎨 Config Tailwind CSS
├── test.html                          # 🧪 Arquivo de teste
├── tsconfig.json                      # ⚙️ Config TypeScript (root)
├── tsconfig.app.json                  # ⚙️ Config TypeScript (app)
├── tsconfig.node.json                 # ⚙️ Config TypeScript (node)
└── vite.config.ts                     # ⚙️ Config Vite
```

## 📏 Convenções de Nomenclatura

### Arquivos e Pastas

| Tipo | Convenção | Exemplo |
|------|-----------|---------|
| **Componentes** | PascalCase.tsx | `UserAvatar.tsx` |
| **Páginas** | PascalCase + Page.tsx | `HomePage.tsx` |
| **Serviços** | PascalCase + Service.ts | `ProcessosService.ts` |
| **Hooks** | camelCase + use prefix | `useAuth.ts` |
| **Utils** | camelCase.ts | `contentParser.ts` |
| **Contexts** | PascalCase + Context.tsx | `AuthContext.tsx` |
| **Types** | camelCase.ts | `billing.ts` |
| **Config** | lowercase.config.js | `vite.config.ts` |

### Pastas

- Singular para tipos: `type/`, `util/`
- Plural para coleções: `components/`, `services/`, `pages/`
- Lowercase para config: `lib/`, `data/`

## 🏛️ Princípios Arquiteturais

### 1. Separação de Responsabilidades

```
Components → Visual Layer (apenas UI)
     ↓
  Services → Business Logic (regras de negócio)
     ↓
   Lib → Infrastructure (Supabase, Gemini)
```

### 2. Single Responsibility

Cada arquivo tem **uma** responsabilidade clara:
- **Componente**: Renderizar UI específica
- **Serviço**: Lógica de negócio específica
- **Hook**: Comportamento reutilizável específico

### 3. DRY (Don't Repeat Yourself)

- Código duplicado → Extrair para utility
- Lógica repetida → Extrair para service
- UI repetida → Extrair para component

### 4. Composição sobre Herança

```typescript
// ✅ BOM: Composição
<Card>
  <Card.Header />
  <Card.Body />
</Card>

// ❌ EVITAR: Herança complexa
class ExtendedCard extends Card extends BaseCard extends...
```

## 📦 Imports e Exports

### Ordem de Imports

```typescript
// 1. React e bibliotecas externas
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// 2. Contexts e hooks internos
import { useAuth } from '@/contexts/AuthContext';

// 3. Services
import { ProcessosService } from '@/services/ProcessosService';

// 4. Components
import { Button } from '@/components/Button';

// 5. Types
import type { Processo } from '@/lib/supabase';

// 6. Utils e assets
import { formatDate } from '@/utils/dateUtils';
```

### Named Exports (Preferido)

```typescript
// ✅ BOM: Named export
export function MyComponent() {}
export class MyService {}

// ❌ EVITAR: Default export
export default MyComponent;
```

## 🔗 Próximos Documentos

- **[04-BANCO-DE-DADOS.md](./04-BANCO-DE-DADOS.md)** - Schema do banco
- **[29-GUIA-DESENVOLVIMENTO.md](./29-GUIA-DESENVOLVIMENTO.md)** - Setup e desenvolvimento

---

**Estrutura organizada e escalável**
