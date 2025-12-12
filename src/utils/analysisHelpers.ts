/**
 * Helpers consolidados para parsing e validação de análises
 *
 * Wrapper inteligente que usa jsonSanitizer existente + utilitários adicionais.
 * Previne erros de parse e render mantendo compatibilidade total.
 */

import { sanitizeContent, tryParseJSON, aggressiveClean } from './jsonSanitizer';
import { safeToString } from './safeRender';
import type { AnalysisParseResult, ErrorState } from '../types/analysis';

export function parseAnalysisContent<T>(
  content: string,
  expectedKey?: string
): AnalysisParseResult<T> {
  if (!content || typeof content !== 'string') {
    return {
      success: false,
      error: 'Conteúdo vazio ou inválido',
    };
  }

  const sanitized = sanitizeContent(content);

  if (sanitized.isJSON && sanitized.parsed) {
    if (expectedKey) {
      const data = sanitized.parsed[expectedKey];
      if (!data) {
        return {
          success: false,
          error: `Estrutura de dados inválida: esperava chave "${expectedKey}"`,
          rawContent: content,
        };
      }
      return {
        success: true,
        data: sanitized.parsed as T,
      };
    }

    return {
      success: true,
      data: sanitized.parsed as T,
    };
  }

  return {
    success: false,
    error: 'Não foi possível fazer parse do JSON',
    rawContent: content,
  };
}

export function cleanJSONMarkers(content: string): string {
  let cleaned = content.trim();

  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.substring(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.substring(3);
  }

  if (cleaned.endsWith('```')) {
    cleaned = cleaned.substring(0, cleaned.length - 3);
  }

  return cleaned.trim();
}

export function safeParseJSON<T>(content: string): T | null {
  const cleaned = cleanJSONMarkers(content);
  return tryParseJSON(cleaned) as T | null;
}

export function formatFieldValue(value: any): string {
  return safeToString(value);
}

export function isEmptyValue(value: any): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === 'object' && Object.keys(value).length === 0) return true;
  return false;
}

export function validateAnalysisStructure<T>(
  data: any,
  requiredKey: string
): { valid: boolean; error?: ErrorState } {
  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      error: {
        type: 'structure',
        message: 'Dados inválidos: esperava um objeto',
        details: data,
      },
    };
  }

  if (!data[requiredKey]) {
    return {
      valid: false,
      error: {
        type: 'structure',
        message: `Estrutura inválida: esperava chave "${requiredKey}"`,
        details: Object.keys(data),
      },
    };
  }

  return { valid: true };
}

export function getFieldLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function isDateField(label: string): boolean {
  return label.toLowerCase().includes('data');
}

export function isValueField(label: string): boolean {
  return label.toLowerCase().includes('valor');
}

export function isPageField(label: string): boolean {
  return label.toLowerCase().includes('página') || label.toLowerCase().includes('pagina');
}
