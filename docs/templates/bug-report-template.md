# Bug Report: [Título Breve do Bug]

> Template para documentação de bugs

## Informações Básicas

**ID:** [#XXX ou auto-gerado]
**Severidade:** [Critical/High/Medium/Low]
**Status:** [New/In Progress/Testing/Resolved/Closed]
**Reportado por:** [Nome/Email]
**Data:** [YYYY-MM-DD]
**Versão:** [x.y.z]

## Descrição

[Descrição clara e concisa do bug]

## Ambiente

- **Frontend:** [versão, browser]
- **Backend:** [ambiente - production/staging/local]
- **Database:** [versão do Supabase]
- **OS:** [Windows/Mac/Linux]
- **Device:** [Desktop/Mobile]

## Passos para Reproduzir

1. [Primeiro passo]
2. [Segundo passo]
3. [Terceiro passo]
4. [Observar o erro]

## Comportamento Esperado

[O que deveria acontecer]

## Comportamento Atual

[O que está acontecendo]

## Screenshots/Videos

[Adicionar screenshots ou links para vídeos se disponível]

## Logs/Erros

```
[Colar logs relevantes aqui]
```

### Console Errors
```javascript
[Erros do console do browser]
```

### Network Errors
```
[Erros de rede/API]
```

### Edge Function Logs
```
[Logs das Edge Functions]
```

## Dados para Reprodução

### IDs Relevantes
- User ID: [uuid]
- Processo ID: [uuid]
- Chunk ID: [uuid]

### Request/Response
```json
// Request
{
  ...
}

// Response
{
  ...
}
```

## Impacto

### Usuários Afetados
- [Número estimado ou % de usuários]
- [Tipo de usuários afetados]

### Funcionalidades Afetadas
- [Lista de funcionalidades impactadas]

### Workaround
[Existe algum workaround temporário?]

## Análise Técnica

### Causa Raiz
[Identificar a causa do bug se conhecida]

### Componentes Afetados
- Frontend: [arquivos]
- Backend: [Edge Functions]
- Database: [tabelas]

### Código Suspeito
```typescript
// Arquivo: src/path/to/file.ts
// Linha: XX
[Código relevante]
```

## Solução Proposta

### Abordagem
[Como resolver o bug]

### Arquivos a Modificar
- [ ] `src/path/to/file1.ts`
- [ ] `src/path/to/file2.ts`
- [ ] `supabase/functions/...`

### Migrations Necessárias
- [ ] [Descrever migration se necessário]

### Tests
- [ ] Unit test para prevenir regressão
- [ ] Integration test

## Priorização

### Critérios
- **Severidade:** [1-5]
- **Frequência:** [Sempre/Frequente/Ocasional/Raro]
- **Impacto no Negócio:** [Alto/Médio/Baixo]

### Justificativa da Prioridade
[Por que esta prioridade?]

## Checklist de Resolução

- [ ] Bug reproduzido localmente
- [ ] Causa raiz identificada
- [ ] Fix implementado
- [ ] Tests adicionados
- [ ] Code review aprovado
- [ ] Deploy em staging
- [ ] Validação em staging
- [ ] Deploy em production
- [ ] Validação em production
- [ ] Documentação atualizada
- [ ] Issue fechada

## Relacionados

### Issues Relacionadas
- #XXX - [descrição]

### PRs
- #YYY - [descrição]

### Documentação
- [Links para docs relevantes]

## Histórico

| Data | Autor | Ação |
|------|-------|------|
| YYYY-MM-DD | [Nome] | Bug reportado |
| YYYY-MM-DD | [Nome] | Em investigação |
| YYYY-MM-DD | [Nome] | Fix implementado |
| YYYY-MM-DD | [Nome] | Resolvido |

---

**Última Atualização:** [YYYY-MM-DD]
**Assignee:** [Nome]
