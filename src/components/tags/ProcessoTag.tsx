import React from 'react';
import { X } from 'lucide-react';
import { useTheme as useThemeContext } from '../../contexts/ThemeContext';
import type { ProcessoTag } from '../../lib/supabase';
import { getTagColorForTheme, getContrastTextColor } from '../../utils/tagColors';

interface ProcessoTagProps {
  tag: ProcessoTag;
  size?: 'sm' | 'md' | 'lg';
  removable?: boolean;
  onRemove?: (tagId: string) => void;
  onClick?: (tagId: string) => void;
  className?: string;
}

export const ProcessoTagComponent: React.FC<ProcessoTagProps> = ({
  tag,
  size = 'md',
  removable = false,
  onRemove,
  onClick,
  className = ''
}) => {
  const { theme } = useThemeContext();

  const backgroundColor = getTagColorForTheme(tag.color, theme);
  const textColor = getContrastTextColor(backgroundColor);

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5'
  };

  const iconSizes = {
    sm: 12,
    md: 14,
    lg: 16
  };

  const handleClick = () => {
    if (onClick) {
      onClick(tag.id);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRemove) {
      onRemove(tag.id);
    }
  };

  return (
    <span
      className={`
        inline-flex items-center gap-1 rounded-full font-medium
        transition-all duration-200
        ${onClick ? 'cursor-pointer hover:opacity-80' : ''}
        ${sizeClasses[size]}
        ${className}
      `}
      style={{
        backgroundColor,
        color: textColor
      }}
      onClick={handleClick}
    >
      <span>{tag.name}</span>
      {removable && onRemove && (
        <button
          onClick={handleRemove}
          className="hover:opacity-70 transition-opacity"
          aria-label={`Remover tag ${tag.name}`}
        >
          <X size={iconSizes[size]} />
        </button>
      )}
    </span>
  );
};
