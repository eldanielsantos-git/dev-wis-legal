/**
 * JSON Sanitizer Utility
 *
 * Sistema robusto de detecção e sanitização de JSON com múltiplas camadas de proteção.
 * Garante que NENHUM JSON seja exibido em formato bruto ao usuário.
 */

export interface SanitizationResult {
  isJSON: boolean;
  parsed: any;
  cleaned: string;
  method: 'json-parse' | 'aggressive-clean' | 'fallback-text';
}

/**
 * Limpa o conteúdo de maneira agressiva removendo todos os marcadores possíveis
 */
export function aggressiveClean(content: string): string {
  let cleaned = content.trim();

  // Remove texto introdutório comum das LLMs
  const introPatterns = [
    /^(Com certeza[!.]?|Claro[!.]?|Segue|Aqui está|Veja|Confira|Abaixo)\s+[^{[\n]*/i,
    /^(A seguir|Apresento|Segue abaixo)\s+[^{[\n]*/i,
  ];

  for (const pattern of introPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }

  // Remove marcadores de código em todas as variações possíveis
  cleaned = cleaned.replace(/^```json\s*/i, '');
  cleaned = cleaned.replace(/^```JSON\s*/i, '');
  cleaned = cleaned.replace(/^```\s*json\s*/i, '');
  cleaned = cleaned.replace(/^```\s*/i, '');
  cleaned = cleaned.replace(/\s*```\s*$/i, '');

  // Remove espaços e quebras de linha extras
  cleaned = cleaned.trim();

  // Remove aspas externas desnecessárias
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) ||
      (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    const unquoted = cleaned.slice(1, -1);
    if (looksLikeJSON(unquoted)) {
      cleaned = unquoted;
    }
  }

  return cleaned;
}

/**
 * Detecta se o conteúdo parece JSON com múltiplos critérios
 */
export function looksLikeJSON(str: string): boolean {
  const trimmed = str.trim();

  if (trimmed.length === 0) return false;

  // Critério 1: Estrutura básica
  const hasStructure =
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'));

  if (!hasStructure) return false;

  // Critério 2: Contém características de JSON
  const hasJSONCharacteristics =
    trimmed.includes(':') || // Pares chave-valor
    trimmed.includes('"') || // Strings com aspas
    /\{[\s\S]*\}/.test(trimmed) || // Objetos
    /\[[\s\S]*\]/.test(trimmed); // Arrays

  // Critério 3: Não parece Markdown ou texto normal
  const notMarkdown =
    !trimmed.startsWith('# ') &&
    !trimmed.startsWith('## ') &&
    !trimmed.startsWith('### ');

  return hasJSONCharacteristics && notMarkdown;
}

/**
 * Tenta fazer parse do JSON com múltiplas estratégias
 */
export function tryParseJSON(content: string): any | null {
  // Estratégia 1: Parse direto
  try {
    return JSON.parse(content);
  } catch (e1) {
    // Estratégia 2: Limpar e tentar novamente
    try {
      const cleaned = aggressiveClean(content);
      return JSON.parse(cleaned);
    } catch (e2) {
      // Estratégia 3: Remover caracteres problemáticos
      try {
        let sanitized = content
          .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove caracteres de controle
          .replace(/\r\n/g, '\n') // Normaliza quebras de linha
          .replace(/\r/g, '\n')
          .trim();

        return JSON.parse(sanitized);
      } catch (e3) {
        // Estratégia 4: Tentar extrair JSON de dentro do texto
        try {
          const jsonMatch = content.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
          if (jsonMatch) {
            return JSON.parse(jsonMatch[1]);
          }
        } catch (e4) {
          // Todas as estratégias falharam
          return null;
        }
      }
    }
  }

  return null;
}

/**
 * Detecta JSON mal formatado que pode ter escapado da detecção
 */
export function containsUnparsedJSON(text: string): boolean {
  // Padrões que indicam JSON não parseado
  const jsonPatterns = [
    /\{\s*"[^"]+"\s*:\s*[^}]+\}/,  // Objeto simples
    /\[\s*\{[^}]+\}\s*\]/,          // Array de objetos
    /"[^"]+"\s*:\s*"[^"]+"/,        // Par chave-valor
    /\{\s*"[^"]+"\s*:\s*\{/,        // Objeto aninhado
  ];

  return jsonPatterns.some(pattern => pattern.test(text));
}

/**
 * Sanitiza o conteúdo com múltiplas camadas de proteção
 */
export function sanitizeContent(content: string): SanitizationResult {
  if (!content || typeof content !== 'string') {
    return {
      isJSON: false,
      parsed: null,
      cleaned: '',
      method: 'fallback-text',
    };
  }

  // CAMADA 1: Limpeza agressiva inicial
  const cleaned = aggressiveClean(content);

  // CAMADA 2: Detecção de JSON
  const appearsToBeJSON = looksLikeJSON(cleaned);

  if (appearsToBeJSON) {
    // CAMADA 3: Tentar parse com múltiplas estratégias
    const parsed = tryParseJSON(cleaned);

    if (parsed !== null) {
      return {
        isJSON: true,
        parsed,
        cleaned,
        method: 'json-parse',
      };
    }

    // CAMADA 4: JSON detectado mas não parseável - limpar agressivamente
    console.warn('[jsonSanitizer] JSON detectado mas não parseável, aplicando limpeza agressiva');

    const aggressiveCleaned = cleaned
      .replace(/\{/g, '')
      .replace(/\}/g, '')
      .replace(/\[/g, '')
      .replace(/\]/g, '')
      .replace(/"/g, '')
      .replace(/,\s*/g, '\n')
      .replace(/:\s*/g, ': ')
      .split('\n')
      .filter(line => line.trim())
      .join('\n');

    return {
      isJSON: false,
      parsed: null,
      cleaned: aggressiveCleaned,
      method: 'aggressive-clean',
    };
  }

  // CAMADA 5: Verificação final - detectar JSON residual no texto
  if (containsUnparsedJSON(cleaned)) {
    console.warn('[jsonSanitizer] JSON residual detectado no texto');

    // Remover estruturas JSON do texto
    const finalCleaned = cleaned
      .replace(/\{[^}]+\}/g, '[conteúdo formatado]')
      .replace(/\[[^\]]+\]/g, '[lista formatada]');

    return {
      isJSON: false,
      parsed: null,
      cleaned: finalCleaned,
      method: 'aggressive-clean',
    };
  }

  // Conteúdo é texto limpo
  return {
    isJSON: false,
    parsed: null,
    cleaned,
    method: 'fallback-text',
  };
}

/**
 * Valida se o objeto parseado é seguro para renderização
 */
export function isValidParsedObject(obj: any): boolean {
  if (obj === null || obj === undefined) return false;

  if (Array.isArray(obj)) {
    return obj.length > 0;
  }

  if (typeof obj === 'object') {
    return Object.keys(obj).length > 0;
  }

  return false;
}
