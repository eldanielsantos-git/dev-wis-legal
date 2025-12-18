export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  diagnostics: {
    hasContent: boolean;
    isValidJSON: boolean;
    isComplete: boolean;
    isTruncated: boolean;
    hasMandatoryKeys: boolean;
    minLengthMet: boolean;
    estimatedCompleteness: number;
  };
}

interface ExpectedStructure {
  minLength: number;
  mandatoryKeys?: string[];
}

const ANALYSIS_STRUCTURES: Record<string, ExpectedStructure> = {
  'Visão Geral do Processo': {
    minLength: 500,
    mandatoryKeys: ['numero_processo', 'classe', 'assunto', 'valor_causa']
  },
  'Resumo Estratégico': {
    minLength: 800,
    mandatoryKeys: ['contexto_geral', 'pedidos_principais', 'decisoes_relevantes']
  },
  'Estratégias Jurídicas': {
    minLength: 600,
    mandatoryKeys: ['estrategias', 'fundamentacao']
  },
  'Riscos e Alertas': {
    minLength: 400,
    mandatoryKeys: ['riscos_identificados']
  },
  'Comunicações e Prazos': {
    minLength: 300,
    mandatoryKeys: ['comunicacoes']
  },
  'Mapa de Preclusões': {
    minLength: 300,
    mandatoryKeys: ['preclusoes']
  },
  'Admissibilidade Recursal': {
    minLength: 400,
    mandatoryKeys: ['analise_admissibilidade']
  },
  'Balanço Financeiro': {
    minLength: 300,
    mandatoryKeys: ['valores']
  },
  'Conclusões e Perspectivas': {
    minLength: 500,
    mandatoryKeys: ['conclusoes', 'perspectivas']
  }
};

export function validateAnalysisJSON(
  content: string,
  promptTitle: string
): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    diagnostics: {
      hasContent: false,
      isValidJSON: false,
      isComplete: false,
      isTruncated: false,
      hasMandatoryKeys: false,
      minLengthMet: false,
      estimatedCompleteness: 0
    }
  };

  if (!content || content.trim().length === 0) {
    result.isValid = false;
    result.errors.push('Conteúdo vazio ou inexistente');
    return result;
  }

  result.diagnostics.hasContent = true;

  const trimmedContent = content.trim();

  if (trimmedContent.length < 50) {
    result.isValid = false;
    result.errors.push(`Conteúdo muito curto (${trimmedContent.length} caracteres)`);
    result.diagnostics.estimatedCompleteness = (trimmedContent.length / 50) * 100;
    return result;
  }

  let parsedJSON: any;
  try {
    parsedJSON = JSON.parse(trimmedContent);
    result.diagnostics.isValidJSON = true;
  } catch (error) {
    result.isValid = false;
    result.errors.push(`JSON inválido: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);

    if (trimmedContent.endsWith(',') ||
        trimmedContent.endsWith('{') ||
        trimmedContent.endsWith('[')) {
      result.diagnostics.isTruncated = true;
      result.errors.push('JSON aparenta estar truncado (terminação incompleta)');
    }

    const openBrackets = (trimmedContent.match(/\{/g) || []).length;
    const closeBrackets = (trimmedContent.match(/\}/g) || []).length;
    const openSquare = (trimmedContent.match(/\[/g) || []).length;
    const closeSquare = (trimmedContent.match(/\]/g) || []).length;

    if (openBrackets !== closeBrackets || openSquare !== closeSquare) {
      result.diagnostics.isComplete = false;
      result.errors.push(
        `Brackets desbalanceados: { ${openBrackets}/${closeBrackets}, [ ${openSquare}/${closeSquare}`
      );
    }

    return result;
  }

  result.diagnostics.isComplete = true;

  const expectedStructure = ANALYSIS_STRUCTURES[promptTitle];

  if (expectedStructure) {
    if (trimmedContent.length < expectedStructure.minLength) {
      result.warnings.push(
        `Conteúdo abaixo do tamanho esperado: ${trimmedContent.length}/${expectedStructure.minLength} caracteres`
      );
      result.diagnostics.minLengthMet = false;
      result.diagnostics.estimatedCompleteness =
        (trimmedContent.length / expectedStructure.minLength) * 100;
    } else {
      result.diagnostics.minLengthMet = true;
      result.diagnostics.estimatedCompleteness = 100;
    }

    if (expectedStructure.mandatoryKeys) {
      const missingKeys: string[] = [];

      for (const key of expectedStructure.mandatoryKeys) {
        if (!(key in parsedJSON)) {
          missingKeys.push(key);
        }
      }

      if (missingKeys.length > 0) {
        result.isValid = false;
        result.errors.push(
          `Chaves obrigatórias ausentes: ${missingKeys.join(', ')}`
        );
        result.diagnostics.hasMandatoryKeys = false;
      } else {
        result.diagnostics.hasMandatoryKeys = true;
      }
    } else {
      result.diagnostics.hasMandatoryKeys = true;
    }
  } else {
    result.diagnostics.minLengthMet = true;
    result.diagnostics.hasMandatoryKeys = true;
    result.diagnostics.estimatedCompleteness = 100;
  }

  const jsonString = JSON.stringify(parsedJSON);
  if (jsonString.length < 100) {
    result.warnings.push('JSON muito pequeno, pode estar incompleto');
  }

  const hasSignificantContent = Object.keys(parsedJSON).length > 0;
  if (!hasSignificantContent) {
    result.isValid = false;
    result.errors.push('JSON vazio (sem propriedades)');
  }

  return result;
}

export function formatValidationErrorMessage(
  processoId: string,
  promptTitle: string,
  validation: ValidationResult
): string {
  let message = `❌ Validação de JSON falhou\n\n`;
  message += `📋 Processo ID: ${processoId}\n`;
  message += `📝 Análise: ${promptTitle}\n\n`;

  if (validation.errors.length > 0) {
    message += `🚨 Erros:\n`;
    validation.errors.forEach(error => {
      message += `  • ${error}\n`;
    });
    message += `\n`;
  }

  if (validation.warnings.length > 0) {
    message += `⚠️ Avisos:\n`;
    validation.warnings.forEach(warning => {
      message += `  • ${warning}\n`;
    });
    message += `\n`;
  }

  message += `📊 Diagnóstico:\n`;
  message += `  • Tem conteúdo: ${validation.diagnostics.hasContent ? '✅' : '❌'}\n`;
  message += `  • JSON válido: ${validation.diagnostics.isValidJSON ? '✅' : '❌'}\n`;
  message += `  • Estrutura completa: ${validation.diagnostics.isComplete ? '✅' : '❌'}\n`;
  message += `  • Truncado: ${validation.diagnostics.isTruncated ? '⚠️ SIM' : '✅ NÃO'}\n`;
  message += `  • Chaves obrigatórias: ${validation.diagnostics.hasMandatoryKeys ? '✅' : '❌'}\n`;
  message += `  • Tamanho adequado: ${validation.diagnostics.minLengthMet ? '✅' : '❌'}\n`;
  message += `  • Completude estimada: ${validation.diagnostics.estimatedCompleteness.toFixed(1)}%\n`;

  return message;
}
