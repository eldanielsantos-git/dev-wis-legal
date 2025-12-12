import React from 'react';

interface SectionHeaderProps {
  title: string;
  level?: 1 | 2 | 3;
  className?: string;
}

export function SectionHeader({ title, level = 2, className = '' }: SectionHeaderProps) {
  if (level === 1) {
    return (
      <h1 className={`text-2xl font-bold text-theme-text-primary ${className}`}>
        {title}
      </h1>
    );
  }

  if (level === 2) {
    return (
      <h2 className={`text-lg font-semibold text-theme-text-primary border-b border-theme-border pb-2 mb-4 ${className}`}>
        {title}
      </h2>
    );
  }

  return (
    <h3 className={`text-base font-semibold text-theme-text-primary ${className}`}>
      {title}
    </h3>
  );
}
