# Database

Documentação completa do banco de dados PostgreSQL.

## 📋 Documentos Nesta Seção

### [Schema do Banco de Dados](./schema.md)
Estrutura completa das tabelas, colunas, tipos e relacionamentos.

**Tópicos:**
- Tabelas principais
- Relacionamentos (FK)
- Tipos de dados
- Índices
- Constraints

---

### [Políticas RLS](./rls-policies.md)
Row Level Security: políticas de acesso e segurança.

**Tópicos:**
- O que é RLS
- Políticas por tabela
- Políticas de SELECT
- Políticas de INSERT/UPDATE/DELETE
- Políticas de compartilhamento

---

### [Migrações](./migrations.md)
Gerenciamento de migrações e versionamento do schema.

**Tópicos:**
- Como criar migrações
- Histórico de migrações
- Rollback de migrações
- Boas práticas

---

### [Triggers e Functions](./triggers.md)
Database triggers e stored procedures.

**Tópicos:**
- Triggers automáticos
- Functions utilitárias
- Validações no banco
- Cálculos automáticos

---

## 🗃️ Principais Tabelas

### Core
- `processos` - Processos jurídicos
- `chunks` - Pedaços de texto para análise
- `analysis_results` - Resultados de análise
- `chat_messages` - Mensagens de chat

### Autenticação e Usuários
- `users` (auth.users - Supabase)
- `user_preferences` - Preferências do usuário
- `user_achievements` - Conquistas

### Sistema de Tokens
- `token_balance` - Saldo de tokens
- `token_transactions` - Histórico de transações
- `token_reservations` - Reservas de tokens
- `subscriptions` - Assinaturas

### Administração
- `analysis_prompts` - Prompts de análise
- `chat_system_prompts` - Prompts do chat
- `system_models` - Configuração de modelos IA

---

## 🔐 Segurança

Todo acesso ao banco é protegido por:
- **RLS (Row Level Security)** - Controle fino de acesso
- **Policies** - Regras por operação (SELECT/INSERT/UPDATE/DELETE)
- **auth.uid()** - Identificação do usuário
- **JWT tokens** - Autenticação via Supabase

---

## 🔗 Links Relacionados

- [Autenticação](../04-authentication/README.md)
- [Sistema de Análise](../05-analysis/README.md)
- [API Reference](../06-api-reference/README.md)

---

[← Voltar ao Índice Principal](../README.md)
