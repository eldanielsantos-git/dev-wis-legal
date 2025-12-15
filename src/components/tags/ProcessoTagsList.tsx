import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { getThemeColors } from '../../utils/themeUtils';
import type { ProcessoTag } from '../../lib/supabase';
import { ProcessoTagComponent } from './ProcessoTag';
import { ProcessoTagsPopup } from './ProcessoTagsPopup';
import { ReadOnlyPermissionModal } from '../ReadOnlyPermissionModal';

interface ProcessoTagsListProps {
  processoId: string;
  tags: ProcessoTag[];
  maxVisible?: number;
  editable?: boolean;
  onTagsChange?: () => void;
  isReadOnly?: boolean;
}

export const ProcessoTagsList: React.FC<ProcessoTagsListProps> = ({
  processoId,
  tags,
  maxVisible = 3,
  editable = false,
  onTagsChange,
  isReadOnly = false
}) => {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [showReadOnlyModal, setShowReadOnlyModal] = useState(false);

  const visibleTags = tags.slice(0, maxVisible);
  const hiddenCount = Math.max(0, tags.length - maxVisible);

  const handleOpenPopup = () => {
    if (isReadOnly) {
      setShowReadOnlyModal(true);
    } else {
      setIsPopupOpen(true);
    }
  };

  const handleClosePopup = () => {
    setIsPopupOpen(false);
    if (onTagsChange) {
      onTagsChange();
    }
  };

  if (tags.length === 0 && !editable) {
    return null;
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {visibleTags.map((tag) => (
          <ProcessoTagComponent key={tag.id} tag={tag} size="sm" />
        ))}

        {hiddenCount > 0 && (
          <button
            onClick={handleOpenPopup}
            className="text-xs px-2 py-0.5 rounded-full transition-opacity hover:opacity-80"
            style={{
              backgroundColor: colors.bgSecondary,
              color: colors.textSecondary
            }}
          >
            +{hiddenCount}
          </button>
        )}

        {editable && (
          <button
            onClick={handleOpenPopup}
            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full transition-all hover:opacity-80"
            style={{
              backgroundColor: colors.bgSecondary,
              color: colors.textPrimary
            }}
          >
            <Plus size={12} />
            <span>Gerenciar</span>
          </button>
        )}
      </div>

      <ProcessoTagsPopup
        isOpen={isPopupOpen}
        onClose={handleClosePopup}
        tags={tags}
        processoId={editable ? processoId : undefined}
        onTagsUpdated={onTagsChange}
      />

      <ReadOnlyPermissionModal
        isOpen={showReadOnlyModal}
        onClose={() => setShowReadOnlyModal(false)}
      />
    </>
  );
};
