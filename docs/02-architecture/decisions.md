# Decisões Arquiteturais (ADRs)

Architecture Decision Records - Documentação das principais decisões técnicas do projeto.

## Índice

- [ADR-001: Escolha do Supabase como Backend](#adr-001-escolha-do-supabase-como-backend)
- [ADR-002: Escolha do Google Gemini para IA](#adr-002-escolha-do-google-gemini-para-ia)
- [ADR-003: Sistema de Chunks para Processamento](#adr-003-sistema-de-chunks-para-processamento)
- [ADR-004: Processamento Assíncrono com Workers](#adr-004-processamento-assíncrono-com-workers)
- [ADR-005: Sistema Híbrido de Monetização](#adr-005-sistema-híbrido-de-monetização)
- [ADR-006: Row Level Security para Autorização](#adr-006-row-level-security-para-autorização)
- [ADR-007: React com TypeScript no Frontend](#adr-007-react-com-typescript-no-frontend)
- [ADR-008: Vite como Build Tool](#adr-008-vite-como-build-tool)
- [ADR-009: TailwindCSS para Styling](#adr-009-tailwindcss-para-styling)
- [ADR-010: Consolidação de Resultados com IA](#adr-010-consolidação-de-resultados-com-ia)

---

## ADR-001: Escolha do Supabase como Backend

**Status:** Aceito
**Data:** 2024-10-15
**Decisores:** Equipe de Arquitetura

### Contexto

Precisávamos de uma solução de backend que fornecesse:
- Database PostgreSQL
- Autenticação
- Storage para arquivos
- Serverless functions
- Tempo de desenvolvimento rápido

### Decisão

Usar Supabase como plataforma de backend completa.

### Alternativas Consideradas

| Alternativa | Prós | Contras | Motivo da Rejeição |
|-------------|------|---------|-------------------|
| **Firebase** | - Fácil de usar<br>- Bem documentado<br>- Google Cloud | - NoSQL (Firestore)<br>- Menos controle<br>- Vendor lock-in maior | Preferência por SQL e mais controle |
| **AWS (Amplify/Custom)** | - Mais flexível<br>- Muitos serviços<br>- Escalabilidade | - Complexo de configurar<br>- Custo inicial alto<br>- Curva de aprendizado | Complexidade desnecessária para MVP |
| **Backend Custom (Node.js)** | - Controle total<br>- Customizável | - Mais tempo de dev<br>- Mais infraestrutura<br>- Mais manutenção | Tempo de desenvolvimento |

### Justificativa

**Por que Supabase?**

1. **PostgreSQL Nativo**
   - SQL familiar para a equipe
   - Queries complexas suportadas
   - Triggers e functions nativas
   - Melhor para dados relacionais

2. **Row Level Security (RLS)**
   - Segurança no nível do banco
   - Políticas declarativas
   - Menos código de autorização

3. **Edge Functions**
   - Serverless functions em Deno
   - TypeScript nativo
   - Bom para workers assíncronos

4. **Ecossistema Integrado**
   - Auth + Database + Storage + Functions
   - Um único serviço para gerenciar
   - Boa DX (Developer Experience)

5. **Custo-Benefício**
   - Free tier generoso
   - Preços competitivos
   - Pay-as-you-grow

### Consequências

**Positivas:**
- Desenvolvimento rápido
- Menos código boilerplate
- Segurança built-in (RLS)
- Boa documentação
- Comunidade ativa

**Negativas:**
- Vendor lock-in (mitigável com PostgreSQL standard)
- Menos controle que backend custom
- Edge Functions limitadas (timeout 2min em free tier)

### Notas

- Mitigação de vendor lock-in: usar PostgreSQL standard e client libraries padrão
- Para features que precisam > 2min: usar workflows externos

---

## ADR-002: Escolha do Google Gemini para IA

**Status:** Aceito
**Data:** 2024-10-20
**Decisores:** Equipe de Arquitetura + Product

### Contexto

Precisávamos de um LLM para:
- Analisar processos jurídicos (português)
- Processar documentos grandes (até 5000 páginas)
- Chat interativo
- Bom custo-benefício
- Boa qualidade em português

### Decisão

Usar Google Gemini Pro 1.5 como modelo principal de IA.

### Alternativas Consideradas

| Alternativa | Contexto | Qualidade PT | Custo | Motivo da Rejeição |
|-------------|----------|--------------|-------|-------------------|
| **OpenAI GPT-4 Turbo** | 128k tokens | Excelente | $$$ | Contexto menor, mais caro |
| **OpenAI GPT-4o** | 128k tokens | Excelente | $$ | Contexto menor |
| **Anthropic Claude 3** | 200k tokens | Excelente | $$ | Contexto menor, sem File API |
| **Llama 3 (Local)** | Variável | Bom | $ | Infraestrutura complexa |
| **Gemini Pro 1.5** | 2M tokens | Muito Bom | $ | **Escolhido** |

### Justificativa

**Por que Gemini Pro 1.5?**

1. **Contexto Extremamente Longo**
   - 2M tokens de contexto
   - Permite processar PDFs inteiros
   - Menos necessidade de chunking agressivo

2. **File API Nativa**
   - Upload direto de PDFs
   - Não precisa extrair todo o texto
   - Processa imagens em PDFs escaneados

3. **Context Caching**
   - Cache de contexto entre requests
   - Economia de 90% em tokens repetidos
   - Essencial para chat e análises múltiplas

4. **Custo-Benefício**
   - Free tier de 50 requests/dia
   - $0.35/1M tokens (input cached)
   - $1.05/1M tokens (input não-cached)
   - Competitivo vs GPT-4

5. **Qualidade em Português**
   - Testes mostraram boa qualidade
   - Bom entendimento jurídico
   - Respostas estruturadas

### Consequências

**Positivas:**
- Processar documentos muito grandes
- Menor necessidade de chunking
- Context caching reduz custos
- File API simplifica arquitetura

**Negativas:**
- Vendor lock-in Google
- Ainda em preview (Pro 1.5)
- Rate limits mais agressivos que OpenAI

### Notas

- Preparar migração para Gemini Pro 2.0 quando disponível
- Considerar OpenAI GPT-4o como fallback
- Monitorar custos continuamente

---

## ADR-003: Sistema de Chunks para Processamento

**Status:** Aceito
**Data:** 2024-10-25
**Decisores:** Equipe de Arquitetura

### Contexto

Mesmo com Gemini Pro 1.5 tendo 2M tokens de contexto, precisávamos considerar:
- Processos podem ter > 2M tokens
- Retry granular em caso de falha
- Processamento paralelo
- Progress tracking detalhado

### Decisão

Implementar sistema de chunks para dividir documentos grandes.

### Estratégia de Chunking

```
Documento completo
        ↓
Dividir em chunks de ~50k tokens
        ↓
Cada chunk processado independentemente
        ↓
Resultados consolidados ao final
```

### Alternativas Consideradas

1. **Processar documento inteiro**
   - Mais simples
   - Menos código
   - **Rejeitado:** Sem granularidade para retry

2. **Chunks de 10k tokens**
   - Mais granular
   - Mais paralelo
   - **Rejeitado:** Muito overhead de consolidação

3. **Chunks de 100k tokens**
   - Menos chunks
   - Menos consolidação
   - **Rejeitado:** Retry muito custoso

4. **Chunks de 50k tokens** ✓
   - Bom equilíbrio
   - Retry aceitável
   - Consolidação gerenciável

### Justificativa

**Vantagens:**

1. **Retry Granular**
   - Se um chunk falha, só ele é reprocessado
   - Não perde trabalho de outros chunks

2. **Processamento Paralelo**
   - Múltiplos chunks podem ser processados simultaneamente
   - Reduz tempo total de processamento

3. **Progress Tracking**
   - Usuário vê progresso chunk por chunk
   - Melhor UX

4. **Tratamento de Erros**
   - Dead letter queue por chunk
   - Identificação clara de problemas

### Consequências

**Positivas:**
- Resiliência a falhas
- Melhor UX (progresso)
- Escalabilidade

**Negativas:**
- Complexidade adicional
- Necessidade de consolidação
- Mais registros no banco

### Notas

- Tamanho de chunk pode ser ajustado baseado em testes de performance
- Considerar chunks dinâmicos baseados na estrutura do documento

---

## ADR-004: Processamento Assíncrono com Workers

**Status:** Aceito
**Data:** 2024-11-01
**Decisores:** Equipe de Arquitetura

### Contexto

Análise de processos pode levar de minutos a horas:
- Processos pequenos: 2-5 minutos
- Processos grandes: 30-120 minutos

Não podemos bloquear a UI ou manter conexão HTTP aberta.

### Decisão

Implementar processamento assíncrono usando Edge Functions como workers.

### Arquitetura

```
User Request (start-analysis)
        ↓
Create processo + chunks (status: pending)
        ↓
Return immediately to user
        ↓
Worker (process-next-prompt) em loop
        ↓
Processa chunks pendentes
        ↓
Atualiza status no banco
        ↓
UI faz polling do status
```

### Alternativas Consideradas

1. **Processamento síncrono**
   - **Rejeitado:** Timeout de requests, má UX

2. **WebSockets para real-time**
   - **Rejeitado:** Supabase não suporta WebSockets customizados

3. **Server-Sent Events (SSE)**
   - **Rejeitado:** Complexidade, Edge Functions não mantêm conexão longa

4. **Workers + Polling** ✓
   - **Aceito:** Simples, confiável, funciona com Supabase

### Justificativa

**Por que Workers?**

1. **Desacoplamento**
   - Request retorna imediatamente
   - Processamento continua em background

2. **Escalabilidade**
   - Workers podem escalar independentemente
   - Múltiplos workers processam em paralelo

3. **Resiliência**
   - Worker pode falhar e reiniciar
   - Estado persistido no banco

4. **Simplicidade**
   - Não precisa de infraestrutura adicional (message queues, etc)
   - Edge Functions são stateless

### Implementação

**Worker Loop:**
```typescript
while (true) {
  const chunk = await getNextPendingChunk();
  if (!chunk) break;

  try {
    const result = await processChunk(chunk);
    await saveResult(result);
    await markChunkCompleted(chunk.id);
  } catch (error) {
    await handleError(chunk, error);
  }
}
```

**Frontend Polling:**
```typescript
const pollStatus = async () => {
  const { data } = await supabase
    .from('processos')
    .select('status, progress')
    .eq('id', processoId)
    .single();

  if (data.status === 'completed') {
    stopPolling();
    showResult();
  }
};

setInterval(pollStatus, 3000); // Poll every 3s
```

### Consequências

**Positivas:**
- Não bloqueia UI
- Escalável
- Simples de implementar
- Confiável

**Negativas:**
- Não é real-time (polling delay)
- Overhead de polling requests
- Workers podem competir por chunks (precisa lock)

### Notas

- Considerar Supabase Realtime para reduzir polling
- Implementar exponential backoff no polling
- Monitorar workers mortos

---

## ADR-005: Sistema Híbrido de Monetização

**Status:** Aceito
**Data:** 2024-11-05
**Decisores:** Product + Business

### Contexto

Precisávamos definir o modelo de monetização:
- Cobrir custos de IA (Google Gemini)
- Escalar receita com crescimento
- Oferecer diferentes níveis de serviço
- Permitir flexibilidade para usuários

### Decisão

Sistema híbrido: Assinatura mensal + Compra avulsa de tokens.

### Modelo Escolhido

**Planos de Assinatura:**
- **Free**: 10k tokens/mês ($0)
- **Pro**: 50k tokens/mês ($29.99)
- **Enterprise**: 200k tokens/mês ($99.99)

**Pacotes Avulsos:**
- 10k tokens: $9.99
- 50k tokens: $39.99
- 100k tokens: $69.99

**Regras:**
- Tokens mensais expiram em 30 dias
- 30% de rollover permitido
- Tokens comprados não expiram

### Alternativas Consideradas

1. **Apenas Assinatura**
   - Previsível para o negócio
   - **Rejeitado:** Pouco flexível para uso esporádico

2. **Apenas Pay-per-use**
   - Máxima flexibilidade
   - **Rejeitado:** Imprevisível para o negócio

3. **Freemium + Upgrade**
   - Simples
   - **Rejeitado:** Sem opção avulsa para picos

4. **Híbrido** ✓
   - Combina vantagens de ambos

### Justificativa

**Vantagens do Modelo Híbrido:**

1. **Flexibilidade para Usuários**
   - Assinatura para uso regular
   - Compra avulsa para picos

2. **Receita Previsível**
   - Base de assinantes gera MRR
   - Compras avulsas são upside

3. **Conversão Gradual**
   - Free → compra avulsa → assinatura
   - Múltiplos pontos de conversão

4. **Alinhamento de Incentivos**
   - Usuário paga pelo uso
   - Negócio cobre custos + margem

### Análise de Custos

**Custo por Análise (estimado):**
- Processo pequeno: 10k tokens → $0.01
- Processo médio: 30k tokens → $0.03
- Processo grande: 100k tokens → $0.10

**Margem por Plano:**
- Free: Custo máximo $0.10/mês (subsídio)
- Pro: ~60% margem
- Enterprise: ~70% margem

### Consequências

**Positivas:**
- Flexibilidade
- MRR previsível
- Conversão facilitada
- Alinhamento de incentivos

**Negativas:**
- Complexidade de implementação
- Contabilidade de tokens complexa
- Precisa de sistema de reserva/rollback

### Notas

- Monitorar churn por plano
- A/B test de preços
- Considerar planos anuais (desconto)

---

## ADR-006: Row Level Security para Autorização

**Status:** Aceito
**Data:** 2024-11-10
**Decisores:** Equipe de Arquitetura + Security

### Contexto

Precisávamos de um sistema de autorização que:
- Proteja dados de usuários
- Seja difícil de burlar
- Não precise de código middleware
- Funcione no nível do banco

### Decisão

Usar Row Level Security (RLS) do PostgreSQL para todas as tabelas.

### Como Funciona

**Exemplo de Política:**
```sql
-- Users can only see their own processos
CREATE POLICY "Users can view own processos"
  ON processos FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
```

**Efeito:**
```sql
-- User A (id: 123) faz query
SELECT * FROM processos;

-- PostgreSQL automaticamente adiciona filtro:
SELECT * FROM processos WHERE user_id = '123';
```

### Alternativas Consideradas

1. **Autorização na Aplicação**
   - Verificar ownership em cada request
   - **Rejeitado:** Fácil esquecer, vulnerável

2. **API Gateway com regras**
   - Centralizado
   - **Rejeitado:** Não funciona para queries diretas do cliente

3. **Views com Filtros**
   - Criar views por usuário
   - **Rejeitado:** Complexo de manter

4. **Row Level Security** ✓
   - Declarativo
   - Difícil de burlar
   - Performance nativa

### Justificativa

**Vantagens do RLS:**

1. **Segurança by Default**
   - Tabela com RLS habilitado → ninguém acessa
   - Precisa criar policy explicitamente
   - Força pensar em segurança

2. **Não Depende de Código**
   - Mesmo se aplicação tem bug, banco protege
   - Queries diretas também são protegidas

3. **Performance Nativa**
   - PostgreSQL otimiza policies
   - Não precisa de JOIN extra para verificar ownership

4. **Auditável**
   - Policies são declarativas
   - Fácil revisar segurança

### Implementação

**Processo de Criação de Tabela:**
```sql
-- 1. Criar tabela
CREATE TABLE my_table (...);

-- 2. Habilitar RLS
ALTER TABLE my_table ENABLE ROW LEVEL SECURITY;

-- 3. Criar policies (exemplo: SELECT)
CREATE POLICY "Users can read own data"
  ON my_table FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 4. Criar policies para INSERT, UPDATE, DELETE
...
```

**Políticas Comuns:**
- SELECT: `USING (auth.uid() = user_id)`
- INSERT: `WITH CHECK (auth.uid() = user_id)`
- UPDATE: `USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`
- DELETE: `USING (auth.uid() = user_id)`

### Consequências

**Positivas:**
- Segurança no banco
- Difícil de burlar
- Performance boa
- Menos código na aplicação

**Negativas:**
- Curva de aprendizado
- Debugging mais complexo
- Erros menos óbvios (silently returns empty)

### Notas

- Sempre habilitar RLS em novas tabelas
- Testar policies com diferentes usuários
- Usar `service_role` apenas em Edge Functions admin

---

## ADR-007-010

*(Continuam na mesma linha, documentando decisões sobre React+TypeScript, Vite, TailwindCSS, e Consolidação com IA)*

---

## Links Relacionados

- [Visão Geral da Arquitetura](./overview.md)
- [Fluxo de Dados](./data-flow.md)
- [Padrões e Convenções](./patterns.md)

---

[← Anterior: Fluxo de Dados](./data-flow.md) | [Próximo: Padrões →](./patterns.md)
