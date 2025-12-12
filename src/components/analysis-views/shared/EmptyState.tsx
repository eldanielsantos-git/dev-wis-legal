import React from 'react';
import { FileText } from 'lucide-react';

interface EmptyStateProps {
  message?: string;
  icon?: React.ReactNode;
}

export function EmptyState({ message = 'Nenhum dado disponível', icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 bg-theme-bg-tertiary border border-theme-border rounded-lg">
      {icon || <FileText className="w-12 h-12 text-theme-text-secondary opacity-50 mb-3" />}
      <p className="text-theme-text-secondary text-sm">{message}</p>
    </div>
  );
}
