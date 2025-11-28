# WisLegal - Documentação Técnica Completa

## Visão Geral

Esta é a documentação técnica completa do sistema **WisLegal**, uma plataforma profissional de análise forense digital de documentos jurídicos. A plataforma utiliza inteligência artificial avançada para processar, transcrever e analisar processos jurídicos de forma automatizada e escalável.

## Sumário da Documentação

### 1. Fundamentos do Sistema
- **[01-VISAO-GERAL.md](./01-VISAO-GERAL.md)** - Visão geral do projeto, objetivos e principais funcionalidades
- **[02-ARQUITETURA.md](./02-ARQUITETURA.md)** - Arquitetura completa do sistema e stack tecnológico
- **[03-ESTRUTURA-PROJETO.md](./03-ESTRUTURA-PROJETO.md)** - Organização do código e estrutura de pastas

### 2. Backend e Dados
- **[04-BANCO-DE-DADOS.md](./04-BANCO-DE-DADOS.md)** - Schema completo do banco de dados PostgreSQL
- **[05-EDGE-FUNCTIONS.md](./05-EDGE-FUNCTIONS.md)** - Documentação de todas as Edge Functions
- **[06-INTEGRACOES-GCP.md](./06-INTEGRACOES-GCP.md)** - Integrações com Google Cloud Platform

### 3. Autenticação e Segurança
- **[07-AUTENTICACAO.md](./07-AUTENTICACAO.md)** - Sistema de autenticação e autorização
- **[08-SEGURANCA-RLS.md](./08-SEGURANCA-RLS.md)** - Row Level Security e políticas de segurança

### 4. Fluxos de Processamento
- **[09-FLUXO-UPLOAD.md](./09-FLUXO-UPLOAD.md)** - Fluxo de upload e armazenamento de documentos
- **[10-FLUXO-ANALISE.md](./10-FLUXO-ANALISE.md)** - Fluxo completo de análise forense
- **[11-SISTEMA-PROMPTS.md](./11-SISTEMA-PROMPTS.md)** - Sistema de prompts de IA versionados

### 5. Frontend e Interface
- **[12-COMPONENTES-UI.md](./12-COMPONENTES-UI.md)** - Catálogo completo de componentes React
- **[13-PAGINAS-ROTAS.md](./13-PAGINAS-ROTAS.md)** - Páginas e sistema de rotas
- **[14-CONTEXTS-HOOKS.md](./14-CONTEXTS-HOOKS.md)** - Contexts e hooks customizados

### 6. Funcionalidades Específicas
- **[15-SISTEMA-TOKENS.md](./15-SISTEMA-TOKENS.md)** - Sistema de tokens e monetização
- **[16-SISTEMA-NOTIFICACOES.md](./16-SISTEMA-NOTIFICACOES.md)** - Notificações em tempo real
- **[17-SISTEMA-CHAT.md](./17-SISTEMA-CHAT.md)** - Chat com IA sobre processos
- **[18-PAINEL-ADMIN.md](./18-PAINEL-ADMIN.md)** - Painel administrativo completo

### 7. Serviços e Lógica de Negócio
- **[19-SERVICOS.md](./19-SERVICOS.md)** - Serviços e lógica de negócio
- **[20-UTILITARIOS.md](./20-UTILITARIOS.md)** - Utilitários e workers

### 8. Design e Experiência
- **[21-DESIGN-SYSTEM.md](./21-DESIGN-SYSTEM.md)** - Design system e estilos
- **[22-UX-PATTERNS.md](./22-UX-PATTERNS.md)** - Padrões de UX e jornadas do usuário
- **[23-UI-GUIDELINES.md](./23-UI-GUIDELINES.md)** - Guidelines de interface

### 9. Performance e Qualidade
- **[24-PERFORMANCE.md](./24-PERFORMANCE.md)** - Otimizações e performance
- **[25-TESTES-QA.md](./25-TESTES-QA.md)** - Estratégias de testes e QA

### 10. Operações e Manutenção
- **[26-DEPLOY-DEVOPS.md](./26-DEPLOY-DEVOPS.md)** - Deploy e DevOps
- **[27-MONITORAMENTO.md](./27-MONITORAMENTO.md)** - Monitoramento e logging
- **[28-TROUBLESHOOTING.md](./28-TROUBLESHOOTING.md)** - Guia de troubleshooting

### 11. Desenvolvimento
- **[29-GUIA-DESENVOLVIMENTO.md](./29-GUIA-DESENVOLVIMENTO.md)** - Guia para desenvolvedores
- **[30-API-REFERENCE.md](./30-API-REFERENCE.md)** - Referência completa de APIs

## Informações Rápidas

### Stack Tecnológico Principal

**Frontend:**
- React 18.3.1 + TypeScript 5.5.3
- Vite 5.4.2 (Build tool)
- Tailwind CSS 3.4.1
- React Router DOM 7.9.4
- Lucide React (Ícones)

**Backend:**
- Supabase (PostgreSQL + Realtime + Storage + Auth)
- Edge Functions (Deno Runtime)
- Row Level Security (RLS)

**Inteligência Artificial:**
- Google Gemini 2.0 Flash (Análise forense)
- Google Document AI (OCR de alta precisão)
- Google Cloud Storage (Armazenamento escalável)

**Pagamentos:**
- Stripe (Checkout, Subscriptions, Webhooks)

**Bibliotecas Especializadas:**
- PDF.js 4.4.168 (Visualização de PDFs)
- pdf-lib 1.17.1 (Manipulação de PDFs)
- recharts 3.2.1 (Gráficos e visualizações)
- react-select 5.10.2 (Seleção avançada)

### Métricas do Projeto

- **108 arquivos TypeScript/React**
- **40+ componentes React**
- **15 Edge Functions**
- **10.231 linhas de SQL** (migrações)
- **25+ páginas e rotas**
- **10+ serviços de lógica de negócio**

### Principais Funcionalidades

1. Upload e processamento de PDFs (até 3GB)
2. OCR de alta precisão com Google Document AI
3. Análise forense inteligente com IA
4. Chat contextual sobre processos
5. Sistema de tokens e monetização
6. Painel administrativo completo
7. Notificações em tempo real
8. Sistema de autenticação robusto
9. Suporte a múltiplas áreas do direito
10. Exportação de análises em DOCX

## Como Navegar Esta Documentação

### Para Desenvolvedores Iniciantes
1. Comece pela [Visão Geral](./01-VISAO-GERAL.md)
2. Leia a [Arquitetura](./02-ARQUITETURA.md)
3. Configure seu ambiente com o [Guia de Desenvolvimento](./29-GUIA-DESENVOLVIMENTO.md)
4. Explore os [Componentes UI](./12-COMPONENTES-UI.md)

### Para Desenvolvedores Backend
1. Estude o [Banco de Dados](./04-BANCO-DE-DADOS.md)
2. Entenda as [Edge Functions](./05-EDGE-FUNCTIONS.md)
3. Conheça o [Sistema de Segurança](./08-SEGURANCA-RLS.md)
4. Explore os [Serviços](./19-SERVICOS.md)

### Para Desenvolvedores Frontend
1. Veja o [Design System](./21-DESIGN-SYSTEM.md)
2. Estude os [Componentes](./12-COMPONENTES-UI.md)
3. Entenda [Contexts e Hooks](./14-CONTEXTS-HOOKS.md)
4. Siga as [UI Guidelines](./23-UI-GUIDELINES.md)

### Para Arquitetos e Tech Leads
1. Analise a [Arquitetura Completa](./02-ARQUITETURA.md)
2. Revise as [Integrações GCP](./06-INTEGRACOES-GCP.md)
3. Estude os [Fluxos de Processamento](./10-FLUXO-ANALISE.md)
4. Avalie [Performance](./24-PERFORMANCE.md)

### Para DevOps e SRE
1. Configure [Deploy](./26-DEPLOY-DEVOPS.md)
2. Implemente [Monitoramento](./27-MONITORAMENTO.md)
3. Estude [Troubleshooting](./28-TROUBLESHOOTING.md)

### Para Product Managers
1. Entenda a [Visão Geral](./01-VISAO-GERAL.md)
2. Conheça os [Padrões de UX](./22-UX-PATTERNS.md)
3. Veja o [Sistema de Tokens](./15-SISTEMA-TOKENS.md)
4. Explore o [Painel Admin](./18-PAINEL-ADMIN.md)

## Convenções de Documentação

### Símbolos e Ícones
- 📋 Conceito ou definição
- 🔧 Configuração ou setup
- 💡 Dica ou best practice
- ⚠️ Atenção ou cuidado
- ❌ Erro comum ou anti-pattern
- ✅ Prática recomendada
- 🚀 Performance ou otimização
- 🔒 Segurança
- 📊 Dados ou métricas
- 🎨 Design ou UI/UX

### Código e Exemplos
Todos os exemplos de código incluem:
- Linguagem identificada (typescript, sql, bash, etc)
- Comentários explicativos
- Contexto de uso
- Links para arquivos originais quando aplicável

### Diagramas
- Diagramas de arquitetura em formato Mermaid
- Fluxogramas de processos
- Diagramas de sequência
- Esquemas de banco de dados

## Manutenção da Documentação

Esta documentação deve ser atualizada sempre que:
- Novos recursos forem adicionados
- Arquitetura for modificada
- APIs forem alteradas
- Processos críticos mudarem
- Novas integrações forem implementadas

**Última atualização:** Outubro 2025
**Versão do projeto:** 3.0
**Versão da documentação:** 1.0

## Contato e Suporte

Para dúvidas sobre a documentação ou o projeto:
1. Consulte o [Troubleshooting](./28-TROUBLESHOOTING.md)
2. Revise a documentação específica do tópico
3. Entre em contato com a equipe de desenvolvimento

---

**WisLegal** - Análise Forense Digital Inteligente
© 2025 - Documentação Técnica Completa
