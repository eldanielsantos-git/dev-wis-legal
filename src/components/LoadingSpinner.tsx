import React, { useMemo } from 'react';
import { Loader } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
}

export function LoadingSpinner({ size = 'md', color }: LoadingSpinnerProps = {}) {
  const { theme } = useTheme();
  const colors = useMemo(() => getThemeColors(theme), [theme]);

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16'
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: colors.bgPrimary }}
    >
      <Loader
        className={`${sizeClasses[size]} animate-spin`}
        style={{ color: color || colors.textPrimary }}
      />
    </div>
  );
}

interface ChatLoadingDotsProps {
  theme?: 'light' | 'dark';
}

export function ChatLoadingDots({ theme = 'dark' }: ChatLoadingDotsProps) {
  const dotColor = theme === 'dark' ? '#FFFFFF' : '#255886';
  const textColor = theme === 'dark' ? '#FFFFFF' : '#141312';

  return (
    <div className="flex items-center space-x-3">
      <span className="text-sm font-medium" style={{ color: textColor }}>
        Analisando sua pergunta
      </span>
      <div className="flex space-x-2 items-center h-6">
        <div
          className="w-2.5 h-2.5 rounded-full"
          style={{
            backgroundColor: dotColor,
            animation: 'bounce 0.6s ease-in-out infinite',
            animationDelay: '0ms'
          }}
        />
        <div
          className="w-2.5 h-2.5 rounded-full"
          style={{
            backgroundColor: dotColor,
            animation: 'bounce 0.6s ease-in-out infinite',
            animationDelay: '100ms'
          }}
        />
        <div
          className="w-2.5 h-2.5 rounded-full"
          style={{
            backgroundColor: dotColor,
            animation: 'bounce 0.6s ease-in-out infinite',
            animationDelay: '200ms'
          }}
        />
      </div>
      <style>{`
        @keyframes bounce {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-12px);
          }
        }
      `}</style>
    </div>
  );
}