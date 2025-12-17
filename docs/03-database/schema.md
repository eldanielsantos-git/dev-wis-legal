# Database Schema

Schema completo do banco de dados PostgreSQL.

## Tabelas Principais

### processos
Armazena informações dos processos judiciais.

```sql
CREATE TABLE processos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  numero_processo text NOT NULL,
  nome text,
  descricao text,
  pdf_path text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  progress integer DEFAULT 0,
  total_pages integer,
  total_tokens integer,
  gemini_file_uri text,
  analysis_type text DEFAULT 'simple',
  is_shared boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX idx_processos_user_id ON processos(user_id);
CREATE INDEX idx_processos_status ON processos(status);
```

### chunks
Pedaços de texto para processamento paralelo.

```sql
CREATE TABLE chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid REFERENCES processos ON DELETE CASCADE,
  content text NOT NULL,
  sequence integer NOT NULL,
  status text DEFAULT 'pending',
  retry_count integer DEFAULT 0,
  error_message text,
  dead_letter_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_chunks_processo_id ON chunks(processo_id);
CREATE INDEX idx_chunks_status ON chunks(status);
CREATE INDEX idx_chunks_dead_letter ON chunks(dead_letter_at) WHERE dead_letter_at IS NOT NULL;
```

### analysis_results
Resultados das análises geradas pela IA.

```sql
CREATE TABLE analysis_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid REFERENCES processos ON DELETE CASCADE,
  chunk_id uuid REFERENCES chunks,
  analysis_type text NOT NULL,
  content jsonb NOT NULL,
  is_final boolean DEFAULT false,
  tokens_used integer,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_analysis_results_processo_id ON analysis_results(processo_id);
CREATE INDEX idx_analysis_results_type ON analysis_results(analysis_type);
CREATE INDEX idx_analysis_results_final ON analysis_results(is_final) WHERE is_final = true;
```

### chat_messages
Histórico de mensagens do chat.

```sql
CREATE TABLE chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid REFERENCES processos ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users NOT NULL,
  role text NOT NULL, -- 'user' ou 'assistant'
  content text NOT NULL,
  tokens_used integer,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_chat_messages_processo_id ON chat_messages(processo_id);
CREATE INDEX idx_chat_messages_user_id ON chat_messages(user_id);
```

### token_balance
Saldo de tokens dos usuários.

```sql
CREATE TABLE token_balance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users UNIQUE NOT NULL,
  available_tokens bigint DEFAULT 0,
  reserved_tokens bigint DEFAULT 0,
  lifetime_tokens bigint DEFAULT 0,
  last_reset_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_token_balance_user_id ON token_balance(user_id);
```

### token_transactions
Histórico de transações de tokens.

```sql
CREATE TABLE token_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  amount bigint NOT NULL,
  type text NOT NULL, -- 'purchase', 'monthly', 'usage', 'refund'
  description text,
  processo_id uuid REFERENCES processos,
  stripe_payment_id text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_token_transactions_user_id ON token_transactions(user_id);
CREATE INDEX idx_token_transactions_type ON token_transactions(type);
```

### token_reservations
Reservas temporárias de tokens para análises em andamento.

```sql
CREATE TABLE token_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  processo_id uuid REFERENCES processos NOT NULL,
  reserved_amount bigint NOT NULL,
  actual_used bigint DEFAULT 0,
  status text DEFAULT 'active', -- 'active', 'completed', 'refunded'
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX idx_token_reservations_user_id ON token_reservations(user_id);
CREATE INDEX idx_token_reservations_processo_id ON token_reservations(processo_id);
CREATE INDEX idx_token_reservations_status ON token_reservations(status);
```

### subscriptions
Assinaturas dos usuários (sincronizada com Stripe).

```sql
CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users UNIQUE NOT NULL,
  stripe_customer_id text NOT NULL,
  stripe_subscription_id text UNIQUE,
  stripe_price_id text,
  status text NOT NULL, -- 'active', 'canceled', 'past_due'
  tier text NOT NULL DEFAULT 'free', -- 'free', 'pro', 'enterprise'
  monthly_tokens bigint DEFAULT 10000,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
```

### processo_shares
Compartilhamento de processos entre usuários.

```sql
CREATE TABLE processo_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid REFERENCES processos ON DELETE CASCADE,
  shared_by_user_id uuid REFERENCES auth.users NOT NULL,
  shared_with_email text NOT NULL,
  shared_with_user_id uuid REFERENCES auth.users,
  permission text DEFAULT 'readonly', -- 'readonly', 'fullaccess'
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_processo_shares_processo_id ON processo_shares(processo_id);
CREATE INDEX idx_processo_shares_shared_with ON processo_shares(shared_with_user_id);
```

### user_preferences
Preferências do usuário.

```sql
CREATE TABLE user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users UNIQUE NOT NULL,
  theme text DEFAULT 'light',
  language text DEFAULT 'pt-BR',
  notifications_enabled boolean DEFAULT true,
  email_notifications boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### analysis_prompts
Prompts de análise (gerenciado por admin).

```sql
CREATE TABLE analysis_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  category text NOT NULL,
  prompt_text text NOT NULL,
  version integer DEFAULT 1,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### chat_system_prompts
Prompts do sistema de chat.

```sql
CREATE TABLE chat_system_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  prompt_text text NOT NULL,
  version integer DEFAULT 1,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### system_models
Configuração de modelos de IA.

```sql
CREATE TABLE system_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  provider text NOT NULL, -- 'gemini', 'openai', etc
  model_id text NOT NULL,
  context_length integer,
  input_cost_per_token numeric,
  output_cost_per_token numeric,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### processo_tags
Tags para organização de processos.

```sql
CREATE TABLE processo_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  name text NOT NULL,
  color text DEFAULT '#3B82F6',
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, name)
);
```

### processo_tag_assignments
Relacionamento entre processos e tags.

```sql
CREATE TABLE processo_tag_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid REFERENCES processos ON DELETE CASCADE,
  tag_id uuid REFERENCES processo_tags ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(processo_id, tag_id)
);
```

### token_limit_notifications
Notificações de limite de tokens.

```sql
CREATE TABLE token_limit_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  notification_type text NOT NULL,
  notified_at timestamptz DEFAULT now()
);
```

## Relacionamentos

```
auth.users (Supabase Auth)
  ├── 1:1 → token_balance
  ├── 1:1 → subscriptions
  ├── 1:1 → user_preferences
  ├── 1:N → processos
  ├── 1:N → token_transactions
  ├── 1:N → chat_messages
  └── 1:N → processo_tags

processos
  ├── 1:N → chunks
  ├── 1:N → analysis_results
  ├── 1:N → chat_messages
  ├── 1:N → token_reservations
  ├── 1:N → processo_shares
  └── N:M → processo_tags (via processo_tag_assignments)

chunks
  └── 1:N → analysis_results
```

## Triggers

### update_updated_at_column
Atualiza automaticamente o campo `updated_at`.

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';
```

Aplicado em: `processos`, `token_balance`, `subscriptions`, `user_preferences`, etc.

### on_auth_user_created
Cria registros iniciais quando usuário é criado.

```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
```

Cria:
- `token_balance` com 10k tokens (Free plan)
- `user_preferences` com defaults

---

## RLS Policies

Todas as tabelas têm RLS habilitado. Ver [RLS Policies](./rls-policies.md) para detalhes.

---

[← Voltar ao Database](./README.md) | [Próximo: RLS Policies →](./rls-policies.md)
