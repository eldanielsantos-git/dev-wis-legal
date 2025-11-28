export function safeToString(value: any): string {
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
    if (value.arquivo && typeof value.arquivo === 'string') {
      return value.arquivo;
    }
    if (Array.isArray(value)) {
      return value.map(v => safeToString(v)).join(', ');
    }
    return JSON.stringify(value);
  }
  return String(value);
}
