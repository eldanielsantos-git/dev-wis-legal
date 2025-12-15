import React from 'react';
import { Lock } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';

interface ReadOnlyPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReadOnlyPermissionModal: React.FC<ReadOnlyPermissionModalProps> = ({
  isOpen,
  onClose
}) => {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);

  if (!isOpen) return null;

  const modalBg = theme === 'light' ? '#FFFFFF' : '#1F2937';
  const modalTextPrimary = theme === 'light' ? '#111827' : '#F9FAFB';
  const modalTextSecondary = theme === 'light' ? '#6B7280' : '#9CA3AF';
  const modalBorder = theme === 'light' ? '#E5E7EB' : '#374151';
  const buttonBg = theme === 'light' ? '#111827' : '#F9FAFB';
  const buttonText = theme === 'light' ? '#FFFFFF' : '#111827';
  const iconColor = theme === 'light' ? '#F59E0B' : '#FBBF24';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onClose}
    >
      <div
        className="rounded-lg shadow-2xl w-full max-w-md"
        style={{ backgroundColor: modalBg }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex flex-col items-center gap-4 p-6 border-b"
          style={{ borderColor: modalBorder }}
        >
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ backgroundColor: `${iconColor}20` }}
          >
            <Lock size={32} style={{ color: iconColor }} />
          </div>
          <h2 className="text-xl font-bold text-center" style={{ color: modalTextPrimary }}>
            Workspace
          </h2>
        </div>

        <div className="p-6">
          <p
            className="text-center leading-relaxed"
            style={{ color: modalTextSecondary }}
          >
            Você tem permissão de leitor para editar e ter acesso em mais funcionalidades solicite ao proprietário do processo a permissão de editor.
          </p>
        </div>

        <div className="flex items-center justify-center p-6 border-t" style={{ borderColor: modalBorder }}>
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-lg font-medium transition-opacity hover:opacity-80 min-w-[120px]"
            style={{
              backgroundColor: buttonBg,
              color: buttonText
            }}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};
