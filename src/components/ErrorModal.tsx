import React, { useEffect } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { playErrorSound } from '../utils/notificationSound';

interface ErrorModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onClose: () => void;
  autoPlaySound?: boolean;
}

export const ErrorModal: React.FC<ErrorModalProps> = ({
  isOpen,
  title,
  message,
  onClose,
  autoPlaySound = true
}) => {
  const { theme } = useTheme();

  useEffect(() => {
    if (isOpen && autoPlaySound) {
      playErrorSound();
    }
  }, [isOpen, autoPlaySound]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-xl shadow-2xl animate-fade-in"
        style={{
          backgroundColor: theme === 'dark' ? '#1F2229' : '#FFFFFF',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <div
                className="p-3 rounded-full"
                style={{ backgroundColor: theme === 'dark' ? '#FAFAFA' : 'rgba(239, 68, 68, 0.1)' }}
              >
                <AlertCircle className="w-6 h-6" style={{ color: theme === 'dark' ? '#0F0E0D' : '#EF4444' }} />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h3
                className="text-lg font-semibold mb-2"
                style={{ color: theme === 'dark' ? '#FFFFFF' : '#111827' }}
              >
                {title}
              </h3>
              <p
                className="text-sm leading-relaxed"
                style={{ color: theme === 'dark' ? '#9CA3AF' : '#6B7280' }}
              >
                {message}
              </p>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 p-1 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
              style={{ color: theme === 'dark' ? '#9CA3AF' : '#6B7280' }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div
          className="px-6 py-4 rounded-b-xl"
          style={{
            backgroundColor: theme === 'dark' ? 'rgba(31, 34, 41, 0.5)' : 'rgba(249, 250, 251, 1)',
            borderTop: `1px solid ${theme === 'dark' ? 'rgba(75, 85, 99, 0.3)' : 'rgba(229, 231, 235, 1)'}`,
          }}
        >
          <button
            onClick={onClose}
            className="w-full px-4 py-2 rounded-lg font-medium transition-all"
            style={{
              backgroundColor: '#EF4444',
              color: '#FFFFFF',
            }}
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
};
