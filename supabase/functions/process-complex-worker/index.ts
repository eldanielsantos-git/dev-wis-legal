import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { GoogleGenerativeAI, SchemaType } from 'npm:@google/generative-ai@0.24.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const campoSchema = {
  type: SchemaType.OBJECT,
  properties: {
    id: { type: SchemaType.STRING },
    label: { type: SchemaType.STRING },
    valor: { type: SchemaType.STRING, nullable: true },
    paginas_referencia: { type: SchemaType.STRING, nullable: true }
  },
  required: ["id", "label"]
};

const documentoAnalisadoSchema = {
  type: SchemaType.OBJECT,
  properties: {
    id: { type: SchemaType.STRING },
    arquivo: { type: SchemaType.STRING },
    paginas: { type: SchemaType.INTEGER },
    tipoProcesso: { type: SchemaType.STRING }
  },
  required: ["id", "arquivo"]
};

const parteSchema = {
  type: SchemaType.OBJECT,
  properties: {
    id: { type: SchemaType.STRING },
    nome: { type: SchemaType.STRING },
    cpfCnpj: { type: SchemaType.STRING, nullable: true },
    Polo: { type: SchemaType.STRING },
    poloDoUsuario: { type: SchemaType.BOOLEAN }
  },
  required: ["id", "nome", "Polo"]
};

const eventoProcessualSchema = {
  type: SchemaType.OBJECT,
  properties: {
    id: { type: SchemaType.STRING },
    evento: { type: SchemaType.STRING },
    data: { type: SchemaType.STRING, nullable: true },
    resumo: { type: SchemaType.STRING }
  },
  required: ["id", "evento", "resumo"]
};

const processoRelacionadoSchema = {
  type: SchemaType.OBJECT,
  properties: {
    id: { type: SchemaType.STRING },
    numero: { type: SchemaType.STRING, nullable: true },
    relacao: { type: SchemaType.STRING, nullable: true },
    notas: { type: SchemaType.STRING, nullable: true }
  },
  required: ["id"]
};

const secaoGenericaEtapa1Schema = {
  type: SchemaType.OBJECT,
  properties: {
    id: { type: SchemaType.STRING },
    titulo: { type: SchemaType.STRING },
    campos: { type: SchemaType.ARRAY, items: campoSchema },
    documentosAnalisados: { type: SchemaType.ARRAY, items: documentoAnalisadoSchema },
    lista: { type: SchemaType.ARRAY, items: parteSchema },
    eventosProcessuais: { type: SchemaType.ARRAY, items: eventoProcessualSchema },
    processosRelacionados: { type: SchemaType.ARRAY, items: processoRelacionadoSchema }
  },
  required: ["id", "titulo"]
};

const etapa1Schema = {
  type: SchemaType.OBJECT,
  properties: {
    visaoGeralProcesso: {
      type: SchemaType.OBJECT,
      properties: {
        titulo: { type: SchemaType.STRING },
        secoes: {
          type: SchemaType.ARRAY,
          items: secaoGenericaEtapa1Schema
        }
      },
      required: ["titulo", "secoes"]
    }
  },
  required: ["visaoGeralProcesso"]
};

const proximaProvidenciaSchema = {
  type: SchemaType.OBJECT,
  properties: {
    parte: { type: SchemaType.STRING, nullable: true },
    providencia: { type: SchemaType.STRING, nullable: true },
    prazo: { type: SchemaType.STRING, nullable: true },
    carater_urgencia: { type: SchemaType.BOOLEAN },
    paginas_referencia: { type: SchemaType.STRING, nullable: true }
  }
};

const statusProcessualSchema = {
  type: SchemaType.OBJECT,
  properties: {
    descricao: { type: SchemaType.STRING, nullable: true },
    paginas_referencia: { type: SchemaType.STRING, nullable: true },
    proximaProvidencia: proximaProvidenciaSchema
  }
};

const secaoEtapa2Schema = {
  type: SchemaType.OBJECT,
  properties: {
    id: { type: SchemaType.STRING },
    titulo: { type: SchemaType.STRING },
    campos: { type: SchemaType.ARRAY, items: campoSchema },
    statusProcessual: statusProcessualSchema
  },
  required: ["id", "titulo"]
};

const etapa2Schema = {
  type: SchemaType.OBJECT,
  properties: {
    resumoEstrategico: {
      type: SchemaType.OBJECT,
      properties: {
        titulo: { type: SchemaType.STRING },
        secoes: {
          type: SchemaType.ARRAY,
          items: secaoEtapa2Schema
        }
      },
      required: ["titulo", "secoes"]
    }
  },
  required: ["resumoEstrategico"]
};

const prazoDerivadoSchema = {
  type: SchemaType.OBJECT,
  properties: {
    id: { type: SchemaType.STRING },
    tipoPrazo: { type: SchemaType.STRING, nullable: true },
    finalidade: { type: SchemaType.STRING, nullable: true },
    baseLegal: { type: SchemaType.STRING, nullable: true },
    dataInicio: { type: SchemaType.STRING, nullable: true },
    duracao: { type: SchemaType.STRING, nullable: true },
    dataFinal: { type: SchemaType.STRING, nullable: true },
    status: { type: SchemaType.STRING, nullable: true },
    observacoes: { type: SchemaType.STRING, nullable: true }
  },
  required: ["id"]
};

const destinatarioSchema = {
  type: SchemaType.OBJECT,
  properties: {
    nome: { type: SchemaType.STRING, nullable: true },
    documento: { type: SchemaType.STRING, nullable: true },
    tipo: { type: SchemaType.STRING, nullable: true },
    status: { type: SchemaType.STRING, nullable: true },
    dataAto: { type: SchemaType.STRING, nullable: true },
    dataJuntada: { type: SchemaType.STRING, nullable: true },
    notas: { type: SchemaType.STRING, nullable: true },
    pagina: { type: SchemaType.STRING, nullable: true }
  }
};

const detalhesARSchema = {
  type: SchemaType.OBJECT,
  properties: {
    nomeManuscrito: { type: SchemaType.STRING, nullable: true },
    assinaturaPresente: { type: SchemaType.STRING, nullable: true },
    motivoDevolucaoExistente: { type: SchemaType.STRING, nullable: true },
    motivoDevolucaoIndicado: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    notas: { type: SchemaType.STRING, nullable: true }
  }
};

const atoSchema = {
  type: SchemaType.OBJECT,
  properties: {
    id: { type: SchemaType.STRING },
    tipoAto: { type: SchemaType.STRING, nullable: true },
    modalidade: { type: SchemaType.STRING, nullable: true },
    destinatario: destinatarioSchema,
    detalhesAR: detalhesARSchema,
    prazosDerivados: { type: SchemaType.ARRAY, items: prazoDerivadoSchema }
  },
  required: ["id"]
};

const secaoEtapa3Schema = {
  type: SchemaType.OBJECT,
  properties: {
    id: { type: SchemaType.STRING },
    titulo: { type: SchemaType.STRING },
    listaAtos: { type: SchemaType.ARRAY, items: atoSchema }
  },
  required: ["id", "titulo"]
};

const etapa3Schema = {
  type: SchemaType.OBJECT,
  properties: {
    comunicacoesPrazos: {
      type: SchemaType.OBJECT,
      properties: {
        titulo: { type: SchemaType.STRING },
        secoes: {
          type: SchemaType.ARRAY,
          items: secaoEtapa3Schema
        }
      },
      required: ["titulo", "secoes"]
    }
  },
  required: ["comunicacoesPrazos"]
};

const recursoIdentificadoSchema = {
  type: SchemaType.OBJECT,
  properties: {
    id: { type: SchemaType.STRING },
    tipoRecurso: { type: SchemaType.STRING, nullable: true },
    dataInterposicao: { type: SchemaType.STRING, nullable: true },
    paginas_referencia: { type: SchemaType.STRING, nullable: true },
    tempestividade: { type: SchemaType.STRING, nullable: true },
    preparoComprovado: { type: SchemaType.STRING, nullable: true },
    regularidadeFormal: { type: SchemaType.STRING, nullable: true },
    juizoAdmissibilidade: { type: SchemaType.STRING, nullable: true },
    dataDecisaoAdmissibilidade: { type: SchemaType.STRING, nullable: true },
    decisaoAdmissibilidadePagina: { type: SchemaType.STRING, nullable: true },
    situacaoAtual: { type: SchemaType.STRING, nullable: true },
    notas: { type: SchemaType.STRING, nullable: true }
  },
  required: ["id"]
};

const recursoCabivelSchema = {
  type: SchemaType.OBJECT,
  properties: {
    id: { type: SchemaType.STRING },
    tipoDecisaoRecorrivel: { type: SchemaType.STRING, nullable: true },
    dataDecisao: { type: SchemaType.STRING, nullable: true },
    paginas_referencia: { type: SchemaType.STRING, nullable: true },
    recursoCabivel: { type: SchemaType.STRING, nullable: true },
    prazoLegal: { type: SchemaType.STRING, nullable: true },
    baseLegal: { type: SchemaType.STRING, nullable: true },
    dataFinalInterposicao: { type: SchemaType.STRING, nullable: true },
    situacao: { type: SchemaType.STRING, nullable: true },
    observacoes: { type: SchemaType.STRING, nullable: true }
  },
  required: ["id"]
};

const secaoEtapa4Schema = {
  type: SchemaType.OBJECT,
  properties: {
    id: { type: SchemaType.STRING },
    titulo: { type: SchemaType.STRING },
    listaRecursosIdentificados: { type: SchemaType.ARRAY, items: recursoIdentificadoSchema },
    listaRecursosCabiveis: { type: SchemaType.ARRAY, items: recursoCabivelSchema }
  },
  required: ["id", "titulo"]
};

const etapa4Schema = {
  type: SchemaType.OBJECT,
  properties: {
    recursosAdmissibilidade: {
      type: SchemaType.OBJECT,
      properties: {
        titulo: { type: SchemaType.STRING },
        secoes: {
          type: SchemaType.ARRAY,
          items: secaoEtapa4Schema
        }
      },
      required: ["titulo", "secoes"]
    }
  },
  required: ["recursosAdmissibilidade"]
};

const estrategiaComplementarSchema = {
  type: SchemaType.OBJECT,
  properties: {
    id: { type: SchemaType.STRING },
    descricao: { type: SchemaType.STRING, nullable: true },
    condicaoAdocao: { type: SchemaType.STRING, nullable: true },
    fundamentacaoLegal: { type: SchemaType.STRING, nullable: true },
    finalidadePratica: { type: SchemaType.STRING, nullable: true },
    riscoProcessual: { type: SchemaType.STRING, nullable: true },
    prioridade: { type: SchemaType.STRING, nullable: true },
    paginasReferencia: { type: SchemaType.STRING, nullable: true }
  },
  required: ["id"]
};

const estrategiaPrincipalSchema = {
  type: SchemaType.OBJECT,
  properties: {
    descricao: { type: SchemaType.STRING, nullable: true },
    fundamentacaoLegal: { type: SchemaType.STRING, nullable: true },
    finalidadePratica: { type: SchemaType.STRING, nullable: true },
    riscoProcessual: { type: SchemaType.STRING, nullable: true },
    custoEstimado: { type: SchemaType.STRING, nullable: true },
    prioridade: { type: SchemaType.STRING, nullable: true },
    paginasReferencia: { type: SchemaType.STRING, nullable: true }
  }
};

const estrategiaPoloSchema = {
  type: SchemaType.OBJECT,
  properties: {
    id: { type: SchemaType.STRING },
    polo: { type: SchemaType.STRING },
    situacaoAtualPolo: { type: SchemaType.STRING, nullable: true },
    estrategiaPrincipal: estrategiaPrincipalSchema,
    estrategiasComplementares: { type: SchemaType.ARRAY, items: estrategiaComplementarSchema }
  },
  required: ["id", "polo"]
};

const analiseGlobalEtapa5Schema = {
  type: SchemaType.OBJECT,
  properties: {
    sinteseEstrategica: { type: SchemaType.STRING, nullable: true },
    pontosAtencaoCriticos: { type: SchemaType.STRING, nullable: true },
    oportunidadesJuridicasGerais: { type: SchemaType.STRING, nullable: true },
    riscosGeraisIdentificados: { type: SchemaType.STRING, nullable: true }
  }
};

const secaoEtapa5Schema = {
  type: SchemaType.OBJECT,
  properties: {
    id: { type: SchemaType.STRING },
    titulo: { type: SchemaType.STRING },
    listaEstrategias: { type: SchemaType.ARRAY, items: estrategiaPoloSchema },
    analiseGlobal: analiseGlobalEtapa5Schema
  },
  required: ["id", "titulo"]
};

const etapa5Schema = {
  type: SchemaType.OBJECT,
  properties: {
    estrategiasJuridicas: {
      type: SchemaType.OBJECT,
      properties: {
        titulo: { type: SchemaType.STRING },
        secoes: {
          type: SchemaType.ARRAY,
          items: secaoEtapa5Schema
        }
      },
      required: ["titulo", "secoes"]
    }
  },
  required: ["estrategiasJuridicas"]
};

const alertaSchema = {
  type: SchemaType.OBJECT,
  properties: {
    id: { type: SchemaType.STRING },
    categoria: { type: SchemaType.STRING, nullable: true },
    descricaoRisco: { type: SchemaType.STRING, nullable: true },
    poloAfetado: { type: SchemaType.STRING, nullable: true },
    gravidade: { type: SchemaType.STRING, nullable: true },
    urgencia: { type: SchemaType.STRING, nullable: true },
    acaoRecomendada: { type: SchemaType.STRING, nullable: true },
    fundamentacaoLegal: { type: SchemaType.STRING, nullable: true },
    paginasReferencia: { type: SchemaType.STRING, nullable: true },
    observacoes: { type: SchemaType.STRING, nullable: true }
  },
  required: ["id"]
};

const secaoEtapa6Schema = {
  type: SchemaType.OBJECT,
  properties: {
    id: { type: SchemaType.STRING },
    titulo: { type: SchemaType.STRING },
    listaAlertas: { type: SchemaType.ARRAY, items: alertaSchema },
    campos: { type: SchemaType.ARRAY, items: campoSchema }
  },
  required: ["id", "titulo"]
};

const etapa6Schema = {
  type: SchemaType.OBJECT,
  properties: {
    riscosAlertasProcessuais: {
      type: SchemaType.OBJECT,
      properties: {
        titulo: { type: SchemaType.STRING },
        secoes: {
          type: SchemaType.ARRAY,
          items: secaoEtapa6Schema
        }
      },
      required: ["titulo", "secoes"]
    }
  },
  required: ["riscosAlertasProcessuais"]
};

const honorarioSchema = {
  type: SchemaType.OBJECT,
  properties: {
    id: { type: SchemaType.STRING },
    tipo: { type: SchemaType.STRING, nullable: true },
    percentualOuValor: { type: SchemaType.STRING, nullable: true },
    valorEstimado: { type: SchemaType.STRING, nullable: true },
    faseFixacao: { type: SchemaType.STRING, nullable: true },
    poloBeneficiado: { type: SchemaType.STRING, nullable: true },
    baseLegal: { type: SchemaType.STRING, nullable: true },
    dataFixacao: { type: SchemaType.STRING, nullable: true },
    paginaReferencia: { type: SchemaType.STRING, nullable: true },
    situacao: { type: SchemaType.STRING, nullable: true },
    observacoes: { type: SchemaType.STRING, nullable: true }
  },
  required: ["id"]
};

const baseDocumentalSchema = {
  type: SchemaType.OBJECT,
  properties: {
    arquivo: { type: SchemaType.STRING, nullable: true },
    pagina: { type: SchemaType.STRING, nullable: true },
    eventoNoSistema: { type: SchemaType.STRING, nullable: true }
  }
};

const constricaoSchema = {
  type: SchemaType.OBJECT,
  properties: {
    id: { type: SchemaType.STRING },
    tipo: { type: SchemaType.STRING, nullable: true },
    valorConstrito: { type: SchemaType.STRING, nullable: true },
    dataConstricao: { type: SchemaType.STRING, nullable: true },
    tipoDeBem: { type: SchemaType.STRING, nullable: true },
    situacaoAtual: { type: SchemaType.STRING, nullable: true },
    baseDocumental: baseDocumentalSchema,
    observacoes: { type: SchemaType.STRING, nullable: true }
  },
  required: ["id"]
};

const liberacaoSchema = {
  type: SchemaType.OBJECT,
  properties: {
    id: { type: SchemaType.STRING },
    tipo: { type: SchemaType.STRING, nullable: true },
    valorLiberado: { type: SchemaType.STRING, nullable: true },
    dataLiberacao: { type: SchemaType.STRING, nullable: true },
    beneficiario: { type: SchemaType.STRING, nullable: true },
    baseDocumental: baseDocumentalSchema,
    observacoes: { type: SchemaType.STRING, nullable: true }
  },
  required: ["id"]
};

const depositoSchema = {
  type: SchemaType.OBJECT,
  properties: {
    id: { type: SchemaType.STRING },
    tipo: { type: SchemaType.STRING, nullable: true },
    valorDepositado: { type: SchemaType.STRING, nullable: true },
    dataDeposito: { type: SchemaType.STRING, nullable: true },
    depositante: { type: SchemaType.STRING, nullable: true },
    finalidade: { type: SchemaType.STRING, nullable: true },
    baseDocumental: baseDocumentalSchema,
    observacoes: { type: SchemaType.STRING, nullable: true }
  },
  required: ["id"]
};

const secaoEtapa7Schema = {
  type: SchemaType.OBJECT,
  properties: {
    id: { type: SchemaType.STRING },
    titulo: { type: SchemaType.STRING },
    campos: { type: SchemaType.ARRAY, items: campoSchema },
    observacoes: { type: SchemaType.STRING, nullable: true },
    listaHonorarios: { type: SchemaType.ARRAY, items: honorarioSchema },
    listaConstricoes: { type: SchemaType.ARRAY, items: constricaoSchema },
    listaLiberacoes: { type: SchemaType.ARRAY, items: liberacaoSchema },
    listaDepositos: { type: SchemaType.ARRAY, items: depositoSchema }
  },
  required: ["id", "titulo"]
};

const etapa7Schema = {
  type: SchemaType.OBJECT,
  properties: {
    balancoFinanceiro: {
      type: SchemaType.OBJECT,
      properties: {
        titulo: { type: SchemaType.STRING },
        secoes: {
          type: SchemaType.ARRAY,
          items: secaoEtapa7Schema
        }
      },
      required: ["titulo", "secoes"]
    }
  },
  required: ["balancoFinanceiro"]
};

const preclusaoRecenteSchema = {
  type: SchemaType.OBJECT,
  properties: {
    id: { type: SchemaType.STRING },
    tipo: { type: SchemaType.STRING, nullable: true },
    atoOuFaseAtingida: { type: SchemaType.STRING, nullable: true },
    poloAfetado: { type: SchemaType.STRING, nullable: true },
    dataInicioPrazo: { type: SchemaType.STRING, nullable: true },
    dataFinalPrazo: { type: SchemaType.STRING, nullable: true },
    baseLegal: { type: SchemaType.STRING, nullable: true },
    consequenciaPratica: { type: SchemaType.STRING, nullable: true },
    acaoRecomendada: { type: SchemaType.STRING, nullable: true },
    statusPrazo: { type: SchemaType.STRING, nullable: true },
    paginasReferencia: { type: SchemaType.STRING, nullable: true },
    observacoes: { type: SchemaType.STRING, nullable: true }
  },
  required: ["id"]
};

const riscoImediatoSchema = {
  type: SchemaType.OBJECT,
  properties: {
    id: { type: SchemaType.STRING },
    atoOuFase: { type: SchemaType.STRING, nullable: true },
    poloAfetado: { type: SchemaType.STRING, nullable: true },
    prazoFinalEstimado: { type: SchemaType.STRING, nullable: true },
    urgencia: { type: SchemaType.STRING, nullable: true },
    acaoRecomendada: { type: SchemaType.STRING, nullable: true },
    baseLegal: { type: SchemaType.STRING, nullable: true },
    baseDocumental: baseDocumentalSchema,
    observacoes: { type: SchemaType.STRING, nullable: true }
  },
  required: ["id"]
};

const analiseGlobalEtapa8Schema = {
  type: SchemaType.OBJECT,
  properties: {
    totalPreclusoesRecentes: { type: SchemaType.INTEGER, nullable: true },
    totalRiscosImediatos: { type: SchemaType.INTEGER, nullable: true },
    analiseImpactoEstrategico: { type: SchemaType.STRING, nullable: true },
    oportunidadesAlegacao: { type: SchemaType.STRING, nullable: true },
    acoesPrioritariasGerais: { type: SchemaType.STRING, nullable: true }
  }
};

const secaoEtapa8Schema = {
  type: SchemaType.OBJECT,
  properties: {
    id: { type: SchemaType.STRING },
    titulo: { type: SchemaType.STRING },
    listaPreclusoesRecentes: { type: SchemaType.ARRAY, items: preclusaoRecenteSchema },
    listaRiscosImediatos: { type: SchemaType.ARRAY, items: riscoImediatoSchema },
    analiseGlobal: analiseGlobalEtapa8Schema
  },
  required: ["id", "titulo"]
};

const etapa8Schema = {
  type: SchemaType.OBJECT,
  properties: {
    mapaPreclusoesProcessuais: {
      type: SchemaType.OBJECT,
      properties: {
        titulo: { type: SchemaType.STRING },
        secoes: {
          type: SchemaType.ARRAY,
          items: secaoEtapa8Schema
        }
      },
      required: ["titulo", "secoes"]
    }
  },
  required: ["mapaPreclusoesProcessuais"]
};

const completudeSchema = {
  type: SchemaType.OBJECT,
  properties: {
    nivel: { type: SchemaType.STRING, nullable: true },
    descricao: { type: SchemaType.STRING, nullable: true },
    premissasFundamentais: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
  }
};

const legibilidadeSchema = {
  type: SchemaType.OBJECT,
  properties: {
    nivel: { type: SchemaType.STRING, nullable: true },
    descricao: { type: SchemaType.STRING, nullable: true }
  }
};

const coerenciaCronologicaSchema = {
  type: SchemaType.OBJECT,
  properties: {
    status: { type: SchemaType.STRING, nullable: true },
    observacoes: { type: SchemaType.STRING, nullable: true }
  }
};

const analiseConfiancaSchema = {
  type: SchemaType.OBJECT,
  properties: {
    nivelConfianca: { type: SchemaType.STRING, nullable: true },
    justificativa: { type: SchemaType.STRING, nullable: true },
    limitacoesAnalise: { type: SchemaType.STRING, nullable: true }
  }
};

const sinteseGlobalSchema = {
  type: SchemaType.OBJECT,
  properties: {
    situacaoAtualProcesso: { type: SchemaType.STRING, nullable: true },
    tendenciaEvolucao: { type: SchemaType.STRING, nullable: true },
    sinteseRiscosOportunidades: { type: SchemaType.STRING, nullable: true },
    proximosPassosPossiveis: { type: SchemaType.STRING, nullable: true },
    observacoesFinais: { type: SchemaType.STRING, nullable: true }
  }
};

const secaoEtapa9Schema = {
  type: SchemaType.OBJECT,
  properties: {
    id: { type: SchemaType.STRING },
    titulo: { type: SchemaType.STRING },
    completude: completudeSchema,
    legibilidade: legibilidadeSchema,
    coerenciaCronologica: coerenciaCronologicaSchema,
    analiseConfianca: analiseConfiancaSchema,
    sinteseGlobal: sinteseGlobalSchema
  },
  required: ["id", "titulo"]
};

const etapa9Schema = {
  type: SchemaType.OBJECT,
  properties: {
    conclusoesPerspectivas: {
      type: SchemaType.OBJECT,
      properties: {
        titulo: { type: SchemaType.STRING },
        secoes: {
          type: SchemaType.ARRAY,
          items: secaoEtapa9Schema
        }
      },
      required: ["titulo", "secoes"]
    }
  },
  required: ["conclusoesPerspectivas"]
};

const schemasMap: Record<number, any> = {
  1: etapa1Schema,
  2: etapa2Schema,
  3: etapa3Schema,
  4: etapa4Schema,
  5: etapa5Schema,
  6: etapa6Schema,
  7: etapa7Schema,
  8: etapa8Schema,
  9: etapa9Schema,
};

function getSchemaByExecutionOrder(executionOrder: number | null | undefined): any {
  if (executionOrder === null || executionOrder === undefined) {
    return undefined;
  }

  if (executionOrder < 1 || executionOrder > 9) {
    return undefined;
  }

  return schemasMap[executionOrder];
}

async function getMaxOutputTokens(
  supabase: any,
  contextKey: string,
  fallbackValue: number
): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('token_limits_config')
      .select('max_output_tokens, is_active')
      .eq('context_key', contextKey)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.warn(`Warning: Error fetching token limit for ${contextKey}, using fallback:`, error);
      return fallbackValue;
    }

    if (data) {
      console.log(`Token limit for ${contextKey}: ${data.max_output_tokens}`);
      return data.max_output_tokens;
    }

    console.warn(`Warning: No active token limit found for ${contextKey}, using fallback: ${fallbackValue}`);
    return fallbackValue;
  } catch (error) {
    console.warn(`Warning: Exception fetching token limit for ${contextKey}, using fallback:`, error);
    return fallbackValue;
  }
}

async function getActiveModels(supabase: any) {
  const { data, error } = await supabase
    .from('admin_system_models')
    .select('*')
    .eq('is_active', true)
    .order('priority', { ascending: true });

  if (error || !data || data.length === 0) {
    throw new Error('Nenhum modelo ativo encontrado');
  }

  const configuredMaxTokens = await getMaxOutputTokens(supabase, 'analysis_complex_files', 60000);

  return data.map((model: any) => ({
    id: model.id,
    name: model.display_name || model.name,
    modelId: model.system_model || model.model_id,
    llmProvider: model.llm_provider,
    temperature: model.temperature ?? 0.2,
    maxTokens: model.max_tokens ?? configuredMaxTokens,
    priority: model.priority,
  }));
}

function isRetryableError(error: any): boolean {
  const errorStr = error?.message?.toLowerCase() || '';
  const statusCode = error?.status;

  return (
    statusCode === 503 ||
    statusCode === 429 ||
    statusCode === 500 ||
    errorStr.includes('overloaded') ||
    errorStr.includes('rate limit') ||
    errorStr.includes('timeout') ||
    errorStr.includes('temporarily unavailable') ||
    errorStr.includes('service unavailable') ||
    errorStr.includes('resource_exhausted') ||
    errorStr.includes('invalid argument') ||
    errorStr.includes('invalid_argument') ||
    errorStr.includes('too large') ||
    errorStr.includes('context length') ||
    errorStr.includes('token limit')
  );
}

async function notifyModelSwitch(
  supabase: any,
  processoId: string,
  fromModel: string,
  toModel: string,
  reason: string
) {
  try {
    const { data: processo } = await supabase
      .from('processos')
      .select('user_id')
      .eq('id', processoId)
      .single();

    if (processo?.user_id) {
      await supabase
        .from('notifications')
        .insert({
          user_id: processo.user_id,
          message: `Modelo alterado de "${fromModel}" para "${toModel}" devido a: ${reason}`,
          read: false,
        });
    }
  } catch (err) {
    console.error('Erro ao criar notificacao de troca de modelo:', err);
  }
}

async function generateContextSummary(
  supabase: any,
  geminiModel: any,
  chunkResult: string,
  chunkIndex: number
): Promise<string> {
  const summaryPrompt = `Voce e um assistente especializado em criar resumos executivos.

Analise o texto abaixo e crie um resumo executivo conciso (maximo 1500 tokens) que contenha:

1. Principais pontos identificados
2. Entidades mencionadas (nomes, datas, valores importantes)
3. Topicos principais
4. Contexto relevante para analise das proximas secoes

Este resumo sera usado como contexto para analise das proximas partes do documento.

TEXTO DO CHUNK ${chunkIndex + 1}:
${chunkResult}

Responda apenas com o resumo executivo em formato de texto estruturado.`;

  const configuredMaxTokens = await getMaxOutputTokens(supabase, 'analysis_complex_files', 60000);

  const summaryResult = await geminiModel.generateContent({
    contents: [{ role: 'user', parts: [{ text: summaryPrompt }] }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: configuredMaxTokens,
    },
  });

  const response = await summaryResult.response;
  return response.text().trim();
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const workerId = crypto.randomUUID().slice(0, 8);
  let queueItemId: string | null = null;
  let processoId: string | null = null;
  let supabase: any = null;
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  try {
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')!;

    supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`\n[${workerId}] Worker iniciado`);

    const { data: queueItem, error: queueError } = await supabase
      .rpc('acquire_next_queue_item', {
        p_worker_id: workerId,
        p_lock_duration_minutes: 15
      })
      .maybeSingle();

    if (queueError) {
      console.error(`[${workerId}] Erro ao buscar item da fila:`, queueError);
      throw queueError;
    }

    if (!queueItem) {
      console.log(`[${workerId}] Nenhum item na fila`);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Nenhum item disponivel na fila',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    queueItemId = queueItem.queue_item_id;
    processoId = queueItem.processo_id;

    console.log(`[${workerId}] Item adquirido da fila: ${queueItemId}`);
    console.log(`[${workerId}] Processo: ${processoId}, Chunk: ${queueItem.chunk_id}`);
    console.log(`[${workerId}] Tentativa: ${queueItem.attempt_number}`);

    await supabase.rpc('register_worker', {
      p_processo_id: processoId,
      p_worker_id: workerId
    });

    await supabase
      .from('complex_processing_status')
      .update({
        current_phase: 'processing',
        chunks_processing: 1,
        last_heartbeat: new Date().toISOString(),
      })
      .eq('processo_id', processoId);

    const heartbeatInterval = setInterval(async () => {
      await supabase.rpc('update_queue_heartbeat', {
        p_queue_item_id: queueItemId,
        p_worker_id: workerId
      });
      console.log(`[${workerId}] Heartbeat enviado`);
    }, 30000);

    try {
      const startTime = Date.now();

      const { data: chunk, error: chunkError } = await supabase
        .from('process_chunks')
        .select('*')
        .eq('id', queueItem.chunk_id)
        .single();

      if (chunkError || !chunk) {
        throw new Error('Chunk nao encontrado');
      }

      console.log(`[${workerId}] Processando chunk ${chunk.chunk_index + 1}/${chunk.total_chunks}`);

      let retries = 0;
      const maxRetries = 120;

      while ((!chunk.gemini_file_uri || chunk.gemini_file_state !== 'ACTIVE') && retries < maxRetries) {
        if (retries === 0) {
          console.log(`[${workerId}] Chunk ainda nao esta ATIVO no Gemini, aguardando...`);
        }

        await new Promise(resolve => setTimeout(resolve, 5000));

        const { data: freshChunk } = await supabase
          .from('process_chunks')
          .select('gemini_file_uri, gemini_file_state')
          .eq('id', chunk.id)
          .single();

        if (freshChunk) {
          chunk.gemini_file_uri = freshChunk.gemini_file_uri;
          chunk.gemini_file_state = freshChunk.gemini_file_state;
        }

        retries++;

        if (retries % 12 === 0) {
          console.log(`[${workerId}] Ainda aguardando upload do chunk (${retries * 5}s)...`);
        }
      }

      if (!chunk.gemini_file_uri || chunk.gemini_file_state !== 'ACTIVE') {
        console.error(`[${workerId}] Chunk nao ficou ATIVO apos ${maxRetries * 5}s. Estado: ${chunk.gemini_file_state}`);

        console.log(`[${workerId}] Tentando reenviar chunk para Gemini...`);

        try {
          await fetch(`${supabaseUrl}/functions/v1/upload-to-gemini`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              processo_id: processoId,
              chunk_id: chunk.id,
            }),
          });

          throw new Error(`Chunk nao estava ATIVO, reenvio disparado. Worker deve retentar.`);
        } catch (retryErr) {
          throw new Error(`Chunk nao foi enviado para Gemini apos ${maxRetries * 5} segundos. Estado: ${chunk.gemini_file_state}`);
        }
      }

      console.log(`[${workerId}] Chunk esta ATIVO no Gemini: ${chunk.gemini_file_uri}`);


      let contextFromPrevious: any = null;
      if (queueItem.context_data?.has_previous_context) {
        const { data: prevContext } = await supabase
          .rpc('get_chunk_context', {
            p_processo_id: processoId,
            p_current_chunk_index: chunk.chunk_index + 1
          })
          .maybeSingle();

        contextFromPrevious = prevContext?.context_summary;
        console.log(`[${workerId}] Contexto do chunk anterior carregado`);
      }

      const { data: promptInfo } = await supabase
        .from('analysis_prompts')
        .select('execution_order')
        .eq('id', queueItem.prompt_id)
        .maybeSingle();
      const executionOrder = promptInfo?.execution_order;

      const models = await getActiveModels(supabase);
      let text = '';
      let tokensUsed = 0;
      let executionTime = 0;
      let usedModel = null;
      let modelErrors: string[] = [];

      for (let modelIndex = 0; modelIndex < models.length; modelIndex++) {
        const model = models[modelIndex];

        try {
          console.log(`[${workerId}] Tentando modelo [${modelIndex + 1}/${models.length}]: ${model.name}`);

          await supabase
            .from('complex_processing_status')
            .update({
              metadata: {
                current_model: model.name,
                current_model_priority: model.priority,
                model_attempts: modelIndex + 1,
                searching_new_model: false,
              },
            })
            .eq('processo_id', processoId);

          const genAI = new GoogleGenerativeAI(geminiApiKey);
          const geminiModel = genAI.getGenerativeModel({ model: model.modelId });

          const parts: any[] = [
            {
              fileData: {
                mimeType: 'application/pdf',
                fileUri: chunk.gemini_file_uri,
              },
            },
          ];

          let finalPrompt = queueItem.prompt_content;

          if (contextFromPrevious) {
            finalPrompt = `CONTEXTO DAS SECOES ANTERIORES DO DOCUMENTO:\n${JSON.stringify(contextFromPrevious, null, 2)}\n\n---\n\n${queueItem.prompt_content}\n\nIMPORTANTE: Este e o chunk ${chunk.chunk_index + 1} de ${chunk.total_chunks}. Considere o contexto anterior ao analisar este trecho.`;
          } else {
            finalPrompt = `${queueItem.prompt_content}\n\nIMPORTANTE: Este e o chunk ${chunk.chunk_index + 1} de ${chunk.total_chunks} do documento.`;
          }

          parts.push({ text: finalPrompt });

          console.log(`[${workerId}] Enviando para LLM...`);
          const llmStartTime = Date.now();

          const result = await geminiModel.generateContent({
            contents: [{ role: 'user', parts }],
            generationConfig: {
              temperature: model.temperature,
              maxOutputTokens: model.maxTokens,
              responseMimeType: 'application/json',
              responseSchema: getSchemaByExecutionOrder(executionOrder),
            },
          });

          const response = await result.response;
          text = response.text().trim();
          executionTime = Date.now() - llmStartTime;
          usedModel = model;

          if (response.usageMetadata) {
            tokensUsed = response.usageMetadata.totalTokenCount || 0;
          }

          console.log(`[${workerId}] Sucesso com modelo: ${model.name}`);

          if (modelIndex > 0) {
            const previousModel = models[modelIndex - 1];
            await notifyModelSwitch(
              supabase,
              processoId,
              previousModel.name,
              model.name,
              'Modelo anterior indisponivel'
            );
          }

          break;

        } catch (modelError: any) {
          const errorMsg = modelError?.message || 'Erro desconhecido';
          modelErrors.push(`${model.name}: ${errorMsg}`);

          console.error(`[${workerId}] Erro no modelo ${model.name}:`, errorMsg);

          if (modelIndex < models.length - 1) {
            console.log(`[${workerId}] Buscando um novo modelo de processamento...`);

            await supabase
              .from('complex_processing_status')
              .update({
                status: 'processing',
                metadata: {
                  searching_new_model: true,
                  failed_model: model.name,
                  error_reason: errorMsg.substring(0, 200),
                  next_model_index: modelIndex + 1,
                },
              })
              .eq('processo_id', processoId);
          }

          if (isRetryableError(modelError)) {
            console.log(`[${workerId}] Erro recuperavel detectado, tentando proximo modelo...`);

            if (modelIndex === models.length - 1) {
              throw new Error(
                `Todos os modelos falharam. Erros: ${modelErrors.join('; ')}`
              );
            }
            continue;
          } else {
            console.error(`[${workerId}] Erro nao recuperavel, mas tentando proximo modelo...`);
            if (modelIndex === models.length - 1) {
              throw new Error(
                `Todos os modelos falharam. Ultimo erro: ${errorMsg}. Todos os erros: ${modelErrors.join('; ')}`
              );
            }
            continue;
          }
        }
      }

      if (!text || !usedModel) {
        throw new Error(`Nenhum modelo conseguiu processar o chunk. Erros: ${modelErrors.join('; ')}`);
      }

      if (text.startsWith('```json')) {
        text = text.replace(/^```json\n?/, '');
      }
      if (text.startsWith('```')) {
        text = text.replace(/^```\n?/, '');
      }
      if (text.endsWith('```')) {
        text = text.replace(/\n?```$/, '');
      }
      text = text.trim();

      console.log(`[${workerId}] Resposta recebida: ${tokensUsed} tokens em ${Math.round(executionTime / 1000)}s`);
      console.log(`[${workerId}] Modelo usado: ${usedModel.name} (Prioridade: ${usedModel.priority})`);

      console.log(`[${workerId}] Gerando resumo contextual...`);
      const genAI = new GoogleGenerativeAI(geminiApiKey);
      const geminiModel = genAI.getGenerativeModel({ model: usedModel.modelId });
      const contextSummary = await generateContextSummary(supabase, geminiModel, text, chunk.chunk_index);
      console.log(`[${workerId}] Resumo contextual gerado`);

      await supabase
        .from('process_chunks')
        .update({
          status: 'completed',
          processing_result: { result: text, prompt_id: queueItem.prompt_id },
          context_summary: { summary: contextSummary, chunk_index: chunk.chunk_index },
          processing_time_seconds: Math.round(executionTime / 1000),
          tokens_used: tokensUsed,
        })
        .eq('id', chunk.id);

      await supabase.rpc('complete_queue_item', {
        p_queue_item_id: queueItemId,
        p_worker_id: workerId,
        p_result_data: { result: text, context_summary: contextSummary },
        p_tokens_used: tokensUsed
      });

      console.log(`[${workerId}] Resultados salvos no banco`);

      const { data: analysisResult } = await supabase
        .from('analysis_results')
        .select('id, status')
        .eq('processo_id', processoId)
        .eq('prompt_id', queueItem.prompt_id)
        .maybeSingle();

      if (analysisResult && analysisResult.status === 'pending') {
        await supabase
          .from('analysis_results')
          .update({
            status: 'running',
            processing_at: new Date().toISOString()
          })
          .eq('id', analysisResult.id);

        console.log(`[${workerId}] Analysis result marcado como 'running'`);
      }

      await supabase.rpc('update_complex_processing_progress', {
        p_processo_id: processoId
      });

      const { data: queueStatsForPrompt } = await supabase
        .from('processing_queue')
        .select('status')
        .eq('processo_id', processoId)
        .eq('prompt_id', queueItem.prompt_id);

      if (queueStatsForPrompt) {
        const hasIncomplete = queueStatsForPrompt.some(q =>
          q.status === 'pending' || q.status === 'retry' || q.status === 'failed' || q.status === 'processing'
        );

        if (!hasIncomplete) {
          console.log(`[${workerId}] Todos os chunks do prompt '${queueItem.prompt_title}' completos!`);
          console.log(`[${workerId}] Disparando consolidacao para este prompt...`);

          fetch(`${supabaseUrl}/functions/v1/consolidation-worker`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              processo_id: processoId,
              prompt_id: queueItem.prompt_id
            }),
          }).catch(err => {
            console.error(`[${workerId}] Erro ao disparar consolidacao do prompt:`, err);
          });
        } else {
          const statusCounts = queueStatsForPrompt.reduce((acc, q) => {
            acc[q.status] = (acc[q.status] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
          console.log(`[${workerId}] Prompt '${queueItem.prompt_title}' ainda tem chunks incompletos:`, statusCounts);
        }
      }

      clearInterval(heartbeatInterval);

      await supabase.rpc('update_chunk_metrics', {
        p_processo_id: processoId,
        p_processing_seconds: Math.round(executionTime / 1000)
      });

      const { data: canSpawn } = await supabase
        .rpc('can_spawn_worker', { p_processo_id: processoId })
        .single();

      if (canSpawn) {
        console.log(`[${workerId}] Disparando novo worker paralelo...`);

        fetch(`${supabaseUrl}/functions/v1/process-complex-worker`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ processo_id: processoId }),
        }).catch(err => {
          console.error(`[${workerId}] Erro ao disparar proximo worker:`, err);
        });
      } else {
        console.log(`[${workerId}] Todos os chunks processados!`);

        const { data: stats } = await supabase
          .rpc('get_queue_stats', { p_processo_id: processoId })
          .single();

        if (stats && stats.pending_items === 0 && stats.processing_items === 0) {
          console.log(`[${workerId}] Processamento completo!`);

          const { data: pendingResults } = await supabase
            .from('analysis_results')
            .select('id')
            .eq('processo_id', processoId)
            .in('status', ['pending', 'running'])
            .limit(1)
            .maybeSingle();

          if (pendingResults) {
            console.log(`[${workerId}] Ainda ha prompts para consolidar, disparando consolidation-worker...`);

            fetch(`${supabaseUrl}/functions/v1/consolidation-worker`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({ processo_id: processoId }),
            }).catch(err => {
              console.error(`[${workerId}] Erro ao disparar consolidacao final:`, err);
            });
          }
        }
      }

      if (processoId) {
        await supabase.rpc('unregister_worker', {
          p_processo_id: processoId,
          p_worker_id: workerId
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Chunk processado com sucesso',
          tokens_used: tokensUsed,
          execution_time_ms: executionTime,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );

    } catch (processingError: any) {
      clearInterval(heartbeatInterval);
      console.error(`[${workerId}] Erro no processamento:`, processingError);

      if (queueItemId) {
        await supabase.rpc('fail_queue_item', {
          p_queue_item_id: queueItemId,
          p_worker_id: workerId,
          p_error_message: processingError.message
        });
      }

      if (processoId) {
        await supabase.rpc('unregister_worker', {
          p_processo_id: processoId,
          p_worker_id: workerId
        });
      }

      throw processingError;
    }

  } catch (error: any) {
    console.error(`[${workerId}] Erro critico:`, error);

    if (processoId && supabase) {
      try {
        await supabase.rpc('unregister_worker', {
          p_processo_id: processoId,
          p_worker_id: workerId
        });
      } catch (unregErr) {
        console.error(`[${workerId}] Erro ao desregistrar worker:`, unregErr);
      }

      try {
        console.log(`[${workerId}] Registrando erro complexo na base de dados...`);

        const { data: processo } = await supabase
          .from('processos')
          .select('user_id, file_name, total_chunks_count')
          .eq('id', processoId)
          .single();

        const errorData: any = {
          processo_id: processoId,
          user_id: processo?.user_id || null,
          error_type: error?.name || 'UnknownError',
          error_category: error?.code || 'processing_error',
          error_message: error?.message || 'Erro desconhecido no processamento',
          error_details: {
            worker_id: workerId,
            stack: error?.stack || null,
            error_object: JSON.stringify(error, Object.getOwnPropertyNames(error)),
          },
          severity: 'critical',
          stack_trace: error?.stack || null,
          current_phase: 'complex_processing',
          worker_id: workerId,
          total_chunks: processo?.total_chunks_count || 0,
          admin_notified: false,
          occurred_at: new Date().toISOString(),
        };

        const { data: errorRecord, error: insertError } = await supabase
          .from('complex_analysis_errors')
          .insert(errorData)
          .select()
          .single();

        if (insertError) {
          console.error(`[${workerId}] Erro ao inserir registro de erro:`, insertError);
        } else {
          console.log(`[${workerId}] Erro registrado com ID: ${errorRecord.id}`);

          console.log(`[${workerId}] Enviando email de notificacao para administradores...`);

          fetch(`${supabaseUrl}/functions/v1/send-admin-complex-analysis-error`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ error_id: errorRecord.id }),
          }).catch(emailErr => {
            console.error(`[${workerId}] Erro ao enviar email de notificacao:`, emailErr?.message);
          });

          console.log(`[${workerId}] Email de notificacao disparado`);
        }
      } catch (errorLogErr) {
        console.error(`[${workerId}] Erro ao registrar erro complexo:`, errorLogErr);
      }
    }

    return new Response(
      JSON.stringify({
        error: error?.message || 'Erro no worker',
        worker_id: workerId,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
