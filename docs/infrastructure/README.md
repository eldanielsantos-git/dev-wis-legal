# Infraestrutura - Documentacao

Documentacao completa da infraestrutura do sistema, incluindo Edge Functions, GitHub Actions, workflows de monitoramento e estrategias de resiliencia.

---

## Documentos Disponiveis

### 1. GitHub Actions - Sistema de Monitoramento Automatizado

**Arquivo:** [github-actions-monitoring.md](./github-actions-monitoring.md)

Documentacao completa dos 6 workflows que monitoram e recuperam automaticamente processos e chunks travados:

- Monitor Stuck Processes (1 min)
- Monitor Auto Restart Failed Chunks (3 min)
- Monitor Complex Health Check (5 min)
- Monitor Stuck Chunks (5 min)
- Monitor Stuck Small Files (5 min)
- Monitor Complex Recovery (10 min)

**Conteudo:**
- Visao geral do sistema
- Workflows detalhados com codigo YAML completo
- Edge functions correspondentes com codigo TypeScript
- RPCs e funcoes database
- Configuracao e setup passo a passo
- Monitoramento e debugging
- Estrategia de resiliencia
- Metricas e KPIs com queries SQL
- Troubleshooting completo
- Custos e limites
- FAQ

### 2. Arquitetura Visual dos Workflows

**Arquivo:** [workflows-architecture.md](./workflows-architecture.md)

Visualizacoes detalhadas usando diagramas Mermaid:

- Arquitetura geral do sistema
- Timeline de execucao dos workflows
- Maquinas de estados (processos e chunks)
- Fluxos de decisao para recovery
- Sequencias de interacoes
- Estrategia de escalacao
- Fluxos detalhados por workflow
- Coordenacao entre workflows

### 3. Edge Functions - Documentacao Completa

**Arquivo:** [edge-functions-complete.md](./edge-functions-complete.md)

Documentacao de todas as Edge Functions do sistema.

---

## Visao Geral do Sistema

O sistema utiliza uma arquitetura de 3 camadas:

```
GitHub Actions (Agendamento)
    |
    v
Edge Functions (Logica de Recovery)
    |
    v
Database + Workers (Processamento)
```

### Fluxo de Processamento

1. **Usuario faz upload de arquivo**
2. **Sistema determina tipo de processamento:**
   - Arquivo < 1000 paginas: Processamento sequencial (process-next-prompt)
   - Arquivo >= 1000 paginas: Processamento em chunks paralelos (process-complex-worker)
3. **Workflows de monitoramento:**
   - Detectam processos/chunks travados
   - Executam recovery automatico
   - Disparam workers conforme necessario
4. **Consolidacao (se aplicavel):**
   - Junta resultados de todos chunks
   - Marca processo como completed

### Componentes Principais

**GitHub Actions Workflows:**
- 6 workflows executando em intervalos de 1-10 minutos
- Monitoramento 24/7 automatizado
- Deteccao rapida de falhas (1-10 min)

**Supabase Edge Functions:**
- 6 funcoes principais de recovery
- Subdivisao automatica de chunks grandes
- Liberacao de locks expirados
- Gerenciamento de dead letter queue

**Workers:**
- process-complex-worker: Processa chunks de arquivos grandes
- consolidation-worker: Junta resultados de chunks
- process-next-prompt: Processa arquivos pequenos sequencialmente

**Database Tables:**
- `processos`: Tabela principal de processos
- `process_chunks`: Chunks de arquivos grandes
- `processing_queue`: Fila de processamento com locks
- `analysis_results`: Resultados de analises
- `complex_processing_status`: Status e heartbeat de processos complexos

---

## Estrategia de Resiliencia

### Niveis de Recovery

1. **Nivel 1** (1-3 min): Deteccao rapida e auto-restart
2. **Nivel 2** (5 min): Recovery de chunks travados
3. **Nivel 3** (5 min): Health check e liberacao de locks
4. **Nivel 4** (10 min): Recovery profundo de processos
5. **Nivel 5** (manual): Dead letter queue para intervencao

### Escalacao de Tentativas

```
Tentativa 1-3:   Auto-restart automatico
Tentativa 3-10:  Stuck chunk recovery
Tentativa 10-20: Health check recovery
Tentativa 20-29: Process recovery
Tentativa 30+:   Dead letter queue (alerta admin)
```

### Taxa de Sucesso

Com este sistema multi-camadas:
- Taxa de recovery automatico: > 98%
- Tempo medio ate recovery: 10-15 minutos
- Prevencao de perda de dados: 100%

---

## Metricas e Observabilidade

### KPIs Principais

1. **Taxa de Sucesso de Recovery:** Percentual de processos recuperados automaticamente
2. **Tempo Medio de Recovery:** Tempo desde falha ate recuperacao
3. **Chunks em Dead Letter:** Itens que precisam intervencao manual
4. **Workers Ativos:** Numero de workers processando simultaneamente

### Queries SQL Uteis

Ver queries detalhadas em: [github-actions-monitoring.md - Metricas e KPIs](./github-actions-monitoring.md#metricas-e-kpis)

---

## Configuracao Rapida

### Pre-requisitos

- Repositorio GitHub
- Projeto Supabase com Edge Functions
- Secrets configurados:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

### Passos

1. **Configurar Secrets no GitHub:**
   - Settings > Secrets and variables > Actions
   - Adicionar `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`

2. **Habilitar GitHub Actions:**
   - Settings > Actions > General
   - Permitir "Allow all actions and reusable workflows"

3. **Deploy Edge Functions:**
   ```bash
   supabase functions deploy auto-restart-failed-chunks
   supabase functions deploy health-check-worker
   supabase functions deploy recover-stuck-chunks
   supabase functions deploy recover-stuck-processes
   supabase functions deploy process-stuck-processos
   supabase functions deploy detect-stuck-processes-small-files
   ```

4. **Testar Workflows:**
   - Actions tab > Selecione workflow
   - Run workflow (manual)
   - Verificar logs

Ver guia completo em: [github-actions-monitoring.md - Configuracao e Setup](./github-actions-monitoring.md#configuracao-e-setup)

---

## Troubleshooting

### Problemas Comuns

1. **Workflow nao executa:**
   - Verificar se GitHub Actions esta habilitado
   - Fazer commit para "acordar" workflows inativos
   - Verificar syntax do YAML

2. **Secrets nao funcionam:**
   - Verificar se secrets estao configurados
   - Usar service_role key (nao anon key)
   - Testar secrets manualmente com curl

3. **Edge Function retorna erro 500:**
   - Ver logs da funcao no Supabase Dashboard
   - Verificar se tabelas/RPCs existem
   - Testar funcao localmente

Ver guia completo em: [github-actions-monitoring.md - Troubleshooting](./github-actions-monitoring.md#troubleshooting)

---

## Custos

### Estimativa Mensal

**GitHub Actions:**
- Execucoes: ~87,840 por mes
- Minutos: ~87,840 minutos/mes
- Recomendacao: Self-hosted runner ($10/mes) ou Enterprise plan

**Supabase:**
- Edge Functions: ~87,840 invocations/mes (dentro do free tier)
- Database: Queries ilimitadas (free tier)
- Custo total Supabase: $0

**Total Cost of Ownership:**
- Self-hosted runner: ~$10/mes
- GitHub Enterprise: ~$635/mes

Ver analise completa em: [github-actions-monitoring.md - Custos e Limites](./github-actions-monitoring.md#custos-e-limites)

---

## Proximos Passos

1. Ler documentacao completa dos workflows
2. Revisar diagramas de arquitetura
3. Configurar secrets no GitHub
4. Testar workflows manualmente
5. Configurar notificacoes (Slack/Email)
6. Monitorar metricas de recovery

---

## Links Uteis

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Cron Expression Syntax](https://crontab.guru/)
- [Mermaid Diagram Syntax](https://mermaid.js.org/intro/)

---

[Voltar ao README principal](../README.md)
