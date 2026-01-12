export function isArray<T>(value: unknown): value is T[] {
  return Array.isArray(value);
}

export function isNonEmptyArray<T>(value: unknown): value is T[] {
  return Array.isArray(value) && value.length > 0;
}

export function ensureArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

export function safeToString(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

export function safeToNumber(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const num = parseFloat(value);
    return isNaN(num) ? undefined : num;
  }
  return undefined;
}

export function hasProperty<K extends string>(
  obj: unknown,
  key: K
): obj is Record<K, unknown> {
  return typeof obj === 'object' && obj !== null && key in obj;
}

export function safeExtractString(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if ('status' in obj && typeof obj.status === 'string') {
      return obj.status;
    }
    if ('nome' in obj && typeof obj.nome === 'string') {
      return obj.nome;
    }
    if ('valor' in obj && typeof obj.valor === 'string') {
      return obj.valor;
    }
    if ('texto' in obj && typeof obj.texto === 'string') {
      return obj.texto;
    }
    if ('descricao' in obj && typeof obj.descricao === 'string') {
      return obj.descricao;
    }
    const values = Object.values(obj);
    const firstString = values.find(v => typeof v === 'string');
    if (firstString && typeof firstString === 'string') {
      return firstString;
    }
  }
  return '';
}
