# Documentação Técnica - Sistema de Análise de Processos Jurídicos

> Documentação completa do sistema de análise automatizada de processos jurídicos com IA

## Sobre o Sistema

Sistema SaaS completo para análise automatizada de processos jurídicos usando Inteligência Artificial, com arquitetura escalável, processamento assíncrono e sistema de tokens/créditos.

**Stack Principal:**
- Frontend: React 18 + TypeScript + Vite + TailwindCSS
- Backend: Supabase (PostgreSQL + Edge Functions)
- IA: Google Gemini Pro 1.5
- Pagamentos: Stripe
- Storage: Supabase Storage + Google AI File API

---

## 📚 Índice Geral

### 1. Getting Started
Guias de início rápido e configuração inicial do ambiente.

- [Visão Geral do Sistema](./01-getting-started/overview.md)
- [Instalação e Setup Local](./01-getting-started/installation.md)
- [Configuração de Ambiente](./01-getting-started/environment-setup.md)
- [Primeiros Passos](./01-getting-started/quick-start.md)

[📖 Ver todos os guias](./01-getting-started/README.md)

---

### 2. Arquitetura
Visão geral da arquitetura do sistema e padrões de design.

- [Visão Geral da Arquitetura](./02-architecture/overview.md)
- [Fluxo de Dados](./02-architecture/data-flow.md)
- [Decisões Arquiteturais](./02-architecture/decisions.md)
- [Padrões e Convenções](./02-architecture/patterns.md)

[📖 Ver documentação completa](./02-architecture/README.md)

---

### 3. Database
Estrutura do banco de dados, schemas, migrações e RLS.

- [Schema do Banco de Dados](./03-database/schema.md)
- [Políticas RLS](./03-database/rls-policies.md)
- [Migrações](./03-database/migrations.md)
- [Triggers e Functions](./03-database/triggers.md)

[📖 Ver documentação completa](./03-database/README.md)

---

### 4. Autenticação
Sistema de autenticação, autorização e controle de acesso.

- [Overview de Autenticação](./04-authentication/overview.md)
- [Fluxo de Registro/Login](./04-authentication/auth-flow.md)
- [Gestão de Sessões](./04-authentication/session-management.md)
- [Sistema de Permissões](./04-authentication/permissions.md)

[📖 Ver documentação completa](./04-authentication/README.md)

---

### 5. Sistema de Análise
Core do sistema: processamento de PDFs e análise com IA.

- [Visão Geral do Sistema de Análise](./05-analysis/overview.md)
- [Upload e Processamento de PDFs](./05-analysis/pdf-processing.md)
- [Sistema de Chunks](./05-analysis/chunk-system.md)
- [Integração com Gemini](./05-analysis/gemini-integration.md)
- [Sistema de Prompts](./05-analysis/prompt-system.md)
- [Consolidação de Resultados](./05-analysis/consolidation.md)
- [Sistema de Chat](./05-analysis/chat-system.md)

[📖 Ver documentação completa](./05-analysis/README.md)

---

### 6. API Reference
Documentação completa das APIs e Edge Functions.

- [Edge Functions Overview](./06-api-reference/edge-functions.md)
- [API Endpoints](./06-api-reference/endpoints.md)
- [Schemas e Validações](./06-api-reference/schemas.md)
- [Exemplos de Uso](./06-api-reference/examples.md)

[📖 Ver documentação completa](./06-api-reference/README.md)

---

### 7. Frontend
Componentes, hooks, contextos e padrões do frontend.

- [Estrutura do Frontend](./07-frontend/structure.md)
- [Componentes Principais](./07-frontend/components.md)
- [Hooks e Utilities](./07-frontend/hooks.md)
- [Gerenciamento de Estado](./07-frontend/state-management.md)
- [Roteamento](./07-frontend/routing.md)

[📖 Ver documentação completa](./07-frontend/README.md)

---

### 8. Deployment
Guias de deploy, CI/CD e infraestrutura.

- [Deploy em Produção](./08-deployment/production.md)
- [CI/CD Pipeline](./08-deployment/cicd.md)
- [Configuração de Domínios](./08-deployment/domains.md)
- [Variáveis de Ambiente](./08-deployment/environment-variables.md)

[📖 Ver documentação completa](./08-deployment/README.md)

---

### 9. Monitoring
Monitoramento, logs, métricas e alertas.

- [Sistema de Logs](./09-monitoring/logging.md)
- [Métricas e Analytics](./09-monitoring/metrics.md)
- [Health Checks](./09-monitoring/health-checks.md)
- [Alertas e Notificações](./09-monitoring/alerts.md)

[📖 Ver documentação completa](./09-monitoring/README.md)

---

### 10. Troubleshooting
Guias de resolução de problemas e debugging.

- [Problemas Comuns](./10-troubleshooting/common-issues.md)
- [Debugging Guide](./10-troubleshooting/debugging.md)
- [Recovery Procedures](./10-troubleshooting/recovery.md)
- [FAQ](./10-troubleshooting/faq.md)

[📖 Ver documentação completa](./10-troubleshooting/README.md)

---

## 🤝 Contribuindo

Quer contribuir com o projeto? Leia nosso guia de contribuição:

- [Guia de Contribuição](./11-contributing/CONTRIBUTING.md)
- [Code Review Process](./11-contributing/code-review.md)
- [Style Guide](./11-contributing/style-guide.md)

---

## 📝 Changelog

Veja o histórico de mudanças e versões:

- [Changelog Completo](./12-changelog/CHANGELOG.md)

---

## 📖 Templates

Templates para documentação e desenvolvimento:

- [Template de Feature](./templates/feature-template.md)
- [Template de Bug Report](./templates/bug-report-template.md)
- [Template de API Docs](./templates/api-docs-template.md)

---

## 🔗 Links Úteis

- [Repositório GitHub](https://github.com/seu-repo)
- [Supabase Dashboard](https://app.supabase.com)
- [Google AI Studio](https://aistudio.google.com)
- [Stripe Dashboard](https://dashboard.stripe.com)

---

## 📞 Suporte

- Email: suporte@seudominio.com
- Documentação: [docs.seudominio.com](https://docs.seudominio.com)
- Issues: [GitHub Issues](https://github.com/seu-repo/issues)

---

**Última Atualização:** 2025-12-17
**Versão da Documentação:** 1.0.0
