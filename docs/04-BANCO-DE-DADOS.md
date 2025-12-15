# 04 - Banco de Dados

## 📋 Visão Geral

O WisLegal utiliza **PostgreSQL 15** via Supabase como banco de dados principal. A arquitetura do banco é projetada para:
- Alta performance com índices otimizados
- Segurança com Row Level Security (RLS)
- Auditoria completa de operações
- Relacionamentos bem definidos
- Suporte a JSONB para flexibilidade

## 🗄️ Diagrama ER Simplificado

```
┌─────────────────┐
│  user_profiles  │
│  - id (PK)      │
│  - email        │
│  - first_name   │
│  - last_name    │
│  - is_admin     │
└────────┬────────┘
         │ 1:N
         ↓
┌─────────────────────┐          ┌──────────────────┐
│    processos        │          │analysis_prompts  │
│  - id (PK)          │          │  - id (PK)       │
│  - user_id (FK)     │          │  - title         │
│  - file_name        │          │  - content       │
│  - status           │          │  - is_active     │
│  - pdf_base64       │          │  - version       │
│  - gemini_file_uri  │          └──────────────────┘
└────────┬────────────┘                    │
         │ 1:N                             │ N:M
         ↓                                 ↓
┌─────────────────────┐          ┌──────────────────┐
│      paginas        │          │analysis_results  │
│  - id (PK)          │          │  - id (PK)       │
│  - processo_id (FK) │          │  - processo_id   │
│  - page_number      │          │  - prompt_id     │
│  - text_content     │          │  - result        │
└─────────────────────┘          │  - status        │
                                 └──────────────────┘

┌─────────────────────┐          ┌──────────────────┐
│  chat_messages      │          │  notifications   │
│  - id (PK)          │          │  - id (PK)       │
│  - processo_id (FK) │          │  - user_id (FK)  │
│  - user_id (FK)     │          │  - message       │
│  - content          │          │  - is_read       │
│  - role             │          │  - type          │
└─────────────────────┘          └──────────────────┘

┌─────────────────────┐          ┌──────────────────────┐
│ stripe_customers    │          │ stripe_subscriptions │
│  - customer_id (PK) │──1:N────→│  - subscription_id   │
│  - user_id (FK)     │          │  - customer_id (FK)  │
│  - email            │          │  - status            │
└─────────────────────┘          │  - tokens_total      │
                                 │  - tokens_used       │
                                 └──────────────────────┘

┌─────────────────────┐
│  token_usage_logs   │
│  - id (PK)          │
│  - user_id (FK)     │
│  - processo_id (FK) │
│  - tokens_used      │
│  - operation_type   │
└─────────────────────┘
```

## 📊 Tabelas Principais

### 1. user_profiles

Armazena perfis completos de usuários.

```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  phone_country_code TEXT DEFAULT '+55',Erro ao iniciar análise: Error: Processo não encontrado at Object.handler (file:///var/tmp/sb-compile-edge-runtime/source/index.ts:35:13) at eventLoopTick (ext:core/01_core.js:175:7) at async mapped (ext:runtime/http.js:242:18)
[bc3ed7dd] ❌ Erro ao buscar informações do processo: { code: "42703", details: null, hint: null, message: "column processos.numero_paginas does not exist" }
[bc3ed7dd] Iniciando análise para processo: 6cd50229-a490-4311-ac15-2845fc61fc70
booted (time: 25ms)
  oab TEXT,
  city TEXT,
  state TEXT,
  avatar_url TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  theme_preference TEXT DEFAULT 'dark',
  terms_accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Índices:**
```sql
CREATE INDEX idx_user_profiles_email ON user_profiles(email);
CREATE INDEX idx_user_profiles_is_admin ON user_profiles(is_admin) WHERE is_admin = TRUE;
```

**RLS Policies:**
```sql
-- Usuários veem apenas seu próprio perfil
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Usuários podem atualizar seu próprio perfil
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins veem todos os perfis
CREATE POLICY "Admins can view all profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );
```

### 2. processos

Tabela central do sistema. Armazena metadados e status de todos os processos.

```sql
CREATE TABLE processos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT,
  file_url TEXT,
  file_size BIGINT,
  status TEXT DEFAULT 'created' CHECK (
    status IN (
      'created',
      'uploading',
      'analyzing',
      'completed',
      'error'
    )
  ),

  -- PDF Storage
  pdf_base64 TEXT,
  pdf_size_bytes BIGINT,
  is_chunked BOOLEAN DEFAULT FALSE,
  total_chunks INTEGER DEFAULT 0,

  -- Gemini File API
  gemini_file_uri TEXT,
  gemini_file_name TEXT,
  gemini_file_state TEXT,
  gemini_file_mime_type TEXT,

  -- Análise Progress
  current_prompt_number INTEGER DEFAULT 0,
  total_prompts INTEGER DEFAULT 9,
  analysis_started_at TIMESTAMPTZ,
  analysis_completed_at TIMESTAMPTZ,

  -- Transcrição
  transcricao JSONB,

  -- Análises (campos legacy - movendo para analysis_results)
  visao_geral_processo JSONB,
  resumo_estrategico JSONB,
  comunicacoes_prazos JSONB,
  admissibilidade_recursal JSONB,
  estrategias_juridicas JSONB,
  riscos_alertas JSONB,
  balanco_financeiro JSONB,
  mapa_preclusoes JSONB,
  conclusoes_perspectivas JSONB,

  -- Metadata
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Índices Otimizados:**
```sql
-- Índice principal: buscar processos por usuário
CREATE INDEX idx_processos_user_id ON processos(user_id);

-- Índice para filtrar por status
CREATE INDEX idx_processos_status ON processos(status);

-- Índice composto para dashboard
CREATE INDEX idx_processos_user_status
  ON processos(user_id, status, created_at DESC);

-- Índice GIN para busca em JSONB
CREATE INDEX idx_processos_transcricao_gin
  ON processos USING GIN (transcricao);

-- Índice para análises concluídas
CREATE INDEX idx_processos_completed
  ON processos(user_id, analysis_completed_at)
  WHERE status = 'completed';
```

**RLS Policies:**
```sql
-- Usuários veem apenas seus processos
CREATE POLICY "Users can view own processos"
  ON processos FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Usuários podem inserir seus processos
CREATE POLICY "Users can insert own processos"
  ON processos FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Usuários podem atualizar seus processos
CREATE POLICY "Users can update own processos"
  ON processos FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Usuários podem deletar seus processos
CREATE POLICY "Users can delete own processos"
  ON processos FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins podem ver e atualizar todos os processos
CREATE POLICY "Admins can view all processos"
  ON processos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );
```

**Triggers:**
```sql
-- Atualizar updated_at automaticamente
CREATE TRIGGER update_processos_updated_at
  BEFORE UPDATE ON processos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Criar notificação quando processo completa
CREATE TRIGGER notify_processo_completed
  AFTER UPDATE ON processos
  FOR EACH ROW
  WHEN (
    OLD.status != 'completed' AND
    NEW.status = 'completed'
  )
  EXECUTE FUNCTION create_processo_completed_notification();
```

### 3. paginas

Armazena texto extraído por página do PDF (normalizado).

```sql
CREATE TABLE paginas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  processo_id UUID NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  text_content TEXT NOT NULL,
  confidence_score NUMERIC(5,2),
  word_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(processo_id, page_number)
);
```

**Índices:**
```sql
CREATE INDEX idx_paginas_processo_id ON paginas(processo_id);
CREATE INDEX idx_paginas_page_number ON paginas(processo_id, page_number);

-- Full-text search
CREATE INDEX idx_paginas_text_content_fts
  ON paginas USING GIN (to_tsvector('portuguese', text_content));
```

**RLS Policies:**
```sql
CREATE POLICY "Users can view pages of own processos"
  ON paginas FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM processos
      WHERE processos.id = paginas.processo_id
      AND processos.user_id = auth.uid()
    )
  );
```

### 4. analysis_prompts

Prompts versionados para análise forense.

```sql
CREATE TABLE analysis_prompts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  version TEXT NOT NULL,
  execution_order INTEGER NOT NULL,
  result_field_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(execution_order, is_active)
);
```

**Dados Iniciais:**
```sql
INSERT INTO analysis_prompts (title, execution_order, result_field_name, content) VALUES
  ('Visão Geral do Processo', 1, 'visao_geral_processo', '...'),
  ('Resumo Estratégico', 2, 'resumo_estrategico', '...'),
  ('Comunicações e Prazos', 3, 'comunicacoes_prazos', '...'),
  ('Admissibilidade Recursal', 4, 'admissibilidade_recursal', '...'),
  ('Estratégias Jurídicas', 5, 'estrategias_juridicas', '...'),
  ('Riscos e Alertas', 6, 'riscos_alertas', '...'),
  ('Balanço Financeiro', 7, 'balanco_financeiro', '...'),
  ('Mapa de Preclusões', 8, 'mapa_preclusoes', '...'),
  ('Conclusões e Perspectivas', 9, 'conclusoes_perspectivas', '...');
```

### 5. analysis_results

Resultados das análises de cada prompt.

```sql
CREATE TABLE analysis_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  processo_id UUID NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
  prompt_id UUID NOT NULL REFERENCES analysis_prompts(id),
  prompt_content TEXT,
  execution_order INTEGER NOT NULL,
  result JSONB NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (
    status IN ('pending', 'running', 'completed', 'failed')
  ),
  model_name TEXT,
  model_version TEXT,
  tokens_used INTEGER,
  execution_time_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  UNIQUE(processo_id, prompt_id)
);
```

**Índices:**
```sql
CREATE INDEX idx_analysis_results_processo ON analysis_results(processo_id);
CREATE INDEX idx_analysis_results_status ON analysis_results(status);

-- GIN para busca em resultados
CREATE INDEX idx_analysis_results_result_gin
  ON analysis_results USING GIN (result);
```

### 6. analysis_executions

Tracking detalhado de execuções de análise.

```sql
CREATE TABLE analysis_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  processo_id UUID NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
  prompt_id UUID NOT NULL REFERENCES analysis_prompts(id),
  model_name TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  execution_time_ms INTEGER,
  tokens_input INTEGER,
  tokens_output INTEGER,
  tokens_total INTEGER,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0
);
```

### 7. admin_system_models

Configuração de modelos de IA disponíveis.

```sql
CREATE TABLE admin_system_models (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'openai', 'anthropic')),
  version TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 0,
  max_input_tokens INTEGER,
  max_output_tokens INTEGER,
  supports_vision BOOLEAN DEFAULT FALSE,
  supports_streaming BOOLEAN DEFAULT FALSE,
  cost_per_1k_input NUMERIC(10,6),
  cost_per_1k_output NUMERIC(10,6),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Exemplo:**
```sql
INSERT INTO admin_system_models (
  name, display_name, provider, version,
  max_input_tokens, max_output_tokens
) VALUES (
  'gemini-2.0-flash-exp',
  'Gemini 2.0 Flash',
  'google',
  '2.0',
  1000000,
  8192
);
```

### 8. chat_messages

Histórico de conversas com IA sobre processos.

```sql
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  processo_id UUID NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  audio_url TEXT,
  audio_transcript TEXT,
  feedback TEXT CHECK (feedback IN ('positive', 'negative')),
  model_used TEXT,
  tokens_used INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Índices:**
```sql
CREATE INDEX idx_chat_messages_processo ON chat_messages(processo_id, created_at);
CREATE INDEX idx_chat_messages_user ON chat_messages(user_id, created_at);
```

### 9. notifications

Sistema de notificações em tempo real.

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (
    type IN ('success', 'error', 'warning', 'info')
  ),
  message TEXT NOT NULL,
  processo_id UUID REFERENCES processos(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Índices:**
```sql
CREATE INDEX idx_notifications_user_unread
  ON notifications(user_id, is_read, created_at DESC)
  WHERE is_read = FALSE;
```

### 10. Tabelas Stripe

#### stripe_customers
```sql
CREATE TABLE stripe_customers (
  customer_id TEXT PRIMARY KEY,
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
```

#### stripe_subscriptions
```sql
CREATE TABLE stripe_subscriptions (
  subscription_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES stripe_customers(customer_id),
  status TEXT NOT NULL,
  price_id TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  current_period_start BIGINT,
  current_period_end BIGINT,
  tokens_base INTEGER NOT NULL DEFAULT 0,
  tokens_extra INTEGER DEFAULT 0,
  tokens_total INTEGER GENERATED ALWAYS AS (tokens_base + tokens_extra) STORED,
  tokens_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
```

**Trigger para calcular tokens_total:**
```sql
CREATE TRIGGER calculate_tokens_total
  BEFORE INSERT OR UPDATE ON stripe_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION calculate_subscription_tokens_total();
```

### 11. token_usage_logs

Auditoria completa de uso de tokens.

```sql
CREATE TABLE token_usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  processo_id UUID REFERENCES processos(id) ON DELETE SET NULL,
  operation_type TEXT NOT NULL,
  tokens_used INTEGER NOT NULL,
  model_name TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Índices:**
```sql
CREATE INDEX idx_token_usage_logs_user ON token_usage_logs(user_id, created_at DESC);
CREATE INDEX idx_token_usage_logs_processo ON token_usage_logs(processo_id);
CREATE INDEX idx_token_usage_logs_operation ON token_usage_logs(operation_type);
```

### 12. pdf_chunks

Chunks de PDFs muito grandes (>50MB).

```sql
CREATE TABLE pdf_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  processo_id UUID NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
  chunk_number INTEGER NOT NULL,
  chunk_data TEXT NOT NULL,
  chunk_size_bytes INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(processo_id, chunk_number)
);
```

### 13. process_chunks

Chunks de processamento para PDFs gigantes (1000+ páginas).

```sql
CREATE TABLE process_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  processo_id UUID NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  total_chunks INTEGER NOT NULL,
  start_page INTEGER NOT NULL,
  end_page INTEGER NOT NULL,
  pages_count INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  gemini_file_uri TEXT,
  gemini_file_name TEXT,
  gemini_file_state TEXT,
  status TEXT DEFAULT 'pending' CHECK (
    status IN ('pending', 'uploading', 'processing', 'completed', 'error')
  ),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(processo_id, chunk_index)
);
```

## 🔧 Functions e Triggers

### Function: update_updated_at_column
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Function: create_processo_completed_notification
```sql
CREATE OR REPLACE FUNCTION create_processo_completed_notification()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (user_id, type, message, processo_id)
  VALUES (
    NEW.user_id,
    'success',
    'Análise do processo "' || NEW.file_name || '" concluída com sucesso!',
    NEW.id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Function: check_token_availability
```sql
CREATE OR REPLACE FUNCTION check_token_availability(
  p_user_id UUID,
  p_tokens_needed INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  v_tokens_available INTEGER;
BEGIN
  SELECT (s.tokens_total - s.tokens_used)
  INTO v_tokens_available
  FROM stripe_customers c
  JOIN stripe_subscriptions s ON s.customer_id = c.customer_id
  WHERE c.user_id = p_user_id
    AND s.status = 'active'
    AND s.deleted_at IS NULL;

  RETURN COALESCE(v_tokens_available, 0) >= p_tokens_needed;
END;
$$ LANGUAGE plpgsql;
```

## 📈 Views Úteis

### View: stripe_user_subscriptions
```sql
CREATE OR REPLACE VIEW stripe_user_subscriptions AS
SELECT
  s.*,
  c.user_id,
  c.email,
  (s.tokens_total - s.tokens_used) AS tokens_remaining,
  ROUND((s.tokens_used::NUMERIC / NULLIF(s.tokens_total, 0)) * 100, 2) AS usage_percentage
FROM stripe_subscriptions s
JOIN stripe_customers c ON c.customer_id = s.customer_id
WHERE s.deleted_at IS NULL;
```

## 🔍 Queries Úteis

### Processos órfãos (travados)
```sql
SELECT id, file_name, status, updated_at
FROM processos
WHERE status = 'analyzing'
  AND updated_at < NOW() - INTERVAL '30 minutes';
```

### Taxa de sucesso de análises
```sql
SELECT
  status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM processos
WHERE analysis_started_at IS NOT NULL
GROUP BY status;
```

### Usuários mais ativos
```sql
SELECT
  u.email,
  u.first_name,
  u.last_name,
  COUNT(p.id) as total_processos,
  SUM(CASE WHEN p.status = 'completed' THEN 1 ELSE 0 END) as completed
FROM user_profiles u
LEFT JOIN processos p ON p.user_id = u.id
GROUP BY u.id, u.email, u.first_name, u.last_name
ORDER BY total_processos DESC
LIMIT 20;
```

### Uso de tokens por usuário (mês atual)
```sql
SELECT
  u.email,
  SUM(t.tokens_used) as tokens_used_this_month,
  s.tokens_total as quota,
  (s.tokens_total - s.tokens_used) as remaining
FROM token_usage_logs t
JOIN user_profiles u ON u.id = t.user_id
LEFT JOIN stripe_customers c ON c.user_id = u.id
LEFT JOIN stripe_subscriptions s ON s.customer_id = c.customer_id
WHERE t.created_at >= DATE_TRUNC('month', CURRENT_DATE)
  AND s.status = 'active'
GROUP BY u.id, u.email, s.tokens_total, s.tokens_used
ORDER BY tokens_used_this_month DESC;
```

## 🛡️ Backup e Recovery

### Backup via Supabase
```bash
# Supabase faz backups automáticos diários
# Recovery via dashboard ou CLI
supabase db dump -f backup.sql
```

### Restore
```bash
psql -h db.xxx.supabase.co -U postgres -d postgres -f backup.sql
```

## 🔗 Próximos Documentos

- **[05-EDGE-FUNCTIONS.md](./05-EDGE-FUNCTIONS.md)** - Funções serverless
- **[08-SEGURANCA-RLS.md](./08-SEGURANCA-RLS.md)** - Segurança detalhada

---

**Banco de dados robusto, seguro e escalável**
