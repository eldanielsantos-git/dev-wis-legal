export interface JsonValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedContent?: string;
  isEmpty: boolean;
  isTruncated: boolean;
}

export function validateAndSanitizeJson(content: string): JsonValidationResult {
  if (!content || content.trim().length === 0) {
    return {
      isValid: false,
      isEmpty: true,
      isTruncated: false,
      error: 'Conteúdo vazio',
    };
  }

  const trimmedContent = content.trim();

  try {
    JSON.parse(trimmedContent);
    return {
      isValid: true,
      isEmpty: false,
      isTruncated: false,
      sanitizedContent: trimmedContent,
    };
  } catch (error) {
    const openBraces = (trimmedContent.match(/{/g) || []).length;
    const closeBraces = (trimmedContent.match(/}/g) || []).length;
    const openBrackets = (trimmedContent.match(/\[/g) || []).length;
    const closeBrackets = (trimmedContent.match(/]/g) || []).length;

    const missingCloseBraces = openBraces - closeBraces;
    const missingCloseBrackets = openBrackets - closeBrackets;

    if (missingCloseBraces > 0 || missingCloseBrackets > 0) {
      let fixedContent = trimmedContent;

      if (fixedContent.endsWith(',')) {
        fixedContent = fixedContent.slice(0, -1);
      }

      for (let i = 0; i < missingCloseBrackets; i++) {
        fixedContent += '\n]';
      }

      for (let i = 0; i < missingCloseBraces; i++) {
        fixedContent += '\n}';
      }

      try {
        JSON.parse(fixedContent);
        return {
          isValid: true,
          isEmpty: false,
          isTruncated: true,
          sanitizedContent: fixedContent,
          error: 'JSON truncado foi reparado automaticamente',
        };
      } catch {
        return {
          isValid: false,
          isEmpty: false,
          isTruncated: true,
          error: 'JSON truncado não pôde ser reparado automaticamente',
        };
      }
    }

    return {
      isValid: false,
      isEmpty: false,
      isTruncated: false,
      error: 'JSON inválido',
    };
  }
}

export function countJsonStructures(content: string): {
  openBraces: number;
  closeBraces: number;
  openBrackets: number;
  closeBrackets: number;
} {
  return {
    openBraces: (content.match(/{/g) || []).length,
    closeBraces: (content.match(/}/g) || []).length,
    openBrackets: (content.match(/\[/g) || []).length,
    closeBrackets: (content.match(/]/g) || []).length,
  };
}
