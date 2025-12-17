# Autenticação e Autorização

Sistema de autenticação, sessões e controle de acesso.

## 📋 Documentos Nesta Seção

### [Overview de Autenticação](./overview.md)
Visão geral do sistema de autenticação.

**Tópicos:**
- Supabase Auth
- Email/Password authentication
- JWT tokens
- Refresh tokens

---

### [Fluxo de Registro/Login](./auth-flow.md)
Fluxos completos de registro e login.

**Tópicos:**
- Fluxo de sign up
- Verificação de email
- Fluxo de sign in
- Recuperação de senha
- Logout

---

### [Gestão de Sessões](./session-management.md)
Como sessões são gerenciadas e mantidas.

**Tópicos:**
- Storage de sessões
- Refresh automático
- Expiração de sessões
- Multi-device sessions

---

### [Sistema de Permissões](./permissions.md)
Controle de acesso e permissões.

**Tópicos:**
- Roles (user, admin)
- Permissões por recurso
- Compartilhamento de processos
- Read-only vs full access

---

## 🔐 Segurança

### Autenticação
- Email/Password via Supabase Auth
- JWT tokens assinados
- Tokens de refresh seguros
- HTTPS obrigatório

### Autorização
- RLS no banco de dados
- Verificação de propriedade
- Políticas por tabela
- Validação server-side

---

## 🔑 Fluxos Principais

### Registro
1. Usuário preenche formulário
2. Validação de senha forte
3. Criação de conta no Supabase Auth
4. Email de verificação enviado
5. Criação de registros relacionados (token_balance, etc)

### Login
1. Usuário envia credenciais
2. Supabase valida credenciais
3. JWT token gerado
4. Session estabelecida
5. Redirecionamento para dashboard

### Recuperação de Senha
1. Usuário solicita reset
2. Email com link enviado
3. Usuário clica no link
4. Nova senha definida
5. Login automático

---

## 🔗 Links Relacionados

- [Database RLS](../03-database/rls-policies.md)
- [Frontend Context](../07-frontend/state-management.md)
- [API Security](../06-api-reference/README.md)

---

[← Voltar ao Índice Principal](../README.md)
