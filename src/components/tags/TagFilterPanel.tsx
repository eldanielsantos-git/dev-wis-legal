import React from 'react';
import { X } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { getThemeColors } from '../../utils/themeUtils';
import type { ProcessoTag } from '../../lib/supabase';
import { ProcessoTagComponent } from './ProcessoTag';

interface TagFilterPanelProps {
  isOpen: boolean;
  availableTags: ProcessoTag[];
  selectedTagIds: string[];
  onTagsChange: (tagIds: string[]) => void;
  onClose: () => void;
  tagCounts?: Map<string, number>;
}

export const TagFilterPanel: React.FC<TagFilterPanelProps> = ({
  isOpen,
  availableTags,
  selectedTagIds,
  onTagsChange,
  onClose,
  tagCounts
}) => {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);

  const toggleTag = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onTagsChange(selectedTagIds.filter(id => id !== tagId));
    } else {
      onTagsChange([...selectedTagIds, tagId]);
    }
  };

  const clearFilters = () => {
    onTagsChange([]);
  };

  const handleApply = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
        onClick={onClose}
      />

      <div
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md shadow-2xl flex flex-col animate-slide-in-right"
        style={{ backgroundColor: colors.bgPrimary }}
      >
        <div
          className="flex items-center justify-between p-4 border-b"
          style={{ borderColor: colors.border }}
        >
          <h2 className="text-lg font-bold" style={{ color: colors.textPrimary }}>
            Filtrar por Tags
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:opacity-70 transition-opacity"
            style={{ color: colors.textSecondary }}
          >
            <X size={20} />
          </button>
        </div>

        {selectedTagIds.length > 0 && (
          <div
            className="p-4 border-b"
            style={{ borderColor: colors.border }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium" style={{ color: colors.textSecondary }}>
                Tags selecionadas ({selectedTagIds.length})
              </span>
              <button
                onClick={clearFilters}
                className="text-xs px-2 py-1 rounded hover:opacity-80"
                style={{
                  backgroundColor: colors.bgSecondary,
                  color: colors.textSecondary
                }}
              >
                Limpar
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedTagIds.map(tagId => {
                const tag = availableTags.find(t => t.id === tagId);
                if (!tag) return null;
                return (
                  <ProcessoTagComponent
                    key={tag.id}
                    tag={tag}
                    size="sm"
                    removable
                    onRemove={toggleTag}
                  />
                );
              })}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {availableTags.map((tag) => {
              const isSelected = selectedTagIds.includes(tag.id);
              const count = tagCounts?.get(tag.id) || 0;

              return (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.id)}
                  className={`
                    w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all
                    hover:opacity-80
                  `}
                  style={{
                    backgroundColor: colors.bgSecondary,
                    borderColor: isSelected ? tag.color : 'transparent'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleTag(tag.id)}
                    className="w-4 h-4"
                    style={{ accentColor: tag.color }}
                  />
                  <ProcessoTagComponent tag={tag} size="sm" />
                  <span
                    className="ml-auto text-xs px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: colors.bgTertiary,
                      color: colors.textSecondary
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {availableTags.length === 0 && (
            <div className="text-center py-8" style={{ color: colors.textSecondary }}>
              Nenhuma tag disponível
            </div>
          )}
        </div>

        <div
          className="flex items-center justify-end gap-3 p-4 border-t"
          style={{ borderColor: colors.border }}
        >
          <button
            onClick={clearFilters}
            className="px-4 py-2 rounded-lg font-medium transition-opacity hover:opacity-80"
            style={{
              backgroundColor: colors.bgSecondary,
              color: colors.textPrimary
            }}
          >
            Limpar Filtros
          </button>
          <button
            onClick={handleApply}
            className="px-4 py-2 rounded-lg font-medium transition-opacity hover:opacity-80"
            style={{
              backgroundColor: colors.accent,
              color: '#FFFFFF'
            }}
          >
            Aplicar
          </button>
        </div>
      </div>
    </>
  );
};
