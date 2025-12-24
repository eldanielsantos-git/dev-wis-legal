export function getBrazilDate(): Date {
  const now = new Date();
  const brazilOffset = -3 * 60;
  const localOffset = now.getTimezoneOffset();
  const diff = localOffset - brazilOffset;

  return new Date(now.getTime() - diff * 60 * 1000);
}

export function getBrazilDateString(): string {
  const brazilDate = getBrazilDate();
  const year = brazilDate.getFullYear();
  const month = String(brazilDate.getMonth() + 1).padStart(2, '0');
  const day = String(brazilDate.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function isTodayBrazil(date: Date): boolean {
  const today = getBrazilDate();
  return date.getDate() === today.getDate() &&
         date.getMonth() === today.getMonth() &&
         date.getFullYear() === today.getFullYear();
}

export function formatDateBrazil(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo'
  });
}
