/**
 * Limpa conteúdo para exibição, removendo caracteres indesejados e formatando texto
 * NOTA: Esta função é LEGADA. Use jsonSanitizer.sanitizeContent() para novos casos.
 */
export function cleanContentForDisplay(content: string): string {
  if (!content || typeof content !== 'string') {
    return '';
  }

  let cleaned = content.trim();

  // Remove marcadores de código
  if (cleaned.startsWith('```json') || cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```json\n?/i, '').replace(/^```\n?/, '');
    cleaned = cleaned.replace(/\n?```$/i, '');
    cleaned = cleaned.trim();
  }

  const looksLikeJSON = (str: string): boolean => {
    const trimmed = str.trim();
    return (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    );
  };

  if (looksLikeJSON(cleaned)) {
    try {
      const parsed = JSON.parse(cleaned);
      return formatJSONToText(parsed);
    } catch (e) {
      // Se falhou o parse, limpar estruturas JSON
      cleaned = cleaned
        .replace(/\{/g, '')
        .replace(/\}/g, '')
        .replace(/\[/g, '')
        .replace(/\]/g, '')
        .replace(/"/g, '')
        .replace(/,\s*/g, '\n');
    }
  }

  // Limpar markdown
  cleaned = cleaned.replace(/^#+\s*/gm, '');
  cleaned = cleaned.replace(/\*\*(.+?)\*\*/g, '$1');
  cleaned = cleaned.replace(/\*(.+?)\*/g, '$1');
  cleaned = cleaned.replace(/`(.+?)`/g, '$1');

  // Remover caracteres soltos problemáticos
  cleaned = cleaned.replace(/[{}\[\]]/g, '');  // Remove chaves e colchetes soltos
  cleaned = cleaned.replace(/,\s*$/gm, '');    // Remove vírgulas no final de linha
  cleaned = cleaned.replace(/:\s*$/gm, '');    // Remove dois pontos no final de linha
  cleaned = cleaned.replace(/""/g, '');        // Remove aspas duplas vazias

  // Normalizar espaços múltiplos
  cleaned = cleaned.replace(/  +/g, ' ');
  cleaned = cleaned.replace(/\n\n\n+/g, '\n\n');

  return cleaned.trim();
}

function formatJSONToText(obj: any, level: number = 0): string {
  if (obj === null || obj === undefined) {
    return '';
  }

  if (typeof obj === 'string') {
    return obj;
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return String(obj);
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) return '';

    const allStrings = obj.every(item => typeof item === 'string');
    if (allStrings) {
      return obj.join('\n');
    }

    return obj
      .map((item, index) => {
        if (typeof item === 'object') {
          const itemText = formatJSONToText(item, level + 1);
          return `${index + 1}. ${itemText}`;
        }
        return `${index + 1}. ${item}`;
      })
      .join('\n\n');
  }

  if (typeof obj === 'object') {
    return Object.entries(obj)
      .map(([key, value]) => {
        if (value === null || value === undefined) return '';
        if (typeof value === 'string' && value.trim() === '') return '';
        if (Array.isArray(value) && value.length === 0) return '';

        const formattedKey = key
          .replace(/_/g, ' ')
          .replace(/([a-z])([A-Z])/g, '$1 $2')
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');

        const formattedValue = formatJSONToText(value, level + 1);

        if (typeof value === 'object') {
          return `${formattedKey}:\n${formattedValue}`;
        }

        return `${formattedKey}: ${formattedValue}`;
      })
      .filter(line => line !== '')
      .join('\n\n');
  }

  return String(obj);
}
