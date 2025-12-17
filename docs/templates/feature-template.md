# Feature: [Nome da Feature]

> Template para documentação de novas features

## Visão Geral

[Breve descrição da feature - 2-3 frases]

## Motivação

[Por que esta feature é necessária? Que problema resolve?]

## Requisitos

### Funcionais
- [ ] Requisito funcional 1
- [ ] Requisito funcional 2
- [ ] Requisito funcional 3

### Não Funcionais
- [ ] Performance: [especificar]
- [ ] Segurança: [especificar]
- [ ] Escalabilidade: [especificar]

## Arquitetura

### Componentes Afetados

#### Frontend
- `src/components/...` - [descrição]
- `src/pages/...` - [descrição]
- `src/services/...` - [descrição]

#### Backend
- `supabase/functions/...` - [descrição]
- Tabelas do banco: [listar]

#### Integrações
- [listar integrações externas se houver]

### Diagrama de Fluxo

```
[Adicionar diagrama ou descrição do fluxo]

1. Usuário faz X
2. Sistema processa Y
3. Resultado Z
```

## Design de Dados

### Novas Tabelas
```sql
-- Exemplo de schema
CREATE TABLE example (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ...
);
```

### Tabelas Modificadas
- `table_name` - [adicionar coluna X, Y, Z]

### Migrations Necessárias
- [ ] Migration 1: [descrição]
- [ ] Migration 2: [descrição]

## API Changes

### Novos Endpoints
- `POST /api/example` - [descrição]
- `GET /api/example/:id` - [descrição]

### Endpoints Modificados
- `PUT /api/example/:id` - [o que mudou]

## UI/UX

### Novas Telas
- [Nome da tela] - [descrição]

### Telas Modificadas
- [Nome da tela] - [o que mudou]

### Wireframes
[Adicionar links ou screenshots se disponível]

## Implementação

### Fase 1: [Nome]
- [ ] Task 1
- [ ] Task 2
- [ ] Task 3

### Fase 2: [Nome]
- [ ] Task 1
- [ ] Task 2
- [ ] Task 3

## Testes

### Unit Tests
- [ ] Teste de componente X
- [ ] Teste de serviço Y

### Integration Tests
- [ ] Teste de fluxo completo

### Manual Tests
- [ ] Cenário 1: [descrição]
- [ ] Cenário 2: [descrição]

## Documentação

- [ ] Atualizar README
- [ ] Atualizar API docs
- [ ] Atualizar guia do usuário
- [ ] Adicionar exemplos

## Rollout Plan

### Staging
- [ ] Deploy em staging
- [ ] Testes em staging
- [ ] Validação com stakeholders

### Production
- [ ] Feature flag (se aplicável)
- [ ] Gradual rollout
- [ ] Monitoramento

## Métricas de Sucesso

- [ ] Métrica 1: [definir]
- [ ] Métrica 2: [definir]
- [ ] Métrica 3: [definir]

## Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| [Risco 1] | Alta/Média/Baixa | Alto/Médio/Baixo | [Como mitigar] |

## Referências

- [Link 1]
- [Link 2]
- Issue: #XXX

---

**Autor:** [Nome]
**Data:** [YYYY-MM-DD]
**Status:** [Draft/In Progress/Review/Approved/Implemented]
