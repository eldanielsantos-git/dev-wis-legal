import React, { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  fileName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDeleteModal({ isOpen, fileName, onConfirm, onCancel }: ConfirmDeleteModalProps) {
  const { theme } = useTheme();
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        onConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onConfirm, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-40 backdrop-blur-sm">
      <div
        className="relative w-full max-w-sm rounded-xl p-5 shadow-2xl border"
        style={{
          backgroundColor: theme === 'dark' ? '#1a1d21' : '#FFFFFF',
          borderColor: theme === 'dark' ? '#374151' : '#E5E7EB'
        }}
      >
        <button
          onClick={onCancel}
          className="absolute top-3 right-3 p-1 rounded transition-colors"
          style={{
            color: theme === 'dark' ? '#9CA3AF' : '#6B7280'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = theme === 'dark' ? '#374151' : '#F3F4F6';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
          aria-label="Fechar"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="mb-5 pr-6">
          <h2
            className="text-base font-semibold mb-3"
            style={{ color: theme === 'dark' ? '#FFFFFF' : '#111827' }}
          >
            Tem certeza que deseja excluir o processo?
          </h2>
          <p
            className="text-sm mb-2 break-words"
            style={{ color: theme === 'dark' ? '#9CA3AF' : '#6B7280' }}
          >
            {fileName}
          </p>
          <p className="text-xs" style={{ color: '#EF4444' }}>
            Esta ação é irreversível
          </p>
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              color: theme === 'dark' ? '#D1D5DB' : '#374151',
              backgroundColor: theme === 'dark' ? '#374151' : '#E5E7EB'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = theme === 'dark' ? '#4B5563' : '#D1D5DB';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = theme === 'dark' ? '#374151' : '#E5E7EB';
            }}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors text-white"
            style={{ backgroundColor: '#DC2626' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#B91C1C';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#DC2626';
            }}
          >
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
}
