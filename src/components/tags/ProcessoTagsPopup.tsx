import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { getThemeColors } from '../../utils/themeUtils';
import type { ProcessoTag } from '../../lib/supabase';
import { ProcessoTagComponent } from './ProcessoTag';
import { ProcessoTagsService } from '../../services/ProcessoTagsService';
import { ProcessoTagAssignmentsService } from '../../services/ProcessoTagAssignmentsService';

interface ProcessoTagsPopupProps {
  isOpen: boolean;
  onClose: () => void;
  tags: ProcessoTag[];
  processoId?: string;
  onTagsUpdated?: () => void;
}

export const ProcessoTagsPopup: React.FC<ProcessoTagsPopupProps> = ({
  isOpen,
  onClose,
  tags,
  processoId,
  onTagsUpdated
}) => {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [availableTags, setAvailableTags] = useState<ProcessoTag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const isEditable = !!processoId;

  useEffect(() => {
    if (isOpen) {
      loadAvailableTags();
      setSelectedTagIds(new Set(tags.map(t => t.id)));
    }
  }, [isOpen, tags]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const loadAvailableTags = async () => {
    setLoading(true);
    try {
      const allTags = await ProcessoTagsService.getAllTags();
      setAvailableTags(allTags);
    } catch (error) {
      console.error('Erro ao carregar tags:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleTag = (tagId: string) => {
    if (!isEditable) return;

    const newSelectedIds = new Set(selectedTagIds);
    if (newSelectedIds.has(tagId)) {
      newSelectedIds.delete(tagId);
    } else {
      newSelectedIds.add(tagId);
    }
    setSelectedTagIds(newSelectedIds);
  };

  const handleSave = async () => {
    if (!processoId) return;

    setSaving(true);
    try {
      await ProcessoTagAssignmentsService.replaceProcessoTags(
        processoId,
        Array.from(selectedTagIds)
      );

      if (onTagsUpdated) {
        onTagsUpdated();
      }

      onClose();
    } catch (error) {
      console.error('Erro ao salvar tags:', error);
      alert('Erro ao salvar tags. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const modalBg = theme === 'dark' ? '#FFFFFF' : '#1a1a1a';
  const modalTextPrimary = theme === 'dark' ? '#1a1a1a' : '#FFFFFF';
  const modalTextSecondary = theme === 'dark' ? '#4B5563' : '#9CA3AF';
  const modalBorder = theme === 'dark' ? '#E5E7EB' : '#374151';
  const modalBgSecondary = theme === 'dark' ? '#F3F4F6' : '#2d2d2d';
  const modalCancelBg = theme === 'dark' ? '#F3F4F6' : '#374151';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onClose}
    >
      <div
        className="rounded-lg shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
        style={{ backgroundColor: modalBg }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between p-4 border-b"
          style={{ borderColor: modalBorder }}
        >
          <h2 className="text-lg font-bold" style={{ color: modalTextPrimary }}>
            Tags do Processo
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:opacity-70 transition-opacity"
            style={{ color: modalTextSecondary }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-8" style={{ color: modalTextSecondary }}>
              Carregando tags...
            </div>
          ) : availableTags.length === 0 ? (
            <div className="text-center py-8" style={{ color: modalTextSecondary }}>
              Nenhuma tag disponível
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {availableTags.map((tag) => (
                <div
                  key={tag.id}
                  className={`
                    flex items-center gap-2 p-3 rounded-lg border-2 transition-all
                    ${isEditable ? 'cursor-pointer hover:opacity-80' : ''}
                  `}
                  style={{
                    backgroundColor: modalBgSecondary,
                    borderColor: selectedTagIds.has(tag.id) ? tag.color : 'transparent'
                  }}
                  onClick={() => toggleTag(tag.id)}
                >
                  {isEditable && (
                    <input
                      type="checkbox"
                      checked={selectedTagIds.has(tag.id)}
                      onChange={() => toggleTag(tag.id)}
                      className="w-4 h-4"
                      style={{ accentColor: tag.color }}
                    />
                  )}
                  <ProcessoTagComponent tag={tag} size="sm" />
                </div>
              ))}
            </div>
          )}
        </div>

        {isEditable && (
          <div
            className="flex items-center justify-end gap-3 p-4 border-t"
            style={{ borderColor: modalBorder }}
          >
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg font-medium transition-opacity hover:opacity-80"
              style={{
                backgroundColor: modalCancelBg,
                color: modalTextPrimary
              }}
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-lg font-medium transition-opacity hover:opacity-80"
              style={{
                backgroundColor: colors.accent,
                color: '#FFFFFF'
              }}
              disabled={saving}
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
