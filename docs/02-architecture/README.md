# Arquitetura

Documentação completa da arquitetura do sistema.

## 📋 Documentos Nesta Seção

### [Visão Geral da Arquitetura](./overview.md)
Visão geral da arquitetura do sistema, componentes principais e suas interações.

**Tópicos:**
- Diagrama de arquitetura geral
- Camadas da aplicação
- Componentes principais
- Tecnologias utilizadas

---

### [Fluxo de Dados](./data-flow.md)
Como os dados fluem através do sistema.

**Tópicos:**
- Fluxo de upload de PDF
- Fluxo de análise com IA
- Fluxo de consolidação
- Fluxo de chat
- Fluxo de tokens/créditos

---

### [Decisões Arquiteturais](./decisions.md)
Documentação das principais decisões de arquitetura (ADRs).

**Tópicos:**
- Por que Supabase?
- Por que Google Gemini?
- Sistema de chunks
- Processamento assíncrono
- Sistema de tokens vs assinatura

---

### [Padrões e Convenções](./patterns.md)
Padrões de código e convenções do projeto.

**Tópicos:**
- Estrutura de arquivos
- Naming conventions
- Padrões de componentes React
- Padrões de serviços
- Padrões de Edge Functions
- Tratamento de erros

---

## 🏗️ Componentes Principais

### Frontend
- React 18 + TypeScript
- Vite como bundler
- TailwindCSS para styling
- React Router para navegação

### Backend
- Supabase (PostgreSQL)
- Edge Functions (Deno)
- Row Level Security (RLS)
- Triggers e Functions

### Serviços Externos
- Google Gemini Pro 1.5
- Stripe para pagamentos
- Supabase Storage
- Google AI File API

---

## 📊 Diagramas

### Arquitetura de Alto Nível
```
┌─────────────┐
│   Frontend  │
│  (React)    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Supabase   │
│  - Auth     │
│  - Database │
│  - Storage  │
│  - Edge Fn  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  External   │
│  - Gemini   │
│  - Stripe   │
└─────────────┘
```

---

## 🔗 Links Relacionados

- [Database Schema](../03-database/README.md)
- [Sistema de Análise](../05-analysis/README.md)
- [Frontend](../07-frontend/README.md)

---

[← Voltar ao Índice Principal](../README.md)
