import React from 'react';
import { Check, X } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { getThemeColors } from '../../utils/themeUtils';
import { TAG_COLORS, getTagColorForTheme } from '../../utils/tagColors';

interface TagColorPickerProps {
  selectedColor: string;
  onChange: (color: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const TagColorPicker: React.FC<TagColorPickerProps> = ({
  selectedColor,
  onChange,
  isOpen,
  onClose
}) => {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);

  if (!isOpen) return null;

  const handleColorSelect = (color: string) => {
    onChange(color);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onClose}
    >
      <div
        className="rounded-lg shadow-2xl w-full max-w-sm"
        style={{ backgroundColor: colors.bgPrimary }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between p-4 border-b"
          style={{ borderColor: colors.border }}
        >
          <h3 className="text-lg font-bold" style={{ color: colors.textPrimary }}>
            Escolher Cor
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:opacity-70 transition-opacity"
            style={{ color: colors.textSecondary }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-4 gap-4">
            {TAG_COLORS.map((tagColor) => {
              const displayColor = getTagColorForTheme(tagColor.light, theme);
              const isSelected = selectedColor === tagColor.light || selectedColor === displayColor;

              return (
                <button
                  key={tagColor.name}
                  onClick={() => handleColorSelect(tagColor.light)}
                  className="group relative flex flex-col items-center gap-2"
                  title={tagColor.name}
                >
                  <div
                    className={`
                      w-12 h-12 rounded-full transition-all
                      hover:scale-110 hover:shadow-lg
                      ${isSelected ? 'ring-4 ring-white ring-opacity-50 scale-110' : ''}
                    `}
                    style={{ backgroundColor: displayColor }}
                  >
                    {isSelected && (
                      <div className="w-full h-full flex items-center justify-center">
                        <Check size={24} color="#FFFFFF" strokeWidth={3} />
                      </div>
                    )}
                  </div>
                  <span
                    className="text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: colors.textSecondary }}
                  >
                    {tagColor.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
