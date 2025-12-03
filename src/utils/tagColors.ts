import { TagColor } from '../lib/supabase';

export const TAG_COLORS: TagColor[] = [
  {
    name: 'Azul',
    light: '#3B82F6',
    dark: '#60A5FA',
    category: 'primary'
  },
  {
    name: 'Verde',
    light: '#10B981',
    dark: '#34D399',
    category: 'success'
  },
  {
    name: 'Vermelho',
    light: '#EF4444',
    dark: '#F87171',
    category: 'danger'
  },
  {
    name: 'Amarelo',
    light: '#F59E0B',
    dark: '#FBBF24',
    category: 'warning'
  },
  {
    name: 'Roxo',
    light: '#8B5CF6',
    dark: '#A78BFA',
    category: 'info'
  },
  {
    name: 'Rosa',
    light: '#EC4899',
    dark: '#F472B6',
    category: 'primary'
  },
  {
    name: 'Laranja',
    light: '#F97316',
    dark: '#FB923C',
    category: 'warning'
  },
  {
    name: 'Turquesa',
    light: '#14B8A6',
    dark: '#2DD4BF',
    category: 'info'
  },
  {
    name: 'Índigo',
    light: '#6366F1',
    dark: '#818CF8',
    category: 'primary'
  },
  {
    name: 'Lima',
    light: '#84CC16',
    dark: '#A3E635',
    category: 'success'
  },
  {
    name: 'Âmbar',
    light: '#D97706',
    dark: '#F59E0B',
    category: 'warning'
  },
  {
    name: 'Ciano',
    light: '#06B6D4',
    dark: '#22D3EE',
    category: 'info'
  }
];

export function getTagColorForTheme(color: string, theme: 'light' | 'dark'): string {
  const tagColor = TAG_COLORS.find(c => c.light === color || c.dark === color);
  if (!tagColor) return color;
  return theme === 'dark' ? tagColor.dark : tagColor.light;
}

export function getContrastTextColor(backgroundColor: string): string {
  const hex = backgroundColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

export function generateTagSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function isValidHexColor(color: string): boolean {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
}
