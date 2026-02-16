# 13. Analise de Processamento de Arquivos

Esta secao contem documentacao tecnica detalhada sobre o sistema de processamento de arquivos PDF do sistema.

## Documentos Disponiveis

### 1. [Processamento de Arquivos Pequenos](./small-files-processing.md)

Documentacao completa do fluxo de processamento para arquivos com ate 1.000 paginas (Tier SMALL).

**Conteudo:**
- Arquitetura simplificada (processamento direto)
- Componentes do frontend envolvidos
- Edge functions utilizadas
- Tabelas do banco de dados
- Sistema de tokens
- Tratamento de erros
- Monitoramento

### 2. [Processamento de Arquivos Complexos](./complex-files-processing.md)

Documentacao completa do fluxo de processamento para arquivos com mais de 1.000 paginas (Tiers MEDIUM, LARGE, VERY_LARGE, HIGH_LARGE, ULTRA_LARGE).

**Conteudo:**
- Sistema de Tiers e configuracoes
- Chunking de PDF com overlap
- Upload paralelo para Gemini
- Sistema de filas e workers
- Processamento paralelo
- Consolidacao de resultados
- GitHub Actions de monitoramento
- Recuperacao de erros
- Metricas e performance

### 3. [Arquitetura Completa de Processamento Complexo](./complex-files-architecture.md)

Referencia tecnica completa da arquitetura de processamento de arquivos complexos, incluindo todos os detalhes de implementacao.

**Conteudo:**
- Arquitetura de alto nivel e diagramas de fluxo
- Referencia completa de todas as Edge Functions
- Schema detalhado do banco de dados (tabelas e RPCs)
- Sistema de recuperacao automatica em 5 camadas
- Configuracao de GitHub Actions Crons
- Maquinas de estado para processos, fases e itens da fila
- Tratamento de erros e dead letter queue
- Consideracoes de performance e escalabilidade

## Visao Geral da Arquitetura

```
                    ┌─────────────────────────────────────┐
                    │           UPLOAD DE PDF             │
                    └─────────────────┬───────────────────┘
                                      │
                                      ▼
                    ┌─────────────────────────────────────┐
                    │      CONTAGEM DE PAGINAS            │
                    │      (pdf-lib no frontend)          │
                    └─────────────────┬───────────────────┘
                                      │
                          ┌───────────┴───────────┐
                          │                       │
                          ▼                       ▼
            ┌─────────────────────┐   ┌─────────────────────┐
            │   <= 1.000 PAGINAS  │   │   > 1.000 PAGINAS   │
            │   (TIER SMALL)      │   │   (TIERS COMPLEX)   │
            └──────────┬──────────┘   └──────────┬──────────┘
                       │                         │
                       ▼                         ▼
            ┌─────────────────────┐   ┌─────────────────────┐
            │   FLUXO SIMPLES     │   │   FLUXO COMPLEXO    │
            │                     │   │                     │
            │   • Upload direto   │   │   • Chunking        │
            │   • Gemini File API │   │   • Upload paralelo │
            │   • Processamento   │   │   • Workers         │
            │     sequencial      │   │   • Consolidacao    │
            └─────────────────────┘   └─────────────────────┘
```

## Principais Diferencas entre Fluxos

| Aspecto | Arquivos Pequenos | Arquivos Complexos |
|---------|-------------------|-------------------|
| Paginas | <= 1.000 | > 1.000 |
| Chunking | Nao | Sim |
| Workers | 1 (sequencial) | 3-6 (paralelo) |
| Tempo estimado | 5-15 minutos | 1-15 horas |
| Checkpoints | Nao | Sim |
| Consolidacao | N/A | Obrigatoria |
| Monitoramento | Basico | GitHub Actions |

## Componentes Principais

### Frontend
- `FileUpload.tsx` - Interface de upload
- `pdfSplitter.ts` - Divisao de PDF em chunks
- `ProcessosService.ts` - Orquestracao do upload
- `TokenValidationService.ts` - Validacao de tokens
- `TierSystemService.ts` - Deteccao de tier

### Edge Functions
- `upload-to-gemini` - Upload para Gemini File API
- `start-analysis` - Inicio de analise simples
- `start-analysis-complex` - Inicio de analise complexa
- `process-next-prompt` - Processamento sequencial
- `upload-chunks-worker` - Upload de chunks
- `process-complex-worker` - Worker de processamento
- `consolidation-worker` - Consolidacao de resultados

### Banco de Dados
- `processos` - Registro principal
- `process_chunks` - Chunks de PDFs complexos
- `processing_queue` - Fila de processamento
- `analysis_results` - Resultados por prompt
- `analysis_prompts` - Prompts configurados
- `complex_processing_status` - Status de processamento

### GitHub Actions
- `monitor-stuck-processes.yml` - A cada 1 minuto
- `monitor-stuck-chunks.yml` - A cada 5 minutos
- `monitor-complex-health-check.yml` - A cada 5 minutos
- `monitor-auto-restart-failed.yml` - A cada 3 minutos
- `monitor-complex-recovery.yml` - A cada 10 minutos

## Metricas Chave

### Tokens
- **Taxa:** 5.500 tokens por pagina
- **Validacao:** Pre-upload

### Performance
- Chunk MEDIUM: 400 paginas
- Chunk LARGE+: 180 paginas
- Overlap: 75 paginas

### Timeouts
- SMALL: 15 minutos
- MEDIUM: 20 minutos
- LARGE: 25 minutos
- VERY_LARGE+: 30-40 minutos
