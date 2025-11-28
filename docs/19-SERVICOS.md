# 19 - Serviços e Lógica de Negócio

## 📋 Visão Geral

Os serviços encapsulam toda a lógica de negócio da aplicação, fornecendo uma camada de abstração entre componentes React e a API do Supabase. Total: **10+ serviços**

## 📂 Estrutura de Serviços

```
src/services/
├── ProcessosService.ts              # CRUD de processos
├── AnalysisService.ts               # Análises forenses
├── AnalysisPromptsService.ts        # Gestão de prompts
├── AnalysisResultsService.ts        # Resultados de análise
├── TokenService.ts                  # Sistema de tokens
├── TokenValidationService.ts        # Validação de tokens
├── TokenTrackingHelper.ts           # Tracking de uso
├── NotificationsService.ts          # Notificações
├── BillingAnalyticsService.ts       # Analytics de billing
├── AdminSystemModelsService.ts      # Gestão de modelos IA
└── IntegrityValidationService.ts    # Validação de integridade
```

## 🎯 Serviços Principais

### 1. ProcessosService

**Propósito:** Gerenciamento completo do ciclo de vida de processos.

**Métodos Principais:**

#### uploadAndStartProcessing
```typescript
static async uploadAndStartProcessing(
  file: File,
  onProcessoCreated?: (processoId: string) => void
): Promise<string>
```

**Fluxo:**
1. Cria processo temporário (status: uploading)
2. Conta páginas do PDF
3. Upload para Google Cloud Storage
4. Converte para Base64 e armazena no banco
5. Atualiza status para created
6. Chama startAnalysis
7. Retorna processo_id

**Exemplo de Uso:**
```typescript
try {
  const processoId = await ProcessosService.uploadAndStartProcessing(
    pdfFile,
    (id) => console.log('Processo criado:', id)
  );
  navigate(`/processo/${processoId}`);
} catch (error) {
  showToast('Erro no upload', 'error');
}
```

#### getAllProcessos
```typescript
static async getAllProcessos(): Promise<Processo[]>
```

Retorna todos os processos do usuário autenticado com:
- Metadados completos
- Status atual
- Progresso de análise
- Informações do perfil (via join)

#### getProcessoById
```typescript
static async getProcessoById(id: string): Promise<Processo | null>
```

Busca processo específico com todas as relações.

#### deleteProcesso
```typescript
static async deleteProcesso(id: string): Promise<void>
```

Deleta processo e todos os dados relacionados:
- Remove arquivo do Storage
- Deleta registros do banco (cascade)
- Remove chunks se existirem

#### updateProcessoName
```typescript
static async updateProcessoName(id: string, newName: string): Promise<void>
```

Renomeia processo.

#### getPaginasText
```typescript
static async getPaginasText(processoId: string): Promise<Pagina[]>
```

Retorna texto de todas as páginas, ordenado.

#### subscribeToProcessoChanges
```typescript
static subscribeToProcessoChanges(
  processoId: string,
  callback: (processo: Processo) => void
): UnsubscribeFunction
```

WebSocket subscription para updates em tempo real.

**Exemplo:**
```typescript
useEffect(() => {
  const unsubscribe = ProcessosService.subscribeToProcessoChanges(
    processoId,
    (updated) => setProcesso(updated)
  );
  return unsubscribe;
}, [processoId]);
```

#### uploadAndProcessChunkedPDF
```typescript
static async uploadAndProcessChunkedPDF(
  file: File,
  totalPages: number,
  onProcessoCreated?: (processoId: string) => void
): Promise<string>
```

Para PDFs gigantes (1000+ páginas):
1. Divide em chunks de 1000 páginas
2. Upload de cada chunk separadamente
3. Cria registros em process_chunks
4. Processa chunks em paralelo

### 2. AnalysisService

**Propósito:** Controle de análises forenses.

**Métodos:**

#### startAnalysis
```typescript
static async startAnalysis(processoId: string): Promise<void>
```

Inicia análise chamando Edge Function.

#### getActivePrompts
```typescript
static async getActivePrompts(): Promise<AnalysisPrompt[]>
```

Retorna prompts ativos ordenados por execution_order.

#### getAnalysisResults
```typescript
static async getAnalysisResults(
  processoId: string
): Promise<AnalysisResult[]>
```

Retorna todos os resultados de análise de um processo.

#### getAnalysisProgress
```typescript
static async getAnalysisProgress(processoId: string): Promise<{
  currentPrompt: number;
  totalPrompts: number;
  status: string;
}>
```

Retorna progresso atual da análise.

#### subscribeToAnalysisProgress
```typescript
static subscribeToAnalysisProgress(
  processoId: string,
  callback: (progress) => void
): UnsubscribeFunction
```

Realtime updates de progresso.

### 3. TokenService

**Propósito:** Gestão completa do sistema de tokens.

**Métodos Principais:**

#### getUserTokenUsageSummary
```typescript
async getUserTokenUsageSummary(userId: string): Promise<TokenUsageSummary>
```

Retorna resumo completo:
```typescript
{
  total_tokens_used: 15000,
  tokens_this_month: 15000,
  monthly_quota: 50000,
  quota_remaining: 35000,
  quota_reset_date: '2025-11-01T00:00:00Z',
  usage_by_operation: {
    'analysis': { tokens: 12000, count: 8 },
    'chat': { tokens: 3000, count: 45 }
  }
}
```

#### checkTokenAvailability
```typescript
async checkTokenAvailability(
  userId: string,
  tokensNeeded: number
): Promise<boolean>
```

Verifica se usuário tem tokens suficientes antes de operação.

**Exemplo:**
```typescript
const hasTokens = await tokenService.checkTokenAvailability(
  user.id,
  estimatedTokens
);

if (!hasTokens) {
  showUpgradeModal();
  return;
}

// Prosseguir com operação
```

#### getProcessoTokenUsage
```typescript
async getProcessoTokenUsage(processoId: string): Promise<number>
```

Soma total de tokens gastos em um processo.

#### getAllUsersTokenQuotas
```typescript
async getAllUsersTokenQuotas(): Promise<Array<UserTokenQuota>>
```

Para admins: lista quotas de todos os usuários.

#### Métodos Utilitários

```typescript
formatTokenCount(tokens: number): string
// 15432 → "15.4K"
// 1500000 → "1.5M"

getUsagePercentage(used: number, quota: number): number
// Calcula percentual

getUsageColor(percentage: number): string
// Verde (<75%), Amarelo (75-90%), Vermelho (>90%)
```

### 4. NotificationsService

**Propósito:** Sistema de notificações em tempo real.

**Métodos:**

#### getNotifications
```typescript
static async getNotifications(userId: string): Promise<Notification[]>
```

Lista notificações do usuário.

#### markAsRead
```typescript
static async markAsRead(notificationId: string): Promise<void>
```

Marca notificação como lida.

#### markAllAsRead
```typescript
static async markAllAsRead(userId: string): Promise<void>
```

Marca todas como lidas.

#### deleteNotification
```typescript
static async deleteNotification(id: string): Promise<void>
```

Deleta notificação.

#### subscribeToNotifications
```typescript
static subscribeToNotifications(
  userId: string,
  callback: (notification: Notification) => void
): UnsubscribeFunction
```

Realtime updates de novas notificações.

**Exemplo de Uso:**
```typescript
useEffect(() => {
  const unsubscribe = NotificationsService.subscribeToNotifications(
    user.id,
    (newNotification) => {
      setNotifications(prev => [newNotification, ...prev]);
      playNotificationSound();
      showToast(newNotification.message, newNotification.type);
    }
  );
  return unsubscribe;
}, [user.id]);
```

### 5. BillingAnalyticsService

**Propósito:** Analytics de faturamento para admins.

**Métodos:**

#### getBillingAnalytics
```typescript
static async getBillingAnalytics(): Promise<BillingAnalytics>
```

Chama Edge Function e retorna:
```typescript
{
  total_users: 150,
  active_subscriptions: 80,
  total_mrr: 24000,
  churn_rate: 3.5,
  revenue_by_plan: [...],
  revenue_by_month: [...],
  top_users: [...]
}
```

#### getSubscriptionMetrics
```typescript
static async getSubscriptionMetrics(): Promise<SubscriptionMetrics>
```

Métricas de assinaturas:
- Novas assinaturas (mês)
- Cancelamentos (mês)
- Taxa de conversão
- Lifetime value médio

### 6. AdminSystemModelsService

**Propósito:** Gestão de modelos de IA disponíveis.

**Métodos:**

#### getAllModels
```typescript
static async getAllModels(): Promise<AdminSystemModel[]>
```

Lista todos os modelos cadastrados.

#### getActiveModel
```typescript
static async getActiveModel(): Promise<AdminSystemModel | null>
```

Retorna modelo ativo com maior prioridade.

#### updateModel
```typescript
static async updateModel(
  id: string,
  updates: Partial<AdminSystemModel>
): Promise<void>
```

Atualiza configuração de modelo.

#### createModel
```typescript
static async createModel(
  model: Omit<AdminSystemModel, 'id' | 'created_at'>
): Promise<AdminSystemModel>
```

Cadastra novo modelo.

**Exemplo de Modelo:**
```typescript
{
  name: 'gemini-2.0-flash-exp',
  display_name: 'Gemini 2.0 Flash',
  provider: 'google',
  version: '2.0',
  is_active: true,
  priority: 1,
  max_input_tokens: 1000000,
  max_output_tokens: 8192,
  supports_vision: true,
  supports_streaming: true,
  cost_per_1k_input: 0.00015,
  cost_per_1k_output: 0.0006
}
```

### 7. IntegrityValidationService

**Propósito:** Monitora integridade do sistema.

**Métodos:**

#### validateSystemIntegrity
```typescript
static async validateSystemIntegrity(): Promise<IntegrityReport>
```

Executa múltiplas validações:
```typescript
{
  orphaned_processes: 5,
  expired_locks: 2,
  missing_files: 0,
  inconsistent_data: 1,
  health_score: 95,
  issues: [
    {
      type: 'orphaned_process',
      severity: 'warning',
      processo_id: 'xxx',
      message: 'Processo travado há 2 horas'
    }
  ]
}
```

#### fixOrphanedProcesses
```typescript
static async fixOrphanedProcesses(): Promise<number>
```

Reprocessa processos órfãos (retorna quantidade).

#### cleanExpiredLocks
```typescript
static async cleanExpiredLocks(): Promise<number>
```

Remove locks expirados.

## 🔧 Padrões de Implementação

### Singleton Services
```typescript
class TokenService {
  // Instância única
  private constructor() {}
}

export const tokenService = new TokenService();
```

### Static Services
```typescript
export class ProcessosService {
  static async getProcessoById(id: string) {
    // Métodos estáticos
  }
}
```

### Error Handling
```typescript
try {
  const data = await service.method();
  return data;
} catch (error) {
  console.error('Erro no serviço:', error);
  throw new Error('Mensagem amigável para usuário');
}
```

### Type Safety
```typescript
// Sempre tipar retornos
async method(): Promise<ReturnType> {
  const { data, error } = await supabase.from('table').select();

  if (error) throw error;

  // Type assertion seguro
  return data as ReturnType;
}
```

## 📊 Performance

### Caching
```typescript
// Cache em memória para dados que não mudam frequentemente
private cache = new Map<string, { data: any; timestamp: number }>();

async getCachedData(key: string): Promise<any> {
  const cached = this.cache.get(key);
  if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
    return cached.data;
  }

  const data = await this.fetchData();
  this.cache.set(key, { data, timestamp: Date.now() });
  return data;
}
```

### Batching
```typescript
// Agrupa múltiplas requisições
async batchGetProcessos(ids: string[]): Promise<Processo[]> {
  const { data } = await supabase
    .from('processos')
    .select('*')
    .in('id', ids);

  return data || [];
}
```

### Debouncing
```typescript
// Para operações frequentes
private debounceTimer: NodeJS.Timeout | null = null;

async debouncedSave(data: any) {
  if (this.debounceTimer) clearTimeout(this.debounceTimer);

  this.debounceTimer = setTimeout(async () => {
    await this.save(data);
  }, 500);
}
```

## 🔗 Próximos Documentos

- **[20-UTILITARIOS.md](./20-UTILITARIOS.md)** - Utilitários e helpers
- **[14-CONTEXTS-HOOKS.md](./14-CONTEXTS-HOOKS.md)** - Contexts e hooks

---

**10+ serviços organizados e type-safe**
