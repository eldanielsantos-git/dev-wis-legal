import React from 'react';
import { Loader } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
}

export function LoadingSpinner({ size = 'md', color }: LoadingSpinnerProps = {}) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Carregando...</p>
      </div>
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