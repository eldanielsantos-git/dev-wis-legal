import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { GoogleGenerativeAI, SchemaType } from 'npm:@google/generative-ai@0.24.1';
import { notifyAdminSafe } from './_shared/notify-admin-safe.ts';

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
        secoes: { type: SchemaType.ARRAY, items: secaoGenericaEtapa1Schema }
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
        secoes: { type: SchemaType.ARRAY, items: secaoEtapa2Schema }
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
        secoes: { type: SchemaType.ARRAY, items: secaoEtapa3Schema }
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
        secoes: { type: SchemaType.ARRAY, items: secaoEtapa4Schema }
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
        secoes: { type: SchemaType.ARRAY, items: secaoEtapa5Schema }
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
        secoes: { type: SchemaType.ARRAY, items: secaoEtapa6Schema }
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
        secoes: { type: SchemaType.ARRAY, items: secaoEtapa7Schema }
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
        secoes: { type: SchemaType.ARRAY, items: secaoEtapa8Schema }
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
        secoes: { type: SchemaType.ARRAY, items: secaoEtapa9Schema }
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
  if (executionOrder === null || executionOrder === undefined) return undefined;
  if (executionOrder < 1 || executionOrder > 9) return undefined;
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
      console.warn(`\u26a0\ufe0f Error fetching token limit for ${contextKey}, using fallback:`, error);
      return fallbackValue;
    }

    if (data) {
      console.log(`\u2705 Token limit for ${contextKey}: ${data.max_output_tokens}`);
      return data.max_output_tokens;
    }

    console.warn(`\u26a0\ufe0f No active token limit found for ${contextKey}, using fallback: ${fallbackValue}`);
    return fallbackValue;
  } catch (error) {
    console.warn(`\u26a0\ufe0f Exception fetching token limit for ${contextKey}, using fallback:`, error);
    return fallbackValue;
  }
}

async function getActiveModel(supabase: any) {
  const { data, error} = await supabase
    .from('admin_system_models')
    .select('*')
    .eq('is_active', true)
    .order('priority', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    throw new Error('Nenhum modelo ativo encontrado');
  }

  const configuredMaxTokens = await getMaxOutputTokens(supabase, 'analysis_consolidation', 60000);

  return {
    id: data.id,
    name: data.name,
    modelId: data.system_model || data.model_id,
    temperature: data.temperature ?? 0.2,
    maxTokens: data.max_tokens ?? configuredMaxTokens,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const workerId = crypto.randomUUID().slice(0, 8);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { processo_id, prompt_id } = await req.json();

    if (!processo_id) {
      throw new Error('processo_id \u00e9 obrigat\u00f3rio');
    }

    if (prompt_id) {
      console.log(`\n[${workerId}] \ud83d\udd04 Consolida\u00e7\u00e3o ESPEC\u00cdFICA - Processo: ${processo_id}, Prompt: ${prompt_id}`);
    } else {
      console.log(`\n[${workerId}] \ud83d\udd04 Consolida\u00e7\u00e3o GERAL - Processo: ${processo_id}`);
    }

    await supabase
      .from('complex_processing_status')
      .update({
        current_phase: 'consolidating',
        last_heartbeat: new Date().toISOString(),
      })
      .eq('processo_id', processo_id);

    const { data: chunks, error: chunksError } = await supabase
      .from('process_chunks')
      .select('chunk_index, context_summary, processing_result')
      .eq('processo_id', processo_id)
      .order('chunk_index', { ascending: true });

    if (chunksError || !chunks || chunks.length === 0) {
      throw new Error('Chunks n\u00e3o encontrados');
    }

    console.log(`[${workerId}] \ud83d\udce6 ${chunks.length} chunks para consolidar`);

    const allSummaries = chunks
      .filter(c => c.processing_result?.result)
      .map(c => {
        const chunkResult = typeof c.processing_result.result === 'string'
          ? c.processing_result.result
          : JSON.stringify(c.processing_result.result);
        return `=== CHUNK ${c.chunk_index + 1} ===\n${chunkResult}`;
      })
      .join('\n\n');

    console.log(`[${workerId}] \ud83d\udcc4 Total de conte\u00fado para consolida\u00e7\u00e3o: ${allSummaries.length} caracteres`);

    let analysisResultsQuery = supabase
      .from('analysis_results')
      .select('id, prompt_id, prompt_title, prompt_content, system_prompt, execution_order, status')
      .eq('processo_id', processo_id)
      .in('status', ['pending', 'running']);

    if (prompt_id) {
      analysisResultsQuery = analysisResultsQuery.eq('prompt_id', prompt_id);
    }

    const { data: analysisResults, error: resultsError } = await analysisResultsQuery
      .order('execution_order', { ascending: true });

    if (resultsError) {
      throw new Error('Erro ao buscar analysis_results');
    }

    console.log(`[${workerId}] \ud83d\udccb Analysis Results encontrados:`, analysisResults?.map(r => ({
      id: r.id,
      title: r.prompt_title,
      status: r.status
    })));

    if (!analysisResults || analysisResults.length === 0) {
      console.log(`[${workerId}] \u2705 Nenhum prompt pendente para consolidar nesta chamada`);

      const { data: allResults } = await supabase
        .from('analysis_results')
        .select('id, status, prompt_title')
        .eq('processo_id', processo_id);

      const allCompleted = allResults?.every(r => r.status === 'completed');
      const hasRunning = allResults?.some(r => r.status === 'running');
      const hasPending = allResults?.some(r => r.status === 'pending');

      console.log(`[${workerId}] \ud83d\udcca Status das etapas:`, {
        total: allResults?.length,
        completed: allResults?.filter(r => r.status === 'completed').length,
        running: allResults?.filter(r => r.status === 'running').length,
        pending: allResults?.filter(r => r.status === 'pending').length,
      });

      if (hasRunning || hasPending) {
        console.log(`[${workerId}] \u26a0\ufe0f H\u00e1 etapas ainda em processamento. N\u00c3O marcar como completed.`);

        if (hasRunning) {
          const runningPrompts = allResults?.filter(r => r.status === 'running');
          console.log(`[${workerId}] \ud83d\udd0d Etapas em running:`, runningPrompts?.map(r => r.prompt_title));
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Nenhum prompt para consolidar nesta chamada, mas h\u00e1 etapas ainda em processamento',
            has_running: hasRunning,
            has_pending: hasPending,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      if (!allCompleted) {
        console.log(`[${workerId}] \u26a0\ufe0f Nem todas as etapas est\u00e3o completed. N\u00c3O marcar como conclu\u00eddo.`);
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Nem todas as etapas est\u00e3o conclu\u00eddas',
            all_completed: false,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const { data: processoInfo } = await supabase
        .from('processos')
        .select('transcricao')
        .eq('id', processo_id)
        .single();

      const totalPages = processoInfo?.transcricao?.totalPages || 0;
      console.log(`[${workerId}] \ud83d\udcc4 Total de p\u00e1ginas processadas: ${totalPages}`);
      console.log(`[${workerId}] \u2705 TODAS as etapas est\u00e3o completed. Marcando processo como conclu\u00eddo.`);

      await supabase
        .from('processos')
        .update({
          status: 'completed',
          pages_processed_successfully: totalPages,
          analysis_completed_at: new Date().toISOString(),
        })
        .eq('id', processo_id);

      await supabase
        .from('complex_processing_status')
        .update({
          current_phase: 'completed',
          last_heartbeat: new Date().toISOString(),
        })
        .eq('id', processo_id);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Consolida\u00e7\u00e3o conclu\u00edda - todos os prompts j\u00e1 processados',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = await getActiveModel(supabase);

    console.log(`[${workerId}] \ud83e\udd16 Usando modelo: ${model.name} (${model.modelId})`);

    const generativeModel = genAI.getGenerativeModel({
      model: model.modelId,
      generationConfig: {
        temperature: model.temperature,
        maxOutputTokens: model.maxTokens,
      },
    });

    for (const analysisResult of analysisResults) {
      console.log(`[${workerId}] \ud83d\udd0d Consolidando: ${analysisResult.prompt_title}`);

      const fullPrompt = `${analysisResult.system_prompt || ''}\n\n${analysisResult.prompt_content}\n\nDOCUMENTO EM LOTES:\n${allSummaries}`;

      const startTime = Date.now();
      const result = await generativeModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
        generationConfig: {
          temperature: model.temperature,
          maxOutputTokens: model.maxTokens,
          responseMimeType: 'application/json',
          responseSchema: getSchemaByExecutionOrder(analysisResult.execution_order),
        },
      });
      const response = result.response;
      const text = response.text();

      const tokensUsed = (
        (response.usageMetadata?.promptTokenCount || 0) +
        (response.usageMetadata?.candidatesTokenCount || 0)
      );

      const executionTime = Date.now() - startTime;

      await supabase
        .from('analysis_results')
        .update({
          status: 'completed',
          result_content: text,
          execution_time_ms: executionTime,
          tokens_used: tokensUsed,
          current_model_id: model.id,
          current_model_name: model.name,
          completed_at: new Date().toISOString(),
        })
        .eq('id', analysisResult.id);

      console.log(`[${workerId}] \u2705 Consolidado: ${analysisResult.prompt_title} (${tokensUsed} tokens)`);

      await supabase
        .from('complex_processing_status')
        .update({
          total_prompts_processed: analysisResults.length,
          last_heartbeat: new Date().toISOString(),
        })
        .eq('processo_id', processo_id);
    }

    console.log(`[${workerId}] \ud83c\udf89 Consolida\u00e7\u00e3o conclu\u00edda com sucesso`);

    const { data: allResultsAfterConsolidation } = await supabase
      .from('analysis_results')
      .select('id, status, prompt_title')
      .eq('processo_id', processo_id);

    const allCompleted = allResultsAfterConsolidation?.every(r => r.status === 'completed');
    const hasRunning = allResultsAfterConsolidation?.some(r => r.status === 'running');
    const hasPending = allResultsAfterConsolidation?.some(r => r.status === 'pending');

    console.log(`[${workerId}] \ud83d\udcca Status final das etapas:`, {
      total: allResultsAfterConsolidation?.length,
      completed: allResultsAfterConsolidation?.filter(r => r.status === 'completed').length,
      running: allResultsAfterConsolidation?.filter(r => r.status === 'running').length,
      pending: allResultsAfterConsolidation?.filter(r => r.status === 'pending').length,
    });

    if (allCompleted && !hasRunning && !hasPending) {
      console.log(`[${workerId}] \u2705 TODOS os prompts consolidados! Marcando processo como completo`);

      const { data: processoInfo } = await supabase
        .from('processos')
        .select('transcricao')
        .eq('id', processo_id)
        .single();

      const totalPages = processoInfo?.transcricao?.totalPages || 0;
      console.log(`[${workerId}] \ud83d\udcc4 Total de p\u00e1ginas processadas: ${totalPages}`);

      await supabase
        .from('processos')
        .update({
          status: 'completed',
          pages_processed_successfully: totalPages,
          analysis_completed_at: new Date().toISOString(),
        })
        .eq('id', processo_id);

      await supabase
        .from('complex_processing_status')
        .update({
          current_phase: 'completed',
          overall_progress_percent: 100,
          last_heartbeat: new Date().toISOString(),
        })
        .eq('processo_id', processo_id);
    } else {
      console.log(`[${workerId}] \u23f3 Ainda h\u00e1 prompts pendentes, continuando processamento...`);

      await supabase
        .from('complex_processing_status')
        .update({
          current_phase: 'processing',
          last_heartbeat: new Date().toISOString(),
        })
        .eq('processo_id', processo_id);

      console.log(`[${workerId}] \ud83d\udd04 Disparando processamento do pr\u00f3ximo prompt pendente...`);

      fetch(`${supabaseUrl}/functions/v1/process-complex-worker`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ processo_id }),
      }).catch(err => {
        console.error(`[${workerId}] \u274c Erro ao disparar pr\u00f3ximo prompt:`, err?.message);
      });
    }

    if (allCompleted && !hasRunning && !hasPending) {
      const { data: processoData } = await supabase
        .from('processos')
        .select('user_id, file_name, created_at, is_chunked, status')
        .eq('id', processo_id)
        .single();

      if (processoData?.user_id) {
        await supabase
          .from('notifications')
          .insert({
            user_id: processoData.user_id,
            type: 'analysis_completed',
            message: 'An\u00e1lise de documento complexo conclu\u00edda com sucesso',
            processo_id: processo_id,
          });

        console.log(`[${workerId}] \ud83d\udcec Notifica\u00e7\u00e3o enviada ao usu\u00e1rio`);

        console.log(`[${workerId}] \ud83d\udce7 Enviando email de processo conclu\u00eddo...`);
        try {
          const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-email-process-completed`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ processo_id }),
          });

          if (emailResponse.ok) {
            const emailResult = await emailResponse.json();
            console.log(`[${workerId}] \u2705 Email enviado com sucesso:`, emailResult.resend_id);
          } else {
            const errorText = await emailResponse.text();
            console.error(`[${workerId}] \u274c Falha ao enviar email:`, errorText);
          }
        } catch (emailError) {
          console.error(`[${workerId}] \u274c Erro ao chamar edge function de email:`, emailError);
        }

        console.log(`[${workerId}] \ud83d\udd14 Processo completo! Enviando notifica\u00e7\u00e3o administrativa...`);

        const { data: userData } = await supabase
          .from('user_profiles')
          .select('email, first_name, last_name')
          .eq('id', processoData.user_id)
          .maybeSingle();

        const startTime = new Date(processoData.created_at);
        const endTime = new Date();
        const durationMs = endTime.getTime() - startTime.getTime();
        const durationMinutes = Math.floor(durationMs / 60000);
        const durationSeconds = Math.floor((durationMs % 60000) / 1000);
        const durationText = durationMinutes > 0
          ? `${durationMinutes}m ${durationSeconds}s`
          : `${durationSeconds}s`;

        const userName = userData ? `${userData.first_name || ''} ${userData.last_name || ''}`.trim() : 'N/A';
        const userEmail = userData?.email || 'N/A';
        const fileName = processoData.file_name || 'N/A';

        notifyAdminSafe({
          type: 'analysis_completed',
          title: 'An\u00e1lise Conclu\u00edda',
          message: `${userName || userEmail} | ${fileName} | ${durationText}`,
          severity: 'success',
          metadata: {
            processo_id,
            file_name: fileName,
            user_email: userEmail,
            user_name: userName || userEmail,
            duration: durationText,
            chunks_count: chunks.length,
            prompts_consolidated: analysisResults.length,
            is_complex: processoData.is_chunked,
          },
          userId: processoData.user_id,
          processoId: processo_id,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Consolida\u00e7\u00e3o conclu\u00edda',
        prompts_consolidated: analysisResults.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error(`[${workerId}] \u274c Erro na consolida\u00e7\u00e3o:`, error);

    return new Response(
      JSON.stringify({
        error: error?.message || 'Erro na consolida\u00e7\u00e3o',
        worker_id: workerId,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});