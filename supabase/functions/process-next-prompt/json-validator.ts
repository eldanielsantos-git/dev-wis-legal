export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  cleanedData: any;
}

export function validateAndCleanJSON(jsonString: string, schema: any): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    cleanedData: null,
  };

  try {
    const parsed = JSON.parse(jsonString);
    result.cleanedData = parsed;

    if (!schema || typeof schema !== 'object') {
      result.warnings.push('Schema de valida\u00e7\u00e3o n\u00e3o fornecido ou inv\u00e1lido');
      return result;
    }

    validateObject(parsed, schema, '', result);

    result.isValid = result.errors.length === 0;
  } catch (error) {
    result.isValid = false;
    result.errors.push(`Erro ao fazer parse do JSON: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }

  return result;
}

function validateObject(data: any, schema: any, path: string, result: ValidationResult): void {
  if (schema.type === 'object') {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      result.errors.push(`${path || 'root'}: Esperado objeto, recebido ${typeof data}`);
      return;
    }

    if (schema.required && Array.isArray(schema.required)) {
      for (const requiredField of schema.required) {
        if (!(requiredField in data)) {
          result.errors.push(`${path}.${requiredField}: Campo obrigat\u00f3rio ausente`);
        }
      }
    }

    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (key in data) {
          const newPath = path ? `${path}.${key}` : key;
          validateField(data[key], propSchema, newPath, result);
        }
      }
    }
  } else if (schema.type === 'array') {
    if (!Array.isArray(data)) {
      result.errors.push(`${path || 'root'}: Esperado array, recebido ${typeof data}`);
      return;
    }

    if (schema.minItems !== undefined && data.length < schema.minItems) {
      result.errors.push(`${path}: Array deve ter pelo menos ${schema.minItems} itens`);
    }

    if (schema.items) {
      data.forEach((item, index) => {
        const newPath = `${path}[${index}]`;
        validateField(item, schema.items, newPath, result);
      });
    }
  }
}

function validateField(value: any, fieldSchema: any, path: string, result: ValidationResult): void {
  if (!fieldSchema || typeof fieldSchema !== 'object') {
    return;
  }

  const expectedType = fieldSchema.type;

  if (expectedType === 'object') {
    validateObject(value, fieldSchema, path, result);
  } else if (expectedType === 'array') {
    validateObject(value, fieldSchema, path, result);
  } else if (expectedType === 'string') {
    if (typeof value !== 'string') {
      result.errors.push(`${path}: Esperado string, recebido ${typeof value}`);
    }
  } else if (expectedType === 'number') {
    if (typeof value !== 'number') {
      result.errors.push(`${path}: Esperado number, recebido ${typeof value}`);
    }
  } else if (expectedType === 'boolean') {
    if (typeof value !== 'boolean') {
      result.errors.push(`${path}: Esperado boolean, recebido ${typeof value}`);
    }
  }
}