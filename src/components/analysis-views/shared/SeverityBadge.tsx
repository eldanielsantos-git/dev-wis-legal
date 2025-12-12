import React from 'react';
import type { GravidadeNivel, UrgenciaNivel, RiscoNivel, ImpactoNivel, PrioridadeNivel } from '../../../types/analysis';

type BadgeVariant = GravidadeNivel | UrgenciaNivel | RiscoNivel | ImpactoNivel | PrioridadeNivel | string;

interface SeverityBadgeProps {
  variant: BadgeVariant;
  type: 'gravidade' | 'urgencia' | 'risco' | 'impacto' | 'prioridade' | 'categoria' | 'custo';
  className?: string;
}

function getBadgeClasses(variant: string, type: string): string {
  const lower = variant.toLowerCase();

  if (type === 'gravidade' || type === 'risco') {
    if (lower.includes('alta') || lower.includes('alto')) {
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-200 dark:border-red-700';
    }
    if (lower.includes('média') || lower.includes('media') || lower.includes('médio') || lower.includes('medio')) {
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-700';
    }
    if (lower.includes('baixa') || lower.includes('baixo')) {
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-200 dark:border-green-700';
    }
  }

  if (type === 'urgencia') {
    if (lower.includes('imediata')) {
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-200 dark:border-red-700';
    }
    if (lower.includes('próxima') || lower.includes('proxima')) {
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-700';
    }
    return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-700';
  }

  if (type === 'impacto') {
    if (lower.includes('direto')) {
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-200 dark:border-red-700';
    }
    if (lower.includes('indireto')) {
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-700';
    }
    return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-700';
  }

  if (type === 'prioridade') {
    if (lower.includes('secundária') || lower.includes('secundaria')) {
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-700';
    }
    if (lower.includes('contingente')) {
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-700';
    }
    if (lower.includes('oportunista')) {
      return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200 border-cyan-200 dark:border-cyan-700';
    }
  }

  if (type === 'custo') {
    if (lower.includes('baixo')) {
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-200 dark:border-green-700';
    }
    if (lower.includes('médio') || lower.includes('medio')) {
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-700';
    }
    if (lower.includes('alto')) {
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 border-orange-200 dark:border-orange-700';
    }
  }

  return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 border-gray-200 dark:border-theme-border';
}

export function SeverityBadge({ variant, type, className = '' }: SeverityBadgeProps) {
  const badgeClasses = getBadgeClasses(variant, type);

  return (
    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded border ${badgeClasses} ${className}`}>
      {variant}
    </span>
  );
}
