# GPI-Gemini-Instructions

## Documentacao Tecnica: Sistema de Analise Forense de Processos

**Versao:** 1.0
**Data:** Janeiro 2025
**Finalidade:** Referencia completa para estudo e aprimoramento dos prompts de analise

---

## Indice

1. [Arquitetura da Chamada da API](#1-arquitetura-da-chamada-da-api)
2. [Estrutura de Envio dos Prompts](#2-estrutura-de-envio-dos-prompts)
3. [Configuracoes do Modelo](#3-configuracoes-do-modelo)
4. [Schemas JSON das 9 Etapas de Analise](#4-schemas-json-das-9-etapas-de-analise)
5. [Mecanismos de Normalizacao e Fallback](#5-mecanismos-de-normalizacao-e-fallback)
6. [Tabela Resumo](#6-tabela-resumo)

---

## 1. Arquitetura da Chamada da API

### 1.1 Biblioteca Utilizada

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: modelId });
```

### 1.2 Fluxo de Processamento

```
[PDF Upload] --> [Supabase Storage] --> [Gemini File API] --> [9 Prompts Sequenciais] --> [Respostas JSON] --> [Views React]
```

### 1.3 Metodos de Envio do Documento

| Cenario | Metodo | Descricao |
|---------|--------|-----------|
| Documento pequeno | Base64 Inline | PDF codificado em base64 enviado diretamente |
| Documento medio | File API (Lote) | URI do Gemini + prompt em uma unica chamada |
| Documento grande (>=3 chunks) | File API Individual | Cada chunk processado separadamente, depois consolidado |

---

## 2. Estrutura de Envio dos Prompts

### 2.1 Origem dos Prompts

Os prompts sao armazenados na tabela `analysis_prompts` do Supabase:

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `id` | UUID | Identificador unico do prompt |
| `title` | string | Nome descritivo (ex: "Visao Geral do Processo") |
| `prompt_content` | text | Texto principal enviado como instrucao do usuario |
| `system_prompt` | text | Instrucoes de sistema (comportamento da LLM) |
| `execution_order` | int (1-9) | Ordem de execucao sequencial |
| `is_active` | boolean | Se o prompt esta ativo para uso |

### 2.2 Estrutura da Requisicao ao Gemini

```typescript
const result = await model.generateContent({
  // CONTEUDO DO USUARIO
  contents: [
    {
      role: 'user',
      parts: [
        // PARTE 1: Documento PDF
        {
          fileData: {
            mimeType: 'application/pdf',
            fileUri: processoData.gemini_file_uri
          }
        },
        // PARTE 2: Prompt de texto
        {
          text: analysisResult.prompt_content
        }
      ]
    }
  ],

  // INSTRUCOES DE SISTEMA (System Prompt)
  systemInstruction: analysisResult.system_prompt || undefined,

  // CONFIGURACAO DE GERACAO
  generationConfig: {
    temperature: 0.2,
    maxOutputTokens: 60000
  }
});
```

### 2.3 Alternativa: Base64 Inline

```typescript
const result = await model.generateContent({
  contents: [
    {
      role: 'user',
      parts: [
        {
          inlineData: {
            mimeType: 'application/pdf',
            data: pdfBase64Data  // String base64 do PDF
          }
        },
        {
          text: analysisResult.prompt_content.trim()
        }
      ]
    }
  ],
  systemInstruction: analysisResult.system_prompt || undefined,
  generationConfig: {
    temperature: 0.2,
    maxOutputTokens: 60000
  }
});
```

### 2.4 Processamento de Documentos em Chunks

Para documentos muito grandes (>=3 chunks):

```typescript
// Processamento individual de cada chunk
for (const chunk of chunks) {
  const chunkResult = await model.generateContent({
    contents: [
      {
        role: 'user',
        parts: [
          {
            fileData: {
              mimeType: 'application/pdf',
              fileUri: chunk.gemini_file_uri
            }
          },
          {
            text: `${prompt}\n\nIMPORTANTE: Esta e a parte ${chunk.chunk_index} de ${chunks.length} do documento.`
          }
        ]
      }
    ],
    systemInstruction: systemPrompt,
    generationConfig: { temperature, maxOutputTokens }
  });

  chunkResults.push(chunkResult);
}

// Consolidacao dos resultados
const combinationPrompt = `Voce esta combinando ${chunks.length} analises parciais...`;
const finalResult = await model.generateContent({...});
```

---

## 3. Configuracoes do Modelo

### 3.1 Parametros de Geracao

| Parametro | Valor Padrao | Descricao |
|-----------|--------------|-----------|
| `temperature` | 0.2 | Baixo para respostas mais deterministicas |
| `maxOutputTokens` | 60000 | Limite de tokens de saida |
| `model_id` | Configuravel | Ex: gemini-1.5-pro, gemini-2.0-flash |

### 3.2 Tabela de Configuracao de Modelos

```sql
-- admin_system_models
id, name, display_name, model_id, system_model, temperature, max_tokens, priority, is_active
```

### 3.3 Tratamento da Resposta

```typescript
const response = result.response;
let text = response.text().trim();

// Limpeza de marcadores markdown
if (text.startsWith('```json')) {
  text = text.replace(/^```json\n?/, '');
}
if (text.startsWith('```')) {
  text = text.replace(/^```\n?/, '');
}
if (text.endsWith('```')) {
  text = text.replace(/\n?```$/, '');
}

// Metadados disponiveis
const totalTokensUsed = response.usageMetadata?.totalTokenCount || 0;
const executionTime = Date.now() - startTime;
```

---

## 4. Schemas JSON das 9 Etapas de Analise

### ETAPA 1: Visao Geral do Processo

**Componente:** `VisaoGeralProcessoView.tsx`
**Chave Raiz:** `visaoGeralProcesso`
**Aliases Aceitos:** `visao_geral_processo`, `visaoGeral`, `visao_geral`

```json
{
  "visaoGeralProcesso": {
    "titulo": "Visao Geral do Processo",
    "secoes": [
      {
        "id": "identificacao",
        "titulo": "Identificacao do Processo",
        "campos": [
          { "id": "numero_processo", "label": "Numero do Processo", "valor": "0000000-00.0000.0.00.0000" },
          { "id": "classe_processual", "label": "Classe Processual", "valor": "Acao Civil Publica" },
          { "id": "vara", "label": "Vara", "valor": "1a Vara Civel" },
          { "id": "comarca", "label": "Comarca", "valor": "Sao Paulo/SP" },
          { "id": "data_distribuicao", "label": "Data de Distribuicao", "valor": "01/01/2024" },
          { "id": "valor_causa", "label": "Valor da Causa", "valor": "R$ 100.000,00" }
        ]
      },
      {
        "id": "documentos",
        "titulo": "Documentos Analisados",
        "documentosAnalisados": [
          {
            "id": "doc_1",
            "arquivo": "processo_completo.pdf",
            "paginas": 150,
            "tipoProcesso": "Civel"
          }
        ]
      },
      {
        "id": "partes",
        "titulo": "Partes do Processo",
        "lista": [
          {
            "id": "parte_1",
            "nome": "Joao da Silva",
            "cpfCnpj": "000.000.000-00",
            "Polo": "Autor",
            "poloDoUsuario": true
          },
          {
            "id": "parte_2",
            "nome": "Empresa XYZ Ltda",
            "cpfCnpj": "00.000.000/0001-00",
            "Polo": "Reu",
            "poloDoUsuario": false
          }
        ]
      },
      {
        "id": "linha_tempo",
        "titulo": "Linha do Tempo Processual",
        "eventosProcessuais": [
          {
            "id": "evento_1",
            "evento": "Distribuicao",
            "data": "01/01/2024",
            "pagina": "1",
            "resumo": "Processo distribuido por sorteio"
          },
          {
            "id": "evento_2",
            "evento": "Citacao",
            "data": "15/01/2024",
            "pagina": "25",
            "resumo": "Reu citado por oficial de justica"
          }
        ]
      },
      {
        "id": "processos_relacionados",
        "titulo": "Processos Relacionados",
        "processosRelacionados": [
          {
            "id": "proc_rel_1",
            "numero": "0000001-00.0000.0.00.0000",
            "relacao": "Conexao",
            "notas": "Processo conexo em tramitacao conjunta"
          }
        ]
      }
    ]
  }
}
```

---

### ETAPA 2: Resumo Estrategico

**Componente:** `ResumoEstrategicoView.tsx`
**Chave Raiz:** `resumoEstrategico`
**Aliases Aceitos:** `resumo_estrategico`, `resumo`

```json
{
  "resumoEstrategico": {
    "titulo": "Resumo Estrategico",
    "secoes": [
      {
        "id": "informacoes_basicas",
        "titulo": "Informacoes Basicas",
        "campos": [
          { "id": "tipo_acao", "label": "Tipo de Acao", "valor": "Acao de Cobranca" },
          { "id": "fase_atual", "label": "Fase Atual", "valor": "Instrucao Probatoria" },
          { "id": "ultima_movimentacao", "label": "Ultima Movimentacao", "valor": "Audiencia de Instrucao realizada em 10/03/2024" }
        ]
      },
      {
        "id": "status",
        "titulo": "Status Processual",
        "statusProcessual": {
          "descricao": "O processo encontra-se em fase de instrucao, com audiencia de instrucao ja realizada. Aguarda-se a apresentacao de alegacoes finais pelas partes.",
          "proximaProvidencia": {
            "parte": "Autor",
            "providencia": "Apresentar alegacoes finais",
            "prazo": "15 dias uteis a contar da intimacao"
          }
        }
      },
      {
        "id": "questao_central",
        "titulo": "Questao Central",
        "questaoCentral": {
          "titulo": "Existencia do Debito",
          "descricao": "A questao central do processo gira em torno da comprovacao da existencia e exigibilidade do debito cobrado.",
          "argumentosPorPolo": [
            {
              "id": "arg_autor",
              "titulo": "Polo Ativo (Autor)",
              "fundamentacaoLegal": "Art. 389 e 395 do Codigo Civil",
              "fatosRelevantes": "Apresentou contrato assinado e comprovante de entrega dos produtos",
              "consistenciaJurisprudencial": "Jurisprudencia majoritaria favoravel a cobranca com documentacao comprobatoria"
            },
            {
              "id": "arg_reu",
              "titulo": "Polo Passivo (Reu)",
              "fundamentacaoLegal": "Art. 373, II do CPC - onus da prova",
              "fatosRelevantes": "Alega vicio no produto entregue e descumprimento contratual pelo autor",
              "consistenciaJurisprudencial": "Ha precedentes que reconhecem excecao de contrato nao cumprido"
            }
          ]
        }
      }
    ]
  }
}
```

---

### ETAPA 3: Comunicacoes e Prazos

**Componente:** `ComunicacoesPrazosView.tsx`
**Chave Raiz:** `comunicacoesPrazos`
**Aliases Aceitos:** `comunicacoes_prazos`, `comunicacoes`

```json
{
  "comunicacoesPrazos": {
    "titulo": "Comunicacoes e Prazos Processuais",
    "secoes": [
      {
        "id": "citacoes_intimacoes",
        "titulo": "Citacoes e Intimacoes",
        "listaAtos": [
          {
            "id": "ato_1",
            "tipoAto": "Citacao",
            "modalidade": "Por Oficial de Justica",
            "destinatario": {
              "nome": "Empresa XYZ Ltda",
              "documento": "00.000.000/0001-00",
              "tipo": "Reu",
              "status": "Citacao Bem-Sucedida",
              "dataAto": "15/01/2024",
              "dataJuntada": "18/01/2024",
              "paginaJuntadaAto": "25",
              "notas": "Citacao realizada na pessoa do representante legal"
            },
            "validadeStatus": "Valida",
            "referencia": {
              "arquivo": "processo.pdf",
              "paginas": "25-26"
            },
            "detalhesAR": {
              "nomeManuscrito": "Jose da Silva",
              "assinaturaPresente": "Sim",
              "motivoDevolucaoExistente": "Nao",
              "notas": "AR recebido pelo porteiro do edificio"
            },
            "prazosDerivados": [
              {
                "id": "prazo_1",
                "tipoPrazo": "Contestacao",
                "finalidade": "Apresentacao de defesa pelo reu",
                "baseLegal": "Art. 335 do CPC",
                "dataInicio": "19/01/2024",
                "duracao": "15 dias uteis",
                "dataFinal": "09/02/2024",
                "status": "Cumprido",
                "observacoes": "Contestacao apresentada em 05/02/2024"
              }
            ]
          },
          {
            "id": "ato_2",
            "tipoAto": "Intimacao",
            "modalidade": "Publicacao em Diario Oficial",
            "destinatario": [
              {
                "nome": "Joao da Silva",
                "tipo": "Autor",
                "status": "Intimacao Bem-Sucedida",
                "dataAto": "01/03/2024"
              },
              {
                "nome": "Empresa XYZ Ltda",
                "tipo": "Reu",
                "status": "Intimacao Bem-Sucedida",
                "dataAto": "01/03/2024"
              }
            ],
            "validadeStatus": "Valida",
            "notas": "Intimacao para audiencia de instrucao"
          }
        ]
      }
    ]
  }
}
```

---

### ETAPA 4: Admissibilidade Recursal

**Componente:** `AdmissibilidadeRecursalView.tsx`
**Chave Raiz:** `recursosAdmissibilidade`
**Aliases Aceitos:** `recursos_admissibilidade`, `admissibilidade`, `recursos`

```json
{
  "recursosAdmissibilidade": {
    "titulo": "Analise de Recursos e Admissibilidade",
    "secoes": [
      {
        "id": "recursos_interpostos",
        "titulo": "Recursos Ja Interpostos",
        "listaRecursosIdentificados": [
          {
            "id": "recurso_1",
            "tipoRecurso": "Agravo de Instrumento",
            "dataInterposicao": "20/02/2024",
            "tempestividade": "Tempestivo",
            "preparoComprovado": "Sim - Comprovante as fls. 85",
            "regularidadeFormal": "Regular - Todas as pecas obrigatorias presentes",
            "juizoAdmissibilidade": "Admitido pelo Relator",
            "situacaoAtual": "Aguardando julgamento",
            "decisaoAdmissibilidadeDoc": "Decisao monocratica de admissao as fls. 120",
            "notas": "Recurso contra decisao que indeferiu tutela de urgencia"
          }
        ]
      },
      {
        "id": "recursos_cabiveis",
        "titulo": "Recursos Cabiveis (Oportunidades)",
        "listaRecursosCabiveis": [
          {
            "id": "cabivel_1",
            "tipoDecisaoRecorrivel": "Sentenca de Merito",
            "dataDecisao": "Pendente",
            "recursoCabivel": "Apelacao",
            "prazoLegal": 15,
            "baseLegal": "Art. 1.003 e 1.009 do CPC",
            "dataFinalInterposicao": "A definir apos publicacao",
            "situacao": "Nao cabivel no momento - Aguardando sentenca",
            "observacoes": "Recurso cabivel apos prolacao da sentenca"
          },
          {
            "id": "cabivel_2",
            "tipoDecisaoRecorrivel": "Decisao Interlocutoria - Prova Pericial",
            "dataDecisao": "25/02/2024",
            "recursoCabivel": "Agravo de Instrumento",
            "prazoLegal": 15,
            "baseLegal": "Art. 1.015, XI do CPC",
            "dataFinalInterposicao": "18/03/2024",
            "situacao": "Prazo em curso",
            "observacoes": "Decisao que indeferiu producao de prova pericial"
          }
        ]
      }
    ]
  }
}
```

---

### ETAPA 5: Estrategias Juridicas

**Componente:** `EstrategiasJuridicasView.tsx`
**Chave Raiz:** `estrategiasJuridicas`
**Aliases Aceitos:** `estrategias_juridicas`, `estrategias`

```json
{
  "estrategiasJuridicas": {
    "titulo": "Estrategias Juridicas por Polo",
    "secoes": [
      {
        "id": "estrategias_por_polo",
        "titulo": "Estrategias Identificadas",
        "listaEstrategias": [
          {
            "id": "estrategia_autor",
            "polo": "Polo Ativo (Autor)",
            "situacaoAtualPolo": "Posicao favoravel apos instrucao probatoria. Provas documentais corroboradas por testemunhas.",
            "estrategiaPrincipal": {
              "descricao": "Reforcar nas alegacoes finais a prova documental produzida, destacando a confissao parcial do reu em depoimento pessoal",
              "fundamentacaoLegal": "Art. 389 do CC c/c Art. 373, I do CPC",
              "finalidadePratica": "Obter sentenca de procedencia integral com condenacao em custas e honorarios",
              "riscoProcessual": "Baixo",
              "custoEstimado": "Baixo",
              "paginasReferencia": "45-67"
            },
            "estrategiasComplementares": [
              {
                "id": "comp_1",
                "descricao": "Requerer execucao provisoria caso haja apelacao sem efeito suspensivo",
                "fundamentacaoLegal": "Art. 520 do CPC",
                "finalidadePratica": "Antecipar satisfacao do credito",
                "condicaoAdocao": "Sentenca de procedencia + Apelacao do reu",
                "riscoProcessual": "Medio",
                "prioridade": "Secundaria",
                "paginasReferencia": "N/A"
              }
            ]
          },
          {
            "id": "estrategia_reu",
            "polo": "Polo Passivo (Reu)",
            "situacaoAtualPolo": "Posicao desfavoravel. Defesa baseada em excecao de contrato nao cumprido nao foi comprovada.",
            "estrategiaPrincipal": {
              "descricao": "Alegar cerceamento de defesa pelo indeferimento da prova pericial e preparar recurso de apelacao",
              "fundamentacaoLegal": "Art. 5o, LV da CF c/c Art. 1.009 do CPC",
              "finalidadePratica": "Anular sentenca ou reformar decisao em grau recursal",
              "riscoProcessual": "Alto",
              "custoEstimado": "Medio",
              "paginasReferencia": "80-85"
            },
            "estrategiasComplementares": [
              {
                "id": "comp_reu_1",
                "descricao": "Propor acordo para encerramento do litigio com desconto",
                "condicaoAdocao": "Cliente autorizar negociacao",
                "riscoProcessual": "Baixo",
                "prioridade": "Contingente"
              }
            ]
          }
        ]
      },
      {
        "id": "consideracoes_gerais",
        "titulo": "Consideracoes Gerais",
        "campos": [
          {
            "id": "recomendacao_geral",
            "label": "Recomendacao Geral",
            "valor": "Recomenda-se ao polo ativo manter postura firme nas alegacoes finais. Ao polo passivo, avaliar proposta de acordo ou preparar recursos."
          }
        ]
      }
    ]
  }
}
```

---

### ETAPA 6: Riscos e Alertas

**Componente:** `RiscosAlertasView.tsx`
**Chave Raiz:** `riscosAlertasProcessuais`
**Aliases Aceitos:** `riscos_alertas_processuais`, `riscosAlertas`, `riscos_alertas`

```json
{
  "riscosAlertasProcessuais": {
    "titulo": "Riscos e Alertas Processuais",
    "secoes": [
      {
        "id": "alertas_identificados",
        "titulo": "Alertas Identificados",
        "listaAlertas": [
          {
            "id": "alerta_1",
            "categoria": "Prazos",
            "descricaoRisco": "Prazo para alegacoes finais encerra em 5 dias uteis. Perda do prazo pode resultar em preclusao.",
            "baseDocumental": {
              "arquivo": "processo.pdf",
              "pagina": "142",
              "eventoNoSistema": "Despacho de intimacao"
            },
            "poloAfetado": "Autor",
            "gravidade": "Alta",
            "impactoPoloUsuario": "Direto",
            "urgencia": "Imediata",
            "acaoRecomendada": "Protocolar alegacoes finais imediatamente. Prazo fatal em 15/04/2024.",
            "fundamentacaoLegal": "Art. 364, par. 2o do CPC",
            "observacoes": "Nao ha previsao de dilacao de prazo nesta fase"
          },
          {
            "id": "alerta_2",
            "categoria": "Nulidade",
            "descricaoRisco": "Possivel nulidade de citacao por ausencia de poderes do recebedor. AR assinado por terceiro sem procuracao.",
            "baseDocumental": {
              "arquivo": "processo.pdf",
              "pagina": "25-26",
              "eventoNoSistema": "Juntada de AR"
            },
            "poloAfetado": "Reu",
            "gravidade": "Media",
            "impactoPoloUsuario": "Indireto",
            "urgencia": "Proxima Audiencia",
            "acaoRecomendada": "Verificar se reu compareceu espontaneamente, o que supriria eventual nulidade.",
            "fundamentacaoLegal": "Art. 239 e 248 do CPC",
            "observacoes": "Comparecimento espontaneo do reu pode ter sanado nulidade"
          },
          {
            "id": "alerta_3",
            "categoria": "Provas",
            "descricaoRisco": "Documento essencial (contrato original) nao foi juntado aos autos. Apenas copia simples disponivel.",
            "poloAfetado": "Autor",
            "gravidade": "Media",
            "impactoPoloUsuario": "Direto",
            "urgencia": "Monitoramento",
            "acaoRecomendada": "Localizar original ou obter declaracao de autenticidade.",
            "fundamentacaoLegal": "Art. 425 e 430 do CPC"
          }
        ]
      },
      {
        "id": "sintese_riscos",
        "titulo": "Sintese de Riscos",
        "campos": [
          { "id": "risco_global", "label": "Nivel de Risco Global", "valor": "Medio" },
          { "id": "numero_total_alertas", "label": "Total de Alertas", "valor": 3 },
          {
            "id": "areas_criticas",
            "label": "Areas Criticas Identificadas",
            "valor": [
              "Gestao de prazos processuais",
              "Validacao de atos de comunicacao",
              "Completude do acervo probatorio"
            ]
          }
        ]
      }
    ]
  }
}
```

---

### ETAPA 7: Balanco Financeiro

**Componente:** `BalancoFinanceiroView.tsx`
**Chave Raiz:** `balancoFinanceiro`
**Aliases Aceitos:** `balanco_financeiro`, `balanco`, `financeiro`

```json
{
  "balancoFinanceiro": {
    "titulo": "Balanco Financeiro do Processo",
    "secoes": [
      {
        "id": "valor_causa",
        "titulo": "Valor da Causa",
        "campos": [
          { "id": "valor_original", "label": "Valor Original", "valor": "R$ 100.000,00" },
          { "id": "valor_atualizado", "label": "Valor Atualizado (estimativa)", "valor": "R$ 115.000,00" },
          { "id": "data_atualizacao", "label": "Data Base", "valor": "01/04/2024" }
        ],
        "baseDocumental": {
          "arquivo": "processo.pdf",
          "pagina": "3",
          "eventoNoSistema": "Peticao inicial"
        }
      },
      {
        "id": "honorarios_sucumbenciais",
        "titulo": "Honorarios Sucumbenciais",
        "listaHonorarios": [
          {
            "id": "hon_1",
            "tipo": "Honorarios de Sucumbencia",
            "percentualOuValor": "10%",
            "valorEstimado": "R$ 11.500,00",
            "faseFixacao": "Sentenca",
            "poloBeneficiado": "A definir",
            "baseLegal": "Art. 85 do CPC",
            "situacao": "Pendente de fixacao",
            "observacoes": "Percentual estimado com base na media da vara"
          }
        ]
      },
      {
        "id": "constricoes_judiciais",
        "titulo": "Constricoes Judiciais",
        "listaConstricoes": [
          {
            "id": "const_1",
            "tipo": "Bloqueio via SISBAJUD",
            "valorConstrito": "R$ 50.000,00",
            "dataConstricao": "20/01/2024",
            "tipoDeBem": "Valores em conta corrente",
            "situacaoAtual": "Ativo - Valores bloqueados",
            "baseDocumental": {
              "arquivo": "processo.pdf",
              "pagina": "90"
            },
            "observacoes": "Bloqueio deferido em tutela de urgencia"
          }
        ]
      },
      {
        "id": "liberacoes_valores",
        "titulo": "Liberacoes de Valores",
        "listaLiberacoes": [
          {
            "id": "lib_1",
            "valorLiberado": "R$ 10.000,00",
            "beneficiario": "Joao da Silva (Autor)",
            "dataLiberacao": "15/03/2024",
            "meioLiberacao": "Alvara judicial",
            "baseDocumental": {
              "arquivo": "processo.pdf",
              "pagina": "135"
            },
            "observacoes": "Liberacao parcial de valores incontroversos"
          }
        ]
      },
      {
        "id": "custas_processuais",
        "titulo": "Custas Processuais",
        "campos": [
          { "id": "custas_iniciais", "label": "Custas Iniciais", "valor": "R$ 2.500,00" },
          { "id": "custas_periciais", "label": "Custas Periciais", "valor": "R$ 0,00 (Pericia indeferida)" },
          { "id": "custas_recursais", "label": "Custas Recursais", "valor": "R$ 800,00" },
          { "id": "total_custas", "label": "Total de Custas", "valor": "R$ 3.300,00" }
        ]
      },
      {
        "id": "consolidacao_financeira",
        "titulo": "Consolidacao Financeira",
        "campos": [
          { "id": "total_em_disputa", "label": "Total em Disputa", "valor": "R$ 115.000,00" },
          { "id": "total_bloqueado", "label": "Total Bloqueado", "valor": "R$ 50.000,00" },
          { "id": "total_liberado", "label": "Total Ja Liberado", "valor": "R$ 10.000,00" },
          { "id": "saldo_pendente", "label": "Saldo Pendente", "valor": "R$ 40.000,00" }
        ],
        "observacoes": "Valores sujeitos a atualizacao monetaria e juros conforme sentenca"
      }
    ]
  }
}
```

---

### ETAPA 8: Mapa de Preclusoes

**Componente:** `MapaPreclusoesView.tsx`
**Chave Raiz:** `mapaPreclusoesProcessuais`
**Aliases Aceitos:** `mapa_preclusoes_processuais`, `mapaPreclusoes`, `mapa_preclusoes`, `preclusoes`

```json
{
  "mapaPreclusoesProcessuais": {
    "titulo": "Mapa de Preclusoes Processuais",
    "secoes": [
      {
        "id": "preclusoes_ocorridas",
        "titulo": "Preclusoes Ja Ocorridas",
        "listaPreclusoesRecentes": [
          {
            "id": "preclusao_1",
            "tipo": "Temporal",
            "atoOuFaseAtingida": "Impugnacao ao valor da causa",
            "poloAfetado": "Reu",
            "dataInicioPrazo": "19/01/2024",
            "dataFinalPrazo": "09/02/2024",
            "baseLegal": "Art. 293 do CPC",
            "consequenciaPratica": "Valor da causa de R$ 100.000,00 tornou-se definitivo para fins de custas e competencia",
            "acaoRecomendada": "Nenhuma acao possivel - materia preclusa",
            "baseDocumental": {
              "arquivo": "processo.pdf",
              "pagina": "45"
            },
            "observacoes": "Reu apresentou contestacao sem impugnar valor da causa"
          },
          {
            "id": "preclusao_2",
            "tipo": "Consumativa",
            "atoOuFaseAtingida": "Especificacao de provas",
            "poloAfetado": "Ambos os polos",
            "baseLegal": "Art. 357, par. 1o do CPC",
            "consequenciaPratica": "Rol de provas esta definido. Novas provas somente com fato novo.",
            "acaoRecomendada": "Monitorar surgimento de fatos novos",
            "observacoes": "Partes ja especificaram provas em audiencia de saneamento"
          },
          {
            "id": "preclusao_3",
            "tipo": "Logica",
            "atoOuFaseAtingida": "Arguicao de incompetencia territorial",
            "poloAfetado": "Reu",
            "baseLegal": "Art. 65 do CPC",
            "consequenciaPratica": "Reu aceitou tacitamente a competencia ao contestar no merito",
            "acaoRecomendada": "Materia preclusa - sem acao possivel"
          }
        ]
      },
      {
        "id": "riscos_preclusao",
        "titulo": "Riscos Imediatos de Preclusao",
        "listaRiscosImediatos": [
          {
            "id": "risco_1",
            "atoOuFase": "Alegacoes Finais",
            "poloAfetado": "Autor",
            "prazoFinalEstimado": "15/04/2024",
            "urgencia": "Imediata",
            "acaoRecomendada": "Protocolar alegacoes finais ate 15/04/2024",
            "baseLegal": "Art. 364 do CPC",
            "observacoes": "Prazo em curso - 5 dias restantes"
          },
          {
            "id": "risco_2",
            "atoOuFase": "Agravo de Instrumento contra indeferimento de prova",
            "poloAfetado": "Reu",
            "prazoFinalEstimado": "18/03/2024",
            "urgencia": "Imediata",
            "acaoRecomendada": "Decisao: interpor recurso ou aceitar preclusao",
            "baseLegal": "Art. 1.015 do CPC"
          }
        ]
      },
      {
        "id": "sintese_preclusoes",
        "titulo": "Sintese Estrategica",
        "campos": [
          { "id": "total_preclusoes_recentes", "label": "Total de Preclusoes Mapeadas", "valor": 3 },
          { "id": "total_riscos_imediatos", "label": "Riscos Imediatos de Preclusao", "valor": 2 },
          { "id": "impacto_polo_usuario", "label": "Impacto no Polo do Usuario", "valor": "Alto" },
          {
            "id": "recomendacoes",
            "label": "Recomendacoes",
            "valor": [
              "Priorizar protocolo de alegacoes finais",
              "Avaliar custo-beneficio de recurso contra prova indeferida",
              "Manter controle rigoroso de prazos futuros"
            ]
          }
        ],
        "observacoes": "Situacao demanda atencao imediata para evitar novas preclusoes"
      }
    ]
  }
}
```

---

### ETAPA 9: Conclusoes e Perspectivas

**Componente:** `ConclusoesPerspettivasView.tsx`
**Chave Raiz:** `conclusoesPerspectivas`
**Aliases Aceitos:** `conclusoes_perspectivas`, `conclusoes`, `perspectivas`

```json
{
  "conclusoesPerspectivas": {
    "titulo": "Conclusoes e Perspectivas",
    "secoes": [
      {
        "id": "qualidade_documental",
        "titulo": "Qualidade da Documentacao Analisada",
        "completude": {
          "nivel": "Alta",
          "descricao": "O acervo documental esta substancialmente completo, permitindo analise abrangente do caso.",
          "premissasFundamentais": [
            "Peticao inicial e contestacao completas",
            "Atos de comunicacao devidamente documentados",
            "Decisoes interlocutorias e despachos presentes",
            "Atas de audiencia disponiveis"
          ]
        },
        "legibilidade": {
          "nivel": "Alta",
          "descricao": "Documentos digitalizados com boa qualidade. OCR adequado para extracao de texto."
        },
        "coerenciaCronologica": {
          "status": "Coerente",
          "observacoes": "Sequencia de eventos esta consistente. Datas e numeracao de paginas conferem."
        }
      },
      {
        "id": "confianca_analise",
        "titulo": "Confianca da Analise",
        "campos": [
          { "id": "nivel_confianca", "label": "Nivel de Confianca", "valor": "Alta" },
          {
            "id": "justificativa_confianca",
            "label": "Justificativa",
            "valor": "Documentacao completa e legivel permite conclusoes robustas. Ressalva para eventuais documentos nao digitalizados."
          }
        ]
      },
      {
        "id": "conclusoes_perspectivas_finais",
        "titulo": "Conclusoes e Perspectivas Finais",
        "campos": [
          {
            "id": "situacao_atual_processo",
            "label": "Situacao Atual do Processo",
            "valor": "O processo encontra-se em fase final de instrucao, aguardando alegacoes finais das partes para posterior sentenca. A fase probatoria foi concluida com sucesso."
          },
          {
            "id": "tendencia_evolucao",
            "label": "Tendencia de Evolucao",
            "valor": "Fase de Sentenca Iminente"
          },
          {
            "id": "riscos_oportunidades_juridicas",
            "label": "Principais Riscos e Oportunidades",
            "valor": [
              "RISCO: Prazo iminente para alegacoes finais - preclusao em 5 dias",
              "RISCO: Possivel recurso do reu pode prolongar desfecho",
              "OPORTUNIDADE: Provas favorecem autor - alta probabilidade de procedencia",
              "OPORTUNIDADE: Valores ja bloqueados agilizam futura execucao"
            ]
          },
          {
            "id": "proximos_passos_possiveis",
            "label": "Proximos Passos Recomendados",
            "valor": [
              "Protocolar alegacoes finais ate 15/04/2024 (URGENTE)",
              "Preparar minuta de cumprimento de sentenca para protocolo imediato",
              "Avaliar interesse em acordo pre-sentenca com reu",
              "Monitorar publicacao da sentenca apos alegacoes finais"
            ]
          }
        ],
        "observacoesFinais": "Analise baseada em documentacao disponivel ate a data de processamento. Recomenda-se validacao por profissional habilitado antes de qualquer acao processual."
      }
    ]
  }
}
```

---

## 5. Mecanismos de Normalizacao e Fallback

### 5.1 Normalizacao de Chaves (viewNormalizer.ts)

O sistema aceita variacoes de nomenclatura nas chaves raiz:

```typescript
function findKeyFlexible(obj: object, primaryKey: string, alternateKeys: string[]): any {
  const allKeys = [primaryKey, ...alternateKeys];

  for (const key of Object.keys(obj)) {
    const normalizedKey = key.toLowerCase().replace(/[_-]/g, '');

    for (const candidate of allKeys) {
      const normalizedCandidate = candidate.toLowerCase().replace(/[_-]/g, '');
      if (normalizedKey === normalizedCandidate) {
        return obj[key];
      }
    }
  }

  return null;
}
```

### 5.2 Sanitizacao de JSON (jsonSanitizer.ts)

```typescript
function sanitizeJsonResponse(text: string): string {
  // Remove texto introdutorio
  text = text.replace(/^(Com certeza|Aqui esta|Segue)[^{]*/, '');

  // Remove marcadores markdown
  text = text.replace(/^```json\n?/, '');
  text = text.replace(/^```\n?/, '');
  text = text.replace(/\n?```$/, '');

  // Remove caracteres de controle
  text = text.replace(/[\x00-\x1F\x7F]/g, '');

  return text.trim();
}
```

### 5.3 Reparo de JSON Truncado (jsonValidator.ts)

```typescript
function repairTruncatedJson(text: string): string {
  let openBraces = 0;
  let openBrackets = 0;

  for (const char of text) {
    if (char === '{') openBraces++;
    if (char === '}') openBraces--;
    if (char === '[') openBrackets++;
    if (char === ']') openBrackets--;
  }

  // Adiciona fechamentos faltantes
  while (openBrackets > 0) { text += ']'; openBrackets--; }
  while (openBraces > 0) { text += '}'; openBraces--; }

  return text;
}
```

### 5.4 Fallback Universal (AnalysisContentRenderer.tsx)

Quando nenhuma view especifica consegue processar o JSON, o componente generico renderiza o conteudo de forma recursiva.

---

## 6. Tabela Resumo

| Etapa | Componente | Chave Raiz | Aliases |
|-------|------------|------------|---------|
| 1 | VisaoGeralProcessoView | `visaoGeralProcesso` | visao_geral_processo, visaoGeral, visao_geral |
| 2 | ResumoEstrategicoView | `resumoEstrategico` | resumo_estrategico, resumo |
| 3 | ComunicacoesPrazosView | `comunicacoesPrazos` | comunicacoes_prazos, comunicacoes |
| 4 | AdmissibilidadeRecursalView | `recursosAdmissibilidade` | recursos_admissibilidade, admissibilidade, recursos |
| 5 | EstrategiasJuridicasView | `estrategiasJuridicas` | estrategias_juridicas, estrategias |
| 6 | RiscosAlertasView | `riscosAlertasProcessuais` | riscos_alertas_processuais, riscosAlertas, riscos_alertas |
| 7 | BalancoFinanceiroView | `balancoFinanceiro` | balanco_financeiro, balanco, financeiro |
| 8 | MapaPreclusoesView | `mapaPreclusoesProcessuais` | mapa_preclusoes_processuais, mapaPreclusoes, mapa_preclusoes, preclusoes |
| 9 | ConclusoesPerspettivasView | `conclusoesPerspectivas` | conclusoes_perspectivas, conclusoes, perspectivas |

---

## Observacoes Finais

1. **Consistencia de Tipos**: Campos que podem ser string ou number (como `pagina`, `valor`) devem ser tratados com conversao segura nas views.

2. **Campos Opcionais**: A maioria dos campos internos sao opcionais (marcados com `?`). As views devem renderizar condicionalmente.

3. **Arrays vs Objetos**: Alguns campos como `destinatario` podem ser objeto unico ou array. As views tratam ambos os casos.

4. **Valores Padronizados**: Campos como `gravidade`, `urgencia`, `impacto` usam valores predefinidos para permitir estilizacao visual (badges coloridos).

---

**Documento gerado para referencia tecnica do sistema GPI (Gestao de Processos Inteligente).**
