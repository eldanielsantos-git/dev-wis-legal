# Visão Geral do Sistema

Sistema SaaS completo para análise automatizada de processos jurídicos usando Inteligência Artificial.

## O Que é o Sistema?

Este sistema permite que advogados, escritórios jurídicos e profissionais do direito façam upload de processos judiciais em PDF e recebam análises estruturadas e detalhadas geradas por IA, além de poderem interagir via chat com o conteúdo dos processos.

### Problema que Resolve

- **Análise Manual Demorada**: Ler e analisar centenas de páginas de processos consome muito tempo
- **Risco de Informações Perdidas**: É fácil perder detalhes importantes em processos extensos
- **Falta de Estruturação**: Informações dispersas dificultam tomada de decisão
- **Consulta Ineficiente**: Procurar informações específicas em PDFs grandes é trabalhoso

### Solução Oferecida

- **Análise Automatizada**: IA processa o processo e gera análise estruturada em minutos
- **10 Tipos de Análise**: Diferentes perspectivas do mesmo processo
- **Chat Inteligente**: Faça perguntas sobre o processo e receba respostas contextualizadas
- **Compartilhamento**: Compartilhe análises com equipe ou clientes
- **Histórico**: Todas as análises ficam salvas e acessíveis

---

## Funcionalidades Principais

### 1. Upload e Processamento de PDFs

- Suporte a PDFs de até **5000 páginas**
- Extração automática de texto
- Processamento em chunks para arquivos grandes
- Progress tracking em tempo real

### 2. Sistema de Análise com IA

**10 Tipos de Análise Disponíveis:**

1. **Visão Geral do Processo**
   - Identificação básica
   - Partes envolvidas
   - Timeline de eventos

2. **Resumo Estratégico**
   - Principais questões jurídicas
   - Argumentos centrais
   - Posicionamento das partes

3. **Comunicações e Prazos**
   - Prazos processuais
   - Intimações pendentes
   - Datas importantes

4. **Riscos e Alertas**
   - Pontos críticos
   - Vulnerabilidades
   - Recomendações urgentes

5. **Estratégias Jurídicas**
   - Linhas de defesa/ataque
   - Jurisprudência aplicável
   - Precedentes relevantes

6. **Balanço Financeiro**
   - Valores em discussão
   - Custas processuais
   - Estimativa de exposição

7. **Admissibilidade Recursal**
   - Análise de requisitos
   - Chances de êxito
   - Estratégia recursal

8. **Mapa de Preclusões**
   - Oportunidades perdidas
   - Prazos vencidos
   - Atos precluso

9. **Conclusões e Perspectivas**
   - Cenários possíveis
   - Probabilidades
   - Recomendações finais

10. **Análise Forense**
    - Investigação profunda
    - Conexões não óbvias
    - Insights avançados

### 3. Chat Interativo

- Faça perguntas em linguagem natural sobre o processo
- Respostas contextualizadas baseadas no conteúdo
- Histórico de conversas salvo
- Suporte a áudio (speech-to-text)

### 4. Sistema de Tokens/Créditos

**Modelo de Negócio:**
- Tokens são consumidos na análise e no chat
- 3 planos de assinatura: Free, Pro, Enterprise
- Compra avulsa de pacotes de tokens
- Tokens mensais + rollover parcial

**Consumo de Tokens:**
- Análise simples: ~10-50k tokens
- Análise complexa: ~50-200k tokens
- Chat: ~100-1000 tokens por mensagem

### 5. Compartilhamento e Colaboração

- Compartilhe processos com outros usuários
- Permissões: read-only ou full access
- Convide membros para workspace
- Sistema de notificações

### 6. Sistema de Tags

- Organize processos com tags customizadas
- Cores personalizáveis
- Filtros avançados
- Tags compartilhadas no workspace

### 7. Busca Inteligente

- Busca no conteúdo dos processos
- Filtros por status, tags, data
- Busca semântica (em desenvolvimento)

---

## Stack Tecnológico

### Frontend

**Core:**
- React 18
- TypeScript
- Vite (bundler)
- React Router v7

**UI/Styling:**
- TailwindCSS
- Lucide Icons
- Recharts (gráficos)

**Libraries:**
- pdf.js (visualização)
- pdf-lib (manipulação)

### Backend

**Supabase:**
- PostgreSQL (database)
- Edge Functions (Deno)
- Authentication
- Storage
- Row Level Security (RLS)

**Integrações:**
- Google Gemini Pro 1.5 (IA)
- Stripe (pagamentos)
- Resend (emails)

### Infraestrutura

**Hosting:**
- Frontend: Netlify
- Backend: Supabase Cloud
- Storage: Supabase + Google AI File API

**CI/CD:**
- GitHub Actions
- Automated workflows

---

## Arquitetura de Alto Nível

```
┌─────────────────────────────────────────────┐
│           FRONTEND (React + Vite)           │
│  - Upload de PDF                            │
│  - Visualização de análises                 │
│  - Chat interface                           │
│  - Admin dashboard                          │
└──────────────────┬──────────────────────────┘
                   │ HTTPS/REST
                   ▼
┌─────────────────────────────────────────────┐
│         SUPABASE (Backend Platform)         │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  PostgreSQL Database                │   │
│  │  - Processos, chunks, análises      │   │
│  │  - Usuários, tokens, assinaturas    │   │
│  │  - RLS policies                     │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  Edge Functions (Deno)              │   │
│  │  - start-analysis                   │   │
│  │  - process-next-prompt (worker)     │   │
│  │  - consolidation-worker             │   │
│  │  - chat-with-processo               │   │
│  │  - stripe-webhook                   │   │
│  │  - email functions                  │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  Storage                            │   │
│  │  - PDFs originais                   │   │
│  └─────────────────────────────────────┘   │
└──────────────────┬──────────────────────────┘
                   │
      ┌────────────┼────────────┐
      │            │            │
      ▼            ▼            ▼
┌──────────┐ ┌──────────┐ ┌──────────┐
│  Google  │ │  Stripe  │ │  Resend  │
│  Gemini  │ │          │ │  (Email) │
└──────────┘ └──────────┘ └──────────┘
```

---

## Fluxo de Uso Típico

### 1. Registro e Configuração
```
Usuário → Sign Up → Verificação Email → Dashboard
```

### 2. Análise de Processo
```
Upload PDF → Extração → Chunking → Análise IA → Consolidação → Resultado
```

### 3. Chat com Processo
```
Processo Analisado → Chat Interface → Pergunta → Resposta IA → Histórico
```

---

## Público-Alvo

### Primário
- **Advogados**: Análise rápida de processos
- **Escritórios de Advocacia**: Gestão de múltiplos processos
- **Departamentos Jurídicos**: Análise em larga escala

### Secundário
- **Estudantes de Direito**: Estudo de casos
- **Consultores Jurídicos**: Pareceres técnicos
- **Peritos**: Análise forense de processos

---

## Diferenciais

### 1. Análise Estruturada
Não é apenas um resumo: são 10 tipos diferentes de análise, cada uma focada em aspectos específicos.

### 2. Processamento de Arquivos Grandes
Suporta PDFs de até 5000 páginas com sistema de chunks inteligente.

### 3. Chat Contextualizado
Chat que realmente entende o contexto do processo, não apenas busca por palavras-chave.

### 4. Sistema de Tokens Flexível
Modelo híbrido: assinatura mensal + compra avulsa de tokens.

### 5. Segurança e Privacidade
- Dados criptografados
- Row Level Security
- Compliance com LGPD
- Não treina IA com dados dos usuários

---

## Métricas de Performance

### Tempo de Processamento
- Processo pequeno (< 100 páginas): 2-5 minutos
- Processo médio (100-500 páginas): 5-15 minutos
- Processo grande (500-1000 páginas): 15-30 minutos
- Processo muito grande (1000-5000 páginas): 30-120 minutos

### Qualidade
- Precisão das análises: Baseada em Gemini Pro 1.5
- Taxa de sucesso: > 95%
- Taxa de retry automático: < 5%

### Disponibilidade
- Uptime: > 99.5%
- Suporte: Email e chat
- SLA: Conforme plano contratado

---

## Limitações Conhecidas

### Técnicas
- Apenas PDFs (DOCX em desenvolvimento)
- Idioma: Português (outros idiomas em testes)
- Máximo 5000 páginas por processo

### Funcionais
- Análise depende da qualidade do PDF
- PDFs escaneados (imagem) têm menor precisão
- Documentos muito técnicos podem ter gaps

---

## Roadmap

### Próximas Features
- Suporte a DOCX
- Análise multi-idioma
- API pública
- Integrações (Drive, Dropbox)
- Mobile app
- Análise comparativa de processos

### Em Desenvolvimento
- Busca semântica
- Sugestões automáticas de petições
- Template de documentos
- Analytics avançado

---

## Links Úteis

- [Instalação](./installation.md)
- [Configuração de Ambiente](./environment-setup.md)
- [Quick Start](./quick-start.md)
- [Arquitetura Completa](../02-architecture/overview.md)
- [API Reference](../06-api-reference/README.md)

---

[← Voltar ao Getting Started](./README.md) | [Próximo: Instalação →](./installation.md)
