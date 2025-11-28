/**
 * Interface para conteúdo parseado
 * NOTA: Esta função é LEGADA. Use jsonSanitizer.sanitizeContent() para novos casos.
 */
export interface ParsedContent {
  type: 'text';
  value: string;
}

/**
 * Faz parse de conteúdo, detectando e convertendo JSON para Markdown
 * NOTA: Esta função é LEGADA. Use jsonSanitizer.sanitizeContent() para novos casos.
 */
export function parseContent(content: string): ParsedContent {
  if (!content || typeof content !== 'string') {
    return { type: 'text', value: '' };
  }

  let cleanedText = content.trim();

  // Remove marcadores de código
  if (cleanedText.startsWith('```json') || cleanedText.startsWith('```')) {
    cleanedText = cleanedText.replace(/^```json\n?/i, '').replace(/^```\n?/, '');
    cleanedText = cleanedText.replace(/\n?```$/i, '');
    cleanedText = cleanedText.trim();
  }

  const looksLikeJSON = (str: string): boolean => {
    const trimmed = str.trim();
    return (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    );
  };

  if (looksLikeJSON(cleanedText)) {
    try {
      const parsed = JSON.parse(cleanedText);
      const markdown = convertJSONToMarkdown(parsed);
      return { type: 'text', value: markdown };
    } catch (e) {
      console.warn('[contentParser] Failed to parse JSON-like content:', e);
      // Fallback: limpar estruturas JSON
      const cleaned = cleanedText
        .replace(/[{}\[\]"]/g, '')
        .replace(/,/g, '\n')
        .replace(/:/g, ': ')
        .split('\n')
        .filter(line => line.trim())
        .join('\n');
      return { type: 'text', value: cleaned };
    }
  }

  // Limpar caracteres problemáticos residuais
  cleanedText = cleanedText
    .replace(/[{}\[\]]/g, '')  // Remove estruturas JSON soltas
    .replace(/,\s*$/gm, '')    // Remove vírgulas no final
    .replace(/:\s*$/gm, '');   // Remove dois pontos no final

  return { type: 'text', value: cleanedText };
}

function convertJSONToMarkdown(data: any, level: number = 0): string {
  if (data === null || data === undefined) {
    return '';
  }

  if (typeof data === 'string') {
    return data;
  }

  if (typeof data === 'number' || typeof data === 'boolean') {
    return String(data);
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return '';
    }

    const allStrings = data.every(item => typeof item === 'string');

    if (allStrings) {
      return data.map(item => `- ${item}`).join('\n');
    }

    const hasComplexItems = data.some(item => typeof item === 'object' && !Array.isArray(item));

    if (hasComplexItems) {
      return data.map((item, index) => {
        const itemContent = convertJSONToMarkdown(item, level + 1);
        return `### Item ${index + 1}\n\n${itemContent}`;
      }).join('\n\n');
    }

    return data.map(item => `- ${convertJSONToMarkdown(item, level + 1)}`).join('\n');
  }

  if (typeof data === 'object') {
    const entries = Object.entries(data);

    if (entries.length === 0) {
      return '';
    }

    return entries
      .map(([key, val]) => {
        const formattedKey = key
          .replace(/_/g, ' ')
          .replace(/([a-z])([A-Z])/g, '$1 $2')
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');

        const isEmpty =
          val === null ||
          val === undefined ||
          (typeof val === 'string' && val.trim() === '') ||
          (Array.isArray(val) && val.length === 0) ||
          (typeof val === 'object' && !Array.isArray(val) && Object.keys(val).length === 0);

        if (isEmpty) {
          return null;
        }

        const valueContent = convertJSONToMarkdown(val, level + 1);
        const headerLevel = level === 0 ? '##' : level === 1 ? '###' : '####';

        return `${headerLevel} ${formattedKey}\n\n${valueContent}`;
      })
      .filter(Boolean)
      .join('\n\n');
  }

  return String(data);
}
