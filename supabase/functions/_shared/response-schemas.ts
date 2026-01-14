import { SchemaType } from 'npm:@google/generative-ai@0.24.1';

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

export function getSchemaByExecutionOrder(executionOrder: number | null | undefined): any {
  if (executionOrder === null || executionOrder === undefined) {
    return undefined;
  }

  if (executionOrder < 1 || executionOrder > 9) {
    return undefined;
  }

  return schemasMap[executionOrder];
}
