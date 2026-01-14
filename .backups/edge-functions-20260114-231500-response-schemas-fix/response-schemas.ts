import { SchemaType } from 'npm:@google/generative-ai@0.24.1';

const etapa1Schema = {
  type: SchemaType.OBJECT,
  properties: {
    visaoGeralProcesso: {
      type: SchemaType.OBJECT,
      description: "Objeto contendo a visao geral do processo."
    }
  },
  required: ["visaoGeralProcesso"]
};

const etapa2Schema = {
  type: SchemaType.OBJECT,
  properties: {
    resumoEstrategico: {
      type: SchemaType.OBJECT,
      description: "Objeto contendo o resumo estrategico do processo."
    }
  },
  required: ["resumoEstrategico"]
};

const etapa3Schema = {
  type: SchemaType.OBJECT,
  properties: {
    comunicacoesPrazos: {
      type: SchemaType.OBJECT,
      description: "Objeto contendo as comunicacoes e prazos do processo."
    }
  },
  required: ["comunicacoesPrazos"]
};

const etapa4Schema = {
  type: SchemaType.OBJECT,
  properties: {
    recursosAdmissibilidade: {
      type: SchemaType.OBJECT,
      description: "Objeto contendo recursos e admissibilidade do processo."
    }
  },
  required: ["recursosAdmissibilidade"]
};

const etapa5Schema = {
  type: SchemaType.OBJECT,
  properties: {
    estrategiasJuridicas: {
      type: SchemaType.OBJECT,
      description: "Objeto contendo as estrategias juridicas do processo."
    }
  },
  required: ["estrategiasJuridicas"]
};

const etapa6Schema = {
  type: SchemaType.OBJECT,
  properties: {
    riscosAlertasProcessuais: {
      type: SchemaType.OBJECT,
      description: "Objeto contendo riscos e alertas processuais."
    }
  },
  required: ["riscosAlertasProcessuais"]
};

const etapa7Schema = {
  type: SchemaType.OBJECT,
  properties: {
    balancoFinanceiro: {
      type: SchemaType.OBJECT,
      description: "Objeto contendo o balanco financeiro do processo."
    }
  },
  required: ["balancoFinanceiro"]
};

const etapa8Schema = {
  type: SchemaType.OBJECT,
  properties: {
    mapaPreclusoesProcessuais: {
      type: SchemaType.OBJECT,
      description: "Objeto contendo o mapa de preclusoes processuais."
    }
  },
  required: ["mapaPreclusoesProcessuais"]
};

const etapa9Schema = {
  type: SchemaType.OBJECT,
  properties: {
    conclusoesPerspectivas: {
      type: SchemaType.OBJECT,
      description: "Objeto contendo as conclusoes e perspectivas do processo."
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
