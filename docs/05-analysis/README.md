# Sistema de Análise

Core do sistema: processamento de PDFs e análise com IA.

## 📋 Documentos Nesta Seção

### [Visão Geral do Sistema de Análise](./overview.md)
Introdução ao sistema de análise e seus componentes.

**Tópicos:**
- Arquitetura do sistema de análise
- Pipeline de processamento
- Componentes principais
- Fluxo end-to-end

---

### [Upload e Processamento de PDFs](./pdf-processing.md)
Como PDFs são carregados e processados.

**Tópicos:**
- Upload para Supabase Storage
- Extração de texto com pdf.js
- Upload para Google AI File API
- Validações e limitações

---

### [Sistema de Chunks](./chunk-system.md)
Divisão de documentos grandes em pedaços processáveis.

**Tópicos:**
- Por que chunks?
- Estratégia de divisão
- Armazenamento de chunks
- Processamento paralelo
- Dead letter queue

---

### [Integração com Gemini](./gemini-integration.md)
Como o Google Gemini é usado para análise.

**Tópicos:**
- API do Gemini
- File API
- Context caching
- Rate limiting
- Custos e otimização

---

### [Sistema de Prompts](./prompt-system.md)
Gerenciamento e versionamento de prompts.

**Tópicos:**
- Prompts de análise
- Prompts de chat
- Versionamento
- Testes de prompts
- Admin panel

---

### [Consolidação de Resultados](./consolidation.md)
Como resultados parciais são consolidados.

**Tópicos:**
- Consolidation worker
- Estratégia de merge
- Validação de JSON
- Formatação final

---

### [Sistema de Chat](./chat-system.md)
Chat interativo sobre processos analisados.

**Tópicos:**
- Arquitetura do chat
- Context management
- Streaming de respostas
- Histórico de mensagens

---

## 🔄 Pipeline de Análise

```
1. Upload PDF
   ↓
2. Extração de Texto
   ↓
3. Divisão em Chunks
   ↓
4. Upload para Gemini
   ↓
5. Processamento Paralelo
   ↓
6. Consolidação
   ↓
7. Resultado Final
```

---

## ⚙️ Componentes

### Edge Functions
- `start-analysis` - Inicia análise
- `upload-to-gemini` - Upload para Gemini
- `process-next-prompt` - Worker de análise
- `consolidation-worker` - Consolidação
- `chat-with-processo` - Chat

### Workers
- `process-complex-worker` - Análises complexas
- `health-check-worker` - Monitoramento
- `auto-restart-failed-chunks` - Recovery

---

## 🎯 Features Principais

### Análise Simples
- Processos até 1000 páginas
- Processamento em chunks
- 10 tipos de análise
- Resultado estruturado

### Análise Complexa
- Processos grandes (1000-5000 páginas)
- Multi-stage processing
- Validação extra
- Maior contexto

### Chat Inteligente
- Perguntas sobre o processo
- Context-aware
- Streaming de respostas
- Histórico persistente

---

## 📊 Métricas

- Tempo médio de análise
- Taxa de sucesso
- Chunks processados
- Tokens utilizados
- Custos por análise

---

## 🔗 Links Relacionados

- [Database Schema](../03-database/schema.md)
- [API Reference](../06-api-reference/README.md)
- [Monitoring](../09-monitoring/README.md)
- [Troubleshooting](../10-troubleshooting/README.md)

---

[← Voltar ao Índice Principal](../README.md)
